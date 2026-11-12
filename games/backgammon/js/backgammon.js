import {initialPosition,legalTurnSequences,rollDice,winner,pipCount} from "./backgammon-engine.js";
const $=id=>document.getElementById(id);
const L={
en:{dashboard:"Dashboard",title:"Fly Infinity Backgammon",tagline:"Roll the dice. Plan every move.",online:"ONLINE PLAY",twoPlayers:"Play a friend",onlineDesc:"Create a private room and invite another player. Free wallet signature; no transaction.",comingSoon:"Coming soon",solo:"SOLO PLAY",cpu:"Play against CPU",cpuDesc:"Choose a difficulty and start a match against the computer.",startCpu:"Play vs CPU",cpuThinking:"CPU is thinking…",easy:"Easy",medium:"Medium",hard:"Hard",practice:"Practice board",boardLabel:"GAME BOARD · LOCAL RULES PREVIEW",practiceTitle:"Backgammon practice",newGame:"New game",white:"White",black:"Black",whiteTurn:"White to move",blackTurn:"Black to move",bar:"BAR",whiteHome:"WHITE HOME",blackHome:"BLACK HOME",roll:"Roll dice",remaining:"MOVES LEFT",rollPrompt:"Roll the dice to begin.",whiteCheckers:"White checkers",blackCheckers:"Black checkers",tapHint:"Select a checker, then a highlighted destination.",noRewards:"No entry fee. No token transfer. No financial rewards.",selectSource:"Select one of your checkers.",selectDestination:"Choose a highlighted destination.",noMoves:"No legal moves. Turn passes.",turn:"{side} to move.",won:"{side} wins!",selectMove:"Choose a legal move for the selected checker.",invalid:"That move is not legal.",rollFirst:"Roll the dice first."},
fa:{dashboard:"داشبورد",title:"تخته نرد فلای اینفینیتی",tagline:"تاس بریز؛ هوشمندانه حرکت کن.",online:"بازی آنلاین",twoPlayers:"بازی با دوستان",onlineDesc:"اتاق خصوصی بسازید و حریف را دعوت کنید. فقط امضای رایگان؛ بدون تراکنش.",comingSoon:"به‌زودی",solo:"بازی انفرادی",cpu:"بازی با کامپیوتر",cpuDesc:"درجه سختی را انتخاب کنید و با کامپیوتر بازی کنید.",startCpu:"شروع بازی با CPU",cpuThinking:"کامپیوتر در حال فکر کردن است…",easy:"آسان",medium:"متوسط",hard:"سخت",practice:"تمرین صفحه",boardLabel:"صفحه بازی · پیش‌نمایش قوانین",practiceTitle:"تمرین تخته‌نرد",newGame:"بازی جدید",white:"سفید",black:"سیاه",whiteTurn:"نوبت سفید",blackTurn:"نوبت سیاه",bar:"بار",whiteHome:"خانه سفید",blackHome:"خانه سیاه",roll:"ریختن تاس",remaining:"حرکت باقی‌مانده",rollPrompt:"برای شروع تاس بریزید.",whiteCheckers:"مهره‌های سفید",blackCheckers:"مهره‌های سیاه",tapHint:"یک مهره را انتخاب و سپس مقصد مشخص‌شده را بزنید.",noRewards:"بدون هزینه ورود، انتقال توکن یا پاداش مالی.",selectSource:"یکی از مهره‌های خود را انتخاب کنید.",selectDestination:"یکی از مقصدهای مشخص‌شده را انتخاب کنید.",noMoves:"حرکت مجازی وجود ندارد؛ نوبت رد می‌شود.",turn:"نوبت {side} است.",won:"{side} برنده شد!",selectMove:"یک حرکت مجاز برای مهره انتخاب‌شده بزنید.",invalid:"این حرکت مجاز نیست.",rollFirst:"ابتدا تاس بریزید."},
ar:{dashboard:"لوحة التحكم",title:"Fly Infinity طاولة الزهر",tagline:"ارمِ النرد وخطط لكل حركة.",online:"اللعب عبر الإنترنت",twoPlayers:"العب مع صديق",onlineDesc:"أنشئ غرفة خاصة وادعُ لاعباً آخر. توقيع مجاني فقط دون معاملات.",comingSoon:"قريباً",solo:"اللعب الفردي",cpu:"العب ضد الكمبيوتر",cpuDesc:"اختر مستوى الصعوبة وابدأ مباراة ضد الكمبيوتر.",startCpu:"ابدأ ضد الكمبيوتر",cpuThinking:"الكمبيوتر يفكر…",easy:"سهل",medium:"متوسط",hard:"صعب",practice:"تجربة اللوحة",boardLabel:"لوحة اللعب · معاينة القواعد",practiceTitle:"تدريب الطاولة",newGame:"لعبة جديدة",white:"الأبيض",black:"الأسود",whiteTurn:"دور الأبيض",blackTurn:"دور الأسود",bar:"الحاجز",whiteHome:"بيت الأبيض",blackHome:"بيت الأسود",roll:"ارمِ النرد",remaining:"الحركات المتبقية",rollPrompt:"ارمِ النرد للبدء.",whiteCheckers:"قطع بيضاء",blackCheckers:"قطع سوداء",tapHint:"اختر قطعة ثم وجهة مضيئة.",noRewards:"لا رسوم دخول ولا تحويل رموز ولا مكافآت مالية.",selectSource:"اختر إحدى قطعك.",selectDestination:"اختر وجهة مضيئة.",noMoves:"لا توجد حركات قانونية؛ يتم تمرير الدور.",turn:"دور {side}.",won:"فاز {side}!",selectMove:"اختر حركة قانونية للقطعة المحددة.",invalid:"هذه الحركة غير قانونية.",rollFirst:"ارمِ النرد أولاً."},
tr:{dashboard:"Panel",title:"Fly Infinity Tavla",tagline:"Zarı at. Her hamleni planla.",online:"ÇEVRİM İÇİ",twoPlayers:"Arkadaşınla oyna",onlineDesc:"Özel oda oluştur ve başka bir oyuncuyu davet et. Ücretsiz imza; işlem yok.",comingSoon:"Yakında",solo:"TEK KİŞİLİK",cpu:"Bilgisayara karşı oyna",cpuDesc:"Zorluk seç ve bilgisayara karşı oyuna başla.",startCpu:"Bilgisayara karşı başla",cpuThinking:"Bilgisayar düşünüyor…",easy:"Kolay",medium:"Orta",hard:"Zor",practice:"Tahtayı dene",boardLabel:"OYUN TAHTASI · KURAL ÖNİZLEMESİ",practiceTitle:"Tavla antrenmanı",newGame:"Yeni oyun",white:"Beyaz",black:"Siyah",whiteTurn:"Beyazın sırası",blackTurn:"Siyahın sırası",bar:"BAR",whiteHome:"BEYAZ EVİ",blackHome:"SİYAH EVİ",roll:"Zar at",remaining:"KALAN HAMLE",rollPrompt:"Başlamak için zar at.",whiteCheckers:"Beyaz pullar",blackCheckers:"Siyah pullar",tapHint:"Bir pul seç, sonra vurgulanan hedefe dokun.",noRewards:"Giriş ücreti ve token transferi yoktur.",selectSource:"Kendi pullarından birini seç.",selectDestination:"Vurgulanan hedefi seç.",noMoves:"Yasal hamle yok. Sıra geçiyor.",turn:"{side} oynuyor.",won:"{side} kazandı!",selectMove:"Seçilen pul için yasal hamle seç.",invalid:"Bu hamle geçersiz.",rollFirst:"Önce zar at."},
ru:{dashboard:"Панель",title:"Fly Infinity Нарды",tagline:"Бросай кости. Планируй каждый ход.",online:"ОНЛАЙН ИГРА",twoPlayers:"Играть с другом",onlineDesc:"Создайте приватную комнату и пригласите соперника. Бесплатная подпись, без транзакций.",comingSoon:"Скоро",solo:"ОДИНОЧНАЯ ИГРА",cpu:"Играть против компьютера",cpuDesc:"Выберите сложность и начните игру против компьютера.",startCpu:"Играть против CPU",cpuThinking:"Компьютер думает…",easy:"Легко",medium:"Средне",hard:"Сложно",practice:"Пробная доска",boardLabel:"ИГРОВОЕ ПОЛЕ · ПРОВЕРКА ПРАВИЛ",practiceTitle:"Тренировка в нарды",newGame:"Новая игра",white:"Белые",black:"Чёрные",whiteTurn:"Ход белых",blackTurn:"Ход чёрных",bar:"БАР",whiteHome:"ДОМ БЕЛЫХ",blackHome:"ДОМ ЧЁРНЫХ",roll:"Бросить кости",remaining:"ОСТАЛОСЬ ХОДОВ",rollPrompt:"Бросьте кости, чтобы начать.",whiteCheckers:"Белые фишки",blackCheckers:"Чёрные фишки",tapHint:"Выберите шашку, затем подсвеченную точку.",noRewards:"Без платы за вход и перевода токенов.",selectSource:"Выберите свою шашку.",selectDestination:"Выберите подсвеченную точку.",noMoves:"Нет допустимых ходов. Передача хода.",turn:"Ход: {side}.",won:"Победили: {side}!",selectMove:"Выберите допустимый ход для шашки.",invalid:"Недопустимый ход.",rollFirst:"Сначала бросьте кости."},
zh:{dashboard:"控制面板",title:"Fly Infinity 西洋双陆棋",tagline:"掷骰子，规划每一步。",online:"在线游戏",twoPlayers:"与朋友对战",onlineDesc:"创建私人房间并邀请另一位玩家。仅需免费签名，不会发起交易。",comingSoon:"即将推出",solo:"单人游戏",cpu:"与电脑对战",cpuDesc:"选择难度并开始与电脑对战。",startCpu:"开始人机对战",cpuThinking:"电脑正在思考…",easy:"简单",medium:"中等",hard:"困难",practice:"练习棋盘",boardLabel:"游戏棋盘 · 规则预览",practiceTitle:"双陆棋练习",newGame:"新游戏",white:"白方",black:"黑方",whiteTurn:"白方回合",blackTurn:"黑方回合",bar:"中柱",whiteHome:"白方基地",blackHome:"黑方基地",roll:"掷骰子",remaining:"剩余步数",rollPrompt:"掷骰子开始游戏。",whiteCheckers:"白色棋子",blackCheckers:"黑色棋子",tapHint:"选择一枚棋子，再选择高亮目标点。",noRewards:"无需入场费，不转移代币，无金融奖励。",selectSource:"选择一枚己方棋子。",selectDestination:"选择高亮的目标点。",noMoves:"没有合法走法，回合跳过。",turn:"轮到{side}。",won:"{side}获胜！",selectMove:"为所选棋子选择合法走法。",invalid:"此走法不合法。",rollFirst:"请先掷骰子。"},
es:{dashboard:"Panel",title:"Fly Infinity Backgammon",tagline:"Lanza los dados. Planea cada movimiento.",online:"JUEGO EN LÍNEA",twoPlayers:"Juega con un amigo",onlineDesc:"Crea una sala privada e invita a otro jugador. Firma gratuita; sin transacciones.",comingSoon:"Próximamente",solo:"JUEGO INDIVIDUAL",cpu:"Juega contra la CPU",cpuDesc:"Elige la dificultad y empieza una partida contra la CPU.",startCpu:"Jugar contra CPU",cpuThinking:"La CPU está pensando…",easy:"Fácil",medium:"Medio",hard:"Difícil",practice:"Practicar tablero",boardLabel:"TABLERO · VISTA PREVIA DE REGLAS",practiceTitle:"Práctica de backgammon",newGame:"Nueva partida",white:"Blancas",black:"Negras",whiteTurn:"Turno de blancas",blackTurn:"Turno de negras",bar:"BARRA",whiteHome:"CASA BLANCAS",blackHome:"CASA NEGRAS",roll:"Lanzar dados",remaining:"MOVIMIENTOS RESTANTES",rollPrompt:"Lanza los dados para empezar.",whiteCheckers:"Fichas blancas",blackCheckers:"Fichas negras",tapHint:"Elige una ficha y luego un destino resaltado.",noRewards:"Sin cuota de entrada ni transferencia de tokens.",selectSource:"Selecciona una de tus fichas.",selectDestination:"Elige un destino resaltado.",noMoves:"No hay movimientos legales. Pasa el turno.",turn:"Turno de {side}.",won:"¡Gana {side}!",selectMove:"Elige un movimiento legal para la ficha.",invalid:"Movimiento no válido.",rollFirst:"Lanza los dados primero."},
pt:{dashboard:"Painel",title:"Fly Infinity Gamão",tagline:"Lance os dados. Planeje cada jogada.",online:"JOGO ONLINE",twoPlayers:"Jogue com um amigo",onlineDesc:"Crie uma sala privada e convide outro jogador. Assinatura gratuita; sem transação.",comingSoon:"Em breve",solo:"JOGO SOLO",cpu:"Jogue contra o computador",cpuDesc:"Escolha a dificuldade e comece uma partida contra o computador.",startCpu:"Jogar contra CPU",cpuThinking:"O computador está pensando…",easy:"Fácil",medium:"Médio",hard:"Difícil",practice:"Praticar tabuleiro",boardLabel:"TABULEIRO · PRÉVIA DAS REGRAS",practiceTitle:"Prática de gamão",newGame:"Novo jogo",white:"Brancas",black:"Pretas",whiteTurn:"Vez das brancas",blackTurn:"Vez das pretas",bar:"BARRA",whiteHome:"CASA BRANCAS",blackHome:"CASA PRETAS",roll:"Lançar dados",remaining:"JOGADAS RESTANTES",rollPrompt:"Lance os dados para começar.",whiteCheckers:"Peças brancas",blackCheckers:"Peças pretas",tapHint:"Selecione uma peça e depois um destino destacado.",noRewards:"Sem taxa de entrada ou transferência de tokens.",selectSource:"Selecione uma das suas peças.",selectDestination:"Escolha um destino destacado.",noMoves:"Sem jogadas legais. Passe a vez.",turn:"Vez de {side}.",won:"{side} venceu!",selectMove:"Escolha uma jogada válida para a peça.",invalid:"Jogada inválida.",rollFirst:"Lance os dados primeiro."}};

