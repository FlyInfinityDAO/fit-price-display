(function(){'use strict';
const $=id=>document.getElementById(id);
const API=(window.FLY_AI_CONFIG&&window.FLY_AI_CONFIG.apiBase||'').replace(/\/$/,'');
const FIT='0xBebe4ea7aA4037CeF5D0bc25a10f9dcA16120Dfa',CHAIN='0x38';
let provider=null,address='',token='',busy=false,history=[],profile=null,assistantId='general';
const t=k=>window.FlyI18n.t(k);
const supportedLanguages=['en','fa','ar','tr','ru','zh','es','pt'];
const countryCodes=('AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW').split(' ');
function toast(s){const el=$('toast');el.textContent=s;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),3600)}
function short(a){return a.slice(0,6)+'…'+a.slice(-4)}
async function request(url,opts={}){if(!API)throw new Error(t('backendMissing'));const r=await fetch(API+url,{...opts,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...(opts.headers||{})}});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||t('sendError'));return data}
async function switchBsc(p){let id=await p.request({method:'eth_chainId'});if(id!=='0x38'){try{await p.request({method:'wallet_switchEthereumChain',params:[{chainId:CHAIN}]})}catch(e){if(e.code===4902)await p.request({method:'wallet_addEthereumChain',params:[{chainId:CHAIN,chainName:'BNB Smart Chain',nativeCurrency:{name:'BNB',symbol:'BNB',decimals:18},rpcUrls:['https://bsc-dataseed.binance.org/'],blockExplorerUrls:['https://bscscan.com/']}]});else throw new Error(t('wrongNetwork'))}}}
function bindWalletEvents(p){if(!p||!p.on||p.__flyAiBound)return;p.__flyAiBound=true;p.on('accountsChanged',a=>{if(!a||!a.length||address&&ethers.utils.getAddress(a[0])!==address)$('disconnectBtn').click()});p.on('chainChanged',()=>{if(token)$('disconnectBtn').click()})}
function currentLanguage(){const l=localStorage.getItem('fit_lang')||'en';return supportedLanguages.includes(l)?l:'en'}
function countryName(code,lang){try{return new Intl.DisplayNames([lang],{type:'region'}).of(code)||code}catch{return code}}
function ensureRegionUI(){
 if(!$('regionSettingsBtn')){const b=document.createElement('button');b.id='regionSettingsBtn';b.type='button';b.className='text-btn';b.textContent=t('regionSettings');b.addEventListener('click',()=>showCountryDialog(false));$('disconnectBtn').parentElement.before(b)}
 if(!$('countryDialog')){const wrap=document.createElement('div');wrap.id='countryDialog';wrap.className='region-overlay hidden';wrap.innerHTML='<section class="region-dialog" role="dialog" aria-modal="true" aria-labelledby="regionTitle"><div class="region-mark">◎</div><h2 id="regionTitle"></h2><p id="regionDescription"></p><label id="countryLabel" for="countrySelect"></label><select id="countrySelect" required></select><p class="region-note" id="regionNote"></p><div class="region-actions"><button id="countrySave" class="primary-btn" type="button"></button><button id="countryCancel" class="text-btn" type="button"></button></div><div id="regionError" role="status"></div></section>';$('toast').before(wrap);
 const select=$('countrySelect');const lang=currentLanguage();const codes=countryCodes.filter(c=>c!=='AQ');codes.sort((a,b)=>countryName(a,lang).localeCompare(countryName(b,lang),lang));const blank=document.createElement('option');blank.value='';blank.textContent=t('chooseCountry');select.append(blank);codes.forEach(code=>{const o=document.createElement('option');o.value=code;o.textContent=countryName(code,lang);select.append(o)});
 $('countrySave').addEventListener('click',saveCountry);$('countryCancel').addEventListener('click',()=>{if(profile?.country_code)$('countryDialog').classList.add('hidden')});
 }
 updateRegionTexts();
}
function refreshCountryOptions(){const select=$('countrySelect');if(!select)return;const selected=select.value;select.innerHTML='';const blank=document.createElement('option');blank.value='';blank.textContent=t('chooseCountry');select.append(blank);const lang=currentLanguage();const codes=countryCodes.filter(c=>c!=='AQ');codes.sort((a,b)=>countryName(a,lang).localeCompare(countryName(b,lang),lang));codes.forEach(code=>{const o=document.createElement('option');o.value=code;o.textContent=countryName(code,lang);select.append(o)});select.value=selected}function updateRegionTexts(){if(!$('countryDialog'))return;$('regionTitle').textContent=t('regionTitle');$('regionDescription').textContent=t('regionDescription');$('countryLabel').textContent=t('countryLabel');$('regionNote').textContent=t('regionNote');$('countrySave').textContent=t('saveCountry');$('countryCancel').textContent=t('cancel');$('regionSettingsBtn')&&($('regionSettingsBtn').textContent=t('regionSettings'));refreshCountryOptions()}
function showCountryDialog(required){ensureRegionUI();$('regionError').textContent='';$('countrySelect').value=profile?.country_code||'';$('countryCancel').classList.toggle('hidden',required);$('countryDialog').classList.remove('hidden')}
async function loadProfile(){ensureRegionUI();const data=await request('/api/profile');profile=data.profile;if(!profile?.country_code)showCountryDialog(true);else{$('regionSettingsBtn').title=countryName(profile.country_code,currentLanguage());}}
async function saveCountry(){const countryCode=$('countrySelect').value;if(!countryCode){$('regionError').textContent=t('chooseCountry');return}const button=$('countrySave');button.disabled=true;try{const data=await request('/api/profile',{method:'PUT',body:JSON.stringify({countryCode,language:currentLanguage()})});profile=data.profile;$('countryDialog').classList.add('hidden');$('regionSettingsBtn').title=countryName(countryCode,currentLanguage());toast(t('countrySaved'))}catch(e){$('regionError').textContent=e.message||t('sendError')}finally{button.disabled=false}}
async function connect(method='browser'){
 const buttons=[$('connectBtn'),$('connectWalletBtn')];
 buttons.forEach(b=>b.disabled=true);
 try{
  toast(t('connecting'));
  if(method==='wallet'){
   if(!window.ethereum||typeof window.ethereum.request!=='function')throw new Error(t('sendError'));
   provider=window.ethereum;
   await provider.request({method:'eth_requestAccounts'});
   window.fiWalletConnectActive=false;
  }else{
   if(typeof window.fiSelectWalletProvider!=='function')throw new Error(t('sendError'));
   provider=await window.fiSelectWalletProvider();
  }
  await switchBsc(provider);bindWalletEvents(provider);
  const accounts=await provider.request({method:'eth_requestAccounts'});
  if(!accounts||!accounts[0])throw new Error(t('sendError'));
  address=ethers.utils.getAddress(accounts[0]);
  if(!API){$('connectBtn').textContent=short(address);$('connectWalletBtn').textContent=short(address);$('walletLabel').textContent=short(address);toast(t('backendMissing'));return}
  const challenge=await request('/api/auth/challenge',{method:'POST',body:JSON.stringify({address})});
  toast(t('sign'));
  const signature=await provider.request({method:'personal_sign',params:[ethers.utils.hexlify(ethers.utils.toUtf8Bytes(challenge.message)),address]});
  toast(t('checking'));
  const verified=await request('/api/auth/verify',{method:'POST',body:JSON.stringify({address,nonce:challenge.nonce,signature})});
  token=verified.token;$('walletLabel').textContent=short(address);$('tierLabel').textContent=t('tier')+' '+verified.tier+' · '+Number(verified.balance).toLocaleString()+' FIT';
  $('connectBtn').textContent=short(address);$('connectWalletBtn').textContent=short(address);
  $('accessPanel').classList.add('hidden');$('workspace').classList.remove('hidden');toast(t('accessGranted'));await loadProfile();
 }catch(e){toast(e.message||t('sendError'))}
 finally{buttons.forEach(b=>b.disabled=false)}
}
function addMessage(role,content){const el=document.createElement('div');el.className='message '+role;el.textContent=content;$('messages').appendChild(el);$('welcome').classList.add('hidden');el.scrollIntoView({block:'end',behavior:'smooth'})}
async function send(text){text=(text||'').trim();if(!text){toast(t('empty'));return}if(!token){toast(t('backendMissing'));return}if(!profile?.country_code){showCountryDialog(true);return}if(busy)return;busy=true;addMessage('user',text);history.push({role:'user',content:text});$('prompt').value='';$('sendBtn').disabled=true;const loading=document.createElement('div');loading.className='message assistant';loading.textContent=t('sending');$('messages').appendChild(loading);try{const result=await request('/api/chat',{method:'POST',body:JSON.stringify({messages:history.slice(-20),language:currentLanguage(),assistantId})});loading.remove();addMessage('assistant',result.reply||'');history.push({role:'assistant',content:result.reply||''})}catch(e){loading.remove();addMessage('assistant',e.message||t('sendError'))}finally{busy=false;$('sendBtn').disabled=false}}
$('connectBtn').addEventListener('click',()=>connect('browser'));$('connectWalletBtn').addEventListener('click',()=>connect('wallet'));
document.querySelectorAll('[data-assistant]').forEach(card=>card.addEventListener('click',()=>{const next=card.dataset.assistant;if(next===assistantId)return;assistantId=next;history=[];$('messages').innerHTML='';$('welcome').classList.remove('hidden');document.querySelectorAll('[data-assistant]').forEach(item=>{const active=item===card;item.classList.toggle('active',active);item.setAttribute('aria-pressed',String(active))});}));$('chatForm').addEventListener('submit',e=>{e.preventDefault();send($('prompt').value)});document.querySelectorAll('[data-prompt]').forEach(b=>b.addEventListener('click',()=>send(b.dataset.prompt)));document.querySelector('[data-i18n="newChat"]').addEventListener('click',()=>{history=[];$('messages').innerHTML='';$('welcome').classList.remove('hidden')});$('disconnectBtn').addEventListener('click',async()=>{token='';address='';profile=null;history=[];$('messages').innerHTML='';$('workspace').classList.add('hidden');$('accessPanel').classList.remove('hidden');$('connectBtn').textContent=t('connectBrowser');$('connectWalletBtn').textContent=t('connectWallet');$('regionSettingsBtn')?.remove();$('countryDialog')?.remove();if(window.fiDisconnectSelectedWallet)await window.fiDisconnectSelectedWallet();toast(t('signedOut'))});$('themeToggle').addEventListener('click',()=>{document.body.classList.toggle('light');localStorage.setItem('fly_ai_theme',document.body.classList.contains('light')?'light':'dark')});if(localStorage.getItem('fly_ai_theme')==='light')document.body.classList.add('light');if(window.ethereum)bindWalletEvents(window.ethereum);document.addEventListener('fly-ai-language-updated',updateRegionTexts);
})();