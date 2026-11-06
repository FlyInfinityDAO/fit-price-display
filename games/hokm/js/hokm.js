const $=id=>document.getElementById(id);
const T={
en:{dashboard:"Dashboard",title:"Hokm Fly Infinity",tagline:"Four players. Two teams. One winning call.",playerAccess:"PLAYER ACCESS",connectTitle:"Connect to enter",accessText:"Connect a BNB Smart Chain wallet holding at least 1 FIT. A free signature verifies access; no transaction is requested.",connectBrowser:"Connect with browser",connectWallet:"Connect wallet",notConnected:"Your wallet has not been connected.",minimum:"Minimum FIT balance",fitRequired:"At least 1 FIT required",tableLabel:"FOUR PLAYER TABLE",tableTitle:"The Hokm Table",soundOn:"Sound on",soundOff:"Sound off",musicOn:"Music on",musicOff:"Music off",north:"North",south:"South",east:"East",west:"West",partner:"Your partner",opponent:"Opponent",you:"You",yourTurn:"Your turn",trump:"TRUMP",tableReady:"Waiting for the game to begin",teamOne:"TEAM NORTH · SOUTH",teamTwo:"TEAM EAST · WEST",round:"ROUND",dealDemo:"Preview card sounds",collectDemo:"Collect cards",previewNote:"Visual preview · gameplay is being built",soundSettings:"SOUND EXPERIENCE",soundTitle:"A quiet, classic card-room atmosphere",soundDescription:"Soft lounge-style instrumental ambience with realistic card handling sounds. Music stays low and can be muted at any time.",musicVolume:"Music volume",noRewards:"No entry fee. No token transfer. No financial rewards."},
fa:{dashboard:"داشبورد",title:"حکم فلای اینفینیتی",tagline:"چهار بازیکن، دو تیم، یک برنده.",playerAccess:"دسترسی بازیکن",connectTitle:"برای ورود کیف پول را متصل کنید",accessText:"کیف پول BNB Smart Chain با حداقل ۱ FIT متصل کنید. احراز دسترسی با امضای رایگان انجام می‌شود؛ هیچ تراکنشی لازم نیست.",connectBrowser:"اتصال با مرورگر",connectWallet:"اتصال کیف پول",notConnected:"هنوز کیف پولی متصل نشده است.",minimum:"حداقل موجودی FIT",fitRequired:"حداقل ۱ FIT لازم است",tableLabel:"میز چهار نفره",tableTitle:"میز بازی حکم",soundOn:"صدا روشن",soundOff:"صدا خاموش",musicOn:"موسیقی روشن",musicOff:"موسیقی خاموش",north:"شمال",south:"جنوب",east:"شرق",west:"غرب",partner:"هم‌تیمی شما",opponent:"حریف",you:"شما",yourTurn:"نوبت شما",trump:"خال حکم",tableReady:"در انتظار شروع بازی",teamOne:"تیم شمال · جنوب",teamTwo:"تیم شرق · غرب",round:"دور",dealDemo:"شنیدن صدای پخش ورق",collectDemo:"جمع کردن ورق‌ها",previewNote:"پیش‌نمایش ظاهری · بازی در حال توسعه است",soundSettings:"تجربه صوتی",soundTitle:"فضایی کلاسیک و آرام شبیه سالن ورق",soundDescription:"موسیقی ملایم کلاسیک با صدای طبیعی ورق‌ها. صدای موسیقی کم است و هر زمان می‌توانید آن را قطع کنید.",musicVolume:"بلندی موسیقی",noRewards:"بدون هزینه ورود، انتقال توکن یا پاداش مالی."},
ar:{dashboard:"لوحة التحكم",title:"حكم فلاي إنفينيتي",tagline:"أربعة لاعبين، فريقان، وفائز واحد.",playerAccess:"دخول اللاعب",connectTitle:"اتصل للدخول",accessText:"اربط محفظة BNB Smart Chain تحتوي على 1 FIT على الأقل. التحقق بتوقيع مجاني دون معاملة.",connectBrowser:"الاتصال عبر المتصفح",connectWallet:"ربط المحفظة",notConnected:"لم يتم ربط المحفظة بعد.",minimum:"الحد الأدنى من FIT",fitRequired:"مطلوب 1 FIT على الأقل",tableLabel:"طاولة لأربعة لاعبين",tableTitle:"طاولة الحكم",soundOn:"الصوت يعمل",soundOff:"الصوت مغلق",musicOn:"الموسيقى تعمل",musicOff:"الموسيقى مغلقة",north:"الشمال",south:"الجنوب",east:"الشرق",west:"الغرب",partner:"شريكك",opponent:"خصم",you:"أنت",yourTurn:"دورك",trump:"الحكم",tableReady:"بانتظار بدء اللعبة",teamOne:"فريق الشمال · الجنوب",teamTwo:"فريق الشرق · الغرب",round:"الجولة",dealDemo:"معاينة أصوات الورق",collectDemo:"اجمع الأوراق",previewNote:"معاينة بصرية · يجري تطوير اللعب",soundSettings:"تجربة الصوت",soundTitle:"أجواء ورق كلاسيكية هادئة",soundDescription:"موسيقى هادئة مع أصوات واقعية للأوراق، ويمكن كتمها في أي وقت.",musicVolume:"مستوى الموسيقى",noRewards:"لا رسوم دخول ولا تحويل رموز ولا مكافآت مالية."},
tr:{dashboard:"Panel",title:"Hokm Fly Infinity",tagline:"Dört oyuncu. İki takım. Tek kazanan.",playerAccess:"OYUNCU ERİŞİMİ",connectTitle:"Girmek için bağlan",accessText:"En az 1 FIT içeren BNB Smart Chain cüzdanını bağla. Ücretsiz imza ile doğrulama; işlem yok.",connectBrowser:"Tarayıcıyla bağlan",connectWallet:"Cüzdanı bağla",notConnected:"Cüzdan henüz bağlanmadı.",minimum:"Minimum FIT bakiyesi",fitRequired:"En az 1 FIT gerekli",tableLabel:"DÖRT KİŞİLİK MASA",tableTitle:"Hokm Masası",soundOn:"Ses açık",soundOff:"Ses kapalı",musicOn:"Müzik açık",musicOff:"Müzik kapalı",north:"Kuzey",south:"Güney",east:"Doğu",west:"Batı",partner:"Takım arkadaşın",opponent:"Rakip",you:"Sen",yourTurn:"Senin sıran",trump:"KOZ",tableReady:"Oyunun başlaması bekleniyor",teamOne:"KUZEY · GÜNEY TAKIMI",teamTwo:"DOĞU · BATI TAKIMI",round:"EL",dealDemo:"Kart seslerini dinle",collectDemo:"Kartları topla",previewNote:"Görsel önizleme · oyun geliştiriliyor",soundSettings:"SES DENEYİMİ",soundTitle:"Sakin, klasik kart salonu atmosferi",soundDescription:"Yumuşak lounge müziği ve gerçekçi kart sesleri. Müzik düşük seviyede tutulur.",musicVolume:"Müzik seviyesi",noRewards:"Giriş ücreti, token transferi veya finansal ödül yok."},
ru:{dashboard:"Панель",title:"Хокм Fly Infinity",tagline:"Четыре игрока. Две команды. Один победитель.",playerAccess:"ДОСТУП ИГРОКА",connectTitle:"Подключитесь для входа",accessText:"Подключите кошелёк BNB Smart Chain минимум с 1 FIT. Бесплатная подпись, без транзакций.",connectBrowser:"Через браузер",connectWallet:"Подключить кошелёк",notConnected:"Кошелёк ещё не подключён.",minimum:"Минимум FIT",fitRequired:"Требуется минимум 1 FIT",tableLabel:"СТОЛ НА ЧЕТВЕРЫХ",tableTitle:"Стол Хокм",soundOn:"Звук включён",soundOff:"Звук выключен",musicOn:"Музыка включена",musicOff:"Музыка выключена",north:"Север",south:"Юг",east:"Восток",west:"Запад",partner:"Ваш партнёр",opponent:"Соперник",you:"Вы",yourTurn:"Ваш ход",trump:"КОЗЫРЬ",tableReady:"Ожидание начала игры",teamOne:"КОМАНДА СЕВЕР · ЮГ",teamTwo:"КОМАНДА ВОСТОК · ЗАПАД",round:"РАУНД",dealDemo:"Прослушать звук карт",collectDemo:"Собрать карты",previewNote:"Предпросмотр · игра разрабатывается",soundSettings:"ЗВУКОВАЯ СРЕДА",soundTitle:"Тихая классическая атмосфера карточного клуба",soundDescription:"Мягкая лаунж-музыка и реалистичные звуки карт. Громкость музыки низкая.",musicVolume:"Громкость музыки",noRewards:"Без платы за вход, перевода токенов и финансовых наград."},
zh:{dashboard:"控制面板",title:"Fly Infinity 霍克姆",tagline:"四位玩家。两个队伍。一位赢家。",playerAccess:"玩家访问",connectTitle:"连接后进入",accessText:"连接至少持有 1 FIT 的 BNB Smart Chain 钱包。免费签名验证，无需交易。",connectBrowser:"通过浏览器连接",connectWallet:"连接钱包",notConnected:"钱包尚未连接。",minimum:"最低 FIT 余额",fitRequired:"至少需要 1 FIT",tableLabel:"四人牌桌",tableTitle:"霍克姆牌桌",soundOn:"声音开启",soundOff:"声音关闭",musicOn:"音乐开启",musicOff:"音乐关闭",north:"北",south:"南",east:"东",west:"西",partner:"你的队友",opponent:"对手",you:"你",yourTurn:"你的回合",trump:"主牌花色",tableReady:"等待游戏开始",teamOne:"北 · 南队",teamTwo:"东 · 西队",round:"回合",dealDemo:"试听发牌音效",collectDemo:"收牌",previewNote:"视觉预览 · 游戏正在开发",soundSettings:"声音体验",soundTitle:"安静经典的牌室氛围",soundDescription:"轻柔休闲背景音乐与真实纸牌音效，音乐音量保持较低。",musicVolume:"音乐音量",noRewards:"无入场费、无代币转账、无金融奖励。"},
es:{dashboard:"Panel",title:"Hokm Fly Infinity",tagline:"Cuatro jugadores. Dos equipos. Un ganador.",playerAccess:"ACCESO",connectTitle:"Conecta para entrar",accessText:"Conecta una cartera BNB Smart Chain con al menos 1 FIT. Firma gratuita; no hay transacción.",connectBrowser:"Conectar con navegador",connectWallet:"Conectar cartera",notConnected:"La cartera aún no está conectada.",minimum:"Saldo mínimo FIT",fitRequired:"Se requiere al menos 1 FIT",tableLabel:"MESA DE CUATRO",tableTitle:"La mesa de Hokm",soundOn:"Sonido activado",soundOff:"Sonido desactivado",musicOn:"Música activada",musicOff:"Música desactivada",north:"Norte",south:"Sur",east:"Este",west:"Oeste",partner:"Tu compañero",opponent:"Rival",you:"Tú",yourTurn:"Tu turno",trump:"TRIUNFO",tableReady:"Esperando el inicio",teamOne:"EQUIPO NORTE · SUR",teamTwo:"EQUIPO ESTE · OESTE",round:"RONDA",dealDemo:"Escuchar sonidos de cartas",collectDemo:"Recoger cartas",previewNote:"Vista previa · juego en desarrollo",soundSettings:"EXPERIENCIA DE SONIDO",soundTitle:"Ambiente clásico y tranquilo de sala de cartas",soundDescription:"Música lounge suave y sonidos realistas de cartas. Volumen bajo.",musicVolume:"Volumen de música",noRewards:"Sin cuota de entrada, transferencias de tokens ni premios financieros."},
pt:{dashboard:"Painel",title:"Hokm Fly Infinity",tagline:"Quatro jogadores. Duas equipes. Um vencedor.",playerAccess:"ACESSO DO JOGADOR",connectTitle:"Conecte para entrar",accessText:"Conecte uma carteira BNB Smart Chain com pelo menos 1 FIT. Assinatura gratuita; sem transação.",connectBrowser:"Conectar pelo navegador",connectWallet:"Conectar carteira",notConnected:"A carteira ainda não foi conectada.",minimum:"Saldo mínimo FIT",fitRequired:"É necessário pelo menos 1 FIT",tableLabel:"MESA PARA QUATRO",tableTitle:"Mesa de Hokm",soundOn:"Som ligado",soundOff:"Som desligado",musicOn:"Música ligada",musicOff:"Música desligada",north:"Norte",south:"Sul",east:"Leste",west:"Oeste",partner:"Seu parceiro",opponent:"Oponente",you:"Você",yourTurn:"Sua vez",trump:"TRUNFO",tableReady:"Aguardando o início do jogo",teamOne:"EQUIPE NORTE · SUL",teamTwo:"EQUIPE LESTE · OESTE",round:"RODADA",dealDemo:"Ouvir sons das cartas",collectDemo:"Recolher cartas",previewNote:"Prévia visual · jogo em desenvolvimento",soundSettings:"EXPERIÊNCIA SONORA",soundTitle:"Ambiente clássico e tranquilo de salão de cartas",soundDescription:"Música lounge suave e sons realistas de cartas. Volume baixo.",musicVolume:"Volume da música",noRewards:"Sem taxa de entrada, transferência de tokens ou recompensas financeiras."}
};
let lang="en",ctx=null,musicOn=false,soundOn=true,timer=null,musicGain=null,bar=0;
const tr=k=>T[lang]?.[k]||T.en[k]||k;
function applyLang(){document.documentElement.lang=lang;document.documentElement.dir=["fa","ar"].includes(lang)?"rtl":"ltr";document.body.classList.toggle("fi-rtl",["fa","ar"].includes(lang));document.querySelectorAll("[data-i]").forEach(el=>el.textContent=tr(el.dataset.i));$("soundToggle").textContent=(soundOn?"♫ ":"♪ ")+tr(soundOn?"soundOn":"soundOff");$("musicToggle").textContent=(musicOn?"♪ ":"♫ ")+tr(musicOn?"musicOn":"musicOff")}
$("languageSelect").addEventListener("change",e=>{lang=e.target.value;applyLang()});
function audio(){if(!ctx){ctx=new(window.AudioContext||window.webkitAudioContext)();musicGain=ctx.createGain();musicGain.gain.value=0;musicGain.connect(ctx.destination)}if(ctx.state==="suspended")ctx.resume();return ctx}
function note(freq,dur=.2,vol=.012,delay=0){const c=audio(),o=c.createOscillator(),g=c.createGain(),t=c.currentTime+delay;o.type="triangle";o.frequency.value=freq;g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(vol,t+.04);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g);g.connect(musicGain||c.destination);o.start(t);o.stop(t+dur+.02)}
function cardFx(kind){if(!soundOn)return;const c=audio(),count=kind==="deal"?13:6;for(let i=0;i<count;i++){const t=c.currentTime+i*(kind==="deal"?.09:.07),b=c.createBuffer(1,Math.floor(c.sampleRate*.065),c.sampleRate),d=b.getChannelData(0);for(let j=0;j<d.length;j++)d[j]=(Math.random()*2-1)*Math.pow(1-j/d.length,3);const s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();s.buffer=b;f.type="lowpass";f.frequency.value=kind==="deal"?2500:1650;g.gain.setValueAtTime(kind==="deal"?.045:.055,t);g.gain.exponentialRampToValueAtTime(.0001,t+.065);s.connect(f);f.connect(g);g.connect(c.destination);s.start(t)}}
const chords=[[261.63,329.63,392,493.88],[220,261.63,329.63,392],[174.61,220,261.63,329.63],[196,246.94,293.66,369.99]];
function musicBar(){if(!musicOn)return;const ns=chords[bar++%chords.length];ns.forEach((f,i)=>note(f,2.7,.004,i*.045));note(ns[0]*2,1,.001,.15)}
function startMusic(){audio();musicOn=true;musicGain.gain.setTargetAtTime(Number($("musicVolume").value)/100,ctx.currentTime,.5);musicBar();timer=setInterval(musicBar,3000);applyLang()}
function stopMusic(){musicOn=false;if(timer)clearInterval(timer);timer=null;if(musicGain)musicGain.gain.setTargetAtTime(0,ctx.currentTime,.3);applyLang()}
$("soundToggle").addEventListener("click",()=>{soundOn=!soundOn;if(soundOn)note(660,.08,.008);applyLang()});
$("musicToggle").addEventListener("click",()=>musicOn?stopMusic():startMusic());
$("musicVolume").addEventListener("input",e=>{$("volumeValue").textContent=e.target.value+"%";if(musicGain&&musicOn)musicGain.gain.setTargetAtTime(Number(e.target.value)/100,ctx.currentTime,.15)});
$("dealDemoBtn").addEventListener("click",()=>{cardFx("deal");$("tableMessage").textContent=lang==="fa"?"صدای پخش کارت‌ها":"Card dealing sound preview"});
$("collectDemoBtn").addEventListener("click",()=>{cardFx("collect");$("tableMessage").textContent=lang==="fa"?"صدای جمع کردن کارت‌ها":"Card collection sound preview"});

