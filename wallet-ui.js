/* Fly Infinity — browser wallet panel with read-only BSC contract data. */
(function () {
  const FIT = '0xBebe4ea7aA4037CeF5D0bc25a10f9dcA16120Dfa';
  const NETWORK = '0x7f1cB4fce7cB3b6C612c4A7Dd123D386564d0C1B';
  const BSC_CHAIN = '0x38';
  const SEL = {
    balanceOf: '0x70a08231',
    price: '0x9dfde201',
    ownerInfo: '0x41c7dd5b',
    leftRight: '0x54e33bbb'
  };
  const words = {
    en:{wallet:'Wallet',title:'Wallet overview',statusOff:'Not connected',statusOn:'Connected',connect:'Connect wallet',disconnect:'Disconnect',account:'Wallet address',network:'Network',noProvider:'No browser wallet was detected. Open this site in a browser with a compatible wallet.',connecting:'Waiting for wallet approval…',rejected:'Connection request was declined.',error:'Could not connect. Please check your wallet and try again.',localDisconnect:'The displayed account was cleared. To revoke site access completely, manage connected sites in your wallet.',close:'Close',unknown:'Unknown network',bsc:'BNB Smart Chain',other:'Chain',balance:'FIT balance',usdValue:'FIT value',usd7:'FIT value 7 days ago',usd30:'FIT value 30 days ago',historyBasis:'Calculated using your current FIT balance and the historical FIT price; it does not represent your actual wallet balance on those dates.',compareLabel:'Compare value with',period24h:'24 hours ago',period7d:'7 days ago',period30d:'30 days ago',period6m:'6 months ago',period1y:'1 year ago',compareValue:'Difference in FIT value',compareHistoryNote:'Historical price is not available for this date. Daily history is used, so 24 hours means the previous daily record.',historyUnavailable:'Historical data unavailable',purchased:'Purchased',allowed:'Allowed limit',remaining:'Remaining',smallerSide:'Network points',left:'Left',right:'Right',loading:'Loading contract data…',readError:'Could not read contract data. Check the BNB Smart Chain network and try again.',wrongNetwork:'Switch your wallet to BNB Smart Chain to view FIT data.',notAvailable:'—'},
    fa:{wallet:'کیف پول',title:'نمای کلی کیف پول',statusOff:'متصل نیست',statusOn:'متصل است',connect:'اتصال کیف پول',disconnect:'قطع اتصال',account:'آدرس کیف پول',network:'شبکه',noProvider:'کیف پول مرورگری شناسایی نشد. سایت را در مرورگری با کیف پول سازگار باز کنید.',connecting:'در انتظار تأیید در کیف پول…',rejected:'درخواست اتصال رد شد.',error:'اتصال انجام نشد. کیف پول را بررسی و دوباره تلاش کنید.',localDisconnect:'حساب نمایش‌داده‌شده پاک شد. برای لغو کامل دسترسی، سایت‌های متصل را در کیف پول مدیریت کنید.',close:'بستن',unknown:'شبکه ناشناخته',bsc:'BNB Smart Chain',other:'شبکه',balance:'موجودی FIT',usdValue:'ارزش دلاری FIT',usd7:'ارزش دلاری FIT در ۷ روز گذشته',usd30:'ارزش دلاری FIT در ۳۰ روز گذشته',historyBasis:'این مقادیر با موجودی فعلی FIT و قیمت تاریخی محاسبه شده‌اند و نشان‌دهنده موجودی واقعی کیف پول در آن تاریخ‌ها نیستند.',compareLabel:'مقایسه ارزش با',period24h:'۲۴ ساعت قبل',period7d:'۷ روز قبل',period30d:'۳۰ روز قبل',period6m:'۶ ماه قبل',period1y:'۱ سال قبل',compareValue:'اختلاف ارزش دلاری FIT',compareHistoryNote:'برای این تاریخ سابقه قیمت موجود نیست. تاریخچه به‌صورت روزانه ثبت می‌شود؛ بنابراین ۲۴ ساعت قبل بر اساس رکورد روزانه قبلی محاسبه می‌شود.',historyUnavailable:'سابقه قیمت برای این بازه موجود نیست',purchased:'خریداری‌شده',allowed:'سقف مجاز',remaining:'باقی‌مانده',smallerSide:'امتیاز شبکه',left:'چپ',right:'راست',loading:'در حال دریافت اطلاعات قرارداد…',readError:'دریافت اطلاعات قرارداد ناموفق بود. شبکه BNB Smart Chain را بررسی و دوباره تلاش کنید.',wrongNetwork:'برای مشاهده اطلاعات FIT، کیف پول را روی BNB Smart Chain قرار دهید.',notAvailable:'—'},
    ar:{wallet:'المحفظة',title:'نظرة عامة على المحفظة',statusOff:'غير متصل',statusOn:'متصل',connect:'اتصال المحفظة',disconnect:'قطع الاتصال',account:'عنوان المحفظة',network:'الشبكة',noProvider:'لم يتم العثور على محفظة متصفح متوافقة.',connecting:'بانتظار موافقة المحفظة…',rejected:'تم رفض طلب الاتصال.',error:'تعذر الاتصال. تحقق من المحفظة وحاول مرة أخرى.',localDisconnect:'تم مسح الحساب المعروض. لإلغاء الوصول بالكامل، أدر المواقع المتصلة في المحفظة.',close:'إغلاق',unknown:'شبكة غير معروفة',bsc:'BNB Smart Chain',other:'الشبكة',balance:'رصيد FIT',usdValue:'قيمة FIT بالدولار',usd7:'قيمة FIT قبل 7 أيام',usd30:'قيمة FIT قبل 30 يوماً',historyBasis:'تم الحساب باستخدام رصيد FIT الحالي والسعر التاريخي، ولا يمثل ذلك رصيد المحفظة الفعلي في تلك التواريخ.',compareLabel:'مقارنة القيمة مع',period24h:'قبل 24 ساعة',period7d:'قبل 7 أيام',period30d:'قبل 30 يوماً',period6m:'قبل 6 أشهر',period1y:'قبل سنة واحدة',compareValue:'الفرق في قيمة FIT',compareHistoryNote:'لا يتوفر سعر تاريخي لهذا التاريخ. السجل يومي، لذا تشير 24 ساعة إلى السجل اليومي السابق.',historyUnavailable:'لا تتوفر بيانات تاريخية لهذه الفترة',purchased:'تم شراؤه',allowed:'الحد المسموح',remaining:'المتبقي',smallerSide:'نقاط الشبكة',left:'يسار',right:'يمين',loading:'جارٍ تحميل بيانات العقد…',readError:'تعذرت قراءة بيانات العقد. تحقق من شبكة BNB Smart Chain وحاول مجدداً.',wrongNetwork:'حوّل المحفظة إلى BNB Smart Chain لعرض بيانات FIT.',notAvailable:'—'},
    tr:{wallet:'Cüzdan',title:'Cüzdan özeti',statusOff:'Bağlı değil',statusOn:'Bağlı',connect:'Cüzdanı bağla',disconnect:'Bağlantıyı kes',account:'Cüzdan adresi',network:'Ağ',noProvider:'Uyumlu tarayıcı cüzdanı bulunamadı.',connecting:'Cüzdan onayı bekleniyor…',rejected:'Bağlantı isteği reddedildi.',error:'Bağlanılamadı. Tekrar deneyin.',localDisconnect:'Gösterilen hesap temizlendi. Erişimi tamamen iptal etmek için bağlı siteleri cüzdanınızdan yönetin.',close:'Kapat',unknown:'Bilinmeyen ağ',bsc:'BNB Smart Chain',other:'Ağ',balance:'FIT bakiyesi',usdValue:'FIT dolar değeri',usd7:'7 gün önceki FIT değeri',usd30:'30 gün önceki FIT değeri',historyBasis:'Mevcut FIT bakiyesi ve geçmiş FIT fiyatı kullanılarak hesaplanır; o tarihlerdeki gerçek cüzdan bakiyesini göstermez.',compareLabel:'Değeri şu tarihle karşılaştır',period24h:'24 saat önce',period7d:'7 gün önce',period30d:'30 gün önce',period6m:'6 ay önce',period1y:'1 yıl önce',compareValue:'FIT değer farkı',compareHistoryNote:'Bu tarih için geçmiş fiyat bulunmuyor. Geçmiş veriler günlük tutulur; bu nedenle 24 saat önce seçeneği önceki günlük kaydı kullanır.',historyUnavailable:'Bu dönem için geçmiş veri yok',purchased:'Satın alınan',allowed:'İzin verilen limit',remaining:'Kalan',smallerSide:'Ağ puanları',left:'Sol',right:'Sağ',loading:'Sözleşme verileri yükleniyor…',readError:'Sözleşme verileri okunamadı. BNB Smart Chain ağını kontrol edin.',wrongNetwork:'FIT verilerini görmek için cüzdanınızı BNB Smart Chain ağına geçirin.',notAvailable:'—'},
    ru:{wallet:'Кошелёк',title:'Обзор кошелька',statusOff:'Не подключён',statusOn:'Подключён',connect:'Подключить кошелёк',disconnect:'Отключить',account:'Адрес кошелька',network:'Сеть',noProvider:'Совместимый браузерный кошелёк не обнаружен.',connecting:'Ожидание подтверждения…',rejected:'Запрос отклонён.',error:'Не удалось подключиться. Повторите попытку.',localDisconnect:'Отображаемый аккаунт очищен. Для полного отзыва доступа управляйте подключёнными сайтами в кошельке.',close:'Закрыть',unknown:'Неизвестная сеть',bsc:'BNB Smart Chain',other:'Сеть',balance:'Баланс FIT',usdValue:'Стоимость FIT в долларах',usd7:'Стоимость FIT 7 дней назад',usd30:'Стоимость FIT 30 дней назад',historyBasis:'Рассчитано по текущему балансу FIT и исторической цене; это не фактический баланс кошелька на те даты.',compareLabel:'Сравнить стоимость с датой',period24h:'24 часа назад',period7d:'7 дней назад',period30d:'30 дней назад',period6m:'6 месяцев назад',period1y:'1 год назад',compareValue:'Разница в стоимости FIT',compareHistoryNote:'Историческая цена для этой даты недоступна. История ведётся по дням, поэтому для 24 часов используется предыдущая дневная запись.',historyUnavailable:'Исторические данные за этот период недоступны',purchased:'Куплено',allowed:'Разрешённый лимит',remaining:'Осталось',smallerSide:'Баллы сети',left:'Слева',right:'Справа',loading:'Загрузка данных контракта…',readError:'Не удалось прочитать данные контракта. Проверьте сеть BNB Smart Chain.',wrongNetwork:'Переключите кошелёк на BNB Smart Chain для просмотра данных FIT.',notAvailable:'—'},
    zh:{wallet:'钱包',title:'钱包概览',statusOff:'未连接',statusOn:'已连接',connect:'连接钱包',disconnect:'断开连接',account:'钱包地址',network:'网络',noProvider:'未检测到兼容的浏览器钱包。',connecting:'等待钱包确认…',rejected:'连接请求已被拒绝。',error:'连接失败，请重试。',localDisconnect:'已清除显示的账户。如需完全撤销权限，请在钱包中管理已连接的网站。',close:'关闭',unknown:'未知网络',bsc:'BNB Smart Chain',other:'网络',balance:'FIT 余额',usdValue:'FIT 美元价值',usd7:'7天前的 FIT 价值',usd30:'30天前的 FIT 价值',historyBasis:'根据当前 FIT 余额和历史价格计算，并不代表这些日期钱包中的实际余额。',compareLabel:'与以下日期比较价值',period24h:'24小时前',period7d:'7天前',period30d:'30天前',period6m:'6个月前',period1y:'1年前',compareValue:'FIT价值差额',compareHistoryNote:'该日期没有可用的历史价格。价格历史按日记录，因此“24小时前”使用前一个日记录。',historyUnavailable:'该时间段没有历史数据',purchased:'已购买',allowed:'允许上限',remaining:'剩余',smallerSide:'网络积分',left:'左',right:'右',loading:'正在读取合约数据…',readError:'无法读取合约数据，请检查 BNB Smart Chain 网络。',wrongNetwork:'请将钱包切换至 BNB Smart Chain 以查看 FIT 数据。',notAvailable:'—'},
    es:{wallet:'Billetera',title:'Resumen de billetera',statusOff:'No conectada',statusOn:'Conectada',connect:'Conectar billetera',disconnect:'Desconectar',account:'Dirección de billetera',network:'Red',noProvider:'No se detectó una billetera de navegador compatible.',connecting:'Esperando aprobación…',rejected:'Se rechazó la solicitud.',error:'No se pudo conectar. Inténtalo de nuevo.',localDisconnect:'Se borró la cuenta mostrada. Para revocar el acceso, administra los sitios conectados en tu billetera.',close:'Cerrar',unknown:'Red desconocida',bsc:'BNB Smart Chain',other:'Red',balance:'Saldo FIT',usdValue:'Valor de FIT en dólares',usd7:'Valor de FIT hace 7 días',usd30:'Valor de FIT hace 30 días',historyBasis:'Calculado con el saldo FIT actual y el precio histórico; no representa el saldo real de la billetera en esas fechas.',compareLabel:'Comparar el valor con',period24h:'Hace 24 horas',period7d:'Hace 7 días',period30d:'Hace 30 días',period6m:'Hace 6 meses',period1y:'Hace 1 año',compareValue:'Diferencia del valor de FIT',compareHistoryNote:'No hay precio histórico disponible para esta fecha. El historial es diario, por lo que 24 horas utiliza el registro diario anterior.',historyUnavailable:'No hay datos históricos para este período',purchased:'Comprado',allowed:'Límite permitido',remaining:'Restante',smallerSide:'Puntos de red',left:'Izquierda',right:'Derecha',loading:'Cargando datos del contrato…',readError:'No se pudieron leer los datos del contrato. Comprueba BNB Smart Chain.',wrongNetwork:'Cambia tu billetera a BNB Smart Chain para ver los datos de FIT.',notAvailable:'—'},
    pt:{wallet:'Carteira',title:'Visão geral da carteira',statusOff:'Não conectada',statusOn:'Conectada',connect:'Conectar carteira',disconnect:'Desconectar',account:'Endereço da carteira',network:'Rede',noProvider:'Nenhuma carteira de navegador compatível foi detectada.',connecting:'Aguardando aprovação…',rejected:'A solicitação foi recusada.',error:'Não foi possível conectar. Tente novamente.',localDisconnect:'A conta exibida foi limpa. Para revogar o acesso, gerencie os sites conectados na carteira.',close:'Fechar',unknown:'Rede desconhecida',bsc:'BNB Smart Chain',other:'Rede',balance:'Saldo FIT',usdValue:'Valor do FIT em dólares',usd7:'Valor do FIT há 7 dias',usd30:'Valor do FIT há 30 dias',historyBasis:'Calculado com o saldo FIT atual e o preço histórico; não representa o saldo real da carteira nessas datas.',compareLabel:'Comparar o valor com',period24h:'Há 24 horas',period7d:'Há 7 dias',period30d:'Há 30 dias',period6m:'Há 6 meses',period1y:'Há 1 ano',compareValue:'Diferença no valor do FIT',compareHistoryNote:'Não há preço histórico disponível para esta data. O histórico é diário, então 24 horas usa o registro diário anterior.',historyUnavailable:'Não há dados históricos para este período',purchased:'Comprado',allowed:'Limite permitido',remaining:'Restante',smallerSide:'Pontos da rede',left:'Esquerda',right:'Direita',loading:'Carregando dados do contrato…',readError:'Não foi possível ler os dados do contrato. Verifique a BNB Smart Chain.',wrongNetwork:'Mude sua carteira para BNB Smart Chain para ver os dados do FIT.',notAvailable:'—'}
  };
  const icon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"></rect><path d="M3 9h18"></path><path d="M16 14h2"></path></svg>';
  let provider=null, account='', chainId='', currentBalance=0, currentPrice=0, historyRows=[];
  const lang=()=>{const l=(document.documentElement.lang||'en').slice(0,2);return words[l]?l:'en';};
  const t=()=>words[lang()];
  const short=a=>a?a.slice(0,6)+'…'+a.slice(-4):'—';
  const chainName=id=>id===BSC_CHAIN?t().bsc:(id?`${t().other} (${parseInt(id,16)})`:t().unknown);
  const padAddress=a=>a.toLowerCase().replace(/^0x/,'').padStart(64,'0');
  const fromHex=h=>BigInt(h||'0x0');
  const units=v=>Number(v)/1e18;
  const fmt=(v,max=4)=>Number.isFinite(v)?v.toLocaleString(lang()==='fa'?'en-US':lang(),{maximumFractionDigits:max}):t().notAvailable;
  function button(){
    if(document.getElementById('walletBtn'))return;
    const b=document.createElement('button');b.id='walletBtn';b.className='fi-wallet-button fi-wallet-floating';b.type='button';b.innerHTML=icon;b.setAttribute('aria-label',t().wallet);b.title=t().wallet;document.body.appendChild(b);
  }
  function panel(){
    if(document.getElementById('fiWalletOverlay'))return;
    const o=document.createElement('div');o.id='fiWalletOverlay';o.className='fi-wallet-overlay';o.setAttribute('aria-hidden','true');
    o.innerHTML=`<section class="fi-wallet-panel" role="dialog" aria-modal="true" aria-labelledby="fiWalletTitle"><div class="fi-wallet-panel-head"><h2 class="fi-wallet-title" id="fiWalletTitle"></h2><button class="fi-wallet-close" type="button" id="fiWalletClose" aria-label="Close">×</button></div><p class="fi-wallet-status"><span class="fi-wallet-status-dot" id="fiWalletDot"></span><span id="fiWalletStatus"></span></p><div class="fi-wallet-details"><div class="fi-wallet-detail"><span class="fi-wallet-metric-label" id="fiAccountLabel"></span><strong class="fi-wallet-address" id="fiWalletAddress">—</strong></div><div class="fi-wallet-detail"><span class="fi-wallet-metric-label" id="fiNetworkLabel"></span><strong class="fi-wallet-metric-value fi-wallet-network-value" id="fiWalletNetwork">—</strong></div></div><div class="fi-wallet-comparison"><label class="fi-wallet-metric-label" id="fiCompareLabel" for="fiComparePeriod"></label><select id="fiComparePeriod" class="fi-wallet-period"><option value="day1"></option><option value="day7"></option><option value="day30"></option><option value="month6"></option><option value="year1"></option></select><strong class="fi-wallet-comparison-value" id="fiCompareValue">—</strong></div><div class="fi-wallet-metrics"><div class="fi-wallet-metric"><span class="fi-wallet-metric-label fi-wallet-balance-label" id="fiBalanceLabel"></span><strong class="fi-wallet-metric-value fi-wallet-balance-value" id="fiBalance">—</strong></div><div class="fi-wallet-metric"><span class="fi-wallet-metric-label fi-wallet-usd-label" id="fiUsdLabel"></span><strong class="fi-wallet-metric-value fi-wallet-usd-value" id="fiUsdValue">—</strong></div><div class="fi-wallet-metric"><span class="fi-wallet-metric-label" id="fiUsd7Label"></span><strong class="fi-wallet-metric-value fi-wallet-usd-value" id="fiUsd7Value">—</strong></div><div class="fi-wallet-metric"><span class="fi-wallet-metric-label" id="fiUsd30Label"></span><strong class="fi-wallet-metric-value fi-wallet-usd-value" id="fiUsd30Value">—</strong></div><div class="fi-wallet-metric"><span class="fi-wallet-metric-label" id="fiPurchasedLabel"></span><strong class="fi-wallet-metric-value" id="fiPurchased">—</strong></div><div class="fi-wallet-metric"><span class="fi-wallet-metric-label" id="fiAllowedLabel"></span><strong class="fi-wallet-metric-value" id="fiAllowed">—</strong></div><div class="fi-wallet-metric"><span class="fi-wallet-metric-label" id="fiRemainingLabel"></span><strong class="fi-wallet-metric-value" id="fiRemaining">—</strong></div><div class="fi-wallet-metric"><span class="fi-wallet-metric-label" id="fiSmallerLabel"></span><strong class="fi-wallet-metric-value" id="fiSmallerSide">—</strong></div></div><p class="fi-wallet-note" id="fiWalletHistoryBasis"></p><p class="fi-wallet-note" id="fiWalletNote" role="status" aria-live="polite"></p><div class="fi-wallet-actions"><button type="button" class="fi-wallet-connect" id="fiWalletConnect"></button><button type="button" class="fi-wallet-disconnect" id="fiWalletDisconnect" hidden></button></div></section>`;
    document.body.appendChild(o);
    const close=()=>{o.classList.remove('is-open');o.setAttribute('aria-hidden','true');};
    document.getElementById('fiWalletClose').addEventListener('click',close);
    o.addEventListener('click',e=>{if(e.target===o)close();});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
    document.getElementById('fiWalletConnect').addEventListener('click',connect);
    document.getElementById('fiWalletDisconnect').addEventListener('click',disconnectLocal);
    document.getElementById('fiComparePeriod').addEventListener('change',renderComparison);
    const bind=()=>{const b=document.getElementById('walletBtn');if(!b||b.dataset.fiWalletBound==='1')return !!b;b.dataset.fiWalletBound='1';b.addEventListener('click',async()=>{o.classList.add('is-open');o.setAttribute('aria-hidden','false');await refreshExisting();document.getElementById('fiWalletClose').focus();});return true;};
    if(!bind()){const mo=new MutationObserver(()=>{if(bind())mo.disconnect();});mo.observe(document.body,{childList:true,subtree:true});}
    window.addEventListener('fi-language-change',updateText);new MutationObserver(updateText).observe(document.documentElement,{attributes:true,attributeFilter:['lang','dir']});
    updateText();renderState();resetMetrics();
  }
  function note(msg){const e=document.getElementById('fiWalletNote');if(e)e.textContent=msg||'';}
  function set(id,v){const e=document.getElementById(id);if(e)e.textContent=v;}
  function resetMetrics(){['fiBalance','fiUsdValue','fiUsd7Value','fiUsd30Value','fiPurchased','fiAllowed','fiRemaining','fiSmallerSide','fiCompareValue'].forEach(id=>set(id,t().notAvailable));currentBalance=0;currentPrice=0;historyRows=[];}
  function renderState(){
    if(!document.getElementById('fiWalletAddress'))return;
    set('fiWalletAddress',short(account));const a=document.getElementById('fiWalletAddress');a.title=account||'';
    set('fiWalletNetwork',chainName(chainId));set('fiWalletStatus',account?t().statusOn:t().statusOff);
    document.getElementById('fiWalletDot').classList.toggle('is-connected',!!account);
    document.getElementById('fiWalletConnect').hidden=!!account;document.getElementById('fiWalletDisconnect').hidden=!account;
    document.getElementById('fiWalletConnect').textContent=t().connect;document.getElementById('fiWalletDisconnect').textContent=t().disconnect;
  }
  function updateText(){
    const z=t();set('fiWalletTitle',z.title);set('fiAccountLabel',z.account);set('fiNetworkLabel',z.network);
    set('fiBalanceLabel',z.balance);set('fiUsdLabel',z.usdValue);set('fiUsd7Label',z.usd7);set('fiUsd30Label',z.usd30);set('fiCompareLabel',z.compareLabel);set('fiWalletHistoryBasis',z.historyBasis+' '+z.compareHistoryNote);set('fiPurchasedLabel',z.purchased);
    const period=document.getElementById('fiComparePeriod');if(period){const options=[['day1',z.period24h],['day7',z.period7d],['day30',z.period30d],['month6',z.period6m],['year1',z.period1y]];options.forEach(([value,label])=>{const option=period.querySelector('option[value="'+value+'"]');if(option)option.textContent=label;});}renderComparison();set('fiAllowedLabel',z.allowed);set('fiRemainingLabel',z.remaining);set('fiSmallerLabel',z.smallerSide);
    const b=document.getElementById('walletBtn');if(b){b.title=z.wallet;b.setAttribute('aria-label',z.wallet);}
    const cl=document.getElementById('fiWalletClose');if(cl)cl.setAttribute('aria-label',z.close);
    if(document.getElementById('fiWalletStatus'))renderState();
  }
  async function ethCall(to,data){
    const result=await provider.request({method:'eth_call',params:[{to,data},'latest']});
    if(typeof result!=='string'||!/^0x[0-9a-fA-F]+$/.test(result)||result.length<66)throw new Error('Empty or invalid contract response');
    return result;
  }
  function historicalRecord(period){
    if(!historyRows.length)return null;
    const target=new Date();
    if(period==='day1')target.setDate(target.getDate()-1);
    else if(period==='day7')target.setDate(target.getDate()-7);
    else if(period==='day30')target.setDate(target.getDate()-30);
    else if(period==='month6')target.setMonth(target.getMonth()-6);
    else if(period==='year1')target.setFullYear(target.getFullYear()-1);
    const key=target.getFullYear()+'-'+String(target.getMonth()+1).padStart(2,'0')+'-'+String(target.getDate()).padStart(2,'0');
    let match=null;
    for(const row of historyRows){if(row.date<=key)match=row;else break;}
    return match;
  }
  function renderComparison(){
    const period=document.getElementById('fiComparePeriod');
    if(!period)return;
    const row=historicalRecord(period.value);
    if(!currentBalance||!currentPrice){set('fiCompareValue',t().notAvailable);return;}
    if(!row){set('fiCompareValue',t().historyUnavailable);const value=document.getElementById('fiCompareValue');if(value)value.classList.remove('is-negative');return;}
    const difference=currentBalance*(currentPrice-Number(row.price));
    const sign=difference>0?'+':difference<0?'−':'';
    set('fiCompareValue',sign+'$'+fmt(Math.abs(difference),4));
    const value=document.getElementById('fiCompareValue');
    if(value)value.classList.toggle('is-negative',difference<0);
  }
  async function loadHistoricalValues(balance,price){
    set('fiUsd7Value',t().notAvailable);set('fiUsd30Value',t().notAvailable);set('fiCompareValue',t().notAvailable);
    currentBalance=balance;currentPrice=price;historyRows=[];
    try{
      const response=await fetch('price-history.json?t='+Date.now(),{cache:'no-store'});
      if(!response.ok)throw new Error('Price history HTTP '+response.status);
      const payload=await response.json();
      const records=Array.isArray(payload)?payload:payload.records;
      if(!Array.isArray(records)||!records.length)throw new Error('No price history records');
      historyRows=records.filter(r=>r&&/^\d{4}-\d{2}-\d{2}$/.test(r.date)&&Number.isFinite(Number(r.price))&&Number(r.price)>0).sort((a,b)=>a.date.localeCompare(b.date));
      const p7=historicalRecord('day7'),p30=historicalRecord('day30');
      if(p7)set('fiUsd7Value','$'+fmt(balance*Number(p7.price),4));
      if(p30)set('fiUsd30Value','$'+fmt(balance*Number(p30.price),4));
      renderComparison();
    }catch(err){historyRows=[];console.warn('FIT historical wallet values unavailable:',err);renderComparison();}
  }
  async function loadContractData(){
    resetMetrics();
    if(!account||!provider)return;
    if(chainId!==BSC_CHAIN){note(t().wrongNetwork);return;}
    note(t().loading);
    const addressArg=padAddress(account);
    // Balance and price are the two core values. Read them independently so
    // an optional profile method cannot hide otherwise valid token data.
    const core=await Promise.allSettled([
      ethCall(FIT,SEL.balanceOf+addressArg),
      ethCall(FIT,SEL.price)
    ]);
    if(core[0].status!=='fulfilled'||core[1].status!=='fulfilled'){
      const failed=core.find(x=>x.status==='rejected');
      const reason=failed&&failed.reason&&failed.reason.message?failed.reason.message:'RPC read failed';
      note(t().readError+' ('+reason.slice(0,110)+')');
      return;
    }
    try{
      const balance=units(fromHex(core[0].value));
      const price=units(fromHex(core[1].value));
      set('fiBalance',fmt(balance,6)+' FIT');
      set('fiUsdValue','$'+fmt(balance*price,4));
      await loadHistoricalValues(balance,price);
    }catch(err){note(t().readError+' (Invalid balance/price response)');return;}

    // Both profile methods take the connected wallet address. The network
    // contract call is intentionally routed through FIT's public wrapper.
    const [ownerResult,lrResult]=await Promise.allSettled([
      ethCall(FIT,SEL.ownerInfo+addressArg),
      ethCall(FIT,SEL.leftRight+addressArg)
    ]);
    if(ownerResult.status==='fulfilled'){
      const owner=ownerResult.value.slice(2);
      if(owner.length>=192){
        const vals=[0,1,2].map(i=>units(BigInt('0x'+owner.slice(i*64,(i+1)*64))));
        set('fiPurchased','$'+fmt(vals[0],4));set('fiAllowed','$'+fmt(vals[1],4));set('fiRemaining','$'+fmt(vals[2],4));
      }
    }
    if(lrResult.status==='fulfilled'){
      const lr=lrResult.value.slice(2);
      if(lr.length>=128){
        const l=BigInt('0x'+lr.slice(0,64)),r=BigInt('0x'+lr.slice(64,128));
        set('fiSmallerSide',t().left+': '+fmt(Number(l),0)+'  |  '+t().right+': '+fmt(Number(r),0));
      }
    }
    const optionalFailed=ownerResult.status==='rejected'||lrResult.status==='rejected';
    note(optionalFailed?'Some profile fields could not be loaded. Token balance and value were read separately.':'');
  }
  async function refreshExisting(){
    provider=window.ethereum||null;
    if(!provider){account='';chainId='';renderState();resetMetrics();note(t().noProvider);return;}
    try{const accounts=await provider.request({method:'eth_accounts'});account=accounts&&accounts[0]||'';chainId=await provider.request({method:'eth_chainId'});listen();renderState();if(account)await loadContractData();else{resetMetrics();note('');}}
    catch(e){renderState();note(t().error);}
  }
  async function connect(){
    provider=window.ethereum||null;
    if(!provider){note(t().noProvider);return;}
    const b=document.getElementById('fiWalletConnect');b.disabled=true;note(t().connecting);
    try{const accounts=await provider.request({method:'eth_requestAccounts'});account=accounts&&accounts[0]||'';chainId=await provider.request({method:'eth_chainId'});listen();renderState();await loadContractData();}
    catch(e){note(e&&e.code===4001?t().rejected:t().error);}
    finally{b.disabled=false;}
  }
  function disconnectLocal(){account='';resetMetrics();renderState();note(t().localDisconnect);}
  function listen(){
    if(!provider||provider.__fiWalletPanelBound)return;
    provider.__fiWalletPanelBound=true;
    if(provider.on){
      provider.on('accountsChanged',async a=>{account=a&&a[0]||'';renderState();if(account)await loadContractData();else{resetMetrics();note(t().statusOff);}});
      provider.on('chainChanged',async id=>{chainId=id;renderState();if(account)await loadContractData();});
      provider.on('disconnect',()=>{account='';chainId='';resetMetrics();renderState();note(t().statusOff);});
    }
  }
  function init(){if(!window.FI_LANG_HEADER_ENABLED)button();panel();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();