(function(){
"use strict";
const H=window.HokmEngine;
if(!H)return;
const $=id=>document.getElementById(id);
const I={
en:{start:"Start solo match",next:"Start next round",restart:"New match",choose:"Choose Hokm suit",yourHand:"Your cards",thinking:"CPU is thinking…",yourTurn:"Your turn · play a legal card",turn:"Turn",seconds:"sec",round:"Round",tricks:"Tricks",team0:"SOUTH · NORTH",team1:"WEST · EAST",won:"Team won the round",matchWon:"Match complete",lost:"The other team won the round",finished:"You won the match!",matchLost:"Match finished · CPU team wins",tie:"Match drawn",needAuth:"Connect your wallet and verify at least 1 FIT to start.",selectTrump:"You are the Hakem. Choose the Hokm suit from your first five cards.",playing:"Follow suit when possible. Your turn is highlighted.",cpuTrump:"CPU Hakem is choosing the Hokm suit…",nextRound:"Round complete. Start the next round when ready.",access:"Access verified. You can now start a solo match.",easy:"Easy",normal:"Normal",hard:"Hard",noCards:"No legal cards available.",auto:"Time expired — a legal card was played automatically.",roundCount:"of",limit:"rounds",trump:"Hokm suit"},
fa:{start:"شروع بازی تک‌نفره",next:"شروع دست بعدی",restart:"مسابقه جدید",choose:"انتخاب خال حکم",yourHand:"کارت‌های شما",thinking:"هوش مصنوعی در حال بازی است…",yourTurn:"نوبت شماست · یک کارت مجاز انتخاب کنید",turn:"نوبت",seconds:"ثانیه",round:"دست",tricks:"دست‌های برده",team0:"تیم جنوب · شمال",team1:"تیم غرب · شرق",won:"این دست را تیم شما برد",matchWon:"مسابقه تمام شد",lost:"تیم مقابل این دست را برد",finished:"شما برنده مسابقه شدید!",matchLost:"مسابقه تمام شد · تیم هوش مصنوعی برنده شد",tie:"مسابقه مساوی شد",needAuth:"برای شروع، کیف پول را متصل و حداقل ۱ FIT را تأیید کنید.",selectTrump:"شما حاکم هستید. از پنج کارت اول خود خال حکم را انتخاب کنید.",playing:"در صورت امکان باید از خال شروع‌شده پیروی کنید. نوبت شما مشخص شده است.",cpuTrump:"حاکمِ هوش مصنوعی در حال انتخاب خال حکم است…",nextRound:"این دست تمام شد. هر زمان آماده بودید دست بعدی را شروع کنید.",access:"دسترسی تأیید شد. اکنون می‌توانید بازی تک‌نفره را شروع کنید.",easy:"آسان",normal:"متوسط",hard:"سخت",noCards:"کارت مجازی برای بازی وجود ندارد.",auto:"زمان تمام شد؛ یک کارت مجاز به‌صورت خودکار بازی شد.",roundCount:"از",limit:"دست",trump:"حکم"},
ar:{start:"ابدأ مباراة فردية",next:"ابدأ الجولة التالية",restart:"مباراة جديدة",choose:"اختر نوع الحكم",yourHand:"أوراقك",thinking:"الذكاء الاصطناعي يفكر…",yourTurn:"دورك · اختر ورقة قانونية",turn:"الدور",seconds:"ث",round:"الجولة",tricks:"الأكلات",team0:"فريق الجنوب · الشمال",team1:"فريق الغرب · الشرق",won:"فاز فريقك بالجولة",matchWon:"اكتملت المباراة",lost:"فاز الفريق الآخر بالجولة",finished:"لقد فزت بالمباراة!",matchLost:"انتهت المباراة · فاز فريق الكمبيوتر",tie:"تعادل",needAuth:"اربط محفظتك وتحقق من امتلاك 1 FIT على الأقل للبدء.",selectTrump:"أنت الحاكم. اختر الحكم من أوراقك الخمس الأولى.",playing:"اتبع النوع إذا أمكن. دورك مميز.",cpuTrump:"الحاكم الآلي يختار الحكم…",nextRound:"انتهت الجولة. ابدأ التالية عندما تكون جاهزاً.",access:"تم التحقق من الوصول. يمكنك بدء مباراة فردية.",easy:"سهل",normal:"متوسط",hard:"صعب",noCards:"لا توجد أوراق قانونية.",auto:"انتهى الوقت — تم لعب ورقة قانونية تلقائياً.",roundCount:"من",limit:"جولات",trump:"الحكم"},
tr:{start:"Tek kişilik oyunu başlat",next:"Sonraki eli başlat",restart:"Yeni maç",choose:"Koz rengini seç",yourHand:"Kartların",thinking:"Yapay zekâ düşünüyor…",yourTurn:"Senin sıran · yasal bir kart seç",turn:"Sıra",seconds:"sn",round:"El",tricks:"Alınan eller",team0:"GÜNEY · KUZEY",team1:"BATI · DOĞU",won:"Bu eli takımın kazandı",matchWon:"Maç tamamlandı",lost:"Bu eli diğer takım kazandı",finished:"Maçı kazandın!",matchLost:"Maç bitti · bilgisayar kazandı",tie:"Maç berabere",needAuth:"Başlamak için cüzdanını bağla ve en az 1 FIT doğrula.",selectTrump:"Hakem sensin. İlk beş kartından kozu seç.",playing:"Mümkünse renge uy. Sıran vurgulanır.",cpuTrump:"Bilgisayar hakemi koz seçiyor…",nextRound:"El bitti. Hazır olduğunda sonraki eli başlat.",access:"Erişim doğrulandı. Tek kişilik maçı başlatabilirsin.",easy:"Kolay",normal:"Normal",hard:"Zor",noCards:"Yasal kart yok.",auto:"Süre doldu — yasal bir kart otomatik oynandı.",roundCount:" / ",limit:"el",trump:"KOZ"},
ru:{start:"Начать одиночную игру",next:"Следующий раунд",restart:"Новый матч",choose:"Выберите козырь",yourHand:"Ваши карты",thinking:"Компьютер думает…",yourTurn:"Ваш ход · выберите допустимую карту",turn:"Ход",seconds:"сек",round:"Раунд",tricks:"Взятки",team0:"ЮГ · СЕВЕР",team1:"ЗАПАД · ВОСТОК",won:"Команда выиграла раунд",matchWon:"Матч завершён",lost:"Другая команда выиграла раунд",finished:"Вы выиграли матч!",matchLost:"Матч завершён · победил компьютер",tie:"Ничья",needAuth:"Подключите кошелёк и подтвердите минимум 1 FIT.",selectTrump:"Вы раздающий. Выберите козырь из первых пяти карт.",playing:"Следуйте масти, если можете. Ваш ход выделен.",cpuTrump:"Компьютер выбирает козырь…",nextRound:"Раунд завершён. Начните следующий, когда будете готовы.",access:"Доступ подтверждён. Можно начать одиночную игру.",easy:"Легко",normal:"Средне",hard:"Сложно",noCards:"Нет допустимых карт.",auto:"Время вышло — карта сыграна автоматически.",roundCount:"из",limit:"раундов",trump:"КОЗЫРЬ"},
zh:{start:"开始单人游戏",next:"开始下一局",restart:"新比赛",choose:"选择主牌花色",yourHand:"你的手牌",thinking:"电脑正在思考…",yourTurn:"轮到你 · 请选择合法牌",turn:"回合",seconds:"秒",round:"局",tricks:"赢得墩数",team0:"南 · 北队",team1:"西 · 东队",won:"你的队伍赢得本局",matchWon:"比赛结束",lost:"另一队赢得本局",finished:"你赢得了比赛！",matchLost:"比赛结束 · 电脑队获胜",tie:"平局",needAuth:"连接钱包并验证至少持有 1 FIT 后开始。",selectTrump:"你是庄家。从前五张牌中选择主牌花色。",playing:"如果可能，请跟随首张牌的花色。",cpuTrump:"电脑庄家正在选择主牌…",nextRound:"本局结束。准备好后开始下一局。",easy:"简单",normal:"普通",hard:"困难",noCards:"没有合法的牌。",auto:"时间到 — 已自动打出一张合法牌。",roundCount:"共",limit:"局",trump:"主牌"},
es:{start:"Iniciar partida individual",next:"Iniciar siguiente ronda",restart:"Nueva partida",choose:"Elegir triunfo",yourHand:"Tus cartas",thinking:"La CPU está pensando…",yourTurn:"Tu turno · juega una carta válida",turn:"Turno",seconds:"s",round:"Ronda",tricks:"Bazas",team0:"SUR · NORTE",team1:"OESTE · ESTE",won:"Tu equipo ganó la ronda",matchWon:"Partida completada",lost:"El otro equipo ganó la ronda",finished:"¡Ganaste la partida!",matchLost:"Partida terminada · gana la CPU",tie:"Empate",needAuth:"Conecta tu cartera y verifica al menos 1 FIT para empezar.",selectTrump:"Eres el hakim. Elige el triunfo entre tus cinco primeras cartas.",playing:"Debes asistir al palo si puedes. Tu turno está resaltado.",cpuTrump:"El hakim de la CPU está eligiendo triunfo…",nextRound:"Ronda terminada. Inicia la siguiente cuando quieras.",access:"Acceso verificado. Ya puedes iniciar una partida individual.",easy:"Fácil",normal:"Normal",hard:"Difícil",noCards:"No hay cartas legales.",auto:"Se acabó el tiempo: se jugó una carta legal automáticamente.",roundCount:"de",limit:"rondas",trump:"TRIUNFO"},
pt:{start:"Iniciar partida solo",next:"Iniciar próxima rodada",restart:"Nova partida",choose:"Escolher trunfo",yourHand:"Suas cartas",thinking:"A CPU está pensando…",yourTurn:"Sua vez · jogue uma carta válida",turn:"Vez",seconds:"s",round:"Rodada",tricks:"Vazas",team0:"SUL · NORTE",team1:"OESTE · LESTE",won:"Sua equipe venceu a rodada",matchWon:"Partida concluída",lost:"A outra equipe venceu a rodada",finished:"Você venceu a partida!",matchLost:"Partida encerrada · CPU venceu",tie:"Empate",needAuth:"Conecte sua carteira e verifique pelo menos 1 FIT para começar.",selectTrump:"Você é o hakim. Escolha o trunfo entre suas cinco primeiras cartas.",playing:"Siga o naipe se possível. Sua vez fica destacada.",cpuTrump:"O hakim da CPU está escolhendo o trunfo…",nextRound:"Rodada concluída. Inicie a próxima quando estiver pronto.",access:"Acesso verificado. Você já pode iniciar uma partida solo.",easy:"Fácil",normal:"Normal",hard:"Difícil",noCards:"Não há cartas válidas.",auto:"O tempo acabou — uma carta válida foi jogada automaticamente.",roundCount:"de",limit:"rodadas",trump:"TRUNFO"}
};
let lang="en",tier=0,difficulty="normal",match=null,game=null,visibleTrick=[],roundResult=null,turnTimer=null,turnDeadline=0,turnInterval=null,locked=false;
const tr=k=>(I[lang]&&I[lang][k])||I.en[k]||k;
const suitName=s=>({ "♠":{en:"Spades",fa:"پیک",ar:"البستوني",tr:"Maça",ru:"Пики",zh:"黑桃",es:"Picas",pt:"Espadas"},"♥":{en:"Hearts",fa:"دل",ar:"القلب",tr:"Kupa",ru:"Червы",zh:"红桃",es:"Corazones",pt:"Copas"},"♦":{en:"Diamonds",fa:"خشت",ar:"الديناري",tr:"Karo",ru:"Бубны",zh:"方块",es:"Diamantes",pt:"Ouros"},"♣":{en:"Clubs",fa:"گشنیز",ar:"السباتي",tr:"Sinek",ru:"Трефы",zh:"梅花",es:"Tréboles",pt:"Paus"}}[s]?.[lang]||s);
const isRed=c=>c.suit==="♥"||c.suit==="♦";
function ensureControls(){
 if($("hokmGameControls"))return;
 const bar=document.querySelector(".control-bar");
 const wrap=document.createElement("div");wrap.id="hokmGameControls";wrap.className="hokm-game-controls";wrap.hidden=false;
 wrap.innerHTML='<div class="hokm-game-status" id="hokmGameStatus" aria-live="polite"></div><div class="hokm-game-buttons"><button id="hokmStartBtn" class="primary-btn" type="button"></button><button id="hokmNextBtn" class="primary-btn" type="button" hidden></button><button id="hokmRestartBtn" class="secondary-btn" type="button" hidden></button></div><div id="hokmTrumpPicker" class="hokm-trump-picker" hidden><strong id="hokmTrumpTitle"></strong><div class="hokm-trump-options"><button type="button" data-suit="♠">♠ <span></span></button><button type="button" data-suit="♥">♥ <span></span></button><button type="button" data-suit="♦">♦ <span></span></button><button type="button" data-suit="♣">♣ <span></span></button></div></div><div class="hokm-hand-caption" id="hokmHandCaption"></div><div class="hokm-turn-clock" id="hokmTurnClock" hidden></div>';
 bar.parentNode.insertBefore(wrap,bar);
 $("hokmStartBtn").disabled=true;
 $("hokmStartBtn").addEventListener("click",startMatch);
 $("hokmNextBtn").addEventListener("click",nextRound);
 $("hokmRestartBtn").addEventListener("click",startMatch);
 $("hokmTrumpPicker").querySelectorAll("[data-suit]").forEach(b=>b.addEventListener("click",()=>chooseTrump(b.dataset.suit)));
}
function setStatus(s){$("hokmGameStatus").textContent=s}
function setMessage(s){$("tableMessage").textContent=s}
function seatElements(seat){return ({0:{hand:".hand-south",chip:".seat-south .player-chip"},1:{hand:".seat-west .hand",chip:".seat-west .player-chip"},2:{hand:".hand-north",chip:".seat-north .player-chip"},3:{hand:".seat-east .hand",chip:".seat-east .player-chip"}})[seat]}
function clearClock(){if(turnInterval)clearInterval(turnInterval);turnInterval=null;turnDeadline=0;$("hokmTurnClock").hidden=true;document.querySelector(".seat-south .player-chip .hokm-seat-ring.turn")?.remove()}
function stopTimers(){clearClock();if(turnTimer)clearTimeout(turnTimer);turnTimer=null;locked=false}
function makeCardNode(card,clickable){
 const b=document.createElement("button");b.className="hokm-card"+(isRed(card)?" red":"")+(clickable?" playable":"");b.type="button";b.disabled=!clickable;b.setAttribute("aria-disabled",String(!clickable));b.dataset.cardId=card.id;b.setAttribute("aria-label",card.rank+" "+suitName(card.suit));
 const top=document.createElement("span");top.className="card-corner";top.textContent=card.rank+card.suit;
 const center=document.createElement("span");center.className="card-center";center.textContent=card.suit;
 b.append(top,center);
 // TokenPocket's embedded iOS/Android WebViews may deliver touchend without
 // synthesizing a reliable click on dynamically-created card buttons.
 let touchStart=null,lastTouchAt=0;
 b.addEventListener("touchstart",event=>{
  const point=event.changedTouches&&event.changedTouches[0];
  if(point)touchStart={x:point.clientX,y:point.clientY};
 },{passive:true});
 b.addEventListener("touchend",event=>{
  const point=event.changedTouches&&event.changedTouches[0];
  if(!point||!touchStart)return;
  const moved=Math.hypot(point.clientX-touchStart.x,point.clientY-touchStart.y);
  touchStart=null;
  if(moved>12)return;
  event.preventDefault();
  lastTouchAt=Date.now();
  playHumanCard(card.id);
 },{passive:false});
 b.addEventListener("touchcancel",()=>{touchStart=null},{passive:true});
 b.addEventListener("click",event=>{
  // Ignore the compatibility click following a touch; touchend already played it.
  if(event.detail>0&&Date.now()-lastTouchAt<1000)return;
  playHumanCard(card.id);
 });
 return b;
}
function makeBack(){const b=document.createElement("span");b.className="hokm-card-back";b.setAttribute("aria-hidden","true");return b}
function renderHand(seat,cards,faceUp){
 const el=document.querySelector(seatElements(seat).hand);if(!el)return;
 const previous=Number(el.dataset.cardCount||0),dealing=cards.length>previous;
 el.classList.remove("dealing");el.replaceChildren();
 if(dealing){el.classList.add("dealing");el.style.setProperty("--deal-x",seat===0?"0px":seat===2?"0px":seat===1?"clamp(70px,14vw,170px)":"clamp(-170px,-14vw,-70px)");el.style.setProperty("--deal-y",seat===0?"clamp(55px,13vw,145px)":seat===2?"clamp(-145px,-13vw,-55px)":"0px")}
 if(faceUp)cards.forEach((card,index)=>{const node=makeCardNode(card,game&&game.phase==="playing"&&game.currentPlayer===0&&!locked&&H.legalCards(game,0).some(c=>c.id===card.id));node.style.setProperty("--deal-index",index);el.appendChild(node)});
 else cards.forEach((_,index)=>{const node=makeBack();node.style.setProperty("--deal-index",index);el.appendChild(node)});
 el.dataset.cardCount=String(cards.length);
}
function renderSeats(){
 const counts=game?game.tricksWon:[0,0,0,0];
 for(let seat=0;seat<4;seat++){
  const node=document.querySelector(seatElements(seat).chip);if(!node)continue;
  const small=node.querySelector("small"),em=node.querySelector("em");
  if(small){small.textContent=seat===0?(game&&game.currentPlayer===0?tr("yourTurn"):tr("yourHand")):((game&&game.currentPlayer===seat)?tr("thinking"):"CPU");}
  if(em)em.textContent=String(counts[seat]||0);
  node.classList.toggle("active",!!game&&!game.finished&&game.currentPlayer===seat);
 }
}
function animatePlayedCard(node,entry,seat){
 const key=String(entry.card.id||entry.card.rank+entry.card.suit)+"@"+seat;
 if(node.dataset.playedCardKey===key)return;
 node.dataset.playedCardKey=key;
 const from={0:[0,150],1:[-155,0],2:[0,-150],3:[155,0]}[seat]||[0,0];
 node.style.setProperty("--hokm-from-x",from[0]+"px");node.style.setProperty("--hokm-from-y",from[1]+"px");
 node.classList.remove("hokm-card-arriving");node.style.animation="none";void node.offsetWidth;node.style.animation="";
 node.classList.add("hokm-card-arriving");
}
function renderTrick(){
 const nodes=[...document.querySelectorAll(".trick-cards .played-card")];
 const entries=visibleTrick.length?visibleTrick:(game?game.trick:[]);
 nodes.forEach(node=>{node.classList.add("empty");node.classList.remove("red","black");node.textContent="·"});
 const active=new Set();
 entries.forEach(entry=>{
  const node=nodes[entry.player];if(!node)return;active.add(entry.player);
  node.classList.remove("empty");node.classList.toggle("red",isRed(entry.card));node.classList.toggle("black",!isRed(entry.card));
  node.textContent=entry.card.rank+entry.card.suit;animatePlayedCard(node,entry,entry.player);
 });
 nodes.forEach((node,index)=>{if(!active.has(index)){node.classList.remove("hokm-card-arriving");node.dataset.playedCardKey="";}});
}
function render(){
 if(!game)return;
 const mapping=[0,1,2,3];
 mapping.forEach(seat=>renderHand(seat,game.hands[seat],seat===0));
 renderSeats();renderTrick();
 const trump=document.getElementById("tableTrumpSuit");if(trump)trump.textContent=game.trump||"—";
 const hakem=document.getElementById("tableHakem"),hakemChip=document.querySelector(seatElements(game.hakem).chip+" b");if(hakem)hakem.textContent=hakemChip?hakemChip.textContent:(game.hakem===0?"You":"CPU "+(game.hakem+1));
 const bottom=document.querySelectorAll(".game-bottom .team-score b");
 if(bottom.length&&match){bottom[0].textContent=match.matchPoints[0];bottom[1].textContent=match.matchPoints[1]}
 const round=document.querySelector(".round-info b");if(round&&match)round.textContent=match.roundNo+" / "+match.maxRounds;
 $("hokmHandCaption").textContent=game.phase==="choose-trump"?tr("selectTrump"):tr("playing");
 renderTrick();
}
function chooseCpuTrump(){
 const hand=game.hands[game.hakem];
 const scores=H.SUITS.map(s=>({s,score:hand.filter(c=>c.suit===s).reduce((v,c)=>v+(c.rank==="A"?5:c.rank==="K"?3:c.rank==="Q"?2:c.rank==="J"?1:0),0)+hand.filter(c=>c.suit===s).length*3}));
 scores.sort((a,b)=>b.score-a.score);
 return scores[0].s;
}
function updateTrumpOptions(){
 const picker=$("hokmTrumpPicker");
 picker.hidden=false;$("hokmTrumpTitle").textContent=tr("choose");
 picker.querySelectorAll("[data-suit]").forEach(b=>{const suit=b.dataset.suit;b.querySelector("span").textContent=suitName(suit);b.disabled=false});
}
function beginRound(hakem){
 game=H.startRound(match,{humanSeat:0,hakem});
 visibleTrick=[];roundResult=null;stopTimers();
 $("hokmNextBtn").hidden=true;$("hokmRestartBtn").hidden=true;$("hokmStartBtn").hidden=true;
 $("hokmTrumpPicker").hidden=true;
 cardFxSafe("deal");render();
 if(game.hakem===0){setStatus(tr("selectTrump"));setMessage(tr("selectTrump"));updateTrumpOptions();return}
 setStatus(tr("cpuTrump"));setMessage(tr("cpuTrump"));
 turnTimer=setTimeout(()=>{if(!game||game.phase!=="choose-trump")return;const suit=chooseCpuTrump();H.chooseTrump(game,suit);cardFxSafe("deal-more");render();setStatus(tr("playing"));setMessage(tr("playing"));advance();},700);
}
function startMatch(){
 if(!tier){setStatus(tr("needAuth"));return}
 stopTimers();match=H.createMatch({mode:"solo",players:[{seat:0,kind:"human",balance:tier>=2?10:1},{seat:1,kind:"cpu"},{seat:2,kind:"cpu"},{seat:3,kind:"cpu"}],difficulty});
 $("hokmGameControls").hidden=false;$("hokmStartBtn").hidden=true;$("hokmNextBtn").hidden=true;$("hokmRestartBtn").hidden=true;
 beginRound();
}
function chooseTrump(suit){
 if(!game||game.phase!=="choose-trump"||game.hakem!==0)return;
 try{H.chooseTrump(game,suit);$("hokmTrumpPicker").hidden=true;cardFxSafe("deal-more");render();setStatus(tr("playing"));setMessage(tr("playing"));startClock();advance()}catch(e){setStatus(e.message)}
}
function startClock(){
 clearClock();if(!game||game.finished||game.currentPlayer!==0)return;
 H.startTurnClock(game);turnDeadline=game.turnDeadlineAt;
 $("hokmTurnClock").hidden=false;
 const tick=()=>{
  const left=Math.max(0,Math.ceil((turnDeadline-Date.now())/1000));
  $("hokmTurnClock").textContent=tr("turn")+": "+left+" "+tr("seconds");
  const chip=document.querySelector(".seat-south .player-chip");
  if(chip){
   let ring=chip.querySelector(".hokm-seat-ring.turn");
   if(!ring){ring=document.createElement("span");ring.className="hokm-seat-ring turn";ring.setAttribute("aria-hidden","true");chip.appendChild(ring)}
   ring.style.setProperty("--ring-progress",String(Math.max(0,Math.min(1,(turnDeadline-Date.now())/30000))));
   ring.textContent=String(left);
  }
  if(left<=0){clearClock();if(game&&game.phase==="playing"&&game.currentPlayer===0){const result=H.resolveTurnTimeout(game,{difficulty});onCardPlayed(result,true)}}
 };
 tick();turnInterval=setInterval(tick,250);
}
function playHumanCard(id){
 if(!game||game.phase!=="playing"||game.currentPlayer!==0||locked)return;
 try{
  clearClock();const result=H.playCardWithClock(game,0,id);onCardPlayed(result,false);
 }catch(e){setStatus(e.message)}
}
function onCardPlayed(result,automatic){
 if(result.completed){
  visibleTrick=result.trick;
  cardFxSafe("collect");
  // Lock before rendering: otherwise the hand briefly looks playable while the
  // 950ms trick-display pause is active, and taps are silently discarded.
  if(result.roundWinner===undefined)locked=true;
 }else{visibleTrick=[];cardFxSafe("play")}
 render();
 if(automatic){setStatus(tr("auto"));setMessage(tr("auto"))}
 if(result.roundWinner!==undefined){completeRound(result.roundWinner);return}
 if(result.completed){
  setStatus(tr("playing"));setMessage(tr("playing"));
  turnTimer=setTimeout(()=>{visibleTrick=[];locked=false;render();if(game.currentPlayer===0)startClock();advance()},950);
  return;
 }
 if(game.currentPlayer===0){startClock();setStatus(tr("yourTurn"));setMessage(tr("yourTurn"))}
 else{setStatus(tr("thinking"));setMessage(tr("thinking"));advance()}
}
function advance(){
 if(!game||game.finished||game.phase!=="playing"||locked)return;
 if(game.currentPlayer===0){startClock();setStatus(tr("yourTurn"));setMessage(tr("yourTurn"));render();return}
 clearClock();
 const seat=game.currentPlayer;
 turnTimer=setTimeout(()=>{
  if(!game||game.finished||game.currentPlayer!==seat||locked)return;
  try{const card=H.chooseCpuCard(game,seat,difficulty);const result=H.playCard(game,seat,card.id);onCardPlayed(result,false)}catch(e){setStatus(e.message)}
 },difficulty==="hard"?650:difficulty==="normal"?520:380);
}
function completeRound(winner){
 stopTimers();visibleTrick=[];render();
 const result=H.finishRound(match,game,winner);
 const humanWon=winner===0;
 const message=humanWon?tr("won"):tr("lost");
 setStatus(message+" · "+match.matchPoints[0]+" : "+match.matchPoints[1]);
 setMessage(message);
 if(result.matchFinished){
  const final=match.matchPoints[0]===match.matchPoints[1]?tr("tie"):(match.matchPoints[0]>match.matchPoints[1]?tr("finished"):tr("matchLost"));
  setStatus(tr("matchWon")+" · "+final);setMessage(final);
  $("hokmRestartBtn").textContent=tr("restart");$("hokmRestartBtn").hidden=false;
 }else{
  $("hokmNextBtn").textContent=tr("next");$("hokmNextBtn").hidden=false;
 }
}
function nextRound(){
 if(!match||match.finished)return;
 const hakem=(game.hakem+1)%4;
 beginRound(hakem);
}
function cardFxSafe(kind){try{if(typeof cardFx==="function")cardFx(kind)}catch(e){}}
function setLanguage(value){if(I[value])lang=value;if($("hokmGameControls")&&!$("hokmGameControls").hidden){$("hokmStartBtn").textContent=tr("start");$("hokmNextBtn").textContent=tr("next");$("hokmRestartBtn").textContent=tr("restart");if(game){$("hokmHandCaption").textContent=game.phase==="choose-trump"?tr("selectTrump"):tr("playing");if(game.phase==="choose-trump"&&game.hakem===0){$("hokmTrumpTitle").textContent=tr("choose");$("hokmTrumpPicker").querySelectorAll("[data-suit]").forEach(b=>b.querySelector("span").textContent=suitName(b.dataset.suit))}}}}
ensureControls();
$("hokmGameControls").hidden=true;
$("languageSelect").addEventListener("change",e=>setLanguage(e.target.value));
window.addEventListener("hokm:language-changed",e=>setLanguage(e.detail?.lang||$("languageSelect").value));
$("cpuDifficulty").addEventListener("change",e=>{difficulty=["easy","normal","hard"].includes(e.target.value)?e.target.value:"normal"});
function activateAuthenticated(d){
 tier=Number(d&&d.tier)||0;setLanguage($("languageSelect").value||"en");
 $("hokmGameControls").hidden=false;$("hokmStartBtn").hidden=false;$("hokmStartBtn").disabled=!tier;$("hokmStartBtn").textContent=tr("start");$("hokmNextBtn").hidden=true;$("hokmRestartBtn").hidden=true;
 setStatus(tier?tr("access"):tr("needAuth"));setMessage("");
}
window.addEventListener("hokm:authenticated",e=>activateAuthenticated(e.detail||{}));
// Recover authentication if wallet verification completed before this controller attached its listener.
if(window.hokmAuthState)activateAuthenticated(window.hokmAuthState);
window.addEventListener("hokm:access-revoked",()=>{
 stopTimers();tier=0;match=null;game=null;visibleTrick=[];$("hokmGameControls").hidden=false;$("hokmStartBtn").disabled=true;$("hokmStartBtn").hidden=false;setStatus(tr("needAuth"));
 document.querySelectorAll(".hand").forEach(el=>{el.replaceChildren(...Array.from({length:13},()=>makeBack()))});
 document.querySelectorAll(".trick-cards .played-card").forEach(el=>{el.classList.add("empty");el.textContent="·"});
 const trump=document.getElementById("tableTrumpSuit");if(trump)trump.textContent="—";const hakem=document.getElementById("tableHakem");if(hakem)hakem.textContent="—";
});
setLanguage($("languageSelect").value||"en");
})();