const API_BASE=(window.HOKM_API_URL||"https://fly-hokm-api.flyinfinityplatform.workers.dev").replace(/\/$/,"");
let activeProvider=null,sessionToken=null,currentWallet=null,watchedWalletProvider=null;
const accessMessages={
 en:{connecting:"Connecting wallet…",signing:"Please approve the free signature in your wallet…",verifying:"Verifying FIT balance on BNB Smart Chain…",ready:"Access verified · ",denied:"Access denied: ",wrongChain:"Please switch to BNB Smart Chain.",noWallet:"No compatible wallet found. Open this page in your wallet browser or use Connect wallet.",noInjectedWallet:"No injected wallet was detected. Open this page in your wallet’s built-in browser.",api:"Hokm authentication service is not configured or unavailable.",timeout:"Wallet signature timed out. Please try again."},
 fa:{connecting:"در حال اتصال کیف پول…",signing:"لطفاً امضای رایگان را در کیف پول تأیید کنید…",verifying:"در حال بررسی موجودی FIT روی BNB Smart Chain…",ready:"دسترسی تأیید شد · ",denied:"عدم دسترسی: ",wrongChain:"لطفاً شبکه را به BNB Smart Chain تغییر دهید.",noWallet:"کیف پول سازگار پیدا نشد. صفحه را در مرورگر کیف پول باز کنید یا روش اتصال کیف پول را امتحان کنید.",noInjectedWallet:"کیف پول مرورگری پیدا نشد. صفحه را از مرورگر داخلی کیف پول باز کنید.",api:"سرویس احراز هویت حکم هنوز راه‌اندازی نشده یا در دسترس نیست.",timeout:"زمان امضای کیف پول تمام شد. دوباره تلاش کنید."},
 ar:{noInjectedWallet:"لم يتم العثور على محفظة مدمجة. افتح الصفحة في المتصفح الداخلي لمحفظتك."},
 tr:{noInjectedWallet:"Tarayıcıya gömülü cüzdan bulunamadı. Sayfayı cüzdanınızın yerleşik tarayıcısında açın."},
 ru:{noInjectedWallet:"Встроенный кошелёк не найден. Откройте страницу во встроенном браузере кошелька."},
 zh:{noInjectedWallet:"未检测到内置钱包。请在钱包的内置浏览器中打开此页面。"},
 es:{noInjectedWallet:"No se detectó una cartera integrada. Abre esta página en el navegador integrado de tu cartera."},
 pt:{noInjectedWallet:"Nenhuma carteira integrada foi detectada. Abra esta página no navegador interno da sua carteira."}
};
const msg=k=>accessMessages[lang]?.[k]||accessMessages.en[k];
function setAccessStatus(text,error=false){$("accessStatus").textContent=text;$("accessStatus").style.color=error?"#ff9999":""}
async function api(path,body,token){
 const response=await fetch(API_BASE+path,{method:body?"POST":"GET",headers:{...(body?{"Content-Type":"application/json"}:{}),...(token?{Authorization:"Bearer "+token}:{})},body:body?JSON.stringify(body):undefined,cache:"no-store"});
 const data=await response.json().catch(()=>({}));
 if(!response.ok||data.ok!==true)throw new Error(data.error||msg("api"));
 return data;
}
async function walletProvider(method){
 if(method==="browser"){
  if(typeof window.fiSelectWalletProvider==="function")return await window.fiSelectWalletProvider();
  if(window.ethereum?.request){await window.ethereum.request({method:"eth_requestAccounts"});return window.ethereum}
  throw new Error(msg("noWallet"));
 }
 if(!window.ethereum?.request)throw new Error(msg("noInjectedWallet"));
 await window.ethereum.request({method:"eth_requestAccounts"});
 return window.ethereum;
}
async function signWithTimeout(signer,message){
 let timeoutId;
 try{return await Promise.race([signer.signMessage(message),new Promise((_,reject)=>{timeoutId=setTimeout(()=>reject(new Error(msg("timeout"))),120000)})])}
 finally{clearTimeout(timeoutId)}
}
async function connectHokm(method){
 const buttons=[$("connectBrowserBtn"),$("connectWalletBtn")];
 buttons.forEach(b=>b.disabled=true);setAccessStatus(msg("connecting"));
 try{
  activeProvider=await walletProvider(method);
  const accounts=await activeProvider.request({method:"eth_accounts"});
  if(!accounts?.[0])throw new Error(msg("noWallet"));
  let chain=String(await activeProvider.request({method:"eth_chainId"})).toLowerCase();
  if(chain!=="0x38"){
   try{await activeProvider.request({method:"wallet_switchEthereumChain",params:[{chainId:"0x38"}]})}
   catch(e){throw new Error(e.code===4902?"BNB Smart Chain is not added to this wallet.":msg("wrongChain"))}
   chain=String(await activeProvider.request({method:"eth_chainId"})).toLowerCase();
   if(chain!=="0x38")throw new Error(msg("wrongChain"));
  }
  const address=accounts[0],provider=new ethers.providers.Web3Provider(activeProvider,"any"),signer=provider.getSigner(),challenge=await api("/api/auth/challenge",{address});
  setAccessStatus(msg("signing"));
  const signature=await signWithTimeout(signer,challenge.message);
  setAccessStatus(msg("verifying"));
  const verified=await api("/api/auth/verify",{address,nonce:challenge.nonce,signature});
  sessionToken=verified.sessionToken;currentWallet=verified.wallet;
  watchWalletProvider(activeProvider);
  const fit=(Number(verified.fitBalanceWei)/1e18).toLocaleString(undefined,{maximumFractionDigits:4});
  setAccessStatus(msg("ready")+currentWallet.slice(0,6)+"…"+currentWallet.slice(-4)+" · "+fit+" FIT · Tier "+verified.tier);
  $("connectBrowserBtn").textContent=tr("connectBrowser");$("connectWalletBtn").textContent=tr("connectWallet");
  window.dispatchEvent(new CustomEvent("hokm:authenticated",{detail:{wallet:currentWallet,tier:verified.tier,expiresAt:verified.expiresAt,sessionToken}}));
 }catch(error){
  console.error("[Hokm wallet]",error);
  setAccessStatus(msg("denied")+(error.message||msg("api")),true);
  sessionToken=null;currentWallet=null;
 }finally{buttons.forEach(b=>b.disabled=false)}
}
$("connectBrowserBtn").addEventListener("click",()=>connectHokm("browser"));
$("connectWalletBtn").addEventListener("click",()=>connectHokm("wallet"));
function walletChanged(){
 sessionToken=null;currentWallet=null;
 setAccessStatus(tr("notConnected"));
 window.dispatchEvent(new CustomEvent("hokm:access-revoked"));
}
function watchWalletProvider(provider){
 if(!provider||typeof provider.on!=="function")return;
 if(watchedWalletProvider&&watchedWalletProvider!==provider){
  if(typeof watchedWalletProvider.removeListener==="function"){
   watchedWalletProvider.removeListener("accountsChanged",walletChanged);
   watchedWalletProvider.removeListener("chainChanged",walletChanged);
  }else if(typeof watchedWalletProvider.off==="function"){
   watchedWalletProvider.off("accountsChanged",walletChanged);
   watchedWalletProvider.off("chainChanged",walletChanged);
  }
 }
 watchedWalletProvider=provider;
 if(typeof provider.removeListener==="function"){
  provider.removeListener("accountsChanged",walletChanged);
  provider.removeListener("chainChanged",walletChanged);
 }else if(typeof provider.off==="function"){
  provider.off("accountsChanged",walletChanged);
  provider.off("chainChanged",walletChanged);
 }
 provider.on("accountsChanged",walletChanged);
 provider.on("chainChanged",walletChanged);
}
applyLang();
let selectedCpuDifficulty="normal";
$("cpuDifficulty")?.addEventListener("change",e=>{selectedCpuDifficulty=["easy","normal","hard"].includes(e.target.value)?e.target.value:"normal";window.hokmCpuDifficulty=selectedCpuDifficulty;});
window.hokmCpuDifficulty=selectedCpuDifficulty;
