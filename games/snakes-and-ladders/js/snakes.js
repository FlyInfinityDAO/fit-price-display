import {createGame,roll,validateGame,SNAKES,LADDERS} from "./snakes-engine.js";
const $=id=>document.getElementById(id),API="https://fly-snakes-and-ladders-api.flyinfinityplatform.workers.dev",TOKEN="0xBebe4ea7aA4037CeF5D0bc25a10f9dcA16120Dfa",BSC=56;
let game=null,lang=localStorage.getItem("fi-game-language")||localStorage.getItem("fi-language")||"en",wallet=null,sessionToken=null,socket=null,roomCode=null,onlineMode=false,walletProvider=null,requestBusy=false,motionBusy=false,onlineStateQueue=Promise.resolve();
const copy={
en:{title:"Fly Infinity Snakes & Ladders",tagline:"Climb higher. Watch your step. Reach 100.",dashboard:"Dashboard",playerAccess:"PLAYER ACCESS",connectTitle:"Connect to enter",accessIntro:"Connect a BNB Smart Chain wallet holding at least 1 FIT. A free signature verifies your wallet; no transaction is requested.",connectBrowser:"Connect with browser",connectWallet:"Connect wallet",notConnected:"Your wallet has not been connected.",minimum:"Minimum FIT balance",fitRequired:"At least 1 FIT required",verified:"Wallet verified. Choose a game mode.",online:"ONLINE MULTIPLAYER",onlineTitle:"Play online",onlineDesc:"Create a room for 2–4 players or join with a six-character code.",createRoom:"Create a room",roomCode:"Room code",joinRoom:"Join room",waitingRoom:"Waiting for players…",copyCode:"Copy code",roomCreated:"Room created. Share this code with friends.",connectingRoom:"Connecting to room…",onlineError:"Online game service is unavailable.",statsTitle:"Player records",figsLabel:"FIGS",winsLabel:"Wins",gamesLabel:"Games",rankLabel:"Rank",leaderboardLabel:"Leaderboard",comingSoon:"Coming soon",local:"LOCAL MULTIPLAYER",localTitle:"Pass & play",localDesc:"Take turns on one device. Choose 2–4 players.",players:"Players",startLocal:"Start local game",cpu:"VS COMPUTER",cpuTitle:"Play against CPU",cpuDesc:"Play solo against computer opponents.",difficulty:"CPU difficulty",startCpu:"Start vs CPU",newGame:"New game",exit:"Exit",turn:"CURRENT TURN",roll:"Roll dice",rules:"Roll to move · Ladders take you up · Snakes send you down · Exact roll to reach 100",noRewards:"No entry fee. No token transfer. No financial rewards.",connecting:"Connecting…",signing:"Sign free message…",verifying:"Verifying FIT balance…",noWallet:"No compatible wallet was found.",switchChain:"Please switch to BNB Smart Chain.",lowFit:"At least 1 FIT is required.",rollFirst:"Roll the dice to move.",won:"{name} wins!",snake:"A snake! Slide down.",ladder:"A ladder! Climb up.",overshoot:"You need an exact roll to reach 100.",cpuTurn:"CPU is taking its turn…",move:" moved to ",position:"Position: "},
fa:{title:"مار و پله فلای اینفینیتی",tagline:"بالاتر برو، مراقب مارها باش و به خانه ۱۰۰ برس.",dashboard:"داشبورد",playerAccess:"دسترسی بازیکن",connectTitle:"برای ورود کیف پول را متصل کنید",accessIntro:"کیف پول BNB Smart Chain با حداقل ۱ FIT متصل کنید. امضای پیام رایگان است و هیچ تراکنشی انجام نمی‌شود.",connectBrowser:"اتصال با مرورگر",connectWallet:"اتصال با ولت",notConnected:"هنوز کیف پول متصل نشده است.",minimum:"حداقل موجودی FIT",fitRequired:"حداقل ۱ FIT لازم است",verified:"کیف پول تأیید شد؛ حالت بازی را انتخاب کنید.",online:"چندنفره آنلاین",onlineTitle:"بازی آنلاین",onlineDesc:"برای ۲ تا ۴ بازیکن اتاق بسازید یا با کد شش‌حرفی وارد شوید.",createRoom:"ساخت اتاق",roomCode:"کد اتاق",joinRoom:"ورود به اتاق",waitingRoom:"در انتظار بازیکنان…",copyCode:"کپی کد",roomCreated:"اتاق ساخته شد؛ کد را برای دوستانتان بفرستید.",connectingRoom:"در حال اتصال به اتاق…",onlineError:"سرویس بازی آنلاین در دسترس نیست.",statsTitle:"سوابق بازیکن",figsLabel:"FIGS",winsLabel:"برد",gamesLabel:"بازی‌ها",rankLabel:"رتبه",leaderboardLabel:"جدول برترین‌ها",comingSoon:"به‌زودی",local:"چندنفره محلی",localTitle:"بازی نوبتی",localDesc:"۲ تا ۴ نفر روی یک دستگاه بازی کنید.",players:"تعداد بازیکنان",startLocal:"شروع بازی محلی",cpu:"بازی با کامپیوتر",cpuTitle:"بازی با CPU",cpuDesc:"به‌تنهایی در برابر حریف‌های کامپیوتری بازی کنید.",difficulty:"درجه سختی CPU",startCpu:"شروع بازی با CPU",newGame:"بازی جدید",exit:"خروج",turn:"نوبت بازیکن",roll:"ریختن تاس",rules:"با تاس حرکت کن · نردبان تو را بالا می‌برد · مار تو را پایین می‌فرستد · برای رسیدن به ۱۰۰ عدد دقیق لازم است",noRewards:"بدون هزینه ورود، انتقال توکن یا پاداش مالی.",connecting:"در حال اتصال…",signing:"امضای پیام رایگان…",verifying:"بررسی موجودی FIT…",noWallet:"کیف پول سازگار پیدا نشد.",switchChain:"شبکه را به BNB Smart Chain تغییر دهید.",lowFit:"حداقل ۱ FIT لازم است.",rollFirst:"برای حرکت تاس بریزید.",won:"{name} برنده شد!",snake:"مار! به خانه پایین‌تر برگشتی.",ladder:"نردبان! بالاتر رفتی.",overshoot:"برای رسیدن به ۱۰۰ باید عدد دقیق بیاید.",cpuTurn:"کامپیوتر در حال بازی است…",move:" به خانه ",position:"موقعیت: "},
ar:{title:"Fly Infinity Snakes & Ladders",tagline:"تسلّق أعلى وانتبه للثعابين حتى تصل إلى 100.",dashboard:"لوحة التحكم",playerAccess:"دخول اللاعب",connectTitle:"اتصل للبدء",accessIntro:"اربط محفظة BNB Smart Chain تحتوي على 1 FIT على الأقل. التوقيع مجاني ولا توجد معاملة.",connectBrowser:"الاتصال عبر المتصفح",connectWallet:"اتصال المحفظة",notConnected:"لم يتم توصيل المحفظة.",minimum:"الحد الأدنى لرصيد FIT",fitRequired:"مطلوب 1 FIT على الأقل",verified:"تم التحقق من المحفظة. اختر وضع اللعب.",online:"لعب جماعي عبر الإنترنت",onlineTitle:"العب عبر الإنترنت",onlineDesc:"أنشئ غرفة من 2 إلى 4 لاعبين أو انضم برمز من ستة أحرف.",createRoom:"إنشاء غرفة",roomCode:"رمز الغرفة",joinRoom:"انضمام للغرفة",waitingRoom:"بانتظار اللاعبين…",copyCode:"نسخ الرمز",roomCreated:"تم إنشاء الغرفة. شارك الرمز مع أصدقائك.",connectingRoom:"جارٍ الاتصال بالغرفة…",onlineError:"خدمة اللعب عبر الإنترنت غير متاحة.",statsTitle:"سجل اللاعب",figsLabel:"FIGS",winsLabel:"انتصارات",gamesLabel:"ألعاب",rankLabel:"الترتيب",leaderboardLabel:"قائمة المتصدرين",comingSoon:"قريباً",local:"لعب محلي",localTitle:"مرر والعب",localDesc:"من 2 إلى 4 لاعبين على جهاز واحد.",players:"عدد اللاعبين",startLocal:"ابدأ اللعب المحلي",cpu:"ضد الكمبيوتر",cpuTitle:"العب ضد الكمبيوتر",cpuDesc:"العب ضد خصوم الكمبيوتر.",difficulty:"الصعوبة",startCpu:"ابدأ ضد الكمبيوتر",newGame:"لعبة جديدة",exit:"خروج",turn:"دور اللاعب",roll:"ارم النرد",rules:"ارم للتحرك · السلالم تصعد بك · الثعابين تعيدك للأسفل · يلزم الرقم الدقيق للوصول إلى 100",noRewards:"لا رسوم دخول ولا تحويل رموز ولا مكافآت مالية.",connecting:"جارٍ الاتصال…",signing:"وقّع الرسالة المجانية…",verifying:"جارٍ التحقق من الرصيد…",noWallet:"لم يتم العثور على محفظة.",switchChain:"يرجى التبديل إلى BNB Smart Chain.",lowFit:"مطلوب 1 FIT على الأقل.",rollFirst:"ارم النرد للتحرك.",won:"فاز {name}!",snake:"ثعبان! انزل للأسفل.",ladder:"سلم! اصعد للأعلى.",overshoot:"تحتاج إلى رقم دقيق للوصول إلى 100.",cpuTurn:"الكمبيوتر يلعب…",move:" تحرك إلى ",position:"الموقع: "},
tr:{title:"Fly Infinity Snakes & Ladders",tagline:"Yüksel, yılanlara dikkat et ve 100'e ulaş.",dashboard:"Panel",playerAccess:"OYUNCU ERİŞİMİ",connectTitle:"Girmek için bağlan",accessIntro:"En az 1 FIT içeren BNB Smart Chain cüzdanını bağla. İmza ücretsizdir; işlem yapılmaz.",connectBrowser:"Tarayıcıyla bağlan",connectWallet:"Cüzdanı bağla",notConnected:"Cüzdan bağlanmadı.",minimum:"Minimum FIT bakiyesi",fitRequired:"En az 1 FIT gerekli",verified:"Cüzdan doğrulandı. Oyun modunu seç.",online:"ÇEVRİM İÇİ",onlineTitle:"Çevrim içi oyna",onlineDesc:"2–4 oyunculu oda oluştur veya altı karakterli kodla katıl.",createRoom:"Oda oluştur",roomCode:"Oda kodu",joinRoom:"Odaya katıl",waitingRoom:"Oyuncular bekleniyor…",copyCode:"Kodu kopyala",roomCreated:"Oda oluşturuldu. Kodu arkadaşlarınla paylaş.",connectingRoom:"Odaya bağlanılıyor…",onlineError:"Çevrim içi oyun hizmeti kullanılamıyor.",statsTitle:"Oyuncu kayıtları",figsLabel:"FIGS",winsLabel:"Galibiyet",gamesLabel:"Oyun",rankLabel:"Sıra",leaderboardLabel:"Liderlik tablosu",comingSoon:"Yakında",local:"YEREL",localTitle:"Sırayla oyna",localDesc:"Tek cihazda 2–4 kişi oynayın.",players:"Oyuncular",startLocal:"Yerel oyunu başlat",cpu:"BİLGİSAYARA KARŞI",cpuTitle:"CPU'ya karşı oyna",cpuDesc:"Bilgisayar rakiplerine karşı oyna.",difficulty:"CPU zorluğu",startCpu:"CPU'ya karşı başla",newGame:"Yeni oyun",exit:"Çıkış",turn:"OYUNCU SIRASI",roll:"Zar at",rules:"Zar at ve ilerle · Merdivenler yukarı çıkarır · Yılanlar aşağı indirir · 100 için tam sayı gerekir",noRewards:"Giriş ücreti, token transferi veya finansal ödül yok.",connecting:"Bağlanıyor…",signing:"Ücretsiz imzala…",verifying:"FIT bakiyesi doğrulanıyor…",noWallet:"Cüzdan bulunamadı.",switchChain:"BNB Smart Chain'e geç.",lowFit:"En az 1 FIT gerekli.",rollFirst:"İlerlemek için zar at.",won:"{name} kazandı!",snake:"Yılan! Aşağı kaydın.",ladder:"Merdiven! Yukarı çıktın.",overshoot:"100'e ulaşmak için tam sayı gerekir.",cpuTurn:"Bilgisayar oynuyor…",move:" ilerledi: ",position:"Konum: "},
ru:{title:"Fly Infinity Snakes & Ladders",tagline:"Поднимайтесь выше и избегайте змей на пути к 100.",dashboard:"Панель",playerAccess:"ДОСТУП ИГРОКА",connectTitle:"Подключитесь для входа",accessIntro:"Подключите кошелёк BNB Smart Chain с балансом от 1 FIT. Подпись бесплатна, транзакций нет.",connectBrowser:"Подключить через браузер",connectWallet:"Подключить кошелёк",notConnected:"Кошелёк не подключён.",minimum:"Минимальный баланс FIT",fitRequired:"Требуется минимум 1 FIT",verified:"Кошелёк проверен. Выберите режим.",online:"ОНЛАЙН",onlineTitle:"Играть онлайн",onlineDesc:"Создайте комнату на 2–4 игроков или войдите по коду из шести символов.",createRoom:"Создать комнату",roomCode:"Код комнаты",joinRoom:"Войти в комнату",waitingRoom:"Ожидание игроков…",copyCode:"Копировать код",roomCreated:"Комната создана. Поделитесь кодом с друзьями.",connectingRoom:"Подключение к комнате…",onlineError:"Онлайн-сервис игры недоступен.",statsTitle:"Статистика игрока",figsLabel:"FIGS",winsLabel:"Победы",gamesLabel:"Игры",rankLabel:"Место",leaderboardLabel:"Таблица лидеров",comingSoon:"Скоро",local:"ЛОКАЛЬНАЯ ИГРА",localTitle:"Передавай и играй",localDesc:"Играйте на одном устройстве, 2–4 игрока.",players:"Игроки",startLocal:"Начать локальную игру",cpu:"ПРОТИВ КОМПЬЮТЕРА",cpuTitle:"Играть против CPU",cpuDesc:"Играйте против компьютерных соперников.",difficulty:"Сложность CPU",startCpu:"Начать против CPU",newGame:"Новая игра",exit:"Выход",turn:"ХОД ИГРОКА",roll:"Бросить кости",rules:"Бросайте кости · Лестницы ведут вверх · Змеи вниз · Для 100 нужен точный бросок",noRewards:"Без платы за вход, переводов токенов и финансовых наград.",connecting:"Подключение…",signing:"Подпишите бесплатное сообщение…",verifying:"Проверка FIT…",noWallet:"Кошелёк не найден.",switchChain:"Переключитесь на BNB Smart Chain.",lowFit:"Нужно минимум 1 FIT.",rollFirst:"Бросьте кости.",won:"Победил {name}!",snake:"Змея! Спуск вниз.",ladder:"Лестница! Подъём.",overshoot:"Для достижения 100 нужен точный бросок.",cpuTurn:"Компьютер ходит…",move:" перешёл на ",position:"Позиция: "},
zh:{title:"Fly Infinity Snakes & Ladders",tagline:"向上攀登，小心蛇，率先到达100。",dashboard:"控制面板",playerAccess:"玩家访问",connectTitle:"连接钱包以进入",accessIntro:"连接至少持有1 FIT的BNB Smart Chain钱包。免费签名验证，无需交易。",connectBrowser:"通过浏览器连接",connectWallet:"连接钱包",notConnected:"钱包尚未连接。",minimum:"最低FIT余额",fitRequired:"至少需要1 FIT",verified:"钱包已验证，请选择模式。",online:"在线多人",onlineTitle:"在线游戏",onlineDesc:"创建2至4人房间，或使用六位代码加入。",createRoom:"创建房间",roomCode:"房间代码",joinRoom:"加入房间",waitingRoom:"正在等待玩家…",copyCode:"复制代码",roomCreated:"房间已创建，请与朋友分享代码。",connectingRoom:"正在连接房间…",onlineError:"在线游戏服务暂不可用。",statsTitle:"玩家记录",figsLabel:"FIGS",winsLabel:"胜场",gamesLabel:"游戏",rankLabel:"排名",leaderboardLabel:"排行榜",comingSoon:"即将推出",local:"本地多人",localTitle:"轮流游戏",localDesc:"2至4名玩家共用一台设备。",players:"玩家人数",startLocal:"开始本地游戏",cpu:"对战电脑",cpuTitle:"对战CPU",cpuDesc:"与电脑对手进行游戏。",difficulty:"CPU难度",startCpu:"开始对战CPU",newGame:"新游戏",exit:"退出",turn:"当前回合",roll:"掷骰子",rules:"掷骰前进 · 梯子向上 · 蛇向下 · 到达100需要准确点数",noRewards:"无入场费、代币转账或金融奖励。",connecting:"正在连接…",signing:"请签署免费消息…",verifying:"正在验证FIT余额…",noWallet:"未找到兼容钱包。",switchChain:"请切换到BNB Smart Chain。",lowFit:"至少需要1 FIT。",rollFirst:"掷骰子开始移动。",won:"{name}获胜！",snake:"遇到蛇！向下滑落。",ladder:"遇到梯子！向上攀登。",overshoot:"必须准确掷出才能到达100。",cpuTurn:"电脑正在行动…",move:" 移动到 ",position:"位置： "},
es:{title:"Fly Infinity Snakes & Ladders",tagline:"Sube, evita las serpientes y llega al 100.",dashboard:"Panel",playerAccess:"ACCESO DE JUGADOR",connectTitle:"Conecta para entrar",accessIntro:"Conecta una cartera BNB Smart Chain con al menos 1 FIT. La firma es gratuita y no solicita transacciones.",connectBrowser:"Conectar con navegador",connectWallet:"Conectar cartera",notConnected:"La cartera no está conectada.",minimum:"Saldo mínimo FIT",fitRequired:"Se requiere al menos 1 FIT",verified:"Cartera verificada. Elige un modo.",online:"MULTIJUGADOR ONLINE",onlineTitle:"Jugar online",onlineDesc:"Crea una sala para 2–4 jugadores o únete con un código de seis caracteres.",createRoom:"Crear sala",roomCode:"Código de sala",joinRoom:"Unirse a sala",waitingRoom:"Esperando jugadores…",copyCode:"Copiar código",roomCreated:"Sala creada. Comparte el código con tus amigos.",connectingRoom:"Conectando a la sala…",onlineError:"El servicio de juego online no está disponible.",statsTitle:"Récords del jugador",figsLabel:"FIGS",winsLabel:"Victorias",gamesLabel:"Partidas",rankLabel:"Puesto",leaderboardLabel:"Clasificación",comingSoon:"Próximamente",local:"MULTIJUGADOR LOCAL",localTitle:"Pasa y juega",localDesc:"De 2 a 4 jugadores en un dispositivo.",players:"Jugadores",startLocal:"Iniciar juego local",cpu:"CONTRA CPU",cpuTitle:"Jugar contra CPU",cpuDesc:"Juega contra rivales informáticos.",difficulty:"Dificultad CPU",startCpu:"Jugar contra CPU",newGame:"Nuevo juego",exit:"Salir",turn:"TURNO ACTUAL",roll:"Lanzar dado",rules:"Lanza y avanza · Las escaleras suben · Las serpientes bajan · Se necesita número exacto para llegar a 100",noRewards:"Sin cuota de entrada, transferencias ni premios financieros.",connecting:"Conectando…",signing:"Firma el mensaje gratuito…",verifying:"Verificando FIT…",noWallet:"No se encontró una cartera compatible.",switchChain:"Cambia a BNB Smart Chain.",lowFit:"Se necesita al menos 1 FIT.",rollFirst:"Lanza el dado para moverte.",won:"¡{name} gana!",snake:"¡Serpiente! Bajas.",ladder:"¡Escalera! Subes.",overshoot:"Necesitas el número exacto para llegar a 100.",cpuTurn:"La CPU está jugando…",move:" avanzó a ",position:"Posición: "},
pt:{title:"Fly Infinity Snakes & Ladders",tagline:"Suba, evite as cobras e alcance 100.",dashboard:"Painel",playerAccess:"ACESSO DO JOGADOR",connectTitle:"Conecte para entrar",accessIntro:"Conecte uma carteira BNB Smart Chain com pelo menos 1 FIT. A assinatura é gratuita e não solicita transação.",connectBrowser:"Conectar pelo navegador",connectWallet:"Conectar carteira",notConnected:"A carteira não está conectada.",minimum:"Saldo mínimo FIT",fitRequired:"É necessário pelo menos 1 FIT",verified:"Carteira verificada. Escolha um modo.",online:"MULTIJOGADOR ONLINE",onlineTitle:"Jogar online",onlineDesc:"Crie uma sala para 2–4 jogadores ou entre com um código de seis caracteres.",createRoom:"Criar sala",roomCode:"Código da sala",joinRoom:"Entrar na sala",waitingRoom:"Aguardando jogadores…",copyCode:"Copiar código",roomCreated:"Sala criada. Compartilhe o código com seus amigos.",connectingRoom:"Conectando à sala…",onlineError:"O serviço de jogo online está indisponível.",statsTitle:"Registros do jogador",figsLabel:"FIGS",winsLabel:"Vitórias",gamesLabel:"Jogos",rankLabel:"Posição",leaderboardLabel:"Classificação",comingSoon:"Em breve",local:"MULTIJOGADOR LOCAL",localTitle:"Passe e jogue",localDesc:"De 2 a 4 jogadores em um dispositivo.",players:"Jogadores",startLocal:"Iniciar jogo local",cpu:"CONTRA CPU",cpuTitle:"Jogar contra CPU",cpuDesc:"Jogue contra adversários do computador.",difficulty:"Dificuldade da CPU",startCpu:"Começar contra CPU",newGame:"Novo jogo",exit:"Sair",turn:"VEZ ATUAL",roll:"Lançar dado",rules:"Lance e avance · Escadas sobem · Cobras descem · Número exato para chegar a 100",noRewards:"Sem taxa de entrada, transferência de token ou recompensa financeira.",connecting:"Conectando…",signing:"Assine a mensagem gratuita…",verifying:"Verificando FIT…",noWallet:"Nenhuma carteira compatível encontrada.",switchChain:"Mude para BNB Smart Chain.",lowFit:"É necessário pelo menos 1 FIT.",rollFirst:"Lance o dado para mover.",won:"{name} venceu!",snake:"Cobra! Desça.",ladder:"Escada! Suba.",overshoot:"É necessário o número exato para chegar a 100.",cpuTurn:"O computador está jogando…",move:" avançou para ",position:"Posição: "}};
Object.assign(copy.en,{reconnect:"Reconnect",connected:"Connected to room.",copied:"Room code copied.",copyFailed:"Could not copy the room code.",roomCodeInvalid:"Enter a valid six-character room code.",emptySeat:"Waiting for player",confirmNewGame:"Start a new game?",confirmExit:"Exit this game?",statsTitle:"Online player records"});
for(const [code,labels] of Object.entries({fa:{reconnect:"اتصال مجدد",connected:"به اتاق متصل شدید.",copied:"کد اتاق کپی شد.",copyFailed:"کپی کد اتاق ناموفق بود.",roomCodeInvalid:"کد شش‌حرفی معتبر وارد کنید.",emptySeat:"در انتظار بازیکن",confirmNewGame:"بازی جدید شروع شود؟",confirmExit:"از بازی خارج می‌شوید؟",statsTitle:"سوابق بازی‌های آنلاین"},ar:{reconnect:"إعادة الاتصال",connected:"متصل بالغرفة.",copied:"تم نسخ الرمز.",copyFailed:"تعذر نسخ الرمز.",roomCodeInvalid:"أدخل رمزاً صحيحاً من ستة أحرف.",emptySeat:"بانتظار لاعب",confirmNewGame:"بدء لعبة جديدة؟",confirmExit:"الخروج من اللعبة؟",statsTitle:"سجل المباريات عبر الإنترنت"},tr:{reconnect:"Yeniden bağlan",connected:"Odaya bağlandı.",copied:"Oda kodu kopyalandı.",copyFailed:"Kod kopyalanamadı.",roomCodeInvalid:"Geçerli altı karakterli kod girin.",emptySeat:"Oyuncu bekleniyor",confirmNewGame:"Yeni oyun başlatılsın mı?",confirmExit:"Oyundan çıkılsın mı?",statsTitle:"Çevrim içi oyuncu kayıtları"},ru:{reconnect:"Переподключиться",connected:"Подключено к комнате.",copied:"Код комнаты скопирован.",copyFailed:"Не удалось скопировать код.",roomCodeInvalid:"Введите код из шести символов.",emptySeat:"Ожидание игрока",confirmNewGame:"Начать новую игру?",confirmExit:"Выйти из игры?",statsTitle:"История онлайн-игр"},zh:{reconnect:"重新连接",connected:"已连接房间。",copied:"房间代码已复制。",copyFailed:"无法复制房间代码。",roomCodeInvalid:"请输入有效的六位房间代码。",emptySeat:"等待玩家",confirmNewGame:"开始新游戏？",confirmExit:"退出游戏？",statsTitle:"在线游戏记录"},es:{reconnect:"Reconectar",connected:"Conectado a la sala.",copied:"Código copiado.",copyFailed:"No se pudo copiar el código.",roomCodeInvalid:"Introduce un código válido de seis caracteres.",emptySeat:"Esperando jugador",confirmNewGame:"¿Iniciar una nueva partida?",confirmExit:"¿Salir de la partida?",statsTitle:"Récords de partidas online"},pt:{reconnect:"Reconectar",connected:"Conectado à sala.",copied:"Código copiado.",copyFailed:"Não foi possível copiar o código.",roomCodeInvalid:"Insira um código válido de seis caracteres.",emptySeat:"Aguardando jogador",confirmNewGame:"Iniciar um novo jogo?",confirmExit:"Sair do jogo?",statsTitle:"Registos de partidas online"}})){Object.assign(copy[code],labels);}
Object.assign(copy.en,{needSix:"You need a 6 to enter the board."});
Object.assign(copy.fa,{needSix:"برای ورود به زمین باید ابتدا عدد ۶ بیاورید."});
Object.assign(copy.ar,{needSix:"يجب أن تحصل على الرقم 6 لدخول اللوحة."});
Object.assign(copy.tr,{needSix:"Oyuna girmek için önce 6 atmalısın."});
Object.assign(copy.ru,{needSix:"Чтобы войти на поле, сначала выбросьте 6."});
Object.assign(copy.zh,{needSix:"必须先掷出6才能进入棋盘。"});
Object.assign(copy.es,{needSix:"Necesitas sacar un 6 para entrar al tablero."});
Object.assign(copy.pt,{needSix:"Você precisa tirar 6 para entrar no tabuleiro."});
const t=k=>copy[lang]?.[k]||copy.en[k]||k;
function applyLanguage(){const x=window.scrollX,y=window.scrollY,rtl=["fa","ar"].includes(lang),android=/Android/i.test(navigator.userAgent||"");document.documentElement.lang=lang;document.documentElement.dir=android&&rtl?"ltr":(rtl?"rtl":"ltr");document.body.classList.toggle("fi-rtl",rtl);const arena=document.querySelector(".arena");if(android&&arena)arena.dir="ltr";document.querySelectorAll("[data-i]").forEach(e=>{const v=t(e.dataset.i);if(v)e.textContent=v;});document.querySelectorAll("[data-i-placeholder]").forEach(e=>e.placeholder=t(e.dataset.iPlaceholder));$("languageSelect").value=lang;document.title=t("title")+" | Fly Infinity Games";if(!android)requestAnimationFrame(()=>window.scrollTo({left:x,top:y,behavior:"auto"}));}
function show(el,on){$(el).hidden=!on;}
async function api(path,body=null,auth=true,method="POST"){
 const headers={};if(body!==null)headers["content-type"]="application/json";if(auth&&sessionToken)headers.Authorization="Bearer "+sessionToken;
 const response=await fetch(API+path,{method,headers,body:body===null?undefined:JSON.stringify(body),cache:"no-store"});
 const data=await response.json().catch(()=>({ok:false,error:"Invalid server response."}));
 if(!response.ok||data.ok!==true)throw new Error(data.error||"Request failed.");
 return data;
}
async function connect(method){
 const btns=[$("connectBrowserBtn"),$("connectWalletBtn")];btns.forEach(b=>b.disabled=true);
 $("accessStatus").textContent=t("connecting");$("deniedPanel").hidden=true;$("eligiblePanel").hidden=true;$("modePanel").hidden=true;
 try{
  let p;if(method==="browser"&&window.fiSelectWalletProvider)p=await window.fiSelectWalletProvider();else p=window.ethereum;
  if(!p?.request)throw Error(t("noWallet"));
  await p.request({method:"eth_requestAccounts"});
  let web3=new ethers.providers.Web3Provider(p,"any"),network=await web3.getNetwork();
  if(network.chainId!==BSC){await p.request({method:"wallet_switchEthereumChain",params:[{chainId:"0x38"}]});web3=new ethers.providers.Web3Provider(p,"any");}
  const signer=web3.getSigner(),address=await signer.getAddress();
  $("accessStatus").textContent=t("signing");
  const challenge=await api("/api/auth/challenge",{address},false);
  const signature=await signer.signMessage(challenge.message);
  $("accessStatus").textContent=t("verifying");
  const verified=await api("/api/auth/verify",{address,nonce:challenge.nonce,signature},false);
  wallet=verified.wallet;sessionToken=verified.sessionToken;walletProvider=p;
  if(typeof p.on==="function"){p.on("accountsChanged",()=>window.location.reload());p.on("chainChanged",()=>window.location.reload());p.on("disconnect",()=>window.location.reload());}
  $("fitStatus").textContent=ethers.utils.formatUnits(verified.fitBalanceWei,18)+" FIT";
  $("fitMark").textContent="✓";$("fitMark").style.color="#00c896";
  show("eligiblePanel",true);show("modePanel",true);$("accessStatus").textContent=t("verified");
  await loadStats();
 }catch(e){
  wallet=null;sessionToken=null;
  const message=/at least 1 fit|minimum.*fit|insufficient.*fit/i.test(e.message)?t("lowFit"):e.message||t("notConnected");
  $("accessStatus").textContent=message;$("deniedPanel").textContent=message;show("deniedPanel",true);
 }finally{btns.forEach(b=>b.disabled=false);}
}
async function loadStats(){
 if(!sessionToken)return;
 try{
  const [me,top]=await Promise.all([api("/api/stats/me",null,true,"GET"),api("/api/stats/leaderboard",null,true,"GET")]);
  const s=me.stats||{};$("statsStatus").textContent="";$("statsWallet").textContent=wallet;$("statsPoints").textContent=(s.points||0)+" FIGS";$("statsWins").textContent=s.wins||0;$("statsGames").textContent=s.games||0;$("statsRank").textContent="#"+(s.rank||1);
  $("statsLeaderboard").replaceChildren();
  (top.leaderboard||[]).forEach((p,i)=>{const row=document.createElement("div");row.className="leader-row";row.textContent="#"+(i+1)+"  "+p.wallet_address.slice(0,8)+"…"+p.wallet_address.slice(-5)+" · "+p.points+" FIGS";$("statsLeaderboard").append(row);});
  show("statsPanel",true);
 }catch{$("statsStatus").textContent=t("onlineError");$("statsWallet").textContent=wallet||"";show("statsPanel",true);}
}
function renderWaitingSeats(room){
 const bar=$("playersBar");bar.dataset.count=String(room.playerCount);bar.replaceChildren();
 for(let i=0;i<room.playerCount;i++){
  const address=room.players?.[i]||null,chip=document.createElement("div");
  chip.className="player-chip"+(address?"":" empty-seat");
  const dot=document.createElement("span");dot.className="player-dot";dot.style.setProperty("--player",["#FF1744","#00E676","#2979FF","#FFD600"][i]);
  const name=document.createElement("strong");name.textContent="Player "+(i+1);
  const status=document.createElement("small");status.textContent=address?address.slice(0,6)+"…"+address.slice(-4):t("emptySeat");
  chip.append(dot,name,status);bar.append(chip);
 }
}
async function copyRoomCode(){
 if(!roomCode)return;
 try{
  if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(roomCode);
  else{const field=document.createElement("textarea");field.value=roomCode;field.style.position="fixed";field.style.opacity="0";document.body.append(field);field.select();if(!document.execCommand("copy"))throw Error("copy");field.remove();}
  $("onlineStatus").textContent=t("copied");
 }catch{$("onlineStatus").textContent=t("copyFailed");}
}
function showOnlineRoom(room,code){
 onlineMode=true;roomCode=code;game=room.state||null;show("modePanel",false);show("gamePanel",true);
 $("copyRoomBtn").hidden=false;$("reconnectBtn").hidden=true;
 $("gameTitle").textContent="Room "+code;$("activeRoomCode").textContent=code;
 show("onlineWaiting",room.status==="waiting");show("boardWrap",room.status==="active"||room.status==="finished");
 show("gameControls",room.status==="active"||room.status==="finished");show("gameFootnote",room.status==="active"||room.status==="finished");
 $("roomPlayersText").textContent=(room.players||[]).filter(Boolean).length+" / "+room.playerCount;
 if(room.status==="waiting")renderWaitingSeats(room);else if(game)render();
 $("gameMessage").textContent=t("waitingRoom");$("newGameBtn").hidden=true;
 connectRoomSocket();
}
async function connectRoomSocket(){
 if(!roomCode||!sessionToken)return;
 try{
  $("reconnectBtn").hidden=true;$("reconnectBtn").disabled=true;
  if(socket){try{socket.close();}catch{}socket=null;}
  const ticket=await api("/api/rooms/"+roomCode+"/ticket",null,true,"POST");
  const activeSocket=new WebSocket(ticket.socketUrl);socket=activeSocket;
  activeSocket.onopen=()=>{if(socket!==activeSocket)return;$("onlineStatus").textContent=t("connected");$("reconnectBtn").hidden=true;$("reconnectBtn").disabled=false;};
  activeSocket.onmessage=event=>{if(socket!==activeSocket)return;
   let message;try{message=JSON.parse(event.data);}catch{return;}
   if(message.type==="error"){$("onlineStatus").textContent=message.error;return;}
   if(!message.game)return;
   const room=message.game;$("roomPlayersText").textContent=(room.players||[]).filter(Boolean).length+" / "+room.playerCount;
   if(room.status==="waiting"){game=null;show("onlineWaiting",true);show("boardWrap",false);show("gameControls",false);show("gameFootnote",false);renderWaitingSeats(room);$("gameMessage").textContent=t("waitingRoom");return;}
   show("onlineWaiting",false);show("boardWrap",true);show("gameControls",true);show("gameFootnote",true);
   onlineStateQueue=onlineStateQueue.then(async()=>{if(socket!==activeSocket)return;const next=room.state;if(!next)return;const previous=game?structuredClone(game):null;if(previous&&next.moveNumber>previous.moveNumber){motionBusy=true;game=next;render();await animateMove(previous,next);motionBusy=false;render();}else{game=next;render();}if(game?.status==="finished")loadStats();}).catch(error=>{motionBusy=false;$("onlineStatus").textContent=error.message||t("onlineError");if(game)render();});
  };
  activeSocket.onclose=()=>{if(socket===activeSocket&&onlineMode&&roomCode){socket=null;$("onlineStatus").textContent=t("onlineError");$("reconnectBtn").hidden=false;$("reconnectBtn").disabled=false;}};
  activeSocket.onerror=()=>{if(socket===activeSocket&&onlineMode&&roomCode){$("onlineStatus").textContent=t("onlineError");$("reconnectBtn").hidden=false;$("reconnectBtn").disabled=false;}};
 }catch(error){$("onlineStatus").textContent=error.message||t("onlineError");$("reconnectBtn").hidden=false;$("reconnectBtn").disabled=false;}
}
async function createOnlineRoom(){
 unlockGameAudio();if(requestBusy)return;requestBusy=true;$("createRoomBtn").disabled=true;
 try{$("onlineStatus").textContent=t("connectingRoom");const result=await api("/api/rooms/create",{playerCount:Number($("onlineCount").value)});$("onlineStatus").textContent=t("roomCreated");showOnlineRoom(result.room,result.roomCode);}
 catch(error){$("onlineStatus").textContent=error.message||t("onlineError");}
 finally{requestBusy=false;$("createRoomBtn").disabled=false;}
}
async function joinOnlineRoom(){
 unlockGameAudio();if(requestBusy)return;
 const code=$("roomCodeInput").value.trim().toUpperCase();
 if(!/^[A-HJ-NP-Z2-9]{6}$/.test(code)){$("onlineStatus").textContent=t("roomCodeInvalid");$("roomCodeInput").focus();return;}
 requestBusy=true;$("joinRoomBtn").disabled=true;
 try{$("onlineStatus").textContent=t("connectingRoom");const result=await api("/api/rooms/join",{roomCode:code});$("onlineStatus").textContent="";showOnlineRoom(result.room,code);}
 catch(error){$("onlineStatus").textContent=error.message||t("onlineError");}
 finally{requestBusy=false;$("joinRoomBtn").disabled=false;}
}
function boardPoint(square){
 const logicalRow=Math.floor((square-1)/10);
 const logicalCol=logicalRow%2===0?(square-1)%10:9-((square-1)%10);
 return {x:(logicalCol+.5)*100,y:(9-logicalRow+.5)*100};
}
function svgNode(tag,attrs={}){
 const node=document.createElementNS("http://www.w3.org/2000/svg",tag);
 for(const [key,value] of Object.entries(attrs))node.setAttribute(key,String(value));
 return node;
}
function drawBoardRoutes(svg){
 const defs=svgNode("defs");
 const shadow=svgNode("filter",{id:"boardRouteShadow",x:"-40%",y:"-40%",width:"180%",height:"180%"});
 shadow.append(svgNode("feDropShadow",{dx:"0",dy:"4",stdDeviation:"3","flood-color":"#14213d","flood-opacity":".35"}));defs.append(shadow);
 svg.append(defs);
 const snakeColors=["#F05A9D","#21B7A5","#8066D9","#F06A4F","#3198E8","#E5A52F"];
 Object.entries(LADDERS).forEach(([from,to],i)=>{
  const a=boardPoint(Number(from)),b=boardPoint(to),dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,px=-dy/len*13,py=dx/len*13;
  const group=svgNode("g",{class:"board-ladder","aria-label":"Ladder "+from+" to "+to,filter:"url(#boardRouteShadow)"});
  for(const side of [-1,1]){
   const x1=a.x+px*side,y1=a.y+py*side,x2=b.x+px*side,y2=b.y+py*side;
   group.append(svgNode("line",{x1,y1,x2,y2,stroke:"#70411F","stroke-width":"13","stroke-linecap":"round",opacity:".9"}));
   group.append(svgNode("line",{x1,y1,x2,y2,stroke:i%2?"#D99A45":"#E8B65D","stroke-width":"8","stroke-linecap":"round"}));
  }
  const rungs=Math.max(3,Math.floor(len/23));
  for(let k=1;k<rungs;k++){
   const t=k/rungs,x=a.x+dx*t,y=a.y+dy*t;
   group.append(svgNode("line",{x1:x+px,y1:y+py,x2:x-px,y2:y-py,stroke:"#75451F","stroke-width":"8","stroke-linecap":"round"}));
   group.append(svgNode("line",{x1:x+px,y1:y+py,x2:x-px,y2:y-py,stroke:"#F2C778","stroke-width":"4.5","stroke-linecap":"round"}));
  }
  svg.append(group);
 });
 Object.entries(SNAKES).forEach(([from,to],i)=>{
  const a=boardPoint(Number(from)),b=boardPoint(to),dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,px=-dy/len,py=dx/len,side=i%2===0?1:-1,amp=Math.min(78,Math.max(28,len*.22))*side;
  const c1x=a.x+dx*.28+px*amp,c1y=a.y+dy*.28+py*amp,c2x=a.x+dx*.72-px*amp,c2y=a.y+dy*.72-py*amp;
  const d="M "+a.x+" "+a.y+" C "+c1x+" "+c1y+", "+c2x+" "+c2y+", "+b.x+" "+b.y;
  const color=snakeColors[i%snakeColors.length];
  const group=svgNode("g",{class:"board-snake","aria-label":"Snake "+from+" to "+to,filter:"url(#boardRouteShadow)"});
  group.append(svgNode("path",{d,fill:"none",stroke:"#24304C","stroke-width":"27","stroke-linecap":"round","stroke-linejoin":"round",opacity:".92"}));
  group.append(svgNode("path",{d,fill:"none",stroke:color,"stroke-width":"20","stroke-linecap":"round","stroke-linejoin":"round"}));
  group.append(svgNode("path",{d,fill:"none",stroke:"#FFFFFF","stroke-width":"3.5","stroke-linecap":"round","stroke-dasharray":"2 13",opacity:".68"}));
  group.append(svgNode("circle",{cx:a.x,cy:a.y,r:"17",fill:"#24304C"}));
  group.append(svgNode("circle",{cx:a.x,cy:a.y,r:"14",fill:color,stroke:"#FFFFFF","stroke-width":"2"}));
  for(const eye of [-1,1]){
   group.append(svgNode("circle",{cx:a.x+eye*5,cy:a.y-4,r:"4.2",fill:"#FFFFFF"}));
   group.append(svgNode("circle",{cx:a.x+eye*5+1,cy:a.y-4,r:"1.9",fill:"#17233B"}));
  }
  group.append(svgNode("path",{d:"M "+a.x+" "+(a.y+9)+" q 5 5 10 0",fill:"none",stroke:"#70234E","stroke-width":"2","stroke-linecap":"round"}));
  group.append(svgNode("path",{d:"M "+(a.x+4)+" "+(a.y+12)+" q 8 5 5 12",fill:"none",stroke:"#F35C77","stroke-width":"2.5","stroke-linecap":"round"}));
  svg.append(group);
 });
}
let snakesAudioContext=null,snakesNoiseBuffer=null;
function unlockGameAudio(){try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return null;if(!snakesAudioContext)snakesAudioContext=new Audio();if(snakesAudioContext.state==="suspended")snakesAudioContext.resume();return snakesAudioContext;}catch{return null;}}
function playDiceSound(){const ctx=unlockGameAudio();if(!ctx)return;const now=ctx.currentTime;
 if(!snakesNoiseBuffer){const buffer=ctx.createBuffer(1,Math.floor(ctx.sampleRate*.38),ctx.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*(.7+Math.random()*.3);snakesNoiseBuffer=buffer;}
 const noise=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();noise.buffer=snakesNoiseBuffer;filter.type="lowpass";filter.frequency.setValueAtTime(2100,now);filter.frequency.exponentialRampToValueAtTime(520,now+.34);gain.gain.setValueAtTime(.0001,now);gain.gain.linearRampToValueAtTime(.105,now+.035);gain.gain.exponentialRampToValueAtTime(.0001,now+.36);noise.connect(filter);filter.connect(gain);gain.connect(ctx.destination);noise.start(now);noise.stop(now+.38);
 [0,.085,.17,.255].forEach((offset,i)=>{const osc=ctx.createOscillator(),amp=ctx.createGain();osc.type="triangle";osc.frequency.setValueAtTime([740,510,630,390][i],now+offset);amp.gain.setValueAtTime(.0001,now+offset);amp.gain.linearRampToValueAtTime(.055,now+offset+.008);amp.gain.exponentialRampToValueAtTime(.0001,now+offset+.055);osc.connect(amp);amp.connect(ctx.destination);osc.start(now+offset);osc.stop(now+offset+.06);});
}
function playPieceSound(action){const ctx=unlockGameAudio();if(!ctx)return;const now=ctx.currentTime;const base=action?.kind==="finish"?620:action?.captured?470:390;
 const hit=(frequency,delay,volume,duration,type)=>{const osc=ctx.createOscillator(),amp=ctx.createGain();osc.type=type||"sine";osc.frequency.setValueAtTime(frequency,now+delay);osc.frequency.exponentialRampToValueAtTime(Math.max(90,frequency*.72),now+delay+duration);amp.gain.setValueAtTime(.0001,now+delay);amp.gain.linearRampToValueAtTime(volume,now+delay+.009);amp.gain.exponentialRampToValueAtTime(.0001,now+delay+duration);osc.connect(amp);amp.connect(ctx.destination);osc.start(now+delay);osc.stop(now+delay+duration+.01);};
 hit(base,0,.075,.105,"sine");hit(base*1.48,.025,.022,.12,"triangle");
 if(action?.captured||action?.kind==="finish"){hit(action.kind==="finish"?880:690,.095,.035,.22,"sine");}
}

function playStepSound(step=0){const ctx=unlockGameAudio();if(!ctx)return;const now=ctx.currentTime,osc=ctx.createOscillator(),gain=ctx.createGain();osc.type="triangle";osc.frequency.setValueAtTime(420+(step%4)*55,now);osc.frequency.exponentialRampToValueAtTime(210,now+.055);gain.gain.setValueAtTime(.0001,now);gain.gain.linearRampToValueAtTime(.045,now+.006);gain.gain.exponentialRampToValueAtTime(.0001,now+.07);osc.connect(gain);gain.connect(ctx.destination);osc.start(now);osc.stop(now+.075);}
function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
function squareOffset(board,token,square,baseRect){
 const cell=board.querySelector('[data-square="'+square+'"]');
 if(!cell)return {x:0,y:0};
 const rect=cell.getBoundingClientRect();
 return {x:rect.left+rect.width/2-(baseRect.left+baseRect.width/2),y:rect.top+rect.height/2-(baseRect.top+baseRect.height/2)};
}
function translateAt(point){return "translate("+point.x+"px,"+point.y+"px)";}
async function animateMove(previous,next){
 if(!previous||!next||!next.lastAction||next.moveNumber===previous.moveNumber)return;
 const action=next.lastAction;playDiceSound();
 const dice=$("diceFace");
 if(dice?.animate)dice.animate([{transform:"rotate(-12deg) scale(.82)"},{transform:"rotate(9deg) scale(1.12)"},{transform:"rotate(0) scale(1)"}],{duration:420,easing:"cubic-bezier(.2,.8,.2,1)"});
 if(action.needSix||action.overshoot){await sleep(320);return;}
 const board=$("snakesBoard"),token=board.querySelector('.token[data-player="'+action.player+'"]');
 if(!token)return;
 if(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches){playPieceSound({kind:action.to===100?"finish":""});return;}
 const path=[];
 if(action.from===0)path.push(1);
 else for(let n=action.from+1;n<=Math.min(action.from+action.value,100);n++)path.push(n);
 const raw=action.from===0?1:action.from+action.value;
 const baseRect=token.getBoundingClientRect();
 let current=action.from===0?1:action.from;
 let currentOffset=squareOffset(board,token,current,baseRect);

 // The token is rendered in its authoritative destination cell. Keep it visible
 // by translating that same DOM node from its old square; never remove/recreate it.
 if(action.from===0){
  token.style.transform=translateAt(currentOffset);
  const pop=token.animate([{transform:translateAt(currentOffset)+" scale(.18)",opacity:.15},{transform:translateAt(currentOffset)+" scale(1.16)",opacity:1},{transform:translateAt(currentOffset)+" scale(1)",opacity:1}],{duration:280,easing:"cubic-bezier(.2,.8,.2,1)",fill:"forwards"});
  await pop.finished.catch(()=>{});
  token.style.transform=translateAt(currentOffset);pop.cancel();playStepSound(0);
 }
 for(let i=0;i<path.length;i++){
  const nextSquare=path[i],targetOffset=squareOffset(board,token,nextSquare,baseRect);
  if(nextSquare===current){currentOffset=targetOffset;continue;}
  playStepSound(i);
  const animation=token.animate([
   {transform:translateAt(currentOffset)+" scale(1)",offset:0},
   {transform:translateAt({x:(currentOffset.x+targetOffset.x)/2,y:(currentOffset.y+targetOffset.y)/2})+" scale(1.12)",offset:.5},
   {transform:translateAt(targetOffset)+" scale(1)",offset:1}
  ],{duration:190,easing:"cubic-bezier(.22,.72,.24,1)",fill:"forwards"});
  await animation.finished.catch(()=>{});
  // Commit the visual position before cancelling WAAPI so there is no one-frame
  // reset to the destination between consecutive squares.
  token.style.transform=translateAt(targetOffset);animation.cancel();
  current=nextSquare;currentOffset=targetOffset;
 }
 if(action.transport){
  const fromOffset=squareOffset(board,token,raw,baseRect),toOffset=squareOffset(board,token,action.to,baseRect);
  const frames=[];
  for(let i=0;i<=10;i++){
   const p=i/10,eased=action.transport.type==="snake"?p*p*(3-2*p):p;
   frames.push({transform:translateAt({x:fromOffset.x+(toOffset.x-fromOffset.x)*eased,y:fromOffset.y+(toOffset.y-fromOffset.y)*eased})+" scale("+(1+Math.sin(p*Math.PI)*.12)+")"});
  }
  const route=token.animate(frames,{duration:action.transport.type==="snake"?620:560,easing:action.transport.type==="snake"?"cubic-bezier(.35,0,.65,1)":"cubic-bezier(.2,.75,.25,1)",fill:"forwards"});
  await route.finished.catch(()=>{});
  token.style.transform=translateAt(toOffset);route.cancel();
  playPieceSound({kind:action.transport.type==="ladder"?"finish":"snake"});
 }else if(action.to===100)playPieceSound({kind:"finish"});
}

function render(){
 if(!game)return;
 validateGame(game);
 $("playersBar").dataset.count=String(game.players.length);
 $("playersBar").replaceChildren();
 const highlightedTurn=motionBusy&&game.lastAction?.type==="roll"?game.lastAction.player:game.turn;
 game.players.forEach((p,i)=>{
  const chip=document.createElement("div");
  chip.className="player-chip"+(i===highlightedTurn&&game.status==="active"?" active":"");
  chip.style.setProperty("--player",p.color);
  const dot=document.createElement("span");dot.className="player-dot";
  const name=document.createElement("strong");name.textContent=p.name;
  const position=document.createElement("small");position.textContent=p.position+"/100";
  chip.append(dot,name,position);$("playersBar").append(chip);
 });
 const board=$("snakesBoard");board.replaceChildren();
 const routes=svgNode("svg",{class:"board-routes",viewBox:"0 0 1000 1000",preserveAspectRatio:"none","aria-hidden":"true"});
 drawBoardRoutes(routes);board.append(routes);
 const tokens=new Map();
 game.players.forEach((p,i)=>{if(p.position){if(!tokens.has(p.position))tokens.set(p.position,[]);tokens.get(p.position).push({...p,index:i});}});
 const tilePalette=["#FFE5B9","#D8F2E7","#DCEBFF","#F6DDF0","#E8E0FF","#FFF2A8","#D6F3F5","#FFE0D5"];
 for(let row=9;row>=0;row--){
  for(let col=0;col<10;col++){
   const n=row%2===1?row*10+(10-col):row*10+col+1;
   const cell=document.createElement("div");
   cell.className="square"+([1,100].includes(n)?" endpoint":"");
   cell.dataset.square=String(n);
   cell.style.setProperty("--tile",tilePalette[(n+Math.floor((n-1)/10)*3)%tilePalette.length]);
   const number=document.createElement("span");number.className="square-number";number.textContent=n;cell.append(number);
   if(n===1||n===100){
    const marker=document.createElement("span");marker.className="square-marker";marker.textContent=n===1?"START":"FINISH";cell.append(marker);
    const icon=document.createElement("span");icon.className="square-icon";icon.textContent=n===1?"🚩":"🏆";cell.append(icon);
   }
   const stack=tokens.get(n)||[];
   if(stack.length){
    const holder=document.createElement("div");holder.className="token-stack";
    stack.forEach(p=>{
     const token=document.createElement("span");token.className="token";
     token.style.setProperty("--token-color",p.color);token.title=p.name;
     token.setAttribute("aria-label",p.name);token.dataset.player=String(p.index);holder.append(token);
    });
    cell.append(holder);
   }
   board.append(cell);
  }
 }
 const displayedTurn=motionBusy&&game.lastAction?.type==="roll"?game.lastAction.player:game.turn;
 $("turnText").textContent=game.status==="finished"?game.players[game.winner].name:game.players[displayedTurn].name;
 $("turnDot").style.setProperty("--player",game.players[displayedTurn].color);
 $("diceFace").textContent=game.lastAction?.value||"–";
 $("rollBtn").disabled=motionBusy||game.status!=="active"||(onlineMode&&(game.players[game.turn]?.wallet!==wallet||socket?.readyState!==WebSocket.OPEN));
 $("gameMessage").textContent=game.status==="finished"?t("won").replace("{name}",game.players[game.winner].name):game.lastAction?.needSix?t("needSix"):game.lastAction?.transport?.type==="snake"?t("snake"):game.lastAction?.transport?.type==="ladder"?t("ladder"):game.lastAction?.overshoot?t("overshoot"):t("rollFirst");
}
function start(humans,total,difficulty){unlockGameAudio();motionBusy=false;onlineStateQueue=Promise.resolve();onlineMode=false;roomCode=null;if(socket){try{socket.close();}catch{}}$("copyRoomBtn").hidden=true;$("reconnectBtn").hidden=true;show("onlineWaiting",false);show("boardWrap",true);show("gameControls",true);show("gameFootnote",true);game=createGame(total,humans,difficulty);show("modePanel",false);show("gamePanel",true);render();if(humans<total&&game.turn>=humans)cpuTurn();}
async function cpuTurn(){if(!game||game.status!=="active"||game.players[game.turn].kind!=="cpu"||motionBusy)return;$("rollBtn").disabled=true;$("gameMessage").textContent=t("cpuTurn");await sleep(720);if(!game||game.status!=="active"||game.players[game.turn].kind!=="cpu")return;const previous=structuredClone(game);motionBusy=true;game=roll(game);render();await animateMove(previous,game);motionBusy=false;render();if(game.status==="active"&&game.players[game.turn].kind==="cpu")cpuTurn();}
async function playerRoll(){unlockGameAudio();if(motionBusy||!game||game.status!=="active"||game.players[game.turn].kind!=="human")return;if(onlineMode){if(socket?.readyState===WebSocket.OPEN&&game.players[game.turn]?.wallet===wallet)socket.send(JSON.stringify({type:"roll"}));return;}try{const previous=structuredClone(game);motionBusy=true;game=roll(game);render();await animateMove(previous,game);motionBusy=false;render();if(game.status==="active"&&game.players[game.turn].kind==="cpu")cpuTurn();}catch(e){motionBusy=false;$("gameMessage").textContent=e.message;render();}}
$("connectBrowserBtn").addEventListener("click",()=>connect("browser"));$("connectWalletBtn").addEventListener("click",()=>connect("wallet"));
$("createRoomBtn").addEventListener("click",createOnlineRoom);$("joinRoomBtn").addEventListener("click",joinOnlineRoom);
$("copyRoomBtn").addEventListener("click",copyRoomCode);
$("reconnectBtn").addEventListener("click",connectRoomSocket);
$("roomCodeInput").addEventListener("input",e=>{e.target.value=e.target.value.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g,"").slice(0,6);});
$("startLocalBtn").addEventListener("click",()=>start(Number($("localCount").value),Number($("localCount").value),"medium"));
$("startCpuBtn").addEventListener("click",()=>start(1,Number($("cpuCount").value),"medium"));
$("rollBtn").addEventListener("click",playerRoll);
$("newGameBtn").addEventListener("click",()=>{if(!game||!window.confirm(t("confirmNewGame")))return;const humans=game.players.filter(p=>p.kind==="human").length;start(humans,game.players.length,game.difficulty);});
$("exitBtn").addEventListener("click",()=>{if(!window.confirm(t("confirmExit")))return;if(socket){socket.close();socket=null;}game=null;onlineMode=false;roomCode=null;show("gamePanel",false);show("modePanel",true);$("newGameBtn").hidden=false;$("copyRoomBtn").hidden=true;$("reconnectBtn").hidden=true;});
$("languageSelect").addEventListener("change",e=>{lang=e.target.value;localStorage.setItem("fi-game-language",lang);applyLanguage();if(game)render();});
applyLanguage();
