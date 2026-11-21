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
function waitForVoices(timeout=1800){
 return new Promise(resolve=>{
  if(!('speechSynthesis'in window)){resolve([]);return}
  const synth=window.speechSynthesis;
  const existing=synth.getVoices();if(existing.length){resolve(existing);return}
  let settled=false,timer;
  const done=()=>{if(settled)return;settled=true;if(synth.removeEventListener)synth.removeEventListener('voiceschanged',check);clearTimeout(timer);resolve(synth.getVoices())};
  const check=()=>{if(synth.getVoices().length)done()};
  if(synth.addEventListener)synth.addEventListener('voiceschanged',check);
  timer=setTimeout(done,timeout);
 });
}
function speak(locale,text,rate=0.92,pitch=0.94){
 return new Promise(async(resolve,reject)=>{
  if(!('speechSynthesis'in window)||!('SpeechSynthesisUtterance'in window))return reject(Object.assign(new Error('This in-app Android WebView does not expose SpeechSynthesis. Use the natural AI voice below or open this page in Chrome.'),{environmental:true,unsupported:true}));
  const voices=await waitForVoices(),prefix=locale.split('-')[0].toLowerCase();
  const voice=voices.find(v=>v.lang.toLowerCase()===locale.toLowerCase())||voices.find(v=>v.lang.toLowerCase().startsWith(prefix+'-'));
  if(!voice)return resolve({unavailable:true,voiceCount:voices.length});
  let attempt=0,done=false,timer=null;
  const finish=(error,result)=>{if(done)return;done=true;if(timer)clearTimeout(timer);error?reject(error):resolve(result)};
  const start=useDefault=>{
   if(done)return;
   const utter=new SpeechSynthesisUtterance(text);utter.lang=voice.lang||locale;
   utter.rate=Math.max(0.78,Math.min(1.12,Number(rate)||0.92));
   utter.pitch=Math.max(0.82,Math.min(1.08,Number(pitch)||0.94));utter.volume=0.82;
   if(!useDefault)utter.voice=voice;
   utter.onend=()=>finish(null,{voice:useDefault?'System default':voice.name,lang:useDefault?locale:voice.lang,fallback:useDefault});
   utter.onerror=e=>{
    if((e.error==='synthesis-failed'||e.error==='audio-busy')&&attempt===0){
     attempt=1;speechSynthesis.cancel();setTimeout(()=>{speechSynthesis.resume();start(true)},350);return;
    }
    finish(Object.assign(new Error('Browser speech playback failed: '+e.error),{environmental:true}));
   };
   try{speechSynthesis.speak(utter)}catch(e){if(attempt===0){attempt=1;setTimeout(()=>start(true),350)}else finish(e)}
  };
  speechSynthesis.cancel();speechSynthesis.resume();
  timer=setTimeout(()=>{speechSynthesis.cancel();finish(Object.assign(new Error('Speech playback timed out'),{environmental:true}))},18000);
  setTimeout(()=>{speechSynthesis.resume();start(false)},180);
 });
}
function pcmToWav(bytes,sampleRate=24000,channels=1){
 const header=new ArrayBuffer(44),view=new DataView(header),write=(offset,value)=>{for(let i=0;i<value.length;i++)view.setUint8(offset+i,value.charCodeAt(i))};
 write(0,'RIFF');view.setUint32(4,36+bytes.byteLength,true);write(8,'WAVE');write(12,'fmt ');
 view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,channels,true);
 view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*channels*2,true);
 view.setUint16(32,channels*2,true);view.setUint16(34,16,true);write(36,'data');view.setUint32(40,bytes.byteLength,true);
 return new Blob([header,bytes],{type:'audio/wav'});
}
async function generateGeminiSpeech({apiKey,text,locale,voiceName='Kore'}){
 const key=String(apiKey||'').trim(),spoken=String(text||'').trim();
 if(!key)throw new Error('Paste a Google AI Studio API key first. The key is not saved.');
 if(!spoken)throw new Error('Enter text to speak first.');
 if(spoken.length>1200)throw new Error('Keep this test text under 1,200 characters.');
 const language=({'en-US':'English','fa-IR':'Iranian Persian','ar-SA':'Arabic','tr-TR':'Turkish','ru-RU':'Russian','zh-CN':'Chinese','es-ES':'Spanish','pt-PT':'Portuguese'})[locale]||locale;
 const instruction='Read the following text verbatim in '+language+'. Use a natural, warm, calm studio-narration voice, clear pronunciation, moderate pace, soft dynamics and no exaggerated pitch or theatrical effects. Do not translate, summarize, or add words. Text:';
 const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash-tts:generateContent',{
  method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},
  body:JSON.stringify({contents:[{parts:[{text:spoken,speechMetadata:{style:'Warm, calm, natural studio narration. Soft dynamics, moderate pace, clear pronunciation, neutral and friendly delivery.'}}]}],
   generationConfig:{responseModalities:['AUDIO'],speechConfig:{voiceConfig:{prebuiltVoiceConfig:{voiceName}},languageCode:locale}}})
 });
 const data=await response.json().catch(()=>({}));
 if(!response.ok){
  const detail=data.error?.message||('HTTP '+response.status);
  if(response.status===400||response.status===403)throw new Error('Google rejected the API key or request: '+detail);
  if(response.status===404)throw new Error('Gemini TTS model is not available to this API key yet: '+detail);
  if(response.status===429)throw new Error('Google free-tier rate limit reached. Wait before trying again. '+detail);
  throw new Error('Gemini TTS request failed: '+detail);
 }
 const parts=data.candidates?.[0]?.content?.parts||[];
 const audioPart=parts.find(part=>part.inlineData?.data);
 if(!audioPart)throw new Error('Google returned no audio data. Try again with a shorter text.');
 const mime=audioPart.inlineData.mimeType||'audio/L16;codec=pcm;rate=24000';
 const raw=Uint8Array.from(atob(audioPart.inlineData.data),c=>c.charCodeAt(0));
 const isWav=String.fromCharCode(...raw.slice(0,4))==='RIFF';
 const rateMatch=mime.match(/rate=(\d+)/i),sampleRate=rateMatch?Number(rateMatch[1]):24000;
 const wav=isWav?new Blob([raw],{type:'audio/wav'}):pcmToWav(raw,sampleRate,1);
 if(wav.size<1000)throw new Error('The generated audio file is unexpectedly small.');
 return wav;
}
document.querySelectorAll('[data-tool]').forEach(button=>button.addEventListener('click',()=>{const tool=button.dataset.tool;document.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b===button));['voice','music','effects'].forEach(n=>$(''+n+'Tool').classList.toggle('hidden',n!==tool));}));
$('musicForm').addEventListener('submit',async e=>{e.preventDefault();try{const blob=await window.FlyAudioComposer.generateMusic({prompt:$('musicPrompt').value,style:$('musicStyle').value,tempo:$('musicTempo').value,duration:$('musicDuration').value});setLocal(blob,'fly-infinity-music-'+$('musicStyle').value+'.wav')}catch(error){$('localStatus').textContent=error.message}});
$('effectForm').addEventListener('submit',async e=>{e.preventDefault();try{const blob=await window.FlyAudioComposer.generateEffect($('effectType').value);setLocal(blob,'fly-infinity-'+$('effectType').value+'.wav')}catch(error){$('localStatus').textContent=error.message}});
$('voiceForm').addEventListener('submit',async e=>{e.preventDefault();try{const result=await speak($('voiceLanguage').value,$('voiceText').value,$('voiceRate').value,$('voicePitch').value);$('voiceAvailability').textContent=result.unavailable?'No installed voice for '+$('voiceLanguage').value+' on this device.':'Played with '+result.voice+' ('+result.lang+').'}catch(err){$('voiceAvailability').textContent=err.message;}});
$('geminiSpeakButton').addEventListener('click',async()=>{
 const button=$('geminiSpeakButton');button.disabled=true;$('voiceAvailability').textContent='Generating natural voice…';
 try{
  const blob=await generateGeminiSpeech({apiKey:$('geminiApiKey').value,text:$('voiceText').value,locale:$('voiceLanguage').value,voiceName:$('geminiVoiceName').value});
  await assertWav(blob);setLocal(blob,'fly-infinity-natural-voice-'+$('voiceLanguage').value+'.wav');
  $('voiceAvailability').textContent='Natural AI voice is ready. Tap Play in the audio player below.';
 }catch(error){$('voiceAvailability').textContent=error.message;}
 finally{button.disabled=false}
});
function updateChromeHint(){
 const android=/Android/i.test(navigator.userAgent);
 const unsupported=!('speechSynthesis'in window)||!('SpeechSynthesisUtterance'in window);
 $('openChromeLink').hidden=!(android&&unsupported);
 if(android&&unsupported)$('voiceAvailability').textContent='Native speech is not available in this Android in-app browser. Use Natural AI Voice above, or open this page in Chrome.';
}
$('stopVoice').addEventListener('click',()=>{if('speechSynthesis'in window)speechSynthesis.cancel();$('voiceAvailability').textContent='Speech stopped.'});
function refreshVoiceInfo(){const voices='speechSynthesis'in window?speechSynthesis.getVoices():[];$('voiceAvailability').textContent=voices.length+' device voice(s) detected. Natural AI voice works independently of installed voices.';updateChromeHint();}
if('speechSynthesis'in window){if(speechSynthesis.addEventListener)speechSynthesis.addEventListener('voiceschanged',refreshVoiceInfo);else speechSynthesis.onvoiceschanged=refreshVoiceInfo;}
async function runAll(){
 const button=$('runAllTests');button.disabled=true;passed=failed=skipped=0;$('qaLog').innerHTML='';$('qaPassed').textContent='0 passed';$('qaFailed').textContent='0 failed';$('qaSkipped').textContent='0 skipped';total=STYLES.length+EFFECTS.length+LANGS.length+2;progress('Running browser capability checks…');
 try{if(!window.FlyAudioComposer)throw new Error('Composer script did not load');log('Audio composer library','pass','FlyAudioComposer API is available');}catch(e){log('Audio composer library','fail',e.message);progress('Stopped: core library unavailable');button.disabled=false;return}
 for(const style of STYLES){progress('Rendering music: '+style);try{const blob=await window.FlyAudioComposer.generateMusic({prompt:'Fly Infinity automated QA '+style,style,tempo:96,duration:15});const buf=await assertWav(blob);const decoded=await decodeWav(buf);log('Music · '+style,'pass',blob.size+' bytes WAV'+(decoded.duration?' · '+decoded.duration.toFixed(1)+'s · '+decoded.channels+'ch':''));}catch(e){log('Music · '+style,'fail',e.message)}}
 for(const effect of EFFECTS){progress('Rendering effect: '+effect);try{const blob=await window.FlyAudioComposer.generateEffect(effect);const buf=await assertWav(blob);const decoded=await decodeWav(buf);log('Effect · '+effect,'pass',blob.size+' bytes WAV'+(decoded.duration?' · '+decoded.duration.toFixed(1)+'s':''));}catch(e){log('Effect · '+effect,'fail',e.message)}}
 progress('Checking browser voice languages…');
 if(!('speechSynthesis'in window)||!('SpeechSynthesisUtterance'in window)){log('Device speech engine','skip','This browser/WebView does not expose SpeechSynthesis; use Gemini Natural Voice below.')}else{const voices=await waitForVoices();log('Device speech engine','pass',voices.length+' installed voice(s)');for(const [name,locale] of LANGS){const prefix=locale.split('-')[0].toLowerCase();const voice=voices.find(v=>v.lang.toLowerCase()===locale.toLowerCase())||voices.find(v=>v.lang.toLowerCase().startsWith(prefix+'-'));if(!voice){log('Voice · '+name,'skip','No installed '+locale+' voice; device/browser limitation');continue}try{progress('Speaking sample: '+name);const result=await speak(locale,'Fly Infinity audio test.');if(result.unavailable)log('Voice · '+name,'skip','Voice became unavailable during test');else log('Voice · '+name,'pass',result.voice+' · '+result.lang+' · playback ended');}catch(e){log('Voice · '+name,e.environmental?'skip':'fail',e.message)}}}
 if($('geminiApiKey').value.trim()){
  progress('Testing one Persian natural-voice request (free-tier quota applies)…');
  try{
   const blob=await generateGeminiSpeech({apiKey:$('geminiApiKey').value,text:'سلام، به استودیوی صدای فلای اینفینیتی خوش آمدید.',locale:'fa-IR',voiceName:$('geminiVoiceName').value});
   await assertWav(blob);setLocal(blob,'fly-infinity-persian-voice-qa.wav');log('Gemini TTS · Persian','pass',blob.size+' bytes WAV returned');
  }catch(e){log('Gemini TTS · Persian','fail',e.message)}
 }else{log('Gemini TTS · Persian','skip','No API key entered; add a free-tier Google AI Studio key to test natural Persian speech.')}
 const report='Complete: '+passed+' passed, '+failed+' failed, '+skipped+' skipped.';progress(report);$('localStatus').textContent=report;button.disabled=false;
}
$('runAllTests').addEventListener('click',runAll);
refreshVoiceInfo();
updateChromeHint();
})();