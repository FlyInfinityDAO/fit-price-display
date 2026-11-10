(function(){'use strict';
const $=id=>document.getElementById(id);
const API=(window.FLY_AI_CONFIG&&window.FLY_AI_CONFIG.apiBase||'').replace(/\/$/,'');
const FIT='0xBebe4ea7aA4037CeF5D0bc25a10f9dcA16120Dfa',CHAIN='0x38';
let provider=null,address='',token='',busy=false,history=[],profile=null,assistantId='general',conversationId=null,conversations=[],memoryEnabled=true,memoryItems=[],historyUiBound=false;
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
 if(!$('regionSettingsBtn')){const b=document.createElement('button');b.id='regionSettingsBtn';b.type='button';b.className='text-btn region-settings-btn';b.textContent=t('regionSettings');b.addEventListener('click',()=>showCountryDialog(false));$('disconnectBtn').parentElement.before(b)}
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
  $('accessPanel').classList.add('hidden');$('workspace').classList.remove('hidden');toast(t('accessGranted'));await loadProfile();await initializeHistoryUI();
 }catch(e){toast(e.message||t('sendError'))}
 finally{buttons.forEach(b=>b.disabled=false)}
}
const assistantPrompts={
 general:["Give me a clear overview of the Fly Infinity ecosystem, its main components and how they connect.","Explain FIT token utility, token mechanics and the role of the reserve in simple terms.","Create a practical getting-started roadmap for a new Fly Infinity community member."],
 legal:["Explain the key legal considerations for a blockchain token project, distinguishing general information from jurisdiction-specific legal advice.","Walk me through a practical checklist for reviewing a crypto project's terms, disclosures and consumer risks.","Help me prepare a list of questions to discuss with a qualified lawyer about a blockchain project."],
 english:["Assess my English level with a short interactive exercise, then explain my mistakes.","Teach me 10 useful English phrases for professional conversations, with examples and pronunciation tips.","Create a 15-minute daily English practice plan focused on speaking, vocabulary and listening."],
 parenting:["Explain age-appropriate ways to build a child's emotional regulation and confidence.","Give practical steps for handling a common parent-child conflict calmly and constructively.","Create an age-aware weekly routine that balances learning, play, sleep and family time."],
 books:["Recommend foundational books for personal growth and explain what each teaches.","Suggest books for a specific topic, comparing their level, approach and practical value.","Build a personalized reading path with beginner, intermediate and advanced stages."],
 culture:["Explain an important Iranian cultural tradition and its historical background.","Compare a social custom in Iran with the same custom in another culture, respectfully and with context.","Create a learning path to explore the history, arts and everyday culture of a country."],
 network:["Explain how to build a sustainable network through trust, value and ethical communication.","Give me a practical framework for mentoring a new team member and tracking their progress.","Create a 30-day leadership and team-development plan with measurable weekly actions."]
};


async function refreshConversations(){
 const data=await request('/api/conversations');conversations=data.conversations||[];const wrap=$('conversationList');if(!wrap)return;wrap.innerHTML='';
 if(!conversations.length){const empty=document.createElement('small');empty.className='sidebar-empty';empty.textContent=t('noChats');wrap.append(empty);return}
 conversations.forEach(item=>{const row=document.createElement('div');row.className='conversation-row'+(item.id===conversationId?' active':'');const open=document.createElement('button');open.type='button';open.className='conversation-open';open.textContent=item.title;open.title=item.title;open.addEventListener('click',()=>openConversation(item.id));const del=document.createElement('button');del.type='button';del.className='conversation-delete';del.textContent='×';del.title=t('deleteChat');del.addEventListener('click',async e=>{e.stopPropagation();try{await request('/api/conversations/'+item.id,{method:'DELETE'});if(conversationId===item.id){conversationId=null;history=[];$('messages').innerHTML='';$('welcome').classList.remove('hidden')}await refreshConversations()}catch(err){toast(err.message)}});row.append(open,del);wrap.append(row)});
}
async function openConversation(id){
 try{const data=await request('/api/conversations/'+id);conversationId=id;assistantId=data.conversation.assistant_id;history=(data.messages||[]).map(m=>({role:m.role,content:m.content}));$('messages').innerHTML='';$('welcome').classList.add('hidden');history.forEach(m=>addMessage(m.role,m.content));renderAssistantSuggestions();document.querySelectorAll('[data-assistant]').forEach(item=>{const active=item.dataset.assistant===assistantId;item.classList.toggle('active',active);item.setAttribute('aria-pressed',String(active))});await refreshConversations()}catch(e){toast(e.message||t('sendError'))}
}
async function loadMemory(){
 const data=await request('/api/memory');memoryEnabled=data.enabled;memoryItems=data.memories||[];renderMemory();
}
function renderMemory(){
 const toggle=$('memoryToggle'),list=$('memoryList');if(!toggle||!list)return;
 toggle.textContent=t('memory')+': '+(memoryEnabled?t('memoryOn'):t('memoryOff'));toggle.setAttribute('aria-pressed',String(memoryEnabled));
 list.innerHTML='';if(!memoryItems.length){const empty=document.createElement('small');empty.className='sidebar-empty';empty.textContent=t('noMemories');list.append(empty);return}
 memoryItems.forEach(item=>{const row=document.createElement('div');row.className='memory-row';const content=document.createElement('div');const key=document.createElement('strong');key.textContent=item.memory_key.replace(/_/g,' ');const value=document.createElement('small');value.textContent=item.memory_value;content.append(key,value);const edit=document.createElement('button');edit.type='button';edit.textContent='✎';edit.title=t('editMemory');edit.addEventListener('click',async()=>{const value=prompt(t('editMemory'),item.memory_value);if(value===null||!value.trim())return;try{await request('/api/memory/'+item.id,{method:'PUT',body:JSON.stringify({value:value.trim()})});item.memory_value=value.trim();renderMemory()}catch(e){toast(e.message)}});const del=document.createElement('button');del.type='button';del.textContent='×';del.title=t('deleteMemory');del.addEventListener('click',async()=>{try{await request('/api/memory/'+item.id,{method:'DELETE'});memoryItems=memoryItems.filter(x=>x.id!==item.id);renderMemory()}catch(e){toast(e.message)}});row.append(content,edit,del);list.append(row)});
}
async function initializeHistoryUI(){
 if(!$('conversationList'))return;
 if(!historyUiBound){historyUiBound=true;
 $('memoryToggle').addEventListener('click',async()=>{try{const enabled=!memoryEnabled;const data=await request('/api/memory/settings',{method:'PUT',body:JSON.stringify({enabled})});memoryEnabled=data.enabled;if(!memoryEnabled)memoryItems=[];else await loadMemory();renderMemory()}catch(e){toast(e.message)}});
 $('memoryView').addEventListener('click',async()=>{try{await loadMemory();$('memoryList').classList.toggle('hidden')}catch(e){toast(e.message)}});
 $('clearMemory').addEventListener('click',async()=>{if(!confirm(t('confirmClearMemory')))return;try{await request('/api/memory',{method:'DELETE'});memoryItems=[];renderMemory();toast(t('memoryCleared'))}catch(e){toast(e.message)}});
 $('clearHistory').addEventListener('click',async()=>{if(!confirm(t('confirmClearHistory')))return;try{await request('/api/conversations',{method:'DELETE'});conversationId=null;history=[];$('messages').innerHTML='';$('welcome').classList.remove('hidden');await refreshConversations();toast(t('historyCleared'))}catch(e){toast(e.message)}});
 }
 await Promise.all([refreshConversations(),loadMemory()]);
 if(conversations.length)await openConversation(conversations[0].id);
}

function renderAssistantSuggestions(){
 const wrap=$("assistantSuggestions");if(!wrap)return;
 const prompts=assistantPrompts[assistantId]||assistantPrompts.general;
 const icons=["✧","◈","⌘"];
 wrap.innerHTML="";
 prompts.forEach((prompt,index)=>{const b=document.createElement("button");b.type="button";b.dataset.prompt=prompt;b.innerHTML=icons[index]+' <span></span>';b.querySelector("span").textContent=t('suggest_'+assistantId+'_'+(index+1));b.addEventListener("click",()=>send(prompt));wrap.appendChild(b)});
}
function addMessage(role,content){const el=document.createElement('div');el.className='message '+role;el.textContent=content;$('messages').appendChild(el);$('welcome').classList.add('hidden');el.scrollIntoView({block:'end',behavior:'smooth'})}
async function send(text){text=(text||'').trim();if(!text){toast(t('empty'));return}if(!token){toast(t('backendMissing'));return}if(!profile?.country_code){showCountryDialog(true);return}if(busy)return;busy=true;addMessage('user',text);history.push({role:'user',content:text});$('prompt').value='';$('sendBtn').disabled=true;const loading=document.createElement('div');loading.className='message assistant';loading.textContent=t('sending');$('messages').appendChild(loading);try{const result=await request('/api/chat',{method:'POST',body:JSON.stringify({messages:history.slice(-20),language:currentLanguage(),assistantId,conversationId})});conversationId=result.conversationId||conversationId;loading.remove();addMessage('assistant',result.reply||'');history.push({role:'assistant',content:result.reply||''});await refreshConversations()}catch(e){loading.remove();addMessage('assistant',e.message||t('sendError'))}finally{busy=false;$('sendBtn').disabled=false}}
$('connectBtn').addEventListener('click',()=>connect('browser'));$('connectWalletBtn').addEventListener('click',()=>connect('wallet'));$('workspaceMenuToggle')?.addEventListener('click',()=>{const open=$('workspace').classList.toggle('mobile-menu-open');$('workspaceMenuToggle').setAttribute('aria-expanded',String(open))});$('workspaceSidebar')?.addEventListener('click',e=>{if(e.target.closest('button')&&window.matchMedia('(max-width: 620px)').matches){$('workspace').classList.remove('mobile-menu-open');$('workspaceMenuToggle')?.setAttribute('aria-expanded','false')}});document.addEventListener('keydown',e=>{if(e.key==='Escape'){$('workspace').classList.remove('mobile-menu-open');$('workspaceMenuToggle')?.setAttribute('aria-expanded','false')}});
document.querySelectorAll('[data-assistant]').forEach(card=>card.addEventListener('click',()=>{const next=card.dataset.assistant;if(next===assistantId)return;assistantId=next;conversationId=null;history=[];$('messages').innerHTML='';$('welcome').classList.remove('hidden');renderAssistantSuggestions();document.querySelectorAll('[data-assistant]').forEach(item=>{const active=item===card;item.classList.toggle('active',active);item.setAttribute('aria-pressed',String(active))});}));$('chatForm').addEventListener('submit',e=>{e.preventDefault();send($('prompt').value)});document.querySelector('[data-i18n="newChat"]').addEventListener('click',()=>{conversationId=null;history=[];$('messages').innerHTML='';$('welcome').classList.remove('hidden');document.querySelectorAll('[data-assistant]').forEach(item=>{const active=item.dataset.assistant===assistantId;item.classList.toggle('active',active);item.setAttribute('aria-pressed',String(active))})});$('disconnectBtn').addEventListener('click',async()=>{token='';address='';profile=null;history=[];conversationId=null;conversations=[];memoryItems=[];$('messages').innerHTML='';$('workspace').classList.add('hidden');$('accessPanel').classList.remove('hidden');$('connectBtn').textContent=t('connectBrowser');$('connectWalletBtn').textContent=t('connectWallet');$('regionSettingsBtn')?.remove();$('countryDialog')?.remove();if(window.fiDisconnectSelectedWallet)await window.fiDisconnectSelectedWallet();toast(t('signedOut'))});if(window.ethereum)bindWalletEvents(window.ethereum);document.addEventListener('fly-ai-language-updated',()=>{updateRegionTexts();renderAssistantSuggestions();renderMemory()});renderAssistantSuggestions();
})();