const O={
en:{playerAccess:"PLAYER ACCESS",connectToEnter:"Connect to enter",accessIntro:"Backgammon Arena is open to wallets holding at least 1 FIT on BNB Smart Chain. A free signature verifies your wallet; no transaction is requested.",minimumBalance:"Minimum FIT balance",serverVerified:"Server verification successful",verifiedNote:"Your wallet has passed the FIT balance check.",noWallet:"No compatible wallet was found. Open this page in a wallet browser or install a browser wallet.",noInjectedWallet:"No injected wallet was found. Open the page in your wallet\u2019s built-in browser.",addBsc:"Add BNB Smart Chain to your wallet first.",switchBsc:"Please switch your wallet to BNB Smart Chain.",walletTimeout:"Wallet signature timed out. Reconnect and try again.",walletConnected:"Wallet connected: {address}",signatureReceived:"Free signature received. Verifying your wallet…",noWalletVerification:"Wallet verification could not be completed.",accessVerified:"Access verified",connected:"Connected",connectBrowser:"Connect with browser",connectWallet:"Connect wallet",walletNotConnected:"Connect a BNB Smart Chain wallet to play online. A free signature is required; no transaction.",connecting:"Connecting wallet…",signing:"Approve the free signature in your wallet…",verifying:"Verifying FIT balance…",fitRequired:"At least 1 FIT required",connectOnline:"PLAYER ACCESS · ONLINE MATCH",createRoom:"Create private room",roomCode:"ROOM CODE",join:"Join room",roomShare:"Create a room and share its six-character code.",waitingOpponent:"Waiting for your opponent to join…",yourTurn:"Your turn · roll the dice",opponentTurn:"Opponent's turn",roomCopied:"Room code copied.",connectionClosed:"Connection closed. Refresh or reconnect.",drawOffer:"Offer draw",acceptDraw:"Accept draw",declineDraw:"Decline",resign:"Resign",confirmResign:"Are you sure you want to resign?",drawOfferReceived:"Your opponent offered a draw.",drawDeclined:"Draw offer declined.",youWon:"You won!",youLost:"You lost.",drawGame:"The game is a draw.",youWonByBearOff:"You won by bearing off all your checkers!",youLostByBearOff:"Your opponent bore off all checkers. You lost.",opponentResigned:"Your opponent resigned. You win!",youResigned:"You resigned. Your opponent wins.",finished:"Game finished",rollToBegin:"Roll the dice to begin.",serverError:"Server error.",walletChanged:"Wallet changed. Reconnect to continue.",copyCode:"Copy code",onlineRoom:"ONLINE PRIVATE ROOM",leavePractice:"Practice board",cpuOpponent:"CPU",cpuMatch:"SOLO PLAY · VS CPU",cpuReady:"CPU match ready. Your turn.",walletProfile:"WALLET PLAYER PROFILE",yourStats:"Your Backgammon stats",totalFigs:"TOTAL FIGS",rank:"RANK",wins:"WINS",losses:"LOSSES",draws:"DRAWS",topPlayers:"TOP PLAYERS",noRankedGames:"No ranked games yet.",statsError:"Could not load player records. Please try again.",statsScope:"Completed online and CPU matches count toward records; practice does not.",finalResult:"FINAL RESULT"},
fa:{playerAccess:"دسترسی بازیکن",connectToEnter:"برای ورود کیف پول را متصل کنید",accessIntro:"بازی آنلاین تخته‌نرد برای کیف پول‌هایی با حداقل ۱ FIT روی شبکه BNB Smart Chain فعال است. فقط امضای رایگان لازم است و هیچ تراکنشی انجام نمی‌شود.",minimumBalance:"حداقل موجودی FIT",serverVerified:"تأیید سرور موفق بود",verifiedNote:"موجودی FIT کیف پول شما تأیید شده است.",noWallet:"کیف پول سازگار پیدا نشد. صفحه را در مرورگر کیف پول باز کنید یا یک کیف پول مرورگری نصب کنید.",noInjectedWallet:"کیف پول مرورگری پیدا نشد. صفحه را در مرورگر داخلی کیف پول باز کنید.",addBsc:"ابتدا شبکه BNB Smart Chain را به کیف پول اضافه کنید.",switchBsc:"لطفاً شبکه کیف پول را به BNB Smart Chain تغییر دهید.",walletTimeout:"مهلت امضای کیف پول تمام شد. دوباره متصل شوید و تلاش کنید.",walletConnected:"کیف پول متصل شد: {address}",signatureReceived:"امضای رایگان دریافت شد؛ در حال تأیید کیف پول…",noWalletVerification:"تأیید کیف پول انجام نشد.",connectBrowser:"اتصال با مرورگر",connectWallet:"اتصال کیف پول",walletNotConnected:"برای بازی آنلاین کیف پول BNB Smart Chain را متصل کنید. فقط امضای رایگان لازم است و تراکنشی انجام نمی‌شود.",connecting:"در حال اتصال کیف پول…",signing:"امضای رایگان را در کیف پول تأیید کنید…",verifying:"در حال بررسی موجودی FIT…",fitRequired:"حداقل ۱ FIT لازم است",connectOnline:"دسترسی بازیکن · مسابقه آنلاین",createRoom:"ساخت اتاق خصوصی",roomCode:"کد اتاق",join:"ورود به اتاق",roomShare:"اتاق بسازید و کد شش‌کاراکتری را برای حریف بفرستید.",waitingOpponent:"منتظر ورود حریف…",yourTurn:"نوبت شماست · تاس بریزید",opponentTurn:"نوبت حریف",roomCopied:"کد اتاق کپی شد.",connectionClosed:"اتصال قطع شد. صفحه را تازه‌سازی یا دوباره متصل کنید.",drawOffer:"پیشنهاد مساوی",acceptDraw:"قبول مساوی",decline:"رد کردن",resign:"تسلیم",confirmResign:"از تسلیم شدن مطمئن هستید؟",drawOfferReceived:"حریف پیشنهاد مساوی داده است.",drawDeclined:"پیشنهاد مساوی رد شد.",youWon:"شما برنده شدید!",youLost:"شما باختید.",drawGame:"بازی مساوی شد.",youWonByBearOff:"با خارج کردن تمام مهره‌ها برنده شدید!",youLostByBearOff:"حریف تمام مهره‌هایش را خارج کرد؛ شما باختید.",opponentResigned:"حریف تسلیم شد؛ شما برنده شدید!",youResigned:"شما تسلیم شدید؛ حریف برنده شد.",finished:"بازی تمام شد",rollToBegin:"برای شروع تاس بریزید.",serverError:"خطای سرور.",walletChanged:"کیف پول تغییر کرد. برای ادامه دوباره متصل شوید.",copyCode:"کپی کد",onlineRoom:"اتاق خصوصی آنلاین",leavePractice:"صفحه تمرین",cpuOpponent:"کامپیوتر",cpuMatch:"بازی انفرادی · مقابل کامپیوتر",cpuReady:"بازی با کامپیوتر آماده است؛ نوبت شماست.",walletProfile:"پروفایل بازیکن",yourStats:"آمار تخته‌نرد شما",totalFigs:"امتیاز کل",rank:"رتبه",wins:"برد",losses:"باخت",draws:"مساوی",topPlayers:"بازیکنان برتر",noRankedGames:"هنوز رکوردی ثبت نشده است.",statsError:"بارگذاری رکوردها انجام نشد؛ دوباره تلاش کنید.",statsScope:"بازی‌های آنلاین و مقابل کامپیوتر در رکوردها ثبت می‌شوند؛ تمرین محاسبه نمی‌شود.",finalResult:"نتیجه نهایی"},
ar:{connectBrowser:"الاتصال عبر المتصفح",connectWallet:"ربط المحفظة",walletNotConnected:"اربط محفظة BNB Smart Chain للعب عبر الإنترنت. يلزم توقيع مجاني فقط ولا توجد معاملة.",connecting:"جارٍ ربط المحفظة…",signing:"وافق على التوقيع المجاني في محفظتك…",verifying:"جارٍ التحقق من رصيد FIT…",fitRequired:"يلزم 1 FIT على الأقل",connectOnline:"دخول اللاعب · مباراة عبر الإنترنت",createRoom:"إنشاء غرفة خاصة",roomCode:"رمز الغرفة",join:"انضمام",roomShare:"أنشئ غرفة وشارك رمزها المكون من ستة أحرف.",waitingOpponent:"بانتظار انضمام خصمك…",yourTurn:"دورك · ارمِ النرد",opponentTurn:"دور الخصم",roomCopied:"تم نسخ رمز الغرفة.",connectionClosed:"انقطع الاتصال. حدّث الصفحة أو أعد الاتصال.",drawOffer:"اقتراح التعادل",acceptDraw:"قبول التعادل",decline:"رفض",resign:"استسلام",confirmResign:"هل أنت متأكد أنك تريد الاستسلام؟",drawOfferReceived:"عرض خصمك التعادل.",drawDeclined:"تم رفض عرض التعادل.",youWon:"لقد فزت!",youLost:"لقد خسرت.",drawGame:"انتهت المباراة بالتعادل.",youWonByBearOff:"فزت بإخراج جميع قطعك!",youLostByBearOff:"أخرج خصمك جميع قطعه. لقد خسرت.",opponentResigned:"استسلم خصمك. أنت الفائز!",youResigned:"استسلمت. خصمك هو الفائز.",finished:"انتهت المباراة",rollToBegin:"ارمِ النرد للبدء.",serverError:"خطأ في الخادم.",walletChanged:"تغيرت المحفظة. أعد الاتصال للمتابعة.",copyCode:"نسخ الرمز",onlineRoom:"غرفة خاصة عبر الإنترنت",leavePractice:"لوحة التدريب"},
tr:{connectBrowser:"Tarayıcıyla bağlan",connectWallet:"Cüzdanı bağla",walletNotConnected:"Çevrim içi oynamak için BNB Smart Chain cüzdanını bağla. Ücretsiz imza gerekir; işlem yapılmaz.",connecting:"Cüzdan bağlanıyor…",signing:"Cüzdanında ücretsiz imzayı onayla…",verifying:"FIT bakiyesi doğrulanıyor…",fitRequired:"En az 1 FIT gerekli",connectOnline:"OYUNCU ERİŞİMİ · ÇEVRİM İÇİ MAÇ",createRoom:"Özel oda oluştur",roomCode:"ODA KODU",join:"Odaya katıl",roomShare:"Oda oluştur ve altı karakterli kodu rakibinle paylaş.",waitingOpponent:"Rakibin katılması bekleniyor…",yourTurn:"Senin sıran · zar at",opponentTurn:"Rakibin sırası",roomCopied:"Oda kodu kopyalandı.",connectionClosed:"Bağlantı kapandı. Yenile veya yeniden bağlan.",drawOffer:"Beraberlik teklif et",acceptDraw:"Beraberliği kabul et",decline:"Reddet",resign:"Pes et",confirmResign:"Pes etmek istediğinden emin misin?",drawOfferReceived:"Rakibin beraberlik teklif etti.",drawDeclined:"Beraberlik teklifi reddedildi.",youWon:"Kazandın!",youLost:"Kaybettin.",drawGame:"Oyun berabere.",youWonByBearOff:"Tüm pullarını toplayarak kazandın!",youLostByBearOff:"Rakibin tüm pullarını topladı. Kaybettin.",opponentResigned:"Rakibin pes etti. Kazandın!",youResigned:"Pes ettin. Rakibin kazandı.",finished:"Oyun bitti",rollToBegin:"Başlamak için zar at.",serverError:"Sunucu hatası.",walletChanged:"Cüzdan değişti. Devam etmek için yeniden bağlan.",copyCode:"Kodu kopyala",onlineRoom:"ÇEVRİM İÇİ ÖZEL ODA",leavePractice:"Tahtayı dene"},
ru:{connectBrowser:"Подключить через браузер",connectWallet:"Подключить кошелёк",walletNotConnected:"Для онлайн-игры подключите кошелёк BNB Smart Chain. Нужна бесплатная подпись; транзакций нет.",connecting:"Подключение кошелька…",signing:"Подтвердите бесплатную подпись в кошельке…",verifying:"Проверка баланса FIT…",fitRequired:"Требуется минимум 1 FIT",connectOnline:"ДОСТУП ИГРОКА · ОНЛАЙН-МАТЧ",createRoom:"Создать приватную комнату",roomCode:"КОД КОМНАТЫ",join:"Войти",roomShare:"Создайте комнату и отправьте сопернику код из шести символов.",waitingOpponent:"Ожидание соперника…",yourTurn:"Ваш ход · бросьте кости",opponentTurn:"Ход соперника",roomCopied:"Код комнаты скопирован.",connectionClosed:"Соединение закрыто. Обновите страницу или подключитесь снова.",drawOffer:"Предложить ничью",acceptDraw:"Принять ничью",decline:"Отклонить",resign:"Сдаться",confirmResign:"Вы уверены, что хотите сдаться?",drawOfferReceived:"Соперник предложил ничью.",drawDeclined:"Предложение ничьей отклонено.",youWon:"Вы победили!",youLost:"Вы проиграли.",drawGame:"Ничья.",youWonByBearOff:"Вы победили, сняв все свои шашки!",youLostByBearOff:"Соперник снял все шашки. Вы проиграли.",opponentResigned:"Соперник сдался. Вы победили!",youResigned:"Вы сдались. Победил соперник.",finished:"Игра завершена",rollToBegin:"Бросьте кости, чтобы начать.",serverError:"Ошибка сервера.",walletChanged:"Кошелёк изменён. Подключитесь снова.",copyCode:"Копировать код",onlineRoom:"ОНЛАЙН-КОМНАТА",leavePractice:"Пробная доска"},
zh:{connectBrowser:"通过浏览器连接",connectWallet:"连接钱包",walletNotConnected:"连接 BNB Smart Chain 钱包以进行在线游戏。只需免费签名，不会发起交易。",connecting:"正在连接钱包…",signing:"请在钱包中确认免费签名…",verifying:"正在验证 FIT 余额…",fitRequired:"至少需要 1 FIT",connectOnline:"玩家入口 · 在线对局",createRoom:"创建私人房间",roomCode:"房间代码",join:"加入房间",roomShare:"创建房间并将六位代码分享给对手。",waitingOpponent:"等待对手加入…",yourTurn:"你的回合 · 掷骰子",opponentTurn:"对手回合",roomCopied:"房间代码已复制。",connectionClosed:"连接已关闭。请刷新或重新连接。",drawOffer:"提议和棋",acceptDraw:"接受和棋",decline:"拒绝",resign:"认输",confirmResign:"确定要认输吗？",drawOfferReceived:"对手提出和棋。",drawDeclined:"和棋提议已拒绝。",youWon:"你赢了！",youLost:"你输了。",drawGame:"本局和棋。",youWonByBearOff:"你已收完所有棋子，获胜！",youLostByBearOff:"对手已收完所有棋子，你输了。",opponentResigned:"对手认输了，你赢了！",youResigned:"你认输了，对手获胜。",finished:"游戏结束",rollToBegin:"掷骰子开始游戏。",serverError:"服务器错误。",walletChanged:"钱包已更改。请重新连接。",copyCode:"复制代码",onlineRoom:"在线私人房间",leavePractice:"练习棋盘"},
es:{connectBrowser:"Conectar con navegador",connectWallet:"Conectar cartera",walletNotConnected:"Conecta una cartera BNB Smart Chain para jugar en línea. Solo se requiere una firma gratuita; no hay transacciones.",connecting:"Conectando cartera…",signing:"Aprueba la firma gratuita en tu cartera…",verifying:"Verificando saldo FIT…",fitRequired:"Se requiere al menos 1 FIT",connectOnline:"ACCESO DE JUGADOR · PARTIDA EN LÍNEA",createRoom:"Crear sala privada",roomCode:"CÓDIGO DE SALA",join:"Unirse",roomShare:"Crea una sala y comparte el código de seis caracteres.",waitingOpponent:"Esperando a que se una tu rival…",yourTurn:"Tu turno · lanza los dados",opponentTurn:"Turno del rival",roomCopied:"Código copiado.",connectionClosed:"Conexión cerrada. Actualiza o vuelve a conectar.",drawOffer:"Ofrecer tablas",acceptDraw:"Aceptar tablas",decline:"Rechazar",resign:"Rendirse",confirmResign:"¿Seguro que quieres rendirte?",drawOfferReceived:"Tu rival ha ofrecido tablas.",drawDeclined:"Oferta de tablas rechazada.",youWon:"¡Has ganado!",youLost:"Has perdido.",drawGame:"La partida terminó en tablas.",youWonByBearOff:"¡Has ganado al retirar todas tus fichas!",youLostByBearOff:"Tu rival retiró todas sus fichas. Has perdido.",opponentResigned:"Tu rival se rindió. ¡Has ganado!",youResigned:"Te rendiste. Tu rival gana.",finished:"Partida terminada",rollToBegin:"Lanza los dados para empezar.",serverError:"Error del servidor.",walletChanged:"La cartera cambió. Vuelve a conectar.",copyCode:"Copiar código",onlineRoom:"SALA PRIVADA EN LÍNEA",leavePractice:"Practicar tablero"},
pt:{connectBrowser:"Conectar pelo navegador",connectWallet:"Conectar carteira",walletNotConnected:"Conecte uma carteira BNB Smart Chain para jogar online. É necessária apenas uma assinatura gratuita; nenhuma transação.",connecting:"Conectando carteira…",signing:"Aprove a assinatura gratuita na carteira…",verifying:"Verificando saldo FIT…",fitRequired:"É necessário pelo menos 1 FIT",connectOnline:"ACESSO DO JOGADOR · PARTIDA ONLINE",createRoom:"Criar sala privada",roomCode:"CÓDIGO DA SALA",join:"Entrar",roomShare:"Crie uma sala e compartilhe o código de seis caracteres.",waitingOpponent:"Aguardando o adversário entrar…",yourTurn:"Sua vez · lance os dados",opponentTurn:"Vez do adversário",roomCopied:"Código da sala copiado.",connectionClosed:"Conexão encerrada. Atualize ou reconecte.",drawOffer:"Oferecer empate",acceptDraw:"Aceitar empate",decline:"Recusar",resign:"Desistir",confirmResign:"Tem certeza de que deseja desistir?",drawOfferReceived:"Seu adversário ofereceu empate.",drawDeclined:"Oferta de empate recusada.",youWon:"Você venceu!",youLost:"Você perdeu.",drawGame:"A partida terminou empatada.",youWonByBearOff:"Você venceu ao retirar todas as suas peças!",youLostByBearOff:"Seu adversário retirou todas as peças. Você perdeu.",opponentResigned:"Seu adversário desistiu. Você venceu!",youResigned:"Você desistiu. Seu adversário venceu.",finished:"Partida encerrada",rollToBegin:"Lance os dados para começar.",serverError:"Erro do servidor.",walletChanged:"A carteira mudou. Conecte novamente.",copyCode:"Copiar código",onlineRoom:"SALA PRIVADA ONLINE",leavePractice:"Praticar tabuleiro"}
};

