(function(){
"use strict";
const API=(window.HOKM_API_URL||"https://fly-hokm-api.flyinfinityplatform.workers.dev").replace(/\/$/,"");
const $=id=>document.getElementById(id);
const words={
 en:{title:"ONLINE FOUR-PLAYER TABLE",create:"Create private room",code:"Room code",join:"Join room",copy:"Copy invite code",waiting:"Waiting for players",connected:"Connected",yourTurn:"Your turn",opponent:"Waiting for opponent",choose:"Choose trump",round:"Round",won:"Your team won this round",lost:"Opponents won this round",finished:"Match finished",need:"Connect and verify your wallet to use online rooms.",copyOk:"Room code copied.",copied:"Copied",seat:"Seat",start:"Waiting for all four players",error:"Online room error",creating:"Creating a private room…",joining:"Joining the room…",invalidCode:"Enter a valid 6-character room code.",room:"Room",connectionLost:"Connection lost. Rejoin with the same wallet and room code.",wsFail:"WebSocket connection failed. Please retry.",roomInactive:"Room connection is not active.",copyFallback:"Select and copy the room code.",chooseBy:"Player {seat} is choosing trump…",seconds:"s",walletVerified:"Wallet verified · online rooms unlocked."},
 fa:{title:"بازی آنلاین چهار‌نفره",create:"ساخت اتاق خصوصی",code:"کد اتاق",join:"ورود به اتاق",copy:"کپی کد دعوت",waiting:"در انتظار بازیکنان",connected:"متصل",yourTurn:"نوبت شماست",opponent:"در انتظار حرکت حریف",choose:"انتخاب خال حکم",round:"دست",won:"تیم شما این دست را برد",lost:"تیم مقابل این دست را برد",finished:"مسابقه تمام شد",need:"برای استفاده از اتاق آنلاین، کیف پول را متصل و احراز کنید.",copyOk:"کد اتاق کپی شد.",copied:"کپی شد",seat:"جایگاه",start:"در انتظار اتصال هر چهار بازیکن",error:"خطای اتاق آنلاین",creating:"در حال ساخت اتاق خصوصی…",joining:"در حال ورود به اتاق…",invalidCode:"کد معتبر ۶ کاراکتری وارد کنید.",room:"اتاق",connectionLost:"ارتباط قطع شد. با همان کیف پول و کد اتاق دوباره وارد شوید.",wsFail:"اتصال آنلاین برقرار نشد؛ دوباره تلاش کنید.",roomInactive:"اتصال اتاق فعال نیست.",copyFallback:"کد اتاق را انتخاب و کپی کنید.",chooseBy:"بازیکن {seat} در حال انتخاب حکم است…",seconds:"ثانیه",walletVerified:"کیف پول تأیید شد · اتاق آنلاین فعال است."},
 ar:{title:"طاولة لأربعة لاعبين عبر الإنترنت",create:"إنشاء غرفة خاصة",code:"رمز الغرفة",join:"انضم إلى الغرفة",copy:"نسخ رمز الدعوة",waiting:"بانتظار اللاعبين",connected:"متصل",yourTurn:"دورك",opponent:"بانتظار الخصم",choose:"اختر الحكم",round:"الجولة",won:"فاز فريقك بهذه الجولة",lost:"فاز الفريق الآخر",finished:"انتهت المباراة",need:"اربط محفظتك وتحقق منها لاستخدام الغرف عبر الإنترنت.",copyOk:"تم نسخ رمز الغرفة.",copied:"تم النسخ",seat:"المقعد",start:"بانتظار اتصال اللاعبين الأربعة",error:"خطأ في الغرفة",creating:"جارٍ إنشاء غرفة خاصة…",joining:"جارٍ دخول الغرفة…",invalidCode:"أدخل رمز غرفة صالحاً من 6 أحرف.",room:"الغرفة",connectionLost:"انقطع الاتصال. أعد الدخول بالمحفظة ورمز الغرفة نفسيهما.",wsFail:"فشل اتصال WebSocket. حاول مجدداً.",roomInactive:"اتصال الغرفة غير نشط.",copyFallback:"حدد رمز الغرفة وانسخه.",chooseBy:"اللاعب {seat} يختار الحكم…",seconds:"ث",walletVerified:"تم التحقق من المحفظة · الغرف متاحة."},
 tr:{title:"ÇEVRİMİÇİ DÖRT OYUNCULU MASA",create:"Özel oda oluştur",code:"Oda kodu",join:"Odaya katıl",copy:"Davet kodunu kopyala",waiting:"Oyuncular bekleniyor",connected:"Bağlandı",yourTurn:"Senin sıran",opponent:"Rakip bekleniyor",choose:"Kozu seç",round:"El",won:"Takımın bu eli kazandı",lost:"Rakip takım bu eli kazandı",finished:"Maç tamamlandı",need:"Çevrimiçi odalar için cüzdanını bağla ve doğrula.",copyOk:"Oda kodu kopyalandı.",copied:"Kopyalandı",seat:"Koltuk",start:"Dört oyuncunun bağlanması bekleniyor",error:"Çevrimiçi oda hatası",creating:"Özel oda oluşturuluyor…",joining:"Odaya katılınıyor…",invalidCode:"Geçerli 6 karakterli oda kodunu gir.",room:"Oda",connectionLost:"Bağlantı kesildi. Aynı cüzdan ve oda koduyla yeniden katıl.",wsFail:"WebSocket bağlantısı kurulamadı. Yeniden dene.",roomInactive:"Oda bağlantısı etkin değil.",copyFallback:"Oda kodunu seçip kopyala.",chooseBy:"{seat}. oyuncu kozu seçiyor…",seconds:"sn",walletVerified:"Cüzdan doğrulandı · çevrimiçi odalar açık."},
 ru:{title:"ОНЛАЙН-СТОЛ НА ЧЕТВЕРЫХ",create:"Создать приватную комнату",code:"Код комнаты",join:"Войти в комнату",copy:"Скопировать код приглашения",waiting:"Ожидание игроков",connected:"Подключён",yourTurn:"Ваш ход",opponent:"Ожидание соперника",choose:"Выберите козырь",round:"Раунд",won:"Ваша команда выиграла раунд",lost:"Другая команда выиграла раунд",finished:"Матч завершён",need:"Подключите и подтвердите кошелёк для онлайн-комнат.",copyOk:"Код комнаты скопирован.",copied:"Скопировано",seat:"Место",start:"Ожидание подключения всех четырёх игроков",error:"Ошибка онлайн-комнаты",creating:"Создание приватной комнаты…",joining:"Вход в комнату…",invalidCode:"Введите корректный код из 6 символов.",room:"Комната",connectionLost:"Связь потеряна. Войдите снова с тем же кошельком и кодом.",wsFail:"Не удалось подключиться по WebSocket. Повторите попытку.",roomInactive:"Соединение с комнатой неактивно.",copyFallback:"Выделите и скопируйте код комнаты.",chooseBy:"Игрок {seat} выбирает козырь…",seconds:"сек",walletVerified:"Кошелёк подтверждён · онлайн-комнаты доступны."},
 zh:{title:"四人在线牌桌",create:"创建私人房间",code:"房间代码",join:"加入房间",copy:"复制邀请代码",waiting:"等待玩家",connected:"已连接",yourTurn:"轮到你",opponent:"等待对手",choose:"选择主牌",round:"局",won:"你的队伍赢得本局",lost:"对方队伍赢得本局",finished:"比赛结束",need:"连接并验证钱包后即可使用在线房间。",copyOk:"房间代码已复制。",copied:"已复制",seat:"座位",start:"等待四位玩家全部连接",error:"在线房间错误",creating:"正在创建私人房间…",joining:"正在加入房间…",invalidCode:"请输入有效的六位房间代码。",room:"房间",connectionLost:"连接已断开。请使用相同钱包和房间代码重新加入。",wsFail:"WebSocket 连接失败，请重试。",roomInactive:"房间连接未激活。",copyFallback:"请选择并复制房间代码。",chooseBy:"玩家 {seat} 正在选择主牌…",seconds:"秒",walletVerified:"钱包已验证 · 在线房间已解锁。"},
 es:{title:"MESA EN LÍNEA PARA CUATRO",create:"Crear sala privada",code:"Código de sala",join:"Unirse a la sala",copy:"Copiar código de invitación",waiting:"Esperando jugadores",connected:"Conectado",yourTurn:"Tu turno",opponent:"Esperando al rival",choose:"Elegir triunfo",round:"Ronda",won:"Tu equipo ganó esta ronda",lost:"El otro equipo ganó esta ronda",finished:"Partida terminada",need:"Conecta y verifica tu cartera para usar salas en línea.",copyOk:"Código copiado.",copied:"Copiado",seat:"Asiento",start:"Esperando a los cuatro jugadores",error:"Error de sala en línea",creating:"Creando sala privada…",joining:"Entrando en la sala…",invalidCode:"Introduce un código válido de 6 caracteres.",room:"Sala",connectionLost:"Conexión perdida. Vuelve a entrar con la misma cartera y código.",wsFail:"Falló la conexión WebSocket. Inténtalo de nuevo.",roomInactive:"La conexión de la sala no está activa.",copyFallback:"Selecciona y copia el código de la sala.",chooseBy:"El jugador {seat} está eligiendo triunfo…",seconds:"s",walletVerified:"Cartera verificada · salas en línea desbloqueadas."},
 pt:{title:"MESA ONLINE PARA QUATRO",create:"Criar sala privada",code:"Código da sala",join:"Entrar na sala",copy:"Copiar código de convite",waiting:"Aguardando jogadores",connected:"Conectado",yourTurn:"Sua vez",opponent:"Aguardando adversário",choose:"Escolher trunfo",round:"Rodada",won:"Sua equipe venceu esta rodada",lost:"A outra equipe venceu esta rodada",finished:"Partida encerrada",need:"Conecte e verifique sua carteira para usar salas online.",copyOk:"Código da sala copiado.",copied:"Copiado",seat:"Assento",start:"Aguardando os quatro jogadores",error:"Erro na sala online"}
};
const t=k=>(words[$("languageSelect")?.value]||words.en)[k]||words.en[k]||k;
let auth=null, socket=null, roomCode="", ownSeat=-1, lastState=null, timer=null, connecting=false, intentionalClose=false;
function ensurePanel(){
 if($("hokmOnlinePanel"))return;
 const settings=document.querySelector(".match-settings");
 if(!settings)return;
 const panel=document.createElement("section");panel.id="hokmOnlinePanel";panel.className="hokm-online-panel";
 panel.innerHTML='<div class="hokm-online-heading"><div><span class="eyebrow" id="hokmOnlineEyebrow"></span><h3 id="hokmOnlineTitle"></h3></div><span class="hokm-online-mark">♠</span></div><div class="hokm-online-actions"><button type="button" class="primary-btn" id="hokmCreateRoom"></button><label class="hokm-room-entry"><span id="hokmRoomCodeLabel"></span><input id="hokmRoomCodeInput" maxlength="6" autocomplete="off" autocapitalize="characters" inputmode="text" placeholder="ABC123"></label><button type="button" class="secondary-btn" id="hokmJoinRoom"></button></div><div class="hokm-room-invite" id="hokmRoomInvite" hidden><strong id="hokmRoomCode"></strong><button type="button" class="secondary-btn" id="hokmCopyRoom"></button></div><div class="hokm-online-status" id="hokmOnlineStatus" role="status" aria-live="polite"></div><div class="hokm-online-trump" id="hokmOnlineTrump" hidden><b id="hokmOnlineTrumpTitle"></b><div><button type="button" data-online-suit="♠">♠</button><button type="button" data-online-suit="♥">♥</button><button type="button" data-online-suit="♦">♦</button><button type="button" data-online-suit="♣">♣</button></div></div>';
 settings.appendChild(panel);
 $("hokmCreateRoom").addEventListener("click",()=>createOrJoin("create"));
 $("hokmJoinRoom").addEventListener("click",()=>createOrJoin("join"));
 $("hokmCopyRoom").addEventListener("click",copyRoomCode);
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
 $("hokmOnlineTrumpTitle").textContent=t("choose");
}
function status(s,error){if($("hokmOnlineStatus")){$("hokmOnlineStatus").textContent=s||"";$("hokmOnlineStatus").classList.toggle("error",!!error)}}
async function request(path,body){
 const response=await fetch(API+path,{method:body?"POST":"GET",headers:{...(body?{"Content-Type":"application/json"}:{}),Authorization:"Bearer "+(auth?.sessionToken||"")},body:body?JSON.stringify(body):undefined,cache:"no-store"});
 const data=await response.json().catch(()=>({}));
 if(!response.ok||data.ok!==true)throw new Error(data.error||"Request failed");
 return data;
}
async function createOrJoin(action){
 if(connecting)return;
 if(!auth?.sessionToken){status(t("need"),true);return}
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
  roomCode=result.code;ownSeat=result.seat;
  $("hokmRoomInvite").hidden=false;$("hokmRoomCode").textContent=roomCode;
  $("hokmGameControls").hidden=true;
  status(t("room")+" "+roomCode+" · "+t("seat")+" "+(ownSeat+1)+" · "+t("waiting")+"…");
  const ticket=await request("/api/rooms/"+roomCode+"/ticket",{});
  openSocket(ticket.ticket);
 }catch(error){status(error.message||t("error"),true)}
 finally{connecting=false;$("hokmCreateRoom").disabled=$("hokmJoinRoom").disabled=false}
}
function openSocket(ticket){
 intentionalClose=false;
 const wsUrl=API.replace(/^https:/,"wss:").replace(/^http:/,"ws:")+"/api/rooms/"+roomCode+"/ws?ticket="+encodeURIComponent(ticket);
 socket=new WebSocket(wsUrl);
 socket.addEventListener("open",()=>status(t("room")+" "+roomCode+" · "+t("connected")));
 socket.addEventListener("message",event=>{
  let data;try{data=JSON.parse(event.data)}catch{return}
  if(data.type==="state"){lastState=data.state;ownSeat=data.state.seat;renderState(data.state)}
  else if(data.type==="error")status(data.error,true);
 });
 socket.addEventListener("close",()=>{
  if(!intentionalClose)status(t("connectionLost"),true);
 });
 socket.addEventListener("error",()=>status("WebSocket connection failed. Check the API deployment.",true));
}
function send(payload){
 if(!socket||socket.readyState!==WebSocket.OPEN){status(t("roomInactive"),true);return}
 socket.send(JSON.stringify(payload));
}
async function copyRoomCode(){
 if(!roomCode)return;
 try{await navigator.clipboard.writeText(roomCode);status(t("copyOk"))}
 catch{const input=$("hokmRoomCodeInput");input.value=roomCode;input.select();status("Select and copy the room code.")}
}
function displaySeat(seat){return (seat-ownSeat+4)%4}
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
    if(b)b.textContent=player?(player.you?"You":(actual%2===ownSeat%2?"Partner":"Opponent")):"Open seat";
    if(small)small.textContent=!player?"Waiting":(player.connected?t("connected"):"Disconnected");
    if(em)em.textContent=String((game.tricksWon||[])[actual]||0);
    chip.classList.toggle("active",game.currentPlayer===actual&&s.status==="playing");
   }
   if(hand){
    hand.replaceChildren();
    const cards=actual===ownSeat?(game.ownHand||[]):Array.from({length:hands[actual]||0},()=>null);
    cards.forEach(card=>{
     if(card)hand.appendChild(cardNode(card,s.status==="playing"&&game.phase==="playing"&&game.currentPlayer===ownSeat));
     else{const back=document.createElement("span");back.className="hokm-card-back";back.setAttribute("aria-hidden","true");hand.appendChild(back)}
    });
   }
  }
  const nodes=[...document.querySelectorAll(".trick-cards .played-card")];
  nodes.forEach(n=>{n.classList.add("empty");n.classList.remove("red");n.textContent="·"});
  const entries=(game.lastTrick&&game.lastTrick.length?game.lastTrick:game.trick)||[];
  entries.forEach(entry=>{const visual=displaySeat(entry.player),node=nodes[visual];if(node){node.classList.remove("empty");node.classList.toggle("red",["♥","♦"].includes(entry.card.suit));node.textContent=entry.card.rank+entry.card.suit}});
  const trump=document.querySelector(".trump-pill b");if(trump)trump.textContent=game.trump||"—";
  const score=document.querySelectorAll(".game-bottom .team-score b");
  if(score.length&&s.match){score[0].textContent=s.match.matchPoints[0];score[1].textContent=s.match.matchPoints[1]}
  const round=document.querySelector(".round-info b");if(round&&s.match){const completed=s.status==="round-break"||s.status==="finished";round.textContent=(s.match.roundsPlayed+(completed?0:1))+" / "+s.match.maxRounds;}
  const picker=$("hokmOnlineTrump");
  const mayChoose=s.status==="playing"&&game.phase==="choose-trump"&&game.hakem===ownSeat;
  picker.hidden=!mayChoose;
  if(game.phase==="choose-trump"&&!mayChoose&&s.status==="playing")status(t("chooseBy").replace("{seat}",String(game.hakem+1)));
  if(game.phase==="playing"&&game.currentPlayer===ownSeat&&Number.isFinite(game.turnDeadlineAt))startCountdown(game.turnDeadlineAt);
  else stopCountdown();
  if(s.status==="round-break"&&s.roundWinner!==null)status((s.roundWinner===ownSeat%2?t("won"):t("lost"))+" · "+(s.match?.matchPoints||[0,0]).join(" : "));
  if(s.status==="finished")status(t("finished")+" · "+(s.match?.matchPoints||[0,0]).join(" : "));
 }else{
  stopCountdown();
  document.querySelectorAll(".hand").forEach(hand=>{hand.replaceChildren(...Array.from({length:13},()=>{const back=document.createElement("span");back.className="hokm-card-back";return back}))});
  document.querySelectorAll(".player-chip em").forEach(el=>el.textContent="0");
  document.querySelectorAll(".trick-cards .played-card").forEach(el=>{el.classList.add("empty");el.classList.remove("red");el.textContent="·"});
  const trump=document.querySelector(".trump-pill b");if(trump)trump.textContent="—";
  document.querySelectorAll(".game-bottom .team-score b").forEach(el=>el.textContent="0");
  const round=document.querySelector(".round-info b");if(round)round.textContent="—";
 }
}
function startCountdown(deadline){
 if(timer)clearInterval(timer);
 const tick=()=>{const left=Math.max(0,Math.ceil((deadline-Date.now())/1000));const base=lastState?.status==="playing"&&lastState?.game?.currentPlayer===ownSeat?t("yourTurn"):t("opponent");status(base+" · "+left+" "+t("seconds"))};
 tick();timer=setInterval(tick,250);
}
function stopCountdown(){if(timer)clearInterval(timer);timer=null}
function reset(){
 intentionalClose=true;if(socket){socket.close();socket=null}
 stopCountdown();lastState=null;roomCode="";ownSeat=-1;auth=null;
 if($("hokmOnlinePanel")){$("hokmOnlinePanel").hidden=true;$("hokmRoomInvite").hidden=true;$("hokmOnlineTrump").hidden=true;status(t("need"))}
}
function activate(d){
 auth=d||null;
 ensurePanel();
 if($("hokmOnlinePanel")){$("hokmOnlinePanel").hidden=!auth?.sessionToken;translatePanel();if(auth?.sessionToken)status(t("walletVerified"));}
}
window.addEventListener("hokm:authenticated",e=>activate(e.detail||{}));
window.addEventListener("hokm:access-revoked",reset);
$("languageSelect")?.addEventListener("change",translatePanel);
if(window.hokmAuthState)activate(window.hokmAuthState);else{ensurePanel();if($("hokmOnlinePanel"))$("hokmOnlinePanel").hidden=true}
window.addEventListener("beforeunload",()=>{intentionalClose=true;if(socket)socket.close()});
})();