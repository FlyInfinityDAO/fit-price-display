(function(){
'use strict';
const API='https://fly-infinity-audio-test.flyinfinityplatform.workers.dev';
const $=id=>document.getElementById(id);
let localUrl=null;
function setLocal(blob,name){
 if(localUrl)URL.revokeObjectURL(localUrl);
 localUrl=URL.createObjectURL(blob);$('localPlayer').src=localUrl;$('localDownload').href=localUrl;$('localDownload').download=name;
 $('localResult').classList.remove('hidden');$('localStatus').textContent='Audio ready.';
}
document.querySelectorAll('[data-tool]').forEach(button=>button.addEventListener('click',()=>{
 const tool=button.dataset.tool;document.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b===button));
 ['voice','music','effects'].forEach(name=>$(''+name+'Tool').classList.toggle('hidden',name!==tool));
}));
$('musicForm').addEventListener('submit',async e=>{
 e.preventDefault();try{const blob=await window.FlyAudioComposer.generateMusic({prompt:$('musicPrompt').value,style:$('musicStyle').value,tempo:$('musicTempo').value,duration:$('musicDuration').value});setLocal(blob,'fly-infinity-music.wav')}catch(error){$('localStatus').textContent=error.message}
});
$('effectForm').addEventListener('submit',async e=>{
 e.preventDefault();try{const blob=await window.FlyAudioComposer.generateEffect($('effectType').value);setLocal(blob,'fly-infinity-sound-effect.wav')}catch(error){$('localStatus').textContent=error.message}
});
})();