let lang=localStorage.getItem("fit_lang")||((navigator.language||"en").slice(0,2));if(!L[lang])lang="en";
const t=(k,v={})=>(L[lang][k]||L.en[k]||O[lang]?.[k]||O.en[k]||k).replace(/\{(\w+)\}/g,(_,x)=>v[x]??"");
function setLang(v){lang=L[v]?v:"en";localStorage.setItem("fit_lang",lang);document.documentElement.lang=lang;document.documentElement.dir=["fa","ar"].includes(lang)?"rtl":"ltr";document.body.classList.toggle("fi-rtl",["fa","ar"].includes(lang));$("languageSelect").value=lang;document.querySelectorAll("[data-i]").forEach(n=>n.textContent=t(n.dataset.i));document.querySelectorAll("[data-i-placeholder]").forEach(n=>n.placeholder=t(n.dataset.iPlaceholder));render();}
let position,side,dice,selected,sequenceOptions,chosenMoves,finished,passTimer=null;
let gameMode="practice",cpuBusy=false,cpuTimer=null;
// Initialize after state declarations because setLang() calls render().
setLang(lang);
$("languageSelect").addEventListener("change",e=>setLang(e.target.value));
let activeProvider=null,sessionToken=null,currentWallet=null,activeRoomCode=null,roomSocket=null,mySide=null,remoteLegalMoves=[],remoteMovesLeft=0,remotePending=false,lastStatsRoom=null;
const hasVerifiedAccess=()=>Boolean(sessionToken&&currentWallet);
function showGameChoices(){if(!hasVerifiedAccess())return false;$("mode-grid").hidden=false;return true;}
function revokeGameAccess(){closeOnlineRoom();sessionToken=null;currentWallet=null;lastStatsRoom=null;$("onlineActions").hidden=true;$("walletConnectOptions").hidden=false;$("mode-grid").hidden=true;$("game-panel").hidden=true;$("statsPanel").hidden=true;$("finalResultPanel").hidden=true;reset();onlineStatus(t("walletChanged"),true);}
const sideName=s=>t(s==="w"?"white":"black");
function setStatus(message,mode="info"){const el=$("gameStatus");el.className="game-status status-"+mode;el.innerHTML='<span class="status-icon" aria-hidden="true"></span><span class="status-copy"></span>';el.querySelector(".status-copy").textContent=message;}
function reset(){if(passTimer!==null){clearTimeout(passTimer);passTimer=null;}if(cpuTimer!==null){clearTimeout(cpuTimer);cpuTimer=null;}cpuBusy=false;remoteLegalMoves=[];remoteMovesLeft=0;remotePending=false;position=initialPosition();side="w";dice=null;selected=null;sequenceOptions=[];chosenMoves=[];finished=false;$("finalResultPanel").hidden=true;$("dieOne").textContent="–";$("dieTwo").textContent="–";$("movesLeft").textContent="—";$("whiteOff").textContent="0 / 15";$("blackOff").textContent="0 / 15";$("rollBtn").disabled=false;setStatus(t("rollPrompt"),"ready");render();}
function pointButton(i){const n=position.points[i],count=Math.abs(n),owner=n>0?"w":n<0?"b":null,legal=selected!==null&&(gameMode==="online"?remoteLegalMoves.some(m=>m.from===selected&&m.to===i):sequenceOptions.some(s=>s.moves[0]?.from===selected&&s.moves[0]?.to===i));const b=document.createElement("button");b.className="point"+(selected===i?" selected":"")+(legal?" legal":"");b.type="button";b.setAttribute("aria-label","Point "+(i+1)+", "+count+" "+(owner||"empty"));b.innerHTML='<span class="point-num">'+(i+1)+'</span><span class="stack"></span>';const stack=b.querySelector(".stack");if(owner){for(let k=0;k<Math.min(count,5);k++){const p=document.createElement("i");p.className="piece "+(owner==="w"?"white":"black");stack.append(p);}if(count>5){const p=stack.lastElementChild;p.classList.add("count");p.dataset.count=count;}}b.addEventListener("click",()=>onPoint(i));return b;}
function render(){if(!position)return;const top=[12,13,14,15,16,17,18,19,20,21,22,23],bottom=[11,10,9,8,7,6,5,4,3,2,1,0];$("boardTop").replaceChildren(...top.map(pointButton));$("boardBottom").replaceChildren(...bottom.map(pointButton));$("barWhite").replaceChildren();$("barBlack").replaceChildren();for(const [s,id] of [["w","barWhite"],["b","barBlack"]]){const area=$(id);area.replaceChildren();area.onclick=()=>{if(s===side)onPoint("bar");};area.style.cursor=s===side?"pointer":"default";for(let k=0;k<Math.min(position.bar[s],5);k++){const p=document.createElement("i");p.className="piece "+(s==="w"?"white":"black");area.append(p);}} $("whiteOff").textContent=position.off.w+" / 15";$("blackOff").textContent=position.off.b+" / 15";const whiteCanOff=side==="w"&&selected!==null&&(gameMode==="online"?remoteLegalMoves.some(m=>m.from===selected&&m.to==="off"):sequenceOptions.some(s=>s.moves[0]?.from===selected&&s.moves[0]?.to==="off"));const blackCanOff=side==="b"&&selected!==null&&(gameMode==="online"?remoteLegalMoves.some(m=>m.from===selected&&m.to==="off"):sequenceOptions.some(s=>s.moves[0]?.from===selected&&s.moves[0]?.to==="off"));$("whiteOff").disabled=!whiteCanOff;$("blackOff").disabled=!blackCanOff;$("whiteOff").onclick=()=>{if(whiteCanOff)onPoint("off");};$("blackOff").onclick=()=>{if(blackCanOff)onPoint("off");};$("whiteOff").classList.toggle("legal",whiteCanOff);$("blackOff").classList.toggle("legal",blackCanOff);$("whitePlayer").classList.toggle("active",side==="w");$("blackPlayer").classList.toggle("active",side==="b");$("whitePlayer").querySelector("small").textContent=side==="w"?t("whiteTurn"):"";$("blackPlayer").querySelector("small").textContent=side==="b"?t("blackTurn"):"";$("movesLeft").textContent=gameMode==="online"?(dice?remoteMovesLeft:"—"):(dice?(sequenceOptions[0]?.moves.length??0):"—");}
function roll(){if(!hasVerifiedAccess())return;if(finished||cpuBusy||(gameMode==="cpu"&&side==="b"))return;if(gameMode==="online"){if(!dice&&roomSocket?.readyState===WebSocket.OPEN&&!remotePending&&side===mySide){remotePending=true;roomSocket.send(JSON.stringify({type:"roll"}));}return;}if(dice){setStatus(t("selectDestination"),"move");return;}dice=rollDice();$("dieOne").textContent=dice[0];$("dieTwo").textContent=dice[1];sequenceOptions=legalTurnSequences(position,side,dice);selected=null;if(!sequenceOptions.length||!sequenceOptions[0].moves.length){setStatus(t("noMoves"),"warning");$("rollBtn").disabled=true;passTimer=setTimeout(()=>{passTimer=null;endTurn();},800);return;}setStatus(t("selectSource"),"roll");$("rollBtn").disabled=true;render();}
function onPoint(i){if(!hasVerifiedAccess())return;if(finished||cpuBusy||(gameMode==="cpu"&&side==="b"))return;if(gameMode==="online"){if(!dice||remotePending||side!==mySide||roomSocket?.readyState!==WebSocket.OPEN)return;if(selected===null){if(remoteLegalMoves.some(m=>m.from===i)){selected=i;setStatus(t("selectDestination"),"move");render();}return;}const legal=remoteLegalMoves.some(m=>m.from===selected&&m.to===i);if(legal){remotePending=true;roomSocket.send(JSON.stringify({type:"move",from:selected,to:i}));selected=null;render();return;}if(remoteLegalMoves.some(m=>m.from===i)){selected=i;render();return;}selected=null;setStatus(t("invalid"),"warning");render();return;}if(!dice){setStatus(t("rollFirst"),"warning");return;}if(selected===null){const candidates=sequenceOptions.filter(s=>s.moves[0]?.from===i);if(!candidates.length){setStatus(t("selectSource"),"roll");return;}selected=i;setStatus(t("selectDestination"),"move");render();return;}const candidates=sequenceOptions.filter(s=>s.moves[0]?.from===selected&&s.moves[0]?.to===i);if(!candidates.length){const otherSources=sequenceOptions.some(s=>s.moves[0]?.from===i);if(otherSources){selected=i;setStatus(t("selectDestination"),"move");render();return;}selected=null;setStatus(t("invalid"),"warning");render();return;}commit(candidates[0]);}
function commit(seq){const move=seq.moves[0],s=side==="w"?1:-1;if(move.from==="bar")position.bar[side]--;else position.points[move.from]-=s;if(move.to==="off")position.off[side]++;else{const enemy=side==="w"?"b":"w";if(Math.abs(position.points[move.to])===1&&position.points[move.to]*s<0){position.bar[enemy]++;position.points[move.to]=0;}position.points[move.to]+=s;}chosenMoves.push(move);sequenceOptions=sequenceOptions.filter(x=>x.moves[0]?.from===move.from&&x.moves[0]?.to===move.to&&x.moves[0]?.die===move.die).map(x=>({moves:x.moves.slice(1),position:x.position}));selected=null;const win=winner(position);if(win){finished=true;setStatus(t("won",{side:sideName(win.side)}),"win");$("rollBtn").disabled=true;dice=null;render();return;}if(!sequenceOptions.length||!sequenceOptions[0].moves.length){endTurn();return;}const remaining=[...dice],usedIndex=remaining.indexOf(move.die);if(usedIndex>=0)remaining.splice(usedIndex,1);dice=remaining;setStatus(t("selectMove"),"move");render();}
function endTurn(){if(passTimer!==null){clearTimeout(passTimer);passTimer=null;}dice=null;selected=null;sequenceOptions=[];chosenMoves=[];side=side==="w"?"b":"w";$("rollBtn").disabled=false;setStatus(t("turn",{side:sideName(side)}),"turn");render();if(gameMode==="cpu"&&side==="b")scheduleCpuTurn();}

