/* Fixed-viewport neon ambient layer shared by Chess Arena and Backgammon.
   Visual-only canvas: no gameplay hooks, no pointer events, no DOM layout changes. */
(() => {
  'use strict';
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const canvas=document.createElement('canvas');
  canvas.id='fi-games-neon-canvas';
  canvas.setAttribute('aria-hidden','true');
  const ctx=canvas.getContext('2d',{alpha:true,desynchronized:true});
  if(!ctx)return;
  let width=0,height=0,dpr=1,last=0,paused=false,raf=0,trails=[],bokeh=[];
  const rand=(a,b)=>a+Math.random()*(b-a);
  const edge=()=>{const side=Math.floor(Math.random()*4);if(side===0)return{x:rand(-width*.18,width*1.18),y:-height*.12};if(side===1)return{x:width*1.12,y:rand(-height*.12,height*1.12)};if(side===2)return{x:rand(-width*.18,width*1.18),y:height*1.12};return{x:-width*.12,y:rand(-height*.12,height*1.12)}};
  const makeTrail=()=>{const a=edge(),b=edge();return{a,b,c:{x:rand(width*.08,width*.92),y:rand(height*.08,height*.92)},t:rand(-.25,.05),speed:rand(.000045,.00009),length:rand(.22,.38),width:rand(2.6,4.8),radius:rand(6,9),hue:Math.random()<.5?'cyan':'violet'}};
  function resize(){
    width=document.documentElement.clientWidth||window.innerWidth;height=window.innerHeight||document.documentElement.clientHeight;dpr=Math.min(window.devicePixelRatio||1,1.5);
    canvas.width=Math.max(1,Math.round(width*dpr));canvas.height=Math.max(1,Math.round(height*dpr));canvas.style.width=width+'px';canvas.style.height=height+'px';ctx.setTransform(dpr,0,0,dpr,0,0);
    const mobile=width<700;trails=Array.from({length:mobile?5:8},makeTrail);bokeh=Array.from({length:mobile?11:19},()=>({x:rand(0,width),y:rand(0,height),r:rand(1.5,4.5),vy:rand(-.10,.10),phase:rand(0,Math.PI*2),hue:Math.random()<.5?'cyan':'violet'}));
  }
  const point=(a,c,b,t)=>({x:(1-t)*(1-t)*a.x+2*(1-t)*t*c.x+t*t*b.x,y:(1-t)*(1-t)*a.y+2*(1-t)*t*c.y+t*t*b.y});
  function frame(now){
    raf=0;if(paused)return;const dt=Math.min(40,now-(last||now));last=now;ctx.clearRect(0,0,width,height);
    bokeh.forEach((p,i)=>{p.y+=p.vy*dt;p.phase+=dt*.0007;if(p.y< -8)p.y=height+8;if(p.y>height+8)p.y=-8;const alpha=.12+.13*(.5+.5*Math.sin(p.phase+i)),color=p.hue==='cyan'?'0,217,255':'139,92,246';ctx.beginPath();ctx.fillStyle='rgba('+color+','+alpha+')';ctx.shadowColor='rgba('+color+',.65)';ctx.shadowBlur=14;ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill()});
    trails.forEach(tr=>{tr.t+=dt*tr.speed;if(tr.t>1.28)Object.assign(tr,makeTrail());const start=Math.max(0,tr.t-tr.length/2),end=Math.min(1,tr.t+tr.length/2);if(end<=start)return;const color=tr.hue==='cyan'?'0,217,255':'139,92,246',p0=point(tr.a,tr.c,tr.b,start),p1=point(tr.a,tr.c,tr.b,end),mid=point(tr.a,tr.c,tr.b,Math.max(0,Math.min(1,tr.t))),grad=ctx.createLinearGradient(p0.x,p0.y,p1.x,p1.y);grad.addColorStop(0,'rgba('+color+',0)');grad.addColorStop(.45,'rgba('+color+',.78)');grad.addColorStop(1,'rgba('+color+',0)');ctx.beginPath();ctx.moveTo(p0.x,p0.y);for(let i=1;i<=12;i++){const p=point(tr.a,tr.c,tr.b,start+(end-start)*i/12);ctx.lineTo(p.x,p.y)}ctx.strokeStyle=grad;ctx.lineWidth=tr.width;ctx.lineCap='round';ctx.shadowColor='rgba('+color+',.9)';ctx.shadowBlur=18;ctx.stroke();ctx.beginPath();ctx.arc(mid.x,mid.y,tr.radius,0,Math.PI*2);ctx.fillStyle='rgba('+color+',.9)';ctx.shadowColor='rgba('+color+',1)';ctx.shadowBlur=23;ctx.fill();ctx.beginPath();ctx.arc(mid.x,mid.y,tr.radius*.48,0,Math.PI*2);ctx.fillStyle='rgba(235,248,255,.92)';ctx.shadowBlur=8;ctx.fill()});
    ctx.shadowBlur=0;raf=requestAnimationFrame(frame);
  }
  function mount(){if(!document.body||canvas.isConnected)return;canvas.style.cssText='position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;z-index:0!important;pointer-events:none!important;display:block!important';document.body.appendChild(canvas);resize();requestAnimationFrame(frame)}
  document.addEventListener('visibilitychange',()=>{paused=document.hidden;if(!paused&&!raf){last=0;raf=requestAnimationFrame(frame)}});
  window.addEventListener('resize',resize,{passive:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
