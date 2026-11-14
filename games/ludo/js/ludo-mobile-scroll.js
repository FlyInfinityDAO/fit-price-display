/* Android-only scroll stability for Ludo room-code entry.
   Mirrors the proven Snakes & Ladders / Hokm native-focus behavior. */
(function(){
 "use strict";
 if(!/Android/i.test(navigator.userAgent||""))return;
 document.documentElement.classList.add("fi-android-webview");
 let savedScrollY=0,roomInputActive=false,restoreTimer=null,restoring=false;
 const roomInput=()=>document.getElementById("roomCode");
 const pageY=()=>window.scrollY||document.documentElement.scrollTop||document.body.scrollTop||0;
 function remember(){const y=pageY();if(y>0)savedScrollY=y;}
 function restoreIfReset(){
  /* Persian and Arabic use native RTL scrolling while the Android keyboard is open. */
  if(["fa","ar"].includes(document.documentElement.lang))return;
  if(restoring)return;
  const input=roomInput();
  if(!input||document.activeElement!==input)return;
  const current=pageY();
  if(savedScrollY<120||current>Math.max(48,savedScrollY*.22))return;
  restoring=true;
  window.scrollTo(0,savedScrollY);
  requestAnimationFrame(()=>{restoring=false;});
 }
 function scheduleRestore(){
  if(restoreTimer)clearTimeout(restoreTimer);
  [90,260,520].forEach(delay=>setTimeout(restoreIfReset,delay));
 }
 document.addEventListener("scroll",()=>{if(!restoring&&!roomInputActive)remember();},{passive:true,capture:true});
 document.addEventListener("pointerdown",event=>{
  if(event.target&&event.target.id==="roomCode"){remember();roomInputActive=true;}
 },true);
 document.addEventListener("focusin",event=>{
  if(event.target&&event.target.id==="roomCode"){
   if(!savedScrollY)remember();
   roomInputActive=true;
   scheduleRestore();
  }
 },true);
 document.addEventListener("focusout",event=>{
  if(event.target&&event.target.id==="roomCode"){
   roomInputActive=false;
   setTimeout(remember,180);
  }
 },true);
 document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState==="hidden"){remember();return;}
  if(roomInputActive)scheduleRestore();
 });
 window.addEventListener("pageshow",()=>{if(roomInputActive)scheduleRestore();});
 if(window.visualViewport)window.visualViewport.addEventListener("resize",()=>{if(roomInputActive)scheduleRestore();},{passive:true});
})();