function evaluateForBlack(p){
  let score=(pipCount(p,"w")-pipCount(p,"b"))*0.7+(p.off.b-p.off.w)*32+(p.bar.w-p.bar.b)*28;
  for(let i=0;i<24;i++){const n=p.points[i];if(n<0){const count=-n;score+=count===1?-11:count*2.2;if(i>=18)score+=count*1.2;}else if(n>0){score+=n===1?10:-n*1.1;}}
  return score;
}
function chooseCpuSequence(sequences,level){
  if(level==="easy")return sequences[Math.floor(Math.random()*sequences.length)];
  let best=null,bestScore=-Infinity;
  for(const seq of sequences){
    let score=evaluateForBlack(seq.position)+seq.moves.reduce((n,m)=>n+(m.hit?7:0),0);
    if(level==="hard"){
      let total=0,weightTotal=0;
      for(let a=1;a<=6;a++)for(let b=a;b<=6;b++){
        const weight=a===b?1:2;
        const replies=legalTurnSequences(seq.position,"w",[a,b]);
        const replyScore=replies.length?Math.min(...replies.map(r=>evaluateForBlack(r.position))):evaluateForBlack(seq.position);
        total+=replyScore*weight;weightTotal+=weight;
      }
      score=total/weightTotal;
    }
    if(score>bestScore){bestScore=score;best=seq;}
  }
  return best||sequences[0];
}
function scheduleCpuTurn(){
  if(gameMode!=="cpu"||side!=="b"||finished||cpuBusy||cpuTimer!==null)return;
  cpuTimer=setTimeout(()=>{cpuTimer=null;cpuPlayTurn();},650);
}
function cpuPlayTurn(){
  if(gameMode!=="cpu"||side!=="b"||finished)return;
  cpuBusy=true;dice=rollDice();$("dieOne").textContent=dice[0];$("dieTwo").textContent=dice[1];
  sequenceOptions=legalTurnSequences(position,side,dice);selected=null;
  if(!sequenceOptions.length||!sequenceOptions[0].moves.length){
    setStatus(t("noMoves"),"warning");$("rollBtn").disabled=true;render();
    cpuTimer=setTimeout(()=>{cpuTimer=null;cpuBusy=false;endTurn();},850);return;
  }
  $("rollBtn").disabled=true;setStatus(t("cpuThinking"),"move");render();
  const step=()=>{
    if(finished||side!=="b"){cpuBusy=false;return;}
    if(!sequenceOptions.length||!sequenceOptions[0].moves.length){cpuBusy=false;return;}
    const chosen=chooseCpuSequence(sequenceOptions,$("difficulty").value);
    const first=chosen.moves[0];
    const candidate=sequenceOptions.find(s=>s.moves[0]?.from===first.from&&s.moves[0]?.to===first.to&&s.moves[0]?.die===first.die);
    if(!candidate){cpuBusy=false;return;}
    commit(candidate);
    if(finished||side!=="b"){cpuBusy=false;return;}
    if(sequenceOptions.length&&sequenceOptions[0].moves.length)cpuTimer=setTimeout(()=>{cpuTimer=null;step();},520);
    else cpuBusy=false;
  };
  cpuTimer=setTimeout(()=>{cpuTimer=null;step();},700);
}

$("rollBtn").addEventListener("click",roll);$("resetBtn").addEventListener("click",()=>{if(hasVerifiedAccess())reset();});$("practiceBtn").addEventListener("click",()=>{if(!hasVerifiedAccess())return;closeOnlineRoom();gameMode="practice";reset();$("game-panel").hidden=false;$("practiceTitle").textContent=t("practiceTitle");$("game-panel").scrollIntoView({behavior:"smooth"});});$("cpuStartBtn").addEventListener("click",createCpuGame);
const API_BASE=(window.CHESS_ARENA_API_URL||"https://fly-chess-arena-api.flyinfinityplatform.workers.dev").replace(/\/$/,"");
const api=async(path,body)=>{const response=await fetch(API_BASE+path,{method:body?"POST":"GET",headers:{...(body?{"Content-Type":"application/json"}:{}),...(sessionToken?{Authorization:"Bearer "+sessionToken}:{})},body:body?JSON.stringify(body):undefined,cache:"no-store"});const data=await response.json().catch(()=>({}));if(!response.ok||data.ok!==true)throw new Error(data.error||"Request failed ("+response.status+")");return data;};
function shortWallet(wallet){return wallet?wallet.slice(0,6)+"…"+wallet.slice(-4):"—";}
async function loadStats(){
 if(!sessionToken)return;
 $("statsPanel").hidden=false;$("statsWallet").textContent=currentWallet||"—";
 try{
  const [profile,board]=await Promise.all([api("/api/backgammon/stats/me"),api("/api/backgammon/stats/leaderboard")]);
  const s=profile.stats||{};
  $("statsPoints").textContent=s.points||0;$("statsRank").textContent="#"+(s.rank||1);
  $("statsGames").textContent=s.games||0;$("statsWins").textContent=s.wins||0;
  $("statsLosses").textContent=s.losses||0;$("statsDraws").textContent=s.draws||0;
  const list=$("statsLeaderboard");list.replaceChildren();
  (board.leaderboard||[]).forEach((player,index)=>{
   const row=document.createElement("div");row.className="leaderboard-row";
   const rank=document.createElement("span");rank.textContent="#"+(index+1);
   const wallet=document.createElement("strong");wallet.textContent=shortWallet(player.wallet_address);
   const points=document.createElement("b");points.textContent=(player.points||0)+" FIGS";
   row.append(rank,wallet,points);list.append(row);
  });
  if(!list.children.length)list.textContent=t("noRankedGames");
 }catch(error){console.warn("[Backgammon stats]",error);$("statsLeaderboard").textContent=t("statsError");}
}
function renderOnlineFinalResult(g){
 const pointsFor=side=>g.result==="draw"?1:g.result===side?3:0;
 $("finalResultPanel").hidden=false;
 $("finalResultTitle").textContent=g.result==="draw"?t("drawGame"):g.result===mySide?t("youWon"):t("youLost");
 $("finalResultReason").textContent=g.reason==="resignation"?t(g.result===mySide?"opponentResigned":"youResigned"):g.reason==="agreement"?t("drawGame"):g.reason==="bear_off"?t(g.result===mySide?"youWonByBearOff":"youLostByBearOff"):t("finished");
 $("finalWhiteWallet").textContent=shortWallet(g.players.white);
 $("finalBlackWallet").textContent=shortWallet(g.players.black);
 $("finalWhitePoints").textContent="+"+pointsFor("w")+" FIGS";
 $("finalBlackPoints").textContent="+"+pointsFor("b")+" FIGS";
}

function onlineStatus(message,isError=false){$("onlineStatus").textContent=message;$("onlineStatus").classList.toggle("error",isError);}
async function requestWalletSignature(signer,message){
 let timeoutId;
 const signing=signer.signMessage(message);
 const timeout=new Promise((_,reject)=>{timeoutId=setTimeout(()=>reject(new Error(t("walletTimeout"))),120000);});
 try{return await Promise.race([signing,timeout]);}finally{clearTimeout(timeoutId);}
}
async function getWalletProvider(method){
 if(method==="browser"){
  if(typeof window.fiSelectWalletProvider==="function")return await window.fiSelectWalletProvider();
  if(window.ethereum&&typeof window.ethereum.request==="function"){await window.ethereum.request({method:"eth_requestAccounts"});return window.ethereum;}
  throw new Error(t("noWallet"));
 }
 if(!window.ethereum||typeof window.ethereum.request!=="function")throw new Error(t("noInjectedWallet"));
 await window.ethereum.request({method:"eth_requestAccounts"});
 window.fiWalletConnectActive=false;
 return window.ethereum;
}
async function connectOnline(method){
 const buttons=[$("connectBrowserBtn"),$("connectWalletBtn")];
 const activeButton=method==="browser"?$("connectBrowserBtn"):$("connectWalletBtn");
 const originalLabel=activeButton.textContent;
 buttons.forEach(b=>b.disabled=true);
 activeButton.textContent=t("connecting");
 $("onlineActions").hidden=true;
 $("eligiblePanel").hidden=true;
 $("deniedPanel").hidden=true;
 $("fitStatus").textContent=t("fitRequired");
 $("fitMark").textContent="—";
 $("fitMark").style.color="";
 sessionToken=null;currentWallet=null;activeProvider=null;
 try{
  activeProvider=await getWalletProvider(method);
  const web3=new ethers.providers.Web3Provider(activeProvider,"any");
  const network=await web3.getNetwork();
  if(network.chainId!==56){
   try{await activeProvider.request({method:"wallet_switchEthereumChain",params:[{chainId:"0x38"}]});}
   catch(error){if(error.code===4902)throw new Error(t("addBsc"));throw new Error(t("switchBsc"));}
  }
  const signer=web3.getSigner();
  const address=await signer.getAddress();
  onlineStatus(t("walletConnected",{address:address.slice(0,6)+"…"+address.slice(-4)}));
  activeButton.textContent=t("signing");
  const challenge=await api("/api/auth/challenge",{address});
  const signature=await requestWalletSignature(signer,challenge.message);
  onlineStatus(t("signatureReceived"));
  activeButton.textContent=t("verifying");
  const verified=await api("/api/auth/verify",{address,nonce:challenge.nonce,signature});
  sessionToken=verified.sessionToken;
  currentWallet=verified.wallet.toLowerCase();
  $("fitStatus").textContent=ethers.utils.formatUnits(verified.fitBalanceWei,18)+" FIT · "+t("serverVerified");
  $("fitMark").textContent="✓";
  $("fitMark").style.color="#00c896";
  $("eligiblePanel").hidden=false;
  $("onlineActions").hidden=false;
  $("walletConnectOptions").hidden=true;
  showGameChoices();
  loadStats();
  onlineStatus(t("accessVerified")+" · "+currentWallet.slice(0,6)+"…"+currentWallet.slice(-4));
 }catch(error){
  console.error("[Backgammon wallet]",error);
  $("deniedPanel").textContent=error&&error.message?error.message:t("noWalletVerification");
  $("deniedPanel").hidden=false;
  $("mode-grid").hidden=true;$("game-panel").hidden=true;
  onlineStatus(error&&error.message?error.message:t("noWalletVerification"),true);
 }finally{
  buttons.forEach(b=>b.disabled=false);
  activeButton.textContent=originalLabel;
 }
}
function closeOnlineRoom(){
 if(roomSocket){roomSocket.close();roomSocket=null;}
 activeRoomCode=null;mySide=null;remoteLegalMoves=[];remoteMovesLeft=0;remotePending=false;
 $("onlineControls").hidden=true;$("copyRoomBtn").hidden=true;$("resetBtn").hidden=false;
}
function onlineFinishStatus(g){
 if(g.result==="draw")return {message:t("drawGame"),mode:"turn"};
 const won=g.result===mySide;
 if(g.reason==="resignation")return {message:t(won?"opponentResigned":"youResigned"),mode:won?"win":"warning"};
 if(g.reason==="bear_off")return {message:t(won?"youWonByBearOff":"youLostByBearOff"),mode:won?"win":"warning"};
 return {message:t(won?"youWon":"youLost"),mode:won?"win":"warning"};
}
async function openOnlineRoom(code){
 closeOnlineRoom();gameMode="online";finished=false;dice=null;selected=null;
 activeRoomCode=code;$("activeRoomCode").textContent=code;$("game-panel").hidden=false;
 $("resetBtn").hidden=true;$("copyRoomBtn").hidden=false;$("onlineControls").hidden=false;
 $("practiceTitle").textContent=t("onlineRoom");onlineStatus(t("waitingOpponent"));
 const ticket=await api("/api/backgammon/rooms/"+code+"/ticket",{});
 roomSocket=new WebSocket(ticket.socketUrl);
 roomSocket.addEventListener("open",()=>onlineStatus(t("connected")));
 roomSocket.addEventListener("message",event=>{
  let payload;try{payload=JSON.parse(event.data);}catch{return;}
  if(payload.type==="error"){remotePending=false;onlineStatus(payload.error||t("serverError"),true);return;}
  const g=payload.game;if(!g)return;
  remotePending=false;position=g.position;side=g.turn;dice=g.dice;remoteLegalMoves=g.legalMoves||[];remoteMovesLeft=g.movesLeft||0;
  mySide=currentWallet===String(g.players.white||"").toLowerCase()?"w":currentWallet===String(g.players.black||"").toLowerCase()?"b":null;
  finished=g.status==="finished";selected=null;
  $("dieOne").textContent=dice?.[0]??"–";$("dieTwo").textContent=dice?.[1]??"–";
  $("rollBtn").disabled=finished||side!==mySide||Boolean(dice)||g.status!=="active";
  const cpuMatch=g.mode==="cpu";
  $("activeRoomCode").textContent=cpuMatch?t("cpuOpponent"):(g.roomCode||activeRoomCode);
  $("copyRoomBtn").hidden=cpuMatch;
  $("practiceTitle").textContent=cpuMatch?t("cpuMatch"):t("onlineRoom");
  $("whitePlayer").querySelector("b").textContent=(g.players.white||"—").slice(0,6)+"…"+(g.players.white||"").slice(-4);
  $("blackPlayer").querySelector("b").textContent=g.players.black==="cpu"?t("cpuOpponent"):g.players.black?(g.players.black.slice(0,6)+"…"+g.players.black.slice(-4)):t("waitingOpponent");
  $("whitePlayer").querySelector("small").textContent=side==="w"?(mySide==="w"?t("yourTurn"):t("opponentTurn")):"";
  $("blackPlayer").querySelector("small").textContent=side==="b"?(mySide==="b"?t("yourTurn"):t("opponentTurn")):"";
  if(g.status==="finished"){const finalStatus=onlineFinishStatus(g);setStatus(finalStatus.message,finalStatus.mode);}else if(g.status==="waiting"){setStatus(t("waitingOpponent"),"info");}else{setStatus(side===mySide?t("yourTurn"):t("opponentTurn"),"turn");}
  $("offerDrawBtn").disabled=g.status!=="active"||Boolean(g.drawOffer);
  $("acceptDrawBtn").disabled=g.status!=="active";$("declineDrawBtn").disabled=g.status!=="active";$("resignBtn").disabled=g.status!=="active";
  $("acceptDrawBtn").hidden=cpuMatch||!g.drawOffer||g.drawOffer.toLowerCase()===currentWallet;
  $("declineDrawBtn").hidden=cpuMatch||!g.drawOffer||g.drawOffer.toLowerCase()===currentWallet;
  $("offerDrawBtn").hidden=cpuMatch||g.status!=="active"||Boolean(g.drawOffer);
  $("gameMessage").textContent=payload.type==="draw_offer"?t("drawOfferReceived"):payload.type==="draw_declined"?t("drawDeclined"):"";
  if(g.status==="finished"){$("rollBtn").disabled=true;$("onlineControls").hidden=false;renderOnlineFinalResult(g);const statsKey=g.roomCode||activeRoomCode;if(statsKey&&lastStatsRoom!==statsKey){lastStatsRoom=statsKey;loadStats();}}
  render();
  if(g.status==="waiting")onlineStatus(t("waitingOpponent"));else if(g.status==="active")onlineStatus(t("connected"));else onlineStatus(t("finished"));
 });
 roomSocket.addEventListener("close",()=>onlineStatus(t("connectionClosed"),true));
 roomSocket.addEventListener("error",()=>onlineStatus(t("serverError"),true));
 $("game-panel").scrollIntoView({behavior:"smooth",block:"center"});
}
async function createCpuGame(){
 if(!hasVerifiedAccess())return;
 const button=$("cpuStartBtn");button.disabled=true;
 try{const result=await api("/api/backgammon/rooms/cpu",{difficulty:$("difficulty").value});await openOnlineRoom(result.roomCode);}
 catch(error){onlineStatus(error.message,true);}
 finally{button.disabled=false;}
}
async function createOnlineRoom(){if(!hasVerifiedAccess())return;
 $("createRoomBtn").disabled=true;try{const r=await api("/api/backgammon/rooms/create",{});await openOnlineRoom(r.roomCode);}
 catch(e){onlineStatus(e.message,true);}finally{$("createRoomBtn").disabled=false;}
}
async function joinOnlineRoom(){if(!hasVerifiedAccess())return;
 const code=$("roomCodeInput").value.trim().toUpperCase();$("joinRoomBtn").disabled=true;
 try{await api("/api/backgammon/rooms/join",{roomCode:code});await openOnlineRoom(code);}
 catch(e){onlineStatus(e.message,true);}finally{$("joinRoomBtn").disabled=false;}
}
function sendOnlineAction(type){if(roomSocket?.readyState===WebSocket.OPEN)roomSocket.send(JSON.stringify({type}));}
$("connectBrowserBtn").addEventListener("click",()=>connectOnline("browser"));
$("connectWalletBtn").addEventListener("click",()=>connectOnline("wallet"));
$("createRoomBtn").addEventListener("click",createOnlineRoom);
$("joinRoomBtn").addEventListener("click",joinOnlineRoom);
$("roomCodeInput").addEventListener("input",()=>{$("roomCodeInput").value=$("roomCodeInput").value.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g,"").slice(0,6);});
$("copyRoomBtn").addEventListener("click",async()=>{if(!activeRoomCode)return;try{await navigator.clipboard.writeText(activeRoomCode);$("gameMessage").textContent=t("roomCopied");}catch{$("gameMessage").textContent=activeRoomCode;}});
$("offerDrawBtn").addEventListener("click",()=>sendOnlineAction("offer_draw"));
$("acceptDrawBtn").addEventListener("click",()=>sendOnlineAction("accept_draw"));
$("declineDrawBtn").addEventListener("click",()=>sendOnlineAction("decline_draw"));
$("resignBtn").addEventListener("click",()=>{if(confirm(t("confirmResign")))sendOnlineAction("resign");});
if(window.ethereum?.on){const changed=()=>revokeGameAccess();window.ethereum.on("accountsChanged",changed);window.ethereum.on("chainChanged",changed);if(activeProvider&&activeProvider!==window.ethereum&&activeProvider.on){activeProvider.on("accountsChanged",changed);activeProvider.on("chainChanged",changed);}}

setLang(lang);reset();