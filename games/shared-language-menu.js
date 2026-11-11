(function(){
"use strict";
const options=[["en","🇬🇧","English"],["fa","🇮🇷","فارسی"],["ar","🇮🇶","العربية"],["tr","🇹🇷","Türkçe"],["ru","🇷🇺","Русский"],["zh","🇨🇳","中文"],["es","🇪🇸","Español"],["pt","🇵🇹","Português"]];
document.addEventListener("DOMContentLoaded",function(){
 const button=document.getElementById("languageButton");
 const menu=document.getElementById("languageMenu");
 const select=document.getElementById("languageSelect");
 if(!button||!menu||!select)return;
 menu.classList.add("fi-game-language-menu");
 const closeMenu=()=>{menu.classList.remove("open");button.setAttribute("aria-expanded","false")};
 const positionMenu=()=>{
  const rect=button.getBoundingClientRect(),margin=12,gap=8;
  const vw=document.documentElement.clientWidth||window.innerWidth,vh=window.innerHeight;
  const width=Math.min(176,Math.max(120,vw-margin*2));
  menu.style.width=width+"px";menu.style.maxWidth=width+"px";
  const maxLeft=Math.max(margin,vw-width-margin),rtl=document.documentElement.dir==="rtl";
  let left=rtl?rect.right-width:rect.left;
  left=Math.max(margin,Math.min(left,maxLeft));
  const menuHeight=Math.min(menu.scrollHeight,vh-margin*2);
  const below=vh-rect.bottom-margin,above=rect.top-margin;
  let top=rect.bottom+gap;
  if(menuHeight>below&&above>below)top=rect.top-gap-menuHeight;
  top=Math.max(margin,Math.min(top,vh-menuHeight-margin));
  menu.style.left=left+"px";menu.style.right="auto";menu.style.top=top+"px";
 };
 const sync=()=>{
  const current=options.find(item=>item[0]===select.value)||options[0];
  button.textContent=current[1];
  menu.querySelectorAll("button").forEach(item=>item.classList.toggle("active",item.dataset.lang===current[0]));
 };
 options.forEach(([code,flag,name])=>{
  const item=document.createElement("button");
  item.type="button";item.className="language-option";item.dataset.lang=code;
  item.setAttribute("role","menuitem");
  const icon=document.createElement("span");icon.className="language-flag";icon.setAttribute("aria-hidden","true");icon.textContent=flag;
  const label=document.createElement("span");label.textContent=name;
  item.append(icon,label);
  item.addEventListener("click",()=>{
   if(select.value!==code){select.value=code;select.dispatchEvent(new Event("change",{bubbles:true}))}
   sync();closeMenu();
  });
  menu.appendChild(item);
 });
 document.body.appendChild(menu);
 sync();
 button.addEventListener("click",event=>{
  event.stopPropagation();
  const opening=!menu.classList.contains("open");
  if(opening){menu.classList.add("open");positionMenu();button.setAttribute("aria-expanded","true")}
  else closeMenu();
 });
 select.addEventListener("change",sync);
 document.addEventListener("click",event=>{if(!button.contains(event.target)&&!menu.contains(event.target))closeMenu()});
 window.addEventListener("resize",()=>{if(menu.classList.contains("open"))positionMenu()},{passive:true});
 window.addEventListener("scroll",()=>{if(menu.classList.contains("open"))positionMenu()},{passive:true,capture:true});
 document.addEventListener("keydown",event=>{if(event.key==="Escape")closeMenu()});
});
})();