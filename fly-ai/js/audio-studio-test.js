(function(){
'use strict';
const $=id=>document.getElementById(id);
const LANGS=[['English','en-US'],['Persian','fa-IR'],['Arabic','ar-SA'],['Turkish','tr-TR'],['Russian','ru-RU'],['Chinese','zh-CN'],['Spanish','es-ES'],['Portuguese','pt-PT']];
const STYLES=['cinematic','calm','electronic','lofi','upbeat'];
const EFFECTS=['chime','magic','whoosh','laser','impact','rain'];
let localUrl=null,passed=0,failed=0,skipped=0,total=0;
function log(label,status,detail){const row=document.createElement('div');row.className='qa-row '+status;const mark=document.createElement('b');mark.textContent=status==='pass'?'PASS':status==='fail'?'FAIL':'SKIP';const name=document.createElement('span');name.textContent=label;const info=document.createElement('small');info.textContent=detail||'';row.append(mark,name,info);$('qaLog').append(row);if(status==='pass')passed++;else if(status==='fail')failed++;else skipped++;$('qaPassed').textContent=passed+' passed';$('qaFailed').textContent=failed+' failed';$('qaSkipped').textContent=skipped+' skipped';}
function progress(s){$('qaProgress').textContent=s}
function setLocal(blob,name){if(localUrl)URL.revokeObjectURL(localUrl);localUrl=URL.createObjectURL(blob);$('localPlayer').src=localUrl;$('localDownload').href=localUrl;$('localDownload').download=name;$('localResult').classList.remove('hidden');$('localStatus').textContent='Audio ready.'}
function assertWav(blob){if(!(blob instanceof Blob)||blob.type!=='audio/wav'||blob.size<48)throw new Error('Missing/invalid WAV Blob');return blob.arrayBuffer().then(buf=>{const v=new DataView(buf);const sig=[0,1,2,3,8,9,10,11].map(i=>String.fromCharCode(v.getUint8(i))).join('');if(sig!=='RIFFWAVE')throw new Error('RIFF/WAVE header missing');if(v.getUint32(4,true)!==buf.byteLength-8)throw new Error('RIFF size mismatch');if(v.getUint32(40,true)!==buf.byteLength-44)throw new Error('WAV data length mismatch');return buf;})}
function decodeWav(buf){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return Promise.resolve({skipped:true});const ctx=new AC();return ctx.decodeAudioData(buf.slice(0)).then(audio=>{const info={duration:audio.duration,channels:audio.numberOfChannels,sampleRate:audio.sampleRate};ctx.close();if(!info.duration||!info.channels)throw new Error('Decoded audio is empty');return info},e=>{ctx.close();throw e})}
function speak(locale,text){return new Promise((resolve,reject)=>{
 if(!('speechSynthesis'in window)||!('SpeechSynthesisUtterance'in window))return reject(new Error('Speech Synthesis API unavailable'));
 const voices=speechSynthesis.getVoices(),prefix=locale.split('-')[0].toLowerCase();
 const voice=voices.find(v=>v.lang.toLowerCase()===locale.toLowerCase())||voices.find(v=>v.lang.toLowerCase().startsWith(prefix+'-'));
 if(!voice)return resolve({unavailable:true,voiceCount:voices.length});
 let attempt=0,done=false,timer=null;
 const finish=(error,result)=>{if(done)return;done=true;if(timer)clearTimeout(timer);error?reject(error):resolve(result)};
 const start=useDefault=>{
  if(done)return;
  const utter=new SpeechSynthesisUtterance(text);utter.lang=locale;utter.rate=1;utter.pitch=1;utter.volume=1;
  if(!useDefault){utter.voice=voice;utter.lang=voice.lang||locale}
  utter.onend=()=>finish(null,{voice:useDefault?'System default':voice.name,lang:useDefault?locale:voice.lang,fallback:useDefault});
  utter.onerror=e=>{
   if((e.error==='synthesis-failed'||e.error==='audio-busy')&&attempt===0){
    attempt=1;speechSynthesis.cancel();setTimeout(()=>{speechSynthesis.resume();start(true)},250);return;
   }
   if(e.error==='synthesis-failed'||e.error==='audio-busy')return finish(Object.assign(new Error('Browser speech engine unavailable after default-voice retry: '+e.error),{environmental:true}));
   if(e.error==='canceled'||e.error==='interrupted')return finish(Object.assign(new Error('Speech interrupted: '+e.error),{environmental:true}));
   finish(new Error('Speech playback error: '+e.error));
  };
  try{speechSynthesis.speak(utter)}catch(e){if(attempt===0){attempt=1;setTimeout(()=>start(true),250)}else finish(Object.assign(new Error('Browser speech engine unavailable: '+e.message),{environmental:true}))}
 };
 speechSynthesis.cancel();speechSynthesis.resume();
 timer=setTimeout(()=>{speechSynthesis.cancel();finish(Object.assign(new Error('Speech playback timed out'),{environmental:true}))},15000);
 setTimeout(()=>{speechSynthesis.resume();start(false)},120);
 });}
document.querySelectorAll('[data-tool]').forEach(button=>button.addEventListener('click',()=>{const tool=button.dataset.tool;document.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b===button));['voice','music','effects'].forEach(n=>$(''+n+'Tool').classList.toggle('hidden',n!==tool));}));
$('musicForm').addEventListener('submit',async e=>{e.preventDefault();try{const blob=await window.FlyAudioComposer.generateMusic({prompt:$('musicPrompt').value,style:$('musicStyle').value,tempo:$('musicTempo').value,duration:$('musicDuration').value});setLocal(blob,'fly-infinity-music-'+$('musicStyle').value+'.wav')}catch(error){$('localStatus').textContent=error.message}});
$('effectForm').addEventListener('submit',async e=>{e.preventDefault();try{const blob=await window.FlyAudioComposer.generateEffect($('effectType').value);setLocal(blob,'fly-infinity-'+$('effectType').value+'.wav')}catch(error){$('localStatus').textContent=error.message}});
$('voiceForm').addEventListener('submit',async e=>{e.preventDefault();try{const result=await speak($('voiceLanguage').value,$('voiceText').value);$('voiceAvailability').textContent=result.unavailable?'No installed voice for this language on this device.':'Played with '+result.voice+' ('+result.lang+').'}catch(err){$('voiceAvailability').textContent=err.message}});
$('stopVoice').addEventListener('click',()=>{if('speechSynthesis'in window)speechSynthesis.cancel();$('voiceAvailability').textContent='Speech stopped.'});
function refreshVoiceInfo(){const voices='speechSynthesis'in window?speechSynthesis.getVoices():[];$('voiceAvailability').textContent=voices.length+' browser voice(s) detected. Language coverage is tested below.'}
if('speechSynthesis'in window)speechSynthesis.onvoiceschanged=refreshVoiceInfo;
async function runAll(){
 const button=$('runAllTests');button.disabled=true;passed=failed=skipped=0;$('qaLog').innerHTML='';$('qaPassed').textContent='0 passed';$('qaFailed').textContent='0 failed';$('qaSkipped').textContent='0 skipped';total=STYLES.length+EFFECTS.length+LANGS.length+2;progress('Running browser capability checks…');
 try{if(!window.FlyAudioComposer)throw new Error('Composer script did not load');log('Audio composer library','pass','FlyAudioComposer API is available');}catch(e){log('Audio composer library','fail',e.message);progress('Stopped: core library unavailable');button.disabled=false;return}
 for(const style of STYLES){progress('Rendering music: '+style);try{const blob=await window.FlyAudioComposer.generateMusic({prompt:'Fly Infinity automated QA '+style,style,tempo:96,duration:15});const buf=await assertWav(blob);const decoded=await decodeWav(buf);log('Music · '+style,'pass',blob.size+' bytes WAV'+(decoded.duration?' · '+decoded.duration.toFixed(1)+'s · '+decoded.channels+'ch':''));}catch(e){log('Music · '+style,'fail',e.message)}}
 for(const effect of EFFECTS){progress('Rendering effect: '+effect);try{const blob=await window.FlyAudioComposer.generateEffect(effect);const buf=await assertWav(blob);const decoded=await decodeWav(buf);log('Effect · '+effect,'pass',blob.size+' bytes WAV'+(decoded.duration?' · '+decoded.duration.toFixed(1)+'s':''));}catch(e){log('Effect · '+effect,'fail',e.message)}}
 progress('Checking browser voice languages…');
 if(!('speechSynthesis'in window)){log('Browser speech engine','fail','SpeechSynthesis API unavailable')}else{const voices=speechSynthesis.getVoices();log('Browser speech engine','pass',voices.length+' installed voice(s)');for(const [name,locale] of LANGS){const prefix=locale.split('-')[0].toLowerCase();const voice=voices.find(v=>v.lang.toLowerCase()===locale.toLowerCase())||voices.find(v=>v.lang.toLowerCase().startsWith(prefix+'-'));if(!voice){log('Voice · '+name,'skip','No installed '+locale+' voice; device/browser limitation');continue}try{progress('Speaking sample: '+name);const result=await speak(locale,'Fly Infinity audio test.');if(result.unavailable)log('Voice · '+name,'skip','Voice became unavailable during test');else log('Voice · '+name,'pass',result.voice+' · '+result.lang+' · playback ended');}catch(e){log('Voice · '+name,e.environmental?'skip':'fail',e.message)}}}
 const report='Complete: '+passed+' passed, '+failed+' failed, '+skipped+' skipped.';progress(report);$('localStatus').textContent=report;button.disabled=false;
}
$('runAllTests').addEventListener('click',runAll);
refreshVoiceInfo();
})();