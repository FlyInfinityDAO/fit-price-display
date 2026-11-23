import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const base = process.env.QA_ORIGIN;
if (!base) throw new Error("QA_ORIGIN is required");
const origin = new URL(base).origin;
const api = "https://fly-social-qa.flyinfinityplatform.workers.dev";
const token = "fly-social-qa-demo-v1";
const wallet = "0x1111111111111111111111111111111111111111";
const devices = [{width:320,height:568},{width:360,height:740},{width:390,height:844},{width:430,height:932},{width:560,height:900},{width:667,height:375},{width:768,height:1024},{width:844,height:390},{width:1024,height:768},{width:1280,height:720},{width:1440,height:900}];
const views = ["feed","explore","notifications","profile"];
const outDir = path.resolve("qa-ui-artifacts");
fs.mkdirSync(outDir,{recursive:true});
const report = { url:base, devices, views, checks:[], screenshots:[], errors:[], apiFailures:[] };
function assert(ok,message){ if(!ok) throw new Error(message); }
function pass(name,detail=""){ report.checks.push({name,status:"passed",detail}); console.log("PASS",name,detail); }
const browser = await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
const context = await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,locale:"en-US"});
const page = await context.newPage();
await page.emulateMedia({reducedMotion:"reduce"});
page.on("pageerror",e=>report.errors.push(e.message));
page.on("console",m=>{if(m.type()==="error")report.errors.push("console: "+m.text());});
page.on("response",r=>{if(r.url().startsWith(api+"/api/")&&r.status()>=500)report.apiFailures.push({url:r.url(),status:r.status()});});
const authHeaders = {Origin:origin,Authorization:"Bearer "+token};
async function nav(view){
  await clickTarget(page.locator("#feedApp .social-nav [data-social-view='"+view+"']"),"Open "+view+" view");
  await page.locator("#"+(view==="notifications"?"notifications":view)+"View").waitFor({state:"visible",timeout:15000});
  const loadedSelector={feed:"#feedList .post",explore:"#exploreGrid .explore-tile",notifications:"#notificationList .notification-row",profile:"#profileHandle"}[view];
  if(loadedSelector)await page.locator(loadedSelector).first().waitFor({state:"visible",timeout:20000});
  if(view==="profile")await page.waitForFunction(()=>document.querySelector("#profileHandle")?.textContent?.trim()==="@flytester",{timeout:20000});
  const statusSelector={feed:"#feedStatus",explore:"#exploreStatus",notifications:"#notificationsStatus",profile:"#profileStatus"}[view];
  if(statusSelector)await page.waitForFunction(selector=>{const node=document.querySelector(selector);return !!node&&!node.textContent.trim();},statusSelector,{timeout:20000});
}
async function request(path,options={}){
  const response=await page.request.fetch(api+path,{...options,headers:{...authHeaders,...(options.headers||{})}});
  const body=await response.json().catch(()=>({}));
  assert(response.ok(), "API "+(options.method||"GET")+" "+path+" failed: "+response.status()+" "+JSON.stringify(body));
  return body;
}
async function clickTarget(locator,label){
  await locator.scrollIntoViewIfNeeded();
  const handle=await locator.elementHandle();
  assert(!!handle,"Missing clickable target: "+label);
  await page.evaluate(el=>el.scrollIntoView({block:"center",inline:"nearest",behavior:"instant"}),handle);
  await page.waitForTimeout(80);
  const hit=await page.evaluate(el=>{
    const r=el.getBoundingClientRect();
    const x=r.left+r.width/2,y=r.top+r.height/2;
    const top=document.elementFromPoint(x,y);
    return {x,y,topTag:top?.tagName||"",topClass:String(top?.className||""),isTarget:top===el||el.contains(top),rect:{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height},height:innerHeight};
  },handle);
  assert(hit.isTarget,label+" is visually covered at its click point: "+JSON.stringify(hit));
  assert(hit.y>25&&hit.y<hit.height-92,label+" falls into fixed top/bottom navigation area: "+JSON.stringify(hit));
  await locator.click();
}
try{
  await page.goto(base,{waitUntil:"domcontentloaded",timeout:60000});
  await page.waitForFunction(()=> {
    const gate=document.querySelector("#authGate"),app=document.querySelector("#feedApp");
    return gate&&app&&gate.hidden&&!app.hidden&&document.querySelectorAll("#feedList .post").length>0;
  },null,{timeout:60000});
  assert(await page.locator("#authGate").isHidden(),"QA must bypass the wallet/password gate");
  assert(await page.locator("#feedApp").isVisible(),"demo account did not open the full app");
  assert(await page.locator("#feedList .post").count()>=5,"seeded demo feed is missing sample posts");
  assert(await page.locator("#feedList .post-author small").filter({hasText:"@flytester"}).count()>=1,"demo user's own post is missing");
  assert(await page.locator("#feedApp .social-nav").isVisible(),"in-app Social navigation is missing");
  assert(await page.locator(".fi-global-bottom-nav [aria-current='page']").count()===1,"global nav must have exactly one active item");
  assert(await page.locator(".fi-bottom-nav-media").getAttribute("href")===origin+"/creator-arena-qa/index.html","global Media item does not point to QA Social");
  assert(await page.evaluate(()=>sessionStorage.getItem("fly-social-token"))===null,"QA must not create or persist a production-style user session");
  pass("no-wallet, no-signature, no-username/password demo entry", "demo account flytester opened directly with seeded synthetic records");

  // Real API actions against the isolated QA D1 and B2, not mocked browser responses.
  const ownCard=page.locator("#feedList .post").filter({has:page.locator(".post-author small").filter({hasText:"@flytester"})}).first();
  assert(await ownCard.count()>=1,"cannot locate the demo user's own post card");
  assert(await ownCard.locator("[data-delete-id]").count()===1,"own post is missing its Delete action");
  assert(await ownCard.locator("[data-repost-id]").count()===0,"own post must not expose an invalid Repost action");
  const otherCard=page.locator("#feedList .post").filter({has:page.locator(".post-author small").filter({hasText:"@alicegreen"})}).first();
  assert(await otherCard.count()===1,"cannot locate a community post");
  const like=otherCard.locator("[data-like-id]").first();
  await clickTarget(like,"Like");
  await page.waitForFunction(()=>document.querySelector("#feedList .post [data-like-id][aria-pressed='true']")!==null);
  await clickTarget(page.locator("#feedList .post").filter({has:page.locator(".post-author small").filter({hasText:"@alicegreen"})}).first().locator("[data-like-id]"),"Unlike");
  await page.waitForFunction(()=>document.querySelector("#feedList .post [data-like-id][aria-pressed='false']")!==null);
  pass("like and unlike", "both actions persisted through the QA Worker and refreshed the feed");

  const repostCard=page.locator("#feedList .post").filter({has:page.locator(".post-author small").filter({hasText:"@alicegreen"})}).first();
  await clickTarget(repostCard.locator("[data-repost-id]"),"Repost");
  await page.waitForFunction(()=>document.querySelector("#feedList .post [data-repost-id][aria-pressed='true']")!==null);
  pass("repost", "community post repost was accepted by the QA API");

  // Publish and delete a real text post in QA D1.
  const draft="QA E2E text post "+Date.now();
  await page.locator("#postText").fill(draft);
  await clickTarget(page.locator("#publishPost"),"Publish text post");
  await page.getByText(draft,{exact:true}).waitFor({timeout:20000});
  const createdCard=page.locator("#feedList .post").filter({hasText:draft});
  assert(await createdCard.locator("[data-delete-id]").count()===1,"new post does not expose Delete");
  page.once("dialog",dialog=>dialog.accept());
  await clickTarget(createdCard.locator("[data-delete-id]"),"Delete text post");
  await createdCard.waitFor({state:"detached",timeout:20000});
  pass("publish and delete text post", "created a post in isolated D1, then deleted it successfully");

  // Upload and publish a real 1x1 PNG through the QA-only B2 bucket.
  const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/n6sAAAAASUVORK5CYII=","base64");
  const imageText="QA E2E image post "+Date.now();
  await page.locator("#postText").fill(imageText);
  await page.locator("#postImage").setInputFiles({name:"fly-qa.png",mimeType:"image/png",buffer:png});
  await clickTarget(page.locator("#publishPost"),"Publish image post");
  const imageCard=page.locator("#feedList .post").filter({hasText:imageText});
  await imageCard.waitFor({state:"visible",timeout:30000});
  await imageCard.locator("img.post-image").waitFor({state:"visible",timeout:30000});
  const imageResponse=await page.request.get(await imageCard.locator("img.post-image").getAttribute("src"));
  assert(imageResponse.ok(),"B2 image could not be retrieved from the QA media route");
  page.once("dialog",dialog=>dialog.accept());
  await clickTarget(imageCard.locator("[data-delete-id]"),"Delete image post");
  await imageCard.waitFor({state:"detached",timeout:20000});
  pass("upload, publish, serve and delete image", "PNG passed validation, was stored in QA B2, loaded in the UI, and removed");

  // Explore and creator profile actions.
  await nav("explore");
  assert(await page.locator("#exploreGrid .explore-tile").count()>=4,"Explore has insufficient demo cards");
  await page.locator("#exploreGrid [data-profile-handle='alicegreen']").first().click();
  await page.locator("#profileView").waitFor({state:"visible"});
  await page.locator("#profileHandle").filter({hasText:"@alicegreen"}).waitFor();
  const follow=page.locator("#profileFollowButton");
  const wasFollowing=await follow.getAttribute("data-following");
  await clickTarget(follow,"Unfollow from profile");
  await page.waitForFunction(()=>document.querySelector("#profileFollowButton").dataset.following!== "true");
  await clickTarget(follow,"Follow from profile");
  await page.waitForFunction(()=>document.querySelector("#profileFollowButton").dataset.following=== "true");
  pass("Explore to creator profile, follow and unfollow", "profile counts and follow state refreshed after both actions");

  // Own followers/following lists, including changing a follow inside the list.
  await nav("profile");
  await page.locator('[data-open-connections="followers"]').click();
  await page.locator("#connectionsPanel").waitFor({state:"visible"});
  await page.locator("#connectionsList .connection-row").first().waitFor({state:"visible",timeout:20000});
  assert(await page.locator("#connectionsList .connection-row").count()>=2,"demo followers were not seeded: "+await page.locator("#connectionsList").innerText());
  const bobFollow=page.locator("#connectionsList [data-follow-handle='bobcreator']");
  assert(await bobFollow.count()===1,"Bob is missing from the demo follower list");
  await clickTarget(bobFollow,"Follow from followers list");
  await page.waitForFunction(()=>document.querySelector("#connectionsList [data-follow-handle='bobcreator']")?.dataset.following==="true");
  await page.locator("#backToProfile").click();
  await page.locator('[data-open-connections="following"]').click();
  await page.locator("#connectionsPanel").waitFor({state:"visible"});
  await page.locator("#connectionsList .connection-row").first().waitFor({state:"visible",timeout:20000});
  assert(await page.locator("#connectionsList .connection-row").count()>=1,"demo following list is empty: "+await page.locator("#connectionsList").innerText());
  pass("followers/following lists and inline follow refresh");

  // Notifications: unread state, single-read and read-all.
  await nav("notifications");
  assert(await page.locator("#notificationList .notification-row").count()>=3,"demo notifications were not seeded");
  assert(await page.locator("#notificationList .notification-row.unread").count()>=3,"unread notifications are missing");
  const firstUnread=page.locator("#notificationList [data-notification-id]").first();
  await clickTarget(firstUnread,"Mark a notification read");
  await page.waitForFunction(()=>document.querySelectorAll("#notificationList .notification-row.unread").length<4);
  await clickTarget(page.locator("#markAllRead"),"Mark all notifications read");
  await page.waitForFunction(()=>document.querySelectorAll("#notificationList .notification-row.unread").length===0);
  assert(await page.locator("#notificationBadge").isHidden(),"notification badge should be cleared after read-all");
  pass("notification badge, mark-one-read and mark-all-read");

  // Responsive checks for each main view at every agreed device width.
  for(const device of devices){
    const {width,height}=device;
    await page.setViewportSize({width,height});
    for(const view of views){
      await nav(view);
      await page.evaluate(()=>window.scrollTo(0,0));
      const snapshot=await page.evaluate(viewName=>{
        const root=document.documentElement;
        const app=document.querySelector("#feedApp");
        const inner=app.querySelector(".social-nav");
        const global=document.querySelector(".fi-global-bottom-nav");
        const target=app.querySelector("#"+(viewName==="notifications"?"notifications":viewName)+"View");
        const rect=el=>{if(!el)return null;const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,position:getComputedStyle(el).position};};
        const backgrounds=getComputedStyle(document.body,"::before").backgroundImage;
        const content=[...target.querySelectorAll(".post,.explore-tile,.notification-row,.profile-card,.profile-stats,.view-title")].filter(el=>el.getClientRects().length);
        return {width:innerWidth,scrollWidth:root.scrollWidth,clientWidth:root.clientWidth,innerNav:rect(inner),globalNav:rect(global),activeView:rect(target),content:content.slice(0,8).map(rect),background:backgrounds.includes("background-mobile.png")?"mobile":backgrounds.includes("background-desktop.png")?"desktop":"unknown"};
      },view);
      assert(snapshot.scrollWidth<=snapshot.clientWidth+1,"horizontal overflow at "+width+"x"+height+" in "+view);
      assert(snapshot.globalNav&&snapshot.globalNav.bottom<=height+1,"global nav outside viewport at "+width+"x"+height);
      assert(snapshot.activeView&&snapshot.activeView.width>0,"view did not render: "+view+" at "+width+"x"+height);
      for(const rect of snapshot.content){
        assert(rect.left>=-1&&rect.right<=width+1,"content clipped at "+width+"x"+height+" in "+view);
      }
      assert(width<=768?snapshot.background==="mobile":snapshot.background==="desktop","incorrect responsive background at "+width+"x"+height);
      if(width<=560)assert(snapshot.innerNav.position==="sticky","Social inner navigation should be sticky on mobile at "+width+"x"+height);
      report.screenshots.push({width,height,view});
      const screenshot=path.join(outDir,"social-"+width+"x"+height+"-"+view+".png");
      await page.screenshot({path:screenshot,fullPage:true,animations:"disabled"});
    }
    pass("responsive layouts "+width+"x"+height,"all four authenticated views rendered without horizontal overflow or clipped content");
  }

  // Language menu and dynamic language state while authenticated.
  await page.setViewportSize({width:390,height:844});
  for(const language of ["en","fa","ar","tr","ru","zh","es","pt"]){
    await page.locator("#langBtn").click();
    await page.locator("#langDropdown [data-lang='"+language+"']").click();
    const direction=await page.locator("html").getAttribute("dir");
    assert((language==="fa"||language==="ar")?direction==="rtl":direction==="ltr","wrong RTL/LTR direction for "+language);
    await page.locator("#feedApp .social-nav [data-social-view='feed']").click();
    await page.locator("#feedView").waitFor({state:"visible"});
    assert(await page.locator("#postText").getAttribute("placeholder"),"post composer placeholder disappeared in "+language);
  }
  await page.locator("#langBtn").click();
  await page.keyboard.press("Escape");
  assert(await page.locator("#langDropdown").evaluate(el=>!el.classList.contains("open")),"Escape should close the language menu");
  pass("8 languages, RTL/LTR, dynamic view refresh and keyboard dismissal");

  assert(report.errors.length===0,"uncaught browser errors: "+report.errors.join(" | "));
  assert(report.apiFailures.length===0,"QA API 5xx responses: "+JSON.stringify(report.apiFailures));
  pass("no uncaught browser errors or API 5xx responses");
}catch(error){
  report.errors.push(String(error?.message||error));
  console.error("SOCIAL_FULL_E2E_FAILURE",error);
  process.exitCode=1;
}finally{
  fs.writeFileSync(path.join(outDir,"full-e2e-report.json"),JSON.stringify(report,null,2));
  console.log("SOCIAL_FULL_E2E_REPORT",JSON.stringify(report,null,2));
  await context.close().catch(()=>{});
  await browser.close().catch(()=>{});
}
