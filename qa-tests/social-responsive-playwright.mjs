import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const base = process.env.QA_ORIGIN;
if (!base) throw new Error("QA_ORIGIN is required");
const origin = new URL(base).origin;
const widths = [320,360,390,430,560,768,1024,1440];
const outDir = path.resolve("qa-ui-artifacts");
fs.mkdirSync(outDir,{recursive:true});
const report = { url:base, widths, results:[], checks:[], errors:[] };
function assert(ok,message){ if(!ok) throw new Error(message); }
function pass(name,detail){ report.checks.push({name,status:"passed",detail:detail||""}); console.log("PASS",name,detail||""); }

const browser = await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
const page = await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
page.on("pageerror",e=>report.errors.push(e.message));
try {
  await page.goto(base,{waitUntil:"domcontentloaded",timeout:60000});
  await page.waitForSelector("#authGate",{timeout:30000});

  assert((await page.locator(".qa-banner").textContent()).includes("SEPARATE DATABASE"),"QA banner missing");
  for (const asset of ["logo.png","background-desktop.png","background-mobile.png"]) {
    const response = await page.request.get(origin+"/"+asset);
    assert(response.ok(),asset+" failed to load");
  }
  assert(await page.locator("#connectSocialBrowser").isVisible(),"browser connect button missing");
  assert(await page.locator("#connectSocialWallet").isVisible(),"wallet-browser connect button missing");
  pass("QA gate and shared visual assets load");

  assert(await page.locator(".fi-global-bottom-nav [aria-current='page']").count()===1,"global nav must have exactly one active item");
  assert(await page.locator(".fi-bottom-nav-dashboard").getAttribute("aria-current")===null,"Dashboard should not be the current page on Social");
  assert(await page.locator(".fi-bottom-nav-media").getAttribute("href")===origin+"/creator-arena-qa/index.html","Social nav target is not the QA page");
  pass("global navigation destination and active state");

  for (const width of widths) {
    await page.setViewportSize({width,height:844});
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.waitForTimeout(60);
    const gate = await page.evaluate(()=>{
      const selectors=[".topbar",".brand","#langBtn","#authGate","#connectSocialBrowser","#connectSocialWallet",".fi-global-bottom-nav",".fi-bottom-nav-media",".fi-bottom-nav-dashboard"];
      const boxes={};
      for(const selector of selectors){
        const el=document.querySelector(selector);if(!el)continue;
        const r=el.getBoundingClientRect();
        boxes[selector]={left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};
      }
      const bg=getComputedStyle(document.body,"::before").backgroundImage;
      return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,boxes,background:bg.includes("background-mobile.png")?"mobile":bg.includes("background-desktop.png")?"desktop":"unknown"};
    });
    assert(gate.scrollWidth<=gate.clientWidth+1,"horizontal overflow at gate width "+width);
    for(const item of Object.entries(gate.boxes)){
      const box=item[1];
      if(box.width>0&&box.height>0)assert(box.left>=-1&&box.right<=width+1,"element clipped at "+width+"px: "+item[0]);
    }
    assert(width<=768?gate.background==="mobile":gate.background==="desktop","wrong background asset at "+width+"px");

    await page.evaluate(()=>{
      document.querySelector("#authGate").hidden=true;
      document.querySelector("#feedApp").hidden=false;
      window.scrollTo(0,0);
    });
    const feed = await page.evaluate(()=>{
      const get=selector=>{
        const el=document.querySelector(selector);if(!el)return null;
        const r=el.getBoundingClientRect();
        return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,position:getComputedStyle(el).position};
      };
      return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,inner:get(".social-nav"),global:get(".fi-global-bottom-nav")};
    });
    assert(feed.scrollWidth<=feed.clientWidth+1,"horizontal overflow in feed layout at "+width+"px");
    assert(feed.global&&feed.global.bottom<=845,"global nav outside viewport at "+width+"px");
    if(width<=560&&feed.inner&&feed.inner.width>0){
      assert(feed.inner.position==="sticky","Social inner nav is not sticky on mobile at "+width+"px");
      assert(feed.inner.bottom<feed.global.top||feed.inner.top>feed.global.bottom,"Social and global nav overlap at "+width+"px");
    }
    report.results.push({gate,feed});
    const shot=path.join(outDir,"social-"+width+".png");
    await page.screenshot({path:shot,fullPage:true});
    pass("responsive layout "+width+"px","background "+gate.background+", inner nav "+(feed.inner?.position||"not shown"));
    await page.evaluate(()=>{
      document.querySelector("#feedApp").hidden=true;
      document.querySelector("#authGate").hidden=false;
    });
  }

  await page.setViewportSize({width:390,height:844});
  await page.locator("#langBtn").click();
  assert(await page.locator("#langDropdown .lang-item").count()===8,"expected 8 language options");
  const layers=await page.evaluate(()=>({
    menu:Number(getComputedStyle(document.querySelector("#langDropdown")).zIndex),
    nav:Number(getComputedStyle(document.querySelector(".fi-global-bottom-nav")).zIndex)
  }));
  assert(layers.menu>layers.nav,"language dropdown would be covered by bottom navigation");
  const languages=["en","fa","ar","tr","ru","zh","es","pt"];
  for(const lang of languages){
    await page.locator("#langBtn").click();
    await page.locator("#langDropdown [data-lang='"+lang+"']").click();
    const dir=await page.locator("html").getAttribute("dir");
    assert((lang==="fa"||lang==="ar")?dir==="rtl":dir==="ltr","incorrect text direction for "+lang);
  }
  await page.locator("#langBtn").click();
  await page.keyboard.press("Escape");
  assert(!(await page.locator("#langDropdown").getAttribute("class")).includes("open"),"Escape did not close language menu");
  pass("all 8 languages, RTL/LTR, dropdown layering and Escape");

  assert(report.errors.length===0,"uncaught browser errors: "+report.errors.join(" | "));
  pass("no uncaught JavaScript errors");
} catch(error) {
  report.errors.push(String(error?.message||error));
  console.error("RESPONSIVE_QA_FAILURE",error);
  process.exitCode=1;
} finally {
  fs.writeFileSync(path.join(outDir,"responsive-report.json"),JSON.stringify(report,null,2));
  console.log("RESPONSIVE_QA_REPORT",JSON.stringify(report,null,2));
  await page.close().catch(()=>{});
  await browser.close().catch(()=>{});
}
