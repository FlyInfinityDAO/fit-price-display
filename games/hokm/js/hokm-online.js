(function(){
"use strict";
const API=(window.HOKM_API_URL||"https://fly-hokm-api.flyinfinityplatform.workers.dev").replace(/\/$/,"");
const $=id=>document.getElementById(id);
const words={
 en:{title:"ONLINE FOUR-PLAYER TABLE",create:"Create private room",code:"Room code",join:"Join room",copy:"Copy invite code",waiting:"Waiting for players",connected:"Connected",yourTurn:"Your turn",opponent:"Waiting for opponent",choose:"Choose Hokm suit",round:"Round",won:"Your team won this round",lost:"Opponents won this round",finished:"Match finished",need:"Connect and verify your wallet to use online rooms.",copyOk:"Room code copied.",copied:"Copied",seat:"Seat",start:"Waiting for all four players",error:"Online room error",creating:"Creating a private room…",joining:"Joining the room…",invalidCode:"Enter a valid 6-character room code.",room:"Room",connectionLost:"Connection lost. Rejoin with the same wallet and room code.",wsFail:"WebSocket connection failed. Please retry.",roomInactive:"Room connection is not active.",copyFallback:"Select and copy the room code.",chooseBy:"Player {seat} is choosing the Hokm suit…",seconds:"s",walletVerified:"Wallet verified · online rooms unlocked.",cpu:"CPU",addTwoCpu:"Add CPUs to seats 3 & 4",addLastCpu:"Add CPU to seat 4",addingCpu:"Adding CPU players…",cpuAdded:"CPU players added.",partner:"Partner",you:"You",openSeat:"Open seat",disconnected:"Disconnected",hands:"hands",whiteTeam:"WHITE TEAM · NORTH / SOUTH",blackTeam:"BLACK TEAM · EAST / WEST",handWins:"Hands won",hakemTimes:"Hakem",matchWins:"Rounds won"},
 fa:{title:"بازی آنلاین چهار‌نفره",create:"ساخت اتاق خصوصی",code:"کد اتاق",join:"ورود به اتاق",copy:"کپی کد دعوت",waiting:"در انتظار بازیکنان",connected:"متصل",yourTurn:"نوبت شماست",opponent:"در انتظار حرکت حریف",choose:"انتخاب خال حکم",round:"دست",won:"تیم شما این دست را برد",lost:"تیم مقابل این دست را برد",finished:"مسابقه تمام شد",need:"برای استفاده از اتاق آنلاین، کیف پول را متصل و احراز کنید.",copyOk:"کد اتاق کپی شد.",copied:"کپی شد",seat:"جایگاه",start:"در انتظار اتصال هر چهار بازیکن",error:"خطای اتاق آنلاین",creating:"در حال ساخت اتاق خصوصی…",joining:"در حال ورود به اتاق…",invalidCode:"کد معتبر ۶ کاراکتری وارد کنید.",room:"اتاق",connectionLost:"ارتباط قطع شد. با همان کیف پول و کد اتاق دوباره وارد شوید.",wsFail:"اتصال آنلاین برقرار نشد؛ دوباره تلاش کنید.",roomInactive:"اتصال اتاق فعال نیست.",copyFallback:"کد اتاق را انتخاب و کپی کنید.",chooseBy:"بازیکن {seat} در حال انتخاب خال حکم است…",seconds:"ثانیه",walletVerified:"کیف پول تأیید شد · اتاق آنلاین فعال است.",cpu:"هوش مصنوعی",addTwoCpu:"افزودن دو هوش مصنوعی برای جایگاه‌های سوم و چهارم",addLastCpu:"افزودن هوش مصنوعی فقط برای جایگاه چهارم",addingCpu:"در حال افزودن بازیکنان هوش مصنوعی…",cpuAdded:"بازیکنان هوش مصنوعی اضافه شدند.",partner:"هم‌تیمی",you:"شما",openSeat:"جایگاه خالی",disconnected:"قطع اتصال",hands:"دست",whiteTeam:"تیم سفید · شمال / جنوب",blackTeam:"تیم مشکی · شرق / غرب",handWins:"برد این دست",hakemTimes:"حاکم‌شدن",matchWins:"برد کلی"},
 ar:{title:"طاولة لأربعة لاعبين عبر الإنترنت",create:"إنشاء غرفة خاصة",code:"رمز الغرفة",join:"انضم إلى الغرفة",copy:"نسخ رمز الدعوة",waiting:"بانتظار اللاعبين",connected:"متصل",yourTurn:"دورك",opponent:"بانتظار الخصم",choose:"اختر الحكم",round:"الجولة",won:"فاز فريقك بهذه الجولة",lost:"فاز الفريق الآخر",finished:"انتهت المباراة",need:"اربط محفظتك وتحقق منها لاستخدام الغرف عبر الإنترنت.",copyOk:"تم نسخ رمز الغرفة.",copied:"تم النسخ",seat:"المقعد",start:"بانتظار اتصال اللاعبين الأربعة",error:"خطأ في الغرفة",creating:"جارٍ إنشاء غرفة خاصة…",joining:"جارٍ دخول الغرفة…",invalidCode:"أدخل رمز غرفة صالحاً من 6 أحرف.",room:"الغرفة",connectionLost:"انقطع الاتصال. أعد الدخول بالمحفظة ورمز الغرفة نفسيهما.",wsFail:"فشل اتصال WebSocket. حاول مجدداً.",roomInactive:"اتصال الغرفة غير نشط.",copyFallback:"حدد رمز الغرفة وانسخه.",chooseBy:"اللاعب {seat} يختار الحكم…",seconds:"ث",walletVerified:"تم التحقق من المحفظة · الغرف متاحة.",cpu:"الكمبيوتر",addTwoCpu:"إضافة الكمبيوتر للمقعدين الثالث والرابع",addLastCpu:"إضافة الكمبيوتر للمقعد الرابع فقط",addingCpu:"جارٍ إضافة لاعبي الكمبيوتر…",cpuAdded:"تمت إضافة لاعبي الكمبيوتر.",partner:"شريك",you:"أنت",openSeat:"مقعد فارغ",disconnected:"غير متصل",hands:"جولات",whiteTeam:"الفريق الأبيض · شمال / جنوب",blackTeam:"الفريق الأسود · شرق / غرب",handWins:"الجولات الحالية",hakemTimes:"مرات الحكم",matchWins:"الجولات الفائزة"},
 tr:{title:"ÇEVRİMİÇİ DÖRT OYUNCULU MASA",create:"Özel oda oluştur",code:"Oda kodu",join:"Odaya katıl",copy:"Davet kodunu kopyala",waiting:"Oyuncular bekleniyor",connected:"Bağlandı",yourTurn:"Senin sıran",opponent:"Rakip bekleniyor",choose:"Hokm rengini seç",round:"El",won:"Takımın bu eli kazandı",lost:"Rakip takım bu eli kazandı",finished:"Maç tamamlandı",need:"Çevrimiçi odalar için cüzdanını bağla ve doğrula.",copyOk:"Oda kodu kopyalandı.",copied:"Kopyalandı",seat:"Koltuk",start:"Dört oyuncunun bağlanması bekleniyor",error:"Çevrimiçi oda hatası",creating:"Özel oda oluşturuluyor…",joining:"Odaya katılınıyor…",invalidCode:"Geçerli 6 karakterli oda kodunu gir.",room:"Oda",connectionLost:"Bağlantı kesildi. Aynı cüzdan ve oda koduyla yeniden katıl.",wsFail:"WebSocket bağlantısı kurulamadı. Yeniden dene.",roomInactive:"Oda bağlantısı etkin değil.",copyFallback:"Oda kodunu seçip kopyala.",chooseBy:"{seat}. oyuncu Hokm rengini seçiyor…",seconds:"sn",walletVerified:"Cüzdan doğrulandı · çevrimiçi odalar açık.",cpu:"CPU",addTwoCpu:"CPU toevoegen aan plaatsen 3 en 4",addLastCpu:"CPU toevoegen aan plaats 4",addingCpu:"CPU-spelers toevoegen…",cpuAdded:"CPU-spelers toegevoegd.",partner:"Takım arkadaşı",you:"Sen",openSeat:"Boş koltuk",disconnected:"Bağlantı kesildi",hands:"el",whiteTeam:"BEYAZ TAKIM · KUZEY / GÜNEY",blackTeam:"SİYAH TAKIM · DOĞU / BATI",handWins:"Bu elde kazanılan",hakemTimes:"Hakem sayısı",matchWins:"Kazanılan turlar"},
 ru:{title:"ОНЛАЙН-СТОЛ НА ЧЕТВЕРЫХ",create:"Создать приватную комнату",code:"Код комнаты",join:"Войти в комнату",copy:"Скопировать код приглашения",waiting:"Ожидание игроков",connected:"Подключён",yourTurn:"Ваш ход",opponent:"Ожидание соперника",choose:"Выберите масть хокма",round:"Раунд",won:"Ваша команда выиграла раунд",lost:"Другая команда выиграла раунд",finished:"Матч завершён",need:"Подключите и подтвердите кошелёк для онлайн-комнат.",copyOk:"Код комнаты скопирован.",copied:"Скопировано",seat:"Место",start:"Ожидание подключения всех четырёх игроков",error:"Ошибка онлайн-комнаты",creating:"Создание приватной комнаты…",joining:"Вход в комнату…",invalidCode:"Введите корректный код из 6 символов.",room:"Комната",connectionLost:"Связь потеряна. Войдите снова с тем же кошельком и кодом.",wsFail:"Не удалось подключиться по WebSocket. Повторите попытку.",roomInactive:"Соединение с комнатой неактивно.",copyFallback:"Выделите и скопируйте код комнаты.",chooseBy:"Игрок {seat} выбирает масть хокма…",seconds:"сек",walletVerified:"Кошелёк подтверждён · онлайн-комнаты доступны.",cpu:"Компьютер",addTwoCpu:"Добавить компьютеры на места 3 и 4",addLastCpu:"Добавить компьютер только на место 4",addingCpu:"Добавление компьютерных игроков…",cpuAdded:"Компьютерные игроки добавлены.",partner:"Партнёр",you:"Вы",openSeat:"Свободное место",disconnected:"Не подключён",hands:"раздач",whiteTeam:"БЕЛАЯ КОМАНДА · СЕВЕР / ЮГ",blackTeam:"ЧЁРНАЯ КОМАНДА · ВОСТОК / ЗАПАД",handWins:"Взято в этой раздаче",hakemTimes:"Раз был хокм",matchWins:"Выиграно раундов"},
 zh:{title:"四人在线牌桌",create:"创建私人房间",code:"房间代码",join:"加入房间",copy:"复制邀请代码",waiting:"等待玩家",connected:"已连接",yourTurn:"轮到你",opponent:"等待对手",choose:"选择主牌",round:"局",won:"你的队伍赢得本局",lost:"对方队伍赢得本局",finished:"比赛结束",need:"连接并验证钱包后即可使用在线房间。",copyOk:"房间代码已复制。",copied:"已复制",seat:"座位",start:"等待四位玩家全部连接",error:"在线房间错误",creating:"正在创建私人房间…",joining:"正在加入房间…",invalidCode:"请输入有效的六位房间代码。",room:"房间",connectionLost:"连接已断开。请使用相同钱包和房间代码重新加入。",wsFail:"WebSocket 连接失败，请重试。",roomInactive:"房间连接未激活。",copyFallback:"请选择并复制房间代码。",chooseBy:"玩家 {seat} 正在选择主牌…",seconds:"秒",walletVerified:"钱包已验证 · 在线房间已解锁。",cpu:"电脑",addTwoCpu:"为第 3 和第 4 个座位添加电脑",addLastCpu:"仅为第 4 个座位添加电脑",addingCpu:"正在添加电脑玩家…",cpuAdded:"电脑玩家已添加。",partner:"队友",you:"你",openSeat:"空位",disconnected:"已断开",hands:"局",whiteTeam:"白队 · 北 / 南",blackTeam:"黑队 · 东 / 西",handWins:"本局获胜",hakemTimes:"担任主牌次数",matchWins:"获胜回合"},
 es:{title:"MESA EN LÍNEA PARA CUATRO",create:"Crear sala privada",code:"Código de sala",join:"Unirse a la sala",copy:"Copiar código de invitación",waiting:"Esperando jugadores",connected:"Conectado",yourTurn:"Tu turno",opponent:"Esperando al rival",choose:"Elegir palo de Hokm",round:"Ronda",won:"Tu equipo ganó esta ronda",lost:"El otro equipo ganó esta ronda",finished:"Partida terminada",need:"Conecta y verifica tu cartera para usar salas en línea.",copyOk:"Código copiado.",copied:"Copiado",seat:"Asiento",start:"Esperando a los cuatro jugadores",error:"Error de sala en línea",creating:"Creando sala privada…",joining:"Entrando en la sala…",invalidCode:"Introduce un código válido de 6 caracteres.",room:"Sala",connectionLost:"Conexión perdida. Vuelve a entrar con la misma cartera y código.",wsFail:"Falló la conexión WebSocket. Inténtalo de nuevo.",roomInactive:"La conexión de la sala no está activa.",copyFallback:"Selecciona y copia el código de la sala.",chooseBy:"El jugador {seat} está eligiendo el palo de Hokm…",seconds:"s",walletVerified:"Cartera verificada · salas en línea desbloqueadas.",cpu:"CPU",addTwoCpu:"Añadir CPU a los asientos 3 y 4",addLastCpu:"Añadir CPU solo al asiento 4",addingCpu:"Añadiendo jugadores CPU…",cpuAdded:"Jugadores CPU añadidos.",partner:"Compañero",you:"Tú",openSeat:"Asiento libre",disconnected:"Desconectado",hands:"manos",whiteTeam:"EQUIPO BLANCO · NORTE / SUR",blackTeam:"EQUIPO NEGRO · ESTE / OESTE",handWins:"Manos ganadas",hakemTimes:"Veces como Hakem",matchWins:"Rondas ganadas"},
 pt:{title:"MESA ONLINE PARA QUATRO",create:"Criar sala privada",code:"Código da sala",join:"Entrar na sala",copy:"Copiar código de convite",waiting:"Aguardando jogadores",connected:"Conectado",yourTurn:"Sua vez",opponent:"Aguardando adversário",choose:"Escolher trunfo",round:"Rodada",won:"Sua equipe venceu esta rodada",lost:"A outra equipe venceu esta rodada",finished:"Partida encerrada",need:"Conecte e verifique sua carteira para usar salas online.",copyOk:"Código da sala copiado.",copied:"Copiado",seat:"Assento",start:"Aguardando os quatro jogadores",addTwoCpu:"Adicionar CPUs aos lugares 3 e 4",addLastCpu:"Adicionar CPU apenas ao lugar 4",addingCpu:"Adicionando jogadores CPU…",cpuAdded:"Jogadores CPU adicionados.",error:"Erro na sala online",hands:"mãos",whiteTeam:"EQUIPE BRANCA · NORTE / SUL",blackTeam:"EQUIPE PRETA · LESTE / OESTE",handWins:"Mãos vencidas",hakemTimes:"Vezes como Hakem",matchWins:"Rodadas vencidas"}
};
const EXTRA_WORDS={"en":{"hakem":"Hakem","turnCountdown":"Turn countdown","reconnectCountdown":"Reconnect countdown","requestFailed":"The request could not be completed.","walletRequired":"Connect and verify a wallet holding at least 1 FIT.","roomNotFound":"The room was not found or has expired.","roomExists":"A room with this code already exists.","walletInRoom":"This wallet is already in the room.","roomFull":"The room is full or the match has already started.","creatorOnly":"Only the room creator can add CPU players.","seatsTaken":"One or more selected seats are already occupied.","reconnectExpired":"The reconnect period has expired; this seat is now controlled by CPU.","notYourTurn":"It is not your turn.","waitTrick":"Wait for the current trick to finish.","serviceUnavailable":"The game service is temporarily unavailable. Please try again."},"fa":{"hakem":"حاکم","turnCountdown":"شمارش معکوس نوبت","reconnectCountdown":"مهلت اتصال مجدد","requestFailed":"انجام درخواست ممکن نشد.","walletRequired":"کیف پولی با حداقل ۱ FIT را متصل و احراز کنید.","roomNotFound":"اتاق پیدا نشد یا مهلت آن تمام شده است.","roomExists":"اتاقی با این کد از قبل وجود دارد.","walletInRoom":"این کیف پول از قبل در اتاق حضور دارد.","roomFull":"اتاق پر شده یا مسابقه شروع شده است.","creatorOnly":"فقط سازنده اتاق می‌تواند هوش مصنوعی اضافه کند.","seatsTaken":"یک یا چند جایگاه انتخاب‌شده قبلاً اشغال شده‌اند.","reconnectExpired":"مهلت اتصال مجدد تمام شده و این جایگاه اکنون در اختیار هوش مصنوعی است.","notYourTurn":"اکنون نوبت شما نیست.","waitTrick":"تا پایان دور فعلی صبر کنید.","serviceUnavailable":"سرویس بازی موقتاً در دسترس نیست. دوباره تلاش کنید.","creating":"در حال ساخت اتاق خصوصی…","joining":"در حال ورود به اتاق…","invalidCode":"کد معتبر ۶ کاراکتری وارد کنید.","room":"اتاق","connectionLost":"ارتباط قطع شد. با همان کیف پول و کد اتاق دوباره وارد شوید.","wsFail":"اتصال آنلاین برقرار نشد؛ دوباره تلاش کنید.","roomInactive":"اتصال اتاق فعال نیست.","copyFallback":"کد اتاق را انتخاب و کپی کنید.","chooseBy":"بازیکن {seat} در حال انتخاب خال حکم است…","seconds":"ثانیه"},"ar":{"hakem":"الحاكم","turnCountdown":"العد التنازلي للدور","reconnectCountdown":"مهلة إعادة الاتصال","requestFailed":"تعذر إكمال الطلب.","walletRequired":"اربط محفظة تحتوي على 1 FIT على الأقل وتحقق منها.","roomNotFound":"الغرفة غير موجودة أو انتهت صلاحيتها.","roomExists":"توجد غرفة بهذا الرمز بالفعل.","walletInRoom":"هذه المحفظة موجودة بالفعل في الغرفة.","roomFull":"الغرفة ممتلئة أو بدأت المباراة بالفعل.","creatorOnly":"يمكن لمنشئ الغرفة فقط إضافة لاعبي الكمبيوتر.","seatsTaken":"مقعد واحد أو أكثر من المقاعد المحددة مشغول بالفعل.","reconnectExpired":"انتهت مهلة إعادة الاتصال وأصبح هذا المقعد تحت تحكم الكمبيوتر.","notYourTurn":"ليس دورك الآن.","waitTrick":"يرجى الانتظار حتى تنتهي الجولة الحالية.","serviceUnavailable":"خدمة اللعبة غير متاحة مؤقتاً. حاول مجدداً."},"tr":{"hakem":"Hakem","turnCountdown":"Tur geri sayımı","reconnectCountdown":"Yeniden bağlanma süresi","requestFailed":"İstek tamamlanamadı.","walletRequired":"En az 1 FIT içeren bir cüzdanı bağlayıp doğrulayın.","roomNotFound":"Oda bulunamadı veya süresi doldu.","roomExists":"Bu kodla bir oda zaten var.","walletInRoom":"Bu cüzdan zaten odada.","roomFull":"Oda dolu veya maç zaten başladı.","creatorOnly":"CPU oyuncularını yalnızca oda sahibi ekleyebilir.","seatsTaken":"Seçilen koltuklardan biri veya birkaçı zaten dolu.","reconnectExpired":"Yeniden bağlanma süresi doldu; bu koltuğu artık CPU yönetiyor.","notYourTurn":"Şu anda sıra sizde değil.","waitTrick":"Lütfen mevcut elin bitmesini bekleyin.","serviceUnavailable":"Oyun hizmeti geçici olarak kullanılamıyor. Lütfen tekrar deneyin.","addTwoCpu":"3. ve 4. koltuklara CPU ekle","addLastCpu":"Yalnızca 4. koltuğa CPU ekle","addingCpu":"CPU oyuncuları ekleniyor…","cpuAdded":"CPU oyuncuları eklendi."},"ru":{"hakem":"Хакем","turnCountdown":"Обратный отсчёт хода","reconnectCountdown":"Время на переподключение","requestFailed":"Не удалось выполнить запрос.","walletRequired":"Подключите и подтвердите кошелёк минимум с 1 FIT.","roomNotFound":"Комната не найдена или срок её действия истёк.","roomExists":"Комната с таким кодом уже существует.","walletInRoom":"Этот кошелёк уже находится в комнате.","roomFull":"Комната заполнена или матч уже начался.","creatorOnly":"Добавлять CPU может только создатель комнаты.","seatsTaken":"Одно или несколько выбранных мест уже заняты.","reconnectExpired":"Время на переподключение истекло; этим местом теперь управляет CPU.","notYourTurn":"Сейчас не ваш ход.","waitTrick":"Дождитесь завершения текущей взятки.","serviceUnavailable":"Игровой сервис временно недоступен. Повторите попытку."},"zh":{"hakem":"主牌庄家","turnCountdown":"回合倒计时","reconnectCountdown":"重新连接倒计时","requestFailed":"请求无法完成。","walletRequired":"请连接并验证至少持有 1 FIT 的钱包。","roomNotFound":"房间不存在或已过期。","roomExists":"此房间代码已被使用。","walletInRoom":"此钱包已经在房间中。","roomFull":"房间已满或比赛已经开始。","creatorOnly":"只有房间创建者可以添加电脑玩家。","seatsTaken":"一个或多个所选座位已被占用。","reconnectExpired":"重新连接期限已过，该座位现在由电脑控制。","notYourTurn":"现在还没轮到你。","waitTrick":"请等待当前墩结束。","serviceUnavailable":"游戏服务暂时不可用，请稍后重试。"},"es":{"hakem":"Hakem","turnCountdown":"Cuenta atrás del turno","reconnectCountdown":"Tiempo para reconectar","requestFailed":"No se pudo completar la solicitud.","walletRequired":"Conecta y verifica una cartera con al menos 1 FIT.","roomNotFound":"La sala no existe o ha caducado.","roomExists":"Ya existe una sala con este código.","walletInRoom":"Esta cartera ya está en la sala.","roomFull":"La sala está llena o la partida ya comenzó.","creatorOnly":"Solo quien creó la sala puede añadir CPU.","seatsTaken":"Uno o más asientos seleccionados ya están ocupados.","reconnectExpired":"Se agotó el plazo de reconexión; la CPU controla este asiento.","notYourTurn":"No es tu turno.","waitTrick":"Espera a que termine la baza actual.","serviceUnavailable":"El servicio del juego no está disponible temporalmente. Inténtalo de nuevo."},"pt":{"hakem":"Hakem","turnCountdown":"Contagem regressiva da vez","reconnectCountdown":"Prazo para reconectar","requestFailed":"Não foi possível concluir a solicitação.","walletRequired":"Conecte e verifique uma carteira com pelo menos 1 FIT.","roomNotFound":"A sala não foi encontrada ou expirou.","roomExists":"Já existe uma sala com este código.","walletInRoom":"Esta carteira já está na sala.","roomFull":"A sala está cheia ou a partida já começou.","creatorOnly":"Somente quem criou a sala pode adicionar CPUs.","seatsTaken":"Um ou mais lugares selecionados já estão ocupados.","reconnectExpired":"O prazo para reconectar terminou; este lugar agora é controlado pela CPU.","notYourTurn":"Não é sua vez.","waitTrick":"Aguarde o fim da vaza atual.","serviceUnavailable":"O serviço do jogo está temporariamente indisponível. Tente novamente.","creating":"Criando sala privada…","joining":"Entrando na sala…","invalidCode":"Digite um código válido de 6 caracteres.","room":"Sala","connectionLost":"Conexão perdida. Entre novamente com a mesma carteira e código.","wsFail":"Falha na conexão WebSocket. Tente novamente.","roomInactive":"A conexão da sala não está ativa.","copyFallback":"Selecione e copie o código da sala.","chooseBy":"O jogador {seat} está escolhendo o naipe de Hokm…","seconds":"s","walletVerified":"Carteira verificada","cpu":"CPU","partner":"Seu parceiro","you":"Você","openSeat":"Lugar disponível","disconnected":"Sem conexão"}};
Object.entries(EXTRA_WORDS).forEach(([locale,values])=>Object.assign(words[locale],values));
const t=k=>(words[$("languageSelect")?.value]||words.en)[k]||(words.en[k])||k;
const ROOM_SESSION_KEY="hokmFlyInfinityRoom";
let auth=null, socket=null, roomCode="", ownSeat=-1, lastState=null, timer=null, connecting=false, intentionalClose=false;
let reconnectTimer=null,reconnectAttempt=0,reconnecting=false;
function ensurePanel(){
 if($("hokmOnlinePanel"))return;
 const settings=document.querySelector(".match-settings");
 if(!settings)return;
 const panel=document.createElement("section");panel.id="hokmOnlinePanel";panel.className="hokm-online-panel";
 panel.innerHTML='<div class="hokm-online-heading"><div><span class="eyebrow" id="hokmOnlineEyebrow"></span><h3 id="hokmOnlineTitle"></h3></div><span class="hokm-online-mark">♠</span></div><div class="hokm-online-actions"><button type="button" class="primary-btn" id="hokmCreateRoom"></button><label class="hokm-room-entry"><span id="hokmRoomCodeLabel"></span><input id="hokmRoomCodeInput" maxlength="6" autocomplete="off" autocapitalize="characters" inputmode="text" placeholder="ABC123"></label><button type="button" class="secondary-btn" id="hokmJoinRoom"></button></div><div class="hokm-room-invite" id="hokmRoomInvite" hidden><strong id="hokmRoomCode"></strong><button type="button" class="secondary-btn" id="hokmCopyRoom"></button></div><div id="hokmCpuControls" class="hokm-cpu-controls" hidden><button type="button" class="secondary-btn" id="hokmAddTwoCpu"></button><button type="button" class="secondary-btn" id="hokmAddLastCpu"></button></div><div class="hokm-online-status" id="hokmOnlineStatus" role="status" aria-live="polite"></div><div class="hokm-online-trump" id="hokmOnlineTrump" hidden><b id="hokmOnlineTrumpTitle"></b><div><button type="button" data-online-suit="♠">♠</button><button type="button" data-online-suit="♥">♥</button><button type="button" data-online-suit="♦">♦</button><button type="button" data-online-suit="♣">♣</button></div></div>';
 settings.appendChild(panel);
 $("hokmCreateRoom").addEventListener("click",()=>createOrJoin("create"));
 $("hokmJoinRoom").addEventListener("click",()=>createOrJoin("join"));
 $("hokmCopyRoom").addEventListener("click",copyRoomCode);
 $("hokmAddTwoCpu").addEventListener("click",()=>addCpuSeats([2,3]));
 $("hokmAddLastCpu").addEventListener("click",()=>addCpuSeats([3]));
 panel.querySelectorAll("[data-online-suit]").forEach(b=>b.addEventListener("click",()=>send({type:"choose_trump",suit:b.dataset.onlineSuit})));
 translatePanel();
}
function translatePanel(){
 if(!$("hokmOnlinePanel"))return;
 $("hokmOnlineEyebrow").textContent=t("title");
 $("hokmOnlineTitle").textContent=t("title");
 $("hokmCreateRoom").textContent=t("create");
 $("hokmRoomCodeLabel").textContent=t("code");
 $("hokmJoinRoom").textContent=t("join");
 $("hokmCopyRoom").textContent=t("copy");
 $("hokmAddTwoCpu").textContent=t("addTwoCpu");
 $("hokmAddLastCpu").textContent=t("addLastCpu");
 $("hokmOnlineTrumpTitle").textContent=t("choose");
}
function friendlyError(error){const raw=String(error&&error.message||error||"");if(/at least 1 FIT|FIT is required|verified wallet required|wallet required/i.test(raw))return t("walletRequired");if(/room.*not found|not found|expired|seat is no longer available|connection ticket/i.test(raw))return t("roomNotFound");if(/already exists/i.test(raw))return t("roomExists");if(/already in the room/i.test(raw))return t("walletInRoom");if(/full|already started/i.test(raw))return t("roomFull");if(/creator/i.test(raw))return t("creatorOnly");if(/occupied/i.test(raw))return t("seatsTaken");if(/reconnect window/i.test(raw))return t("reconnectExpired");if(/not your turn|not your turn to choose/i.test(raw))return t("notYourTurn");if(/wait for the current trick/i.test(raw))return t("waitTrick");if(/BSC RPC|temporarily unavailable|failed to fetch|networkerror/i.test(raw))return t("serviceUnavailable");return t("error")}
let lastStatusKey=null,lastStatusSuffix="",lastStatusError=false;
function status(s,error){if(!$("hokmOnlineStatus"))return;const dict=words[$("languageSelect")?.value]||words.en;let found=null;if(typeof s==="string"){for(const[key,label]of Object.entries(dict)){if(label&&(s===label||s.startsWith(label+" · "))&&(!found||label.length>found.label.length))found={key,label,suffix:s.slice(label.length)}}}lastStatusKey=found?.key||null;lastStatusSuffix=found?.suffix||"";lastStatusError=!!error;$("hokmOnlineStatus").textContent=s||"";$("hokmOnlineStatus").classList.toggle("error",!!error)}
async function request(path,body){
 const response=await fetch(API+path,{method:body?"POST":"GET",headers:{...(body?{"Content-Type":"application/json"}:{}),Authorization:"Bearer "+(auth?.sessionToken||"")},body:body?JSON.stringify(body):undefined,cache:"no-store"});
 const data=await response.json().catch(()=>({}));
 if(!response.ok||data.ok!==true)throw new Error(data.error||t("requestFailed"));
 return data;
}
async function createOrJoin(action){
 if(connecting)return;
 if(!auth?.sessionToken){status(t("need"),true);return}
 if(reconnectTimer){clearTimeout(reconnectTimer);reconnectTimer=null}
 if(socket){intentionalClose=true;socket.close();socket=null}
 stopCountdown();lastState=null;
 if(action==="join"){
  roomCode=$("hokmRoomCodeInput").value.trim().toUpperCase();
  if(!/^[A-HJ-NP-Z2-9]{6}$/.test(roomCode)){status(t("invalidCode"),true);return}
 }
 connecting=true;
 $("hokmCreateRoom").disabled=$("hokmJoinRoom").disabled=true;
 try{
  status(t(action==="create"?"creating":"joining"));
  const result=await request("/api/rooms",{action,code:roomCode||undefined});
  roomCode=result.code;ownSeat=result.seat;sessionStorage.setItem(ROOM_SESSION_KEY,roomCode);reconnectAttempt=0;
  $("hokmRoomInvite").hidden=false;$("hokmRoomCode").textContent=roomCode;
  $("hokmGameControls").hidden=true;
  status(t("room")+" "+roomCode+" · "+t("seat")+" "+(ownSeat+1)+" · "+t("waiting")+"…");
  const ticket=await request("/api/rooms/"+roomCode+"/ticket",{});
  openSocket(ticket.ticket);
 }catch(error){status(friendlyError(error),true)}
 finally{connecting=false;$("hokmCreateRoom").disabled=$("hokmJoinRoom").disabled=false}
}
function openSocket(ticket){
 intentionalClose=false;
 if(reconnectTimer){clearTimeout(reconnectTimer);reconnectTimer=null}
 const wsUrl=API.replace(/^https:/,"wss:").replace(/^http:/,"ws:")+"/api/rooms/"+roomCode+"/ws?ticket="+encodeURIComponent(ticket);
 const ws=new WebSocket(wsUrl);socket=ws;
 ws.addEventListener("open",()=>{if(socket!==ws)return;reconnectAttempt=0;status(t("room")+" "+roomCode+" · "+t("connected"))});
 ws.addEventListener("message",event=>{
  let data;try{data=JSON.parse(event.data)}catch{return}
  if(data.type==="state"){
   const previous=lastState,next=data.state;
   if(previous&&next.game&&previous.game){
    const before=previous.game.handCounts||[],after=next.game.handCounts||[];
    if(after.some((n,i)=>Number(n)>Number(before[i]||0)))window.HokmAudio?.card("deal-more");
    const beforeTrick=(previous.game.trick||[]).length,afterTrick=(next.game.trick||[]).length;
    const beforeLast=(previous.game.lastTrick||[]).map(x=>x.card?.id).join(",");
    const afterLast=(next.game.lastTrick||[]).map(x=>x.card?.id).join(",");
    if(afterLast&&afterLast!==beforeLast&&(next.game.lastTrick||[]).length===4)window.HokmAudio?.card("collect");
    else if(afterTrick>beforeTrick)window.HokmAudio?.card("play");
   }else if(next.status==="playing"&&next.game)window.HokmAudio?.card("deal");
   lastState=next;ownSeat=next.seat;renderState(next);
  }
  else if(data.type==="error")status(friendlyError(data.error),true);
 });
 ws.addEventListener("close",()=>{
  if(socket===ws)socket=null;
  if(!intentionalClose&&socket===null){status(t("connectionLost"));scheduleReconnect()}
 });
 ws.addEventListener("error",()=>{if(socket===ws)status(t("wsFail"),true)});
}
function scheduleReconnect(){
 if(intentionalClose||!auth?.sessionToken||!roomCode||reconnectTimer||reconnecting)return;
 const delay=Math.min(1000*Math.pow(2,reconnectAttempt++),10000);
 reconnectTimer=setTimeout(async()=>{
  reconnectTimer=null;reconnecting=true;
  try{
   const ticket=await request("/api/rooms/"+roomCode+"/ticket",{});
   openSocket(ticket.ticket);
  }catch(error){
   status(friendlyError(error)+" · "+t("connectionLost"),true);
   reconnecting=false;
   if(!/not found|expired|replaced|seat is no longer/i.test(error.message||""))scheduleReconnect();
  }finally{reconnecting=false}
 },delay);
}
async function resumeSavedRoom(){
 if(connecting||socket||!auth?.sessionToken)return;
 const saved=sessionStorage.getItem(ROOM_SESSION_KEY)||"";
 if(!/^[A-HJ-NP-Z2-9]{6}$/.test(saved))return;
 roomCode=saved;connecting=true;
 try{
  $("hokmRoomInvite").hidden=false;$("hokmRoomCode").textContent=roomCode;$("hokmGameControls").hidden=true;
  status(t("joining")+" · "+roomCode);
  const ticket=await request("/api/rooms/"+roomCode+"/ticket",{});
  openSocket(ticket.ticket);
 }catch(error){
  status(friendlyError(error),true);
  if(/not found|expired|replaced|seat is no longer/i.test(error.message||""))sessionStorage.removeItem(ROOM_SESSION_KEY);
 }finally{connecting=false}
}
function send(payload){
 if(!socket||socket.readyState!==WebSocket.OPEN){status(t("roomInactive"),true);return}
 socket.send(JSON.stringify(payload));
}
async function addCpuSeats(seats){
 if(connecting||ownSeat!==0||lastState?.status!=="waiting")return;
 connecting=true;
 $("hokmAddTwoCpu").disabled=$("hokmAddLastCpu").disabled=true;
 status(t("addingCpu"));
 try{await request("/api/rooms/"+roomCode+"/cpu",{seats});status(t("cpuAdded"));}
 catch(error){status(friendlyError(error),true)}
 finally{connecting=false;$("hokmAddTwoCpu").disabled=$("hokmAddLastCpu").disabled=false}
}
async function copyRoomCode(){
 if(!roomCode)return;
 try{await navigator.clipboard.writeText(roomCode);status(t("copyOk"))}
 catch{const input=$("hokmRoomCodeInput");input.value=roomCode;input.select();status(t("copyFallback"))}
}
function displaySeat(seat){return (seat-ownSeat+4)%4}
function makeSeatRing(kind){const ring=document.createElement("span");ring.className="hokm-seat-ring "+kind;ring.setAttribute("aria-hidden","true");return ring}
function renderSeatRing(chip,kind,deadline,now){let ring=chip.querySelector(".hokm-seat-ring."+kind);if(!deadline){ring?.remove();return}if(!ring){ring=makeSeatRing(kind);chip.appendChild(ring)}const total=kind==="turn"?30000:(lastState?.game?.reconnectGraceMs||60000);const left=Math.max(0,deadline-now);ring.style.setProperty("--ring-progress",String(Math.max(0,Math.min(1,left/total))));ring.textContent=String(Math.ceil(left/1000));ring.title=kind==="turn"?t("turnCountdown"):t("reconnectCountdown");}
function seatEls(seat){
 return ({0:{hand:".hand-south",chip:".seat-south .player-chip"},1:{hand:".seat-west .hand",chip:".seat-west .player-chip"},2:{hand:".hand-north",chip:".seat-north .player-chip"},3:{hand:".seat-east .hand",chip:".seat-east .player-chip"}})[seat];
}
function cardNode(card,playable){
 const el=document.createElement(playable?"button":"span");
 el.className="hokm-card"+(["♥","♦"].includes(card.suit)?" red":"")+(playable?" playable":"");
 if(playable){el.type="button";el.addEventListener("click",()=>send({type:"play_card",cardId:card.id}))}
 const corner=document.createElement("span");corner.className="card-corner";corner.textContent=card.rank+card.suit;
 const center=document.createElement("span");center.className="card-center";center.textContent=card.suit;
 el.append(corner,center);return el;
}
function renderState(s){
 if(!$("hokmOnlinePanel"))return;
 const players=s.players||[],me=players.find(p=>p.you),game=s.game;
 const waitingCount=players.filter(p=>p.connected).length;
 $("hokmRoomInvite").hidden=false;$("hokmRoomCode").textContent=s.code;
 const occupied=new Set(players.map(p=>p.seat));
 const cpuControls=$("hokmCpuControls");
 const canAddCpu=ownSeat===0&&s.status==="waiting";
 $("hokmAddTwoCpu").hidden=!(canAddCpu&&!occupied.has(2)&&!occupied.has(3));
 $("hokmAddLastCpu").hidden=!(canAddCpu&&occupied.has(2)&&!occupied.has(3));
 cpuControls.hidden=$("hokmAddTwoCpu").hidden&&$("hokmAddLastCpu").hidden;
 if(s.status==="waiting")status(t("waiting")+" · "+waitingCount+"/4 · "+t("start"));
 else if(s.status==="round-break")status((s.roundWinner===ownSeat%2?t("won"):t("lost"))+" · "+(s.match?.matchPoints||[0,0]).join(" : "));
 else if(s.status==="finished")status(t("finished")+" · "+(s.match?.matchPoints||[0,0]).join(" : "));
 else status(game&&game.currentPlayer===ownSeat?t("yourTurn"):t("opponent"));
 if(game){
  const hands=game.handCounts||[0,0,0,0];
  for(let actual=0;actual<4;actual++){
   const visual=displaySeat(actual),els=seatEls(visual),player=players.find(p=>p.seat===actual),chip=document.querySelector(els.chip),hand=document.querySelector(els.hand);
   if(chip){
    const b=chip.querySelector("b"),small=chip.querySelector("small"),em=chip.querySelector("em");
    if(b)b.textContent=player?(player.cpu?t("cpu"):(player.wallet||"—").replace(/\.\.\.(.{3})$/,(_,tail)=>"..."+tail.toUpperCase())):t("openSeat");
    if(small)small.textContent=!player?t("waiting"):(player.cpu?t("cpu"):(player.connected?t("connected"):t("disconnected")));
    if(em)em.textContent=String((game.tricksWon||[])[actual]||0);
    chip.classList.toggle("active",game.currentPlayer===actual&&s.status==="playing");
    chip.classList.toggle("hakem-seat",game.hakem===actual);
    let crown=chip.querySelector(".hokm-hakem-crown");if(game.hakem===actual){if(!crown){crown=document.createElement("span");crown.className="hokm-hakem-crown";crown.textContent="♛";crown.title=t("hakem");chip.appendChild(crown)}}else crown?.remove();
   }
   if(hand){
    const cards=actual===ownSeat?(game.ownHand||[]):Array.from({length:hands[actual]||0},()=>null);
    const canPlay=s.status==="playing"&&game.phase==="playing"&&game.currentPlayer===ownSeat;
    const signature=(actual===ownSeat?cards.map(card=>card.id).join("|"):String(cards.length))+"|"+(canPlay?"play":"wait");
    if(hand.dataset.handSignature!==signature){
     const previous=Number(hand.dataset.cardCount||0),dealing=cards.length>previous;
     hand.classList.remove("dealing");hand.replaceChildren();
     if(dealing){hand.classList.add("dealing");hand.style.setProperty("--deal-x",visual===0?"0px":visual===2?"0px":visual===1?"clamp(70px,14vw,170px)":"clamp(-170px,-14vw,-70px)");hand.style.setProperty("--deal-y",visual===0?"clamp(55px,13vw,145px)":visual===2?"clamp(-145px,-13vw,-55px)":"0px")}
     cards.forEach((card,index)=>{
      const node=card?cardNode(card,canPlay):document.createElement("span");
      if(!card){node.className="hokm-card-back";node.setAttribute("aria-hidden","true")}
      node.style.setProperty("--deal-index",index);hand.appendChild(node);
     });
     hand.dataset.cardCount=String(cards.length);hand.dataset.handSignature=signature;
    }
   }
  }
  const nodes=[...document.querySelectorAll(".trick-cards .played-card")];
  nodes.forEach(n=>{n.classList.add("empty");n.classList.remove("red","black");n.textContent="·"});
  const entries=(game.lastTrick&&game.lastTrick.length?game.lastTrick:game.trick)||[];
  entries.forEach(entry=>{const visual=displaySeat(entry.player),node=nodes[visual];if(node){node.classList.remove("empty");node.classList.toggle("red",["♥","♦"].includes(entry.card.suit));node.classList.toggle("black",!["♥","♦"].includes(entry.card.suit));node.textContent=entry.card.rank+entry.card.suit}});
  const trump=document.getElementById("tableTrumpSuit");if(trump)trump.textContent=game.trump||"—";
  const hakem=document.getElementById("tableHakem"),hakemActual=game.hakem, hakemVisual=displaySeat(hakemActual),hakemChip=document.querySelector(seatEls(hakemVisual).chip+" b");if(hakem)hakem.textContent=hakemChip?hakemChip.textContent:(players.find(p=>p.seat===hakemActual)?.cpu?t("cpu"):t("seat")+" "+(hakemActual+1));
  const currentScores=document.querySelectorAll(".hokm-round-score b");
  if(currentScores.length){currentScores[0].textContent=String((game.teamTricks||[0,0])[0]||0);currentScores[1].textContent=String((game.teamTricks||[0,0])[1]||0)}
  const score=document.querySelectorAll(".game-bottom .team-score b");
  if(score.length&&s.match){score[0].textContent=s.match.matchPoints[0];score[1].textContent=s.match.matchPoints[1]}
  const hakemStats=document.querySelectorAll(".team-hakem-count");
  if(hakemStats.length&&s.match){hakemStats[0].textContent=String((s.match.hakemCounts||[0,0])[0]||0);hakemStats[1].textContent=String((s.match.hakemCounts||[0,0])[1]||0)}
  const tierLabel=$("hokmMatchTier");if(tierLabel&&s.match){const tierFit=s.match.accessTier>=2?10:1;tierLabel.textContent=(tierFit===10?"10 FIT":"1 FIT")+" · "+s.match.maxRounds+" "+t("hands")}
  const round=document.querySelector(".round-info b");if(round&&s.match){const completed=s.status==="round-break"||s.status==="finished";round.textContent=(s.match.roundsPlayed+(completed?0:1))+" / "+s.match.maxRounds;}
  const picker=$("hokmOnlineTrump");
  const mayChoose=s.status==="playing"&&game.phase==="choose-trump"&&game.hakem===ownSeat;
  picker.hidden=!mayChoose;
  if(game.phase==="choose-trump"&&!mayChoose&&s.status==="playing")status(t("chooseBy").replace("{seat}",String(game.hakem+1)));
  if(game.phase==="playing"&&Number.isFinite(game.turnDeadlineAt))startCountdown(game.turnDeadlineAt);
  else stopCountdown();
  const now=Date.now(),activeSeat=game.phase==="choose-trump"?game.hakem:game.currentPlayer;
  for(let actual=0;actual<4;actual++){const visual=displaySeat(actual),chip=document.querySelector(seatEls(visual).chip),player=players.find(p=>p.seat===actual);if(!chip)continue;renderSeatRing(chip,"turn",s.status==="playing"&&activeSeat===actual?game.turnDeadlineAt:null,now);renderSeatRing(chip,"disconnect",player&&!player.connected&&!player.cpu?player.reconnectDeadlineAt:null,now);}
  if(s.status==="round-break"&&s.roundWinner!==null)status((s.roundWinner===ownSeat%2?t("won"):t("lost"))+" · "+(s.match?.matchPoints||[0,0]).join(" : "));
  if(s.status==="finished")status(t("finished")+" · "+(s.match?.matchPoints||[0,0]).join(" : "));
 }else{
  stopCountdown();
  document.querySelectorAll(".hand").forEach(hand=>{hand.replaceChildren(...Array.from({length:13},()=>{const back=document.createElement("span");back.className="hokm-card-back";return back}))});
  document.querySelectorAll(".player-chip em").forEach(el=>el.textContent="0");document.querySelectorAll(".hokm-seat-ring,.hokm-won-pile,.hokm-hakem-crown").forEach(el=>el.remove());document.querySelectorAll(".hokm-round-score b,.team-hakem-count").forEach(el=>el.textContent="0");const tierLabel=$("hokmMatchTier");if(tierLabel)tierLabel.textContent="—";
  document.querySelectorAll(".trick-cards .played-card").forEach(el=>{el.classList.add("empty");el.classList.remove("red","black");el.textContent="·"});
  const trump=document.getElementById("tableTrumpSuit");if(trump)trump.textContent="—";const hakem=document.getElementById("tableHakem");if(hakem)hakem.textContent="—";
  document.querySelectorAll(".game-bottom .team-score b").forEach(el=>el.textContent="0");
  const round=document.querySelector(".round-info b");if(round)round.textContent="—";
 }
}
function startCountdown(deadline){
 if(timer)clearInterval(timer);
 const tick=()=>{const now=Date.now(),left=Math.max(0,Math.ceil((deadline-now)/1000));const base=lastState?.status==="playing"&&lastState?.game?.currentPlayer===ownSeat?t("yourTurn"):t("opponent");status(base+" · "+left+" "+t("seconds"));const players=lastState?.players||[],game=lastState?.game;for(let actual=0;actual<4;actual++){const chip=document.querySelector(seatEls(displaySeat(actual)).chip),player=players.find(p=>p.seat===actual);if(!chip)continue;renderSeatRing(chip,"turn",lastState?.status==="playing"&&(game?.phase==="choose-trump"?game.hakem:game?.currentPlayer)===actual?game.turnDeadlineAt:null,now);renderSeatRing(chip,"disconnect",player&&!player.connected&&!player.cpu?player.reconnectDeadlineAt:null,now)}};
 tick();timer=setInterval(tick,200);
}
function stopCountdown(){if(timer)clearInterval(timer);timer=null}
function reset(){
 intentionalClose=true;if(reconnectTimer){clearTimeout(reconnectTimer);reconnectTimer=null}if(socket){socket.close();socket=null}
 sessionStorage.removeItem(ROOM_SESSION_KEY);stopCountdown();lastState=null;roomCode="";ownSeat=-1;auth=null;
 if($("hokmOnlinePanel")){$("hokmOnlinePanel").hidden=true;$("hokmRoomInvite").hidden=true;$("hokmCpuControls").hidden=true;$("hokmOnlineTrump").hidden=true;status(t("need"))}
}
function activate(d){
 auth=d||null;
 ensurePanel();
 if($("hokmOnlinePanel")){$("hokmOnlinePanel").hidden=!auth?.sessionToken;translatePanel();if(auth?.sessionToken){status(t("walletVerified"));resumeSavedRoom();}}
}
window.addEventListener("hokm:authenticated",e=>activate(e.detail||{}));
window.addEventListener("hokm:access-revoked",reset);
window.addEventListener("hokm:language-changed",()=>{translatePanel();if(lastState)renderState(lastState);else if(lastStatusKey)status(t(lastStatusKey)+lastStatusSuffix,lastStatusError)});
if(window.hokmAuthState)activate(window.hokmAuthState);else{ensurePanel();if($("hokmOnlinePanel"))$("hokmOnlinePanel").hidden=true}
window.addEventListener("beforeunload",()=>{intentionalClose=true;if(socket)socket.close()});
})();