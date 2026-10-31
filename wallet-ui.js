/* Fly Infinity — shared browser-injected wallet panel (EIP-1193). */
(function () {
  const words = {
    en:{wallet:'Wallet',title:'Wallet overview',statusOff:'Not connected',statusOn:'Connected',connect:'Connect wallet',disconnect:'Disconnect',account:'Wallet address',network:'Network',noProvider:'No browser wallet was detected. Open this site in a browser with a compatible wallet extension.',connecting:'Waiting for wallet approval…',rejected:'Connection request was declined.',error:'Could not connect. Please check your wallet and try again.',localDisconnect:'The site has cleared the displayed account. To revoke site access completely, manage connected sites in your wallet.',close:'Close',unknown:'Unknown network',bsc:'BNB Smart Chain',other:'Chain',copied:'Copy address',copyDone:'Copied'},
    fa:{wallet:'کیف پول',title:'نمای کلی کیف پول',statusOff:'متصل نیست',statusOn:'متصل است',connect:'اتصال کیف پول',disconnect:'قطع اتصال',account:'آدرس کیف پول',network:'شبکه',noProvider:'کیف پول مرورگری شناسایی نشد. سایت را در مرورگری با کیف پول سازگار باز کنید.',connecting:'در انتظار تأیید در کیف پول…',rejected:'درخواست اتصال رد شد.',error:'اتصال انجام نشد. کیف پول را بررسی و دوباره تلاش کنید.',localDisconnect:'آدرس نمایش‌داده‌شده در سایت پاک شد. برای لغو کامل دسترسی سایت، بخش سایت‌های متصل در کیف پول را مدیریت کنید.',close:'بستن',unknown:'شبکه ناشناخته',bsc:'BNB Smart Chain',other:'شبکه',copied:'کپی آدرس',copyDone:'کپی شد'},
    ar:{wallet:'المحفظة',title:'نظرة عامة على المحفظة',statusOff:'غير متصل',statusOn:'متصل',connect:'اتصال المحفظة',disconnect:'قطع الاتصال',account:'عنوان المحفظة',network:'الشبكة',noProvider:'لم يتم العثور على محفظة في المتصفح. افتح الموقع في متصفح يدعم محفظة متوافقة.',connecting:'بانتظار موافقة المحفظة…',rejected:'تم رفض طلب الاتصال.',error:'تعذر الاتصال. تحقق من محفظتك وحاول مرة أخرى.',localDisconnect:'تم مسح الحساب المعروض من الموقع. لإلغاء الوصول بالكامل، أدر المواقع المتصلة من محفظتك.',close:'إغلاق',unknown:'شبكة غير معروفة',bsc:'BNB Smart Chain',other:'الشبكة',copied:'نسخ العنوان',copyDone:'تم النسخ'},
    tr:{wallet:'Cüzdan',title:'Cüzdan özeti',statusOff:'Bağlı değil',statusOn:'Bağlı',connect:'Cüzdanı bağla',disconnect:'Bağlantıyı kes',account:'Cüzdan adresi',network:'Ağ',noProvider:'Tarayıcı cüzdanı bulunamadı. Siteyi uyumlu bir cüzdan uzantısı olan tarayıcıda açın.',connecting:'Cüzdan onayı bekleniyor…',rejected:'Bağlantı isteği reddedildi.',error:'Bağlanılamadı. Cüzdanınızı kontrol edip tekrar deneyin.',localDisconnect:'Sitede gösterilen hesap temizlendi. Site erişimini tamamen iptal etmek için cüzdanınızdaki bağlı siteleri yönetin.',close:'Kapat',unknown:'Bilinmeyen ağ',bsc:'BNB Smart Chain',other:'Ağ',copied:'Adresi kopyala',copyDone:'Kopyalandı'},
    ru:{wallet:'Кошелёк',title:'Обзор кошелька',statusOff:'Не подключён',statusOn:'Подключён',connect:'Подключить кошелёк',disconnect:'Отключить',account:'Адрес кошелька',network:'Сеть',noProvider:'Браузерный кошелёк не обнаружен. Откройте сайт в браузере с совместимым расширением кошелька.',connecting:'Ожидание подтверждения в кошельке…',rejected:'Запрос на подключение отклонён.',error:'Не удалось подключиться. Проверьте кошелёк и повторите попытку.',localDisconnect:'Отображаемый на сайте аккаунт очищен. Чтобы полностью отозвать доступ, управляйте подключёнными сайтами в кошельке.',close:'Закрыть',unknown:'Неизвестная сеть',bsc:'BNB Smart Chain',other:'Сеть',copied:'Скопировать адрес',copyDone:'Скопировано'},
    zh:{wallet:'钱包',title:'钱包概览',statusOff:'未连接',statusOn:'已连接',connect:'连接钱包',disconnect:'断开连接',account:'钱包地址',network:'网络',noProvider:'未检测到浏览器钱包。请在支持兼容钱包扩展的浏览器中打开此网站。',connecting:'等待钱包确认…',rejected:'连接请求已被拒绝。',error:'连接失败。请检查钱包后重试。',localDisconnect:'网站已清除显示的账户。如需完全撤销网站权限，请在钱包中管理已连接的网站。',close:'关闭',unknown:'未知网络',bsc:'BNB Smart Chain',other:'网络',copied:'复制地址',copyDone:'已复制'},
    es:{wallet:'Billetera',title:'Resumen de billetera',statusOff:'No conectada',statusOn:'Conectada',connect:'Conectar billetera',disconnect:'Desconectar',account:'Dirección de billetera',network:'Red',noProvider:'No se detectó una billetera del navegador. Abre este sitio en un navegador con una extensión compatible.',connecting:'Esperando la aprobación de la billetera…',rejected:'Se rechazó la solicitud de conexión.',error:'No se pudo conectar. Comprueba tu billetera e inténtalo de nuevo.',localDisconnect:'El sitio ha borrado la cuenta mostrada. Para revocar el acceso por completo, administra los sitios conectados en tu billetera.',close:'Cerrar',unknown:'Red desconocida',bsc:'BNB Smart Chain',other:'Red',copied:'Copiar dirección',copyDone:'Copiado'},
    pt:{wallet:'Carteira',title:'Visão geral da carteira',statusOff:'Não conectada',statusOn:'Conectada',connect:'Conectar carteira',disconnect:'Desconectar',account:'Endereço da carteira',network:'Rede',noProvider:'Nenhuma carteira do navegador foi detectada. Abra este site em um navegador com uma extensão compatível.',connecting:'Aguardando aprovação da carteira…',rejected:'A solicitação de conexão foi recusada.',error:'Não foi possível conectar. Verifique sua carteira e tente novamente.',localDisconnect:'O site limpou a conta exibida. Para revogar totalmente o acesso, gerencie os sites conectados na sua carteira.',close:'Fechar',unknown:'Rede desconhecida',bsc:'BNB Smart Chain',other:'Rede',copied:'Copiar endereço',copyDone:'Copiado'}
  };
  const icon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"></rect><path d="M3 9h18"></path><path d="M16 14h2"></path></svg>';
  let provider=null, account='', chainId='', messageTimer=null;
  const lang=()=>{const l=(document.documentElement.lang||'en').slice(0,2);return words[l]?l:'en';};
  const t=()=>words[lang()];
  const short=a=>a?a.slice(0,6)+'…'+a.slice(-4):'—';
  const chainName=id=>id==='0x38'?t().bsc:(id?`${t().other} (${parseInt(id,16)})`:t().unknown);
  function button(){
    if(document.getElementById('walletBtn')) return;
    const b=document.createElement('button');b.id='walletBtn';b.className='fi-wallet-button fi-wallet-floating';b.type='button';b.innerHTML=icon;b.setAttribute('aria-label',t().wallet);b.title=t().wallet;document.body.appendChild(b);
  }
  function panel(){
    if(document.getElementById('fiWalletOverlay'))return;
    const o=document.createElement('div');o.id='fiWalletOverlay';o.className='fi-wallet-overlay';o.setAttribute('aria-hidden','true');
    o.innerHTML=`<section class="fi-wallet-panel" role="dialog" aria-modal="true" aria-labelledby="fiWalletTitle"><div class="fi-wallet-panel-head"><h2 class="fi-wallet-title" id="fiWalletTitle"></h2><button class="fi-wallet-close" type="button" id="fiWalletClose" aria-label="Close">×</button></div><p class="fi-wallet-status"><span class="fi-wallet-status-dot" id="fiWalletDot"></span><span id="fiWalletStatus"></span></p><div class="fi-wallet-details"><div class="fi-wallet-detail"><span class="fi-wallet-metric-label" id="fiAccountLabel"></span><strong class="fi-wallet-address" id="fiWalletAddress">—</strong></div><div class="fi-wallet-detail"><span class="fi-wallet-metric-label" id="fiNetworkLabel"></span><strong class="fi-wallet-metric-value" id="fiWalletNetwork">—</strong></div></div><p class="fi-wallet-note" id="fiWalletNote" role="status" aria-live="polite"></p><div class="fi-wallet-actions"><button type="button" class="fi-wallet-connect" id="fiWalletConnect"></button><button type="button" class="fi-wallet-disconnect" id="fiWalletDisconnect" hidden></button></div></section>`;
    document.body.appendChild(o);
    const close=()=>{o.classList.remove('is-open');o.setAttribute('aria-hidden','true');};
    document.getElementById('fiWalletClose').addEventListener('click',close);
    o.addEventListener('click',e=>{if(e.target===o)close();});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
    document.getElementById('fiWalletConnect').addEventListener('click',connect);
    document.getElementById('fiWalletDisconnect').addEventListener('click',disconnectLocal);
    const bind=()=>{const b=document.getElementById('walletBtn');if(!b||b.dataset.fiWalletBound==='1')return !!b;b.dataset.fiWalletBound='1';b.addEventListener('click',async()=>{o.classList.add('is-open');o.setAttribute('aria-hidden','false');await refreshExisting();document.getElementById('fiWalletClose').focus();});return true;};
    if(!bind()){const mo=new MutationObserver(()=>{if(bind())mo.disconnect();});mo.observe(document.body,{childList:true,subtree:true});}
    window.addEventListener('fi-language-change',updateText);new MutationObserver(updateText).observe(document.documentElement,{attributes:true,attributeFilter:['lang','dir']});
    updateText();renderState();
  }
  function note(msg){const e=document.getElementById('fiWalletNote');if(e)e.textContent=msg||'';}
  function renderState(){
    const a=document.getElementById('fiWalletAddress'),n=document.getElementById('fiWalletNetwork'),s=document.getElementById('fiWalletStatus'),d=document.getElementById('fiWalletDot'),c=document.getElementById('fiWalletConnect'),x=document.getElementById('fiWalletDisconnect');
    if(!a)return;
    a.textContent=short(account);a.title=account||'';n.textContent=chainName(chainId);s.textContent=account?t().statusOn:t().statusOff;
    d.classList.toggle('is-connected',!!account);c.hidden=!!account;x.hidden=!account;c.textContent=t().connect;x.textContent=t().disconnect;
  }
  function updateText(){
    const z=t(),set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
    set('fiWalletTitle',z.title);set('fiAccountLabel',z.account);set('fiNetworkLabel',z.network);
    const b=document.getElementById('walletBtn');if(b){b.title=z.wallet;b.setAttribute('aria-label',z.wallet);}
    const cl=document.getElementById('fiWalletClose');if(cl)cl.setAttribute('aria-label',z.close);
    const c=document.getElementById('fiWalletConnect'),x=document.getElementById('fiWalletDisconnect');if(c)c.textContent=z.connect;if(x)x.textContent=z.disconnect;
    if(document.getElementById('fiWalletStatus'))renderState();
  }
  async function refreshExisting(){
    provider=window.ethereum||null;
    if(!provider){account='';chainId='';renderState();note(t().noProvider);return;}
    try{const accounts=await provider.request({method:'eth_accounts'});account=accounts&&accounts[0]||'';chainId=await provider.request({method:'eth_chainId'});listen();renderState();note('');}
    catch(e){renderState();note(t().error);}
  }
  async function connect(){
    provider=window.ethereum||null;
    if(!provider){note(t().noProvider);return;}
    const b=document.getElementById('fiWalletConnect');b.disabled=true;note(t().connecting);
    try{const accounts=await provider.request({method:'eth_requestAccounts'});account=accounts&&accounts[0]||'';chainId=await provider.request({method:'eth_chainId'});listen();renderState();note('');}
    catch(e){note(e&&e.code===4001?t().rejected:t().error);}
    finally{b.disabled=false;}
  }
  function disconnectLocal(){
    account='';renderState();note(t().localDisconnect);
  }
  function listen(){
    if(!provider||provider.__fiWalletPanelBound)return;
    provider.__fiWalletPanelBound=true;
    if(provider.on){
      provider.on('accountsChanged',a=>{account=a&&a[0]||'';renderState();if(!account)note(t().statusOff);});
      provider.on('chainChanged',id=>{chainId=id;renderState();});
      provider.on('disconnect',()=>{account='';chainId='';renderState();note(t().statusOff);});
    }
  }
  function init(){if(!window.FI_LANG_HEADER_ENABLED)button();panel();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
