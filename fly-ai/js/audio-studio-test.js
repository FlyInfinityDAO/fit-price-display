(function(){
'use strict';
const API='https://fly-infinity-audio-test.flyinfinityplatform.workers.dev';
const $=id=>document.getElementById(id);
let voiceUrl=null,localUrl=null,busy=false;
function setLocal(blob,name){
 if(localUrl)URL.revokeObjectURL(localUrl);
 localUrl=URL.createObjectURL(blob);$('localPlayer').src=localUrl;$('localDownload').href=localUrl;$('localDownload').download=name;
 $('localResult').classList.remove('hidden');$('localStatus').textContent='Audio ready.';
}
document.querySelectorAll('[data-tool]').forEach(button=>button.addEventListener('click',()=>{
 const tool=button.dataset.tool;document.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b===button));
 ['voice','music','effects'].forEach(name=>$(''+name+'Tool').classList.toggle('hidden',name!==tool));
}));
$('voiceForm').addEventListener('submit',async e=>{
 e.preventDefault();if(busy)return;
 const text=$('voiceText').value.trim();if(!text){$('voiceStatus').textContent='Enter text first.';return}
 busy=true;$('voiceButton').disabled=true;$('voiceStatus').textContent='Generating speech…';
 try{
  const response=await fetch(API+'/api/audio/preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,speaker:$('voiceSpeaker').value})});
  if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.error||'Voice preview failed')}
  const blob=await response.blob();if(!blob.size||!blob.type.startsWith('audio/'))throw new Error('Invalid audio response');
  if(voiceUrl)URL.revokeObjectURL(voiceUrl);voiceUrl=URL.createObjectURL(blob);
  $('voicePlayer').src=voiceUrl;$('voiceDownload').href=voiceUrl;$('voiceResult').classList.remove('hidden');$('voiceStatus').textContent='Voice preview created.';
 }catch(error){$('voiceStatus').textContent=error.message||'Voice preview failed'}
 finally{busy=false;$('voiceButton').disabled=false}
});
$('musicForm').addEventListener('submit',async e=>{
 e.preventDefault();try{const blob=await window.FlyAudioComposer.generateMusic({prompt:$('musicPrompt').value,style:$('musicStyle').value,tempo:$('musicTempo').value,duration:$('musicDuration').value});setLocal(blob,'fly-infinity-music.wav')}catch(error){$('localStatus').textContent=error.message}
});
$('effectForm').addEventListener('submit',async e=>{
 e.preventDefault();try{const blob=await window.FlyAudioComposer.generateEffect($('effectType').value);setLocal(blob,'fly-infinity-sound-effect.wav')}catch(error){$('localStatus').textContent=error.message}
});
})();
