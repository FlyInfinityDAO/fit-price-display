import "../../engine/hokm-engine.js";

const H = globalThis.HokmEngine;

function publicPlayer(p, viewer, match) {
  const matchPlayer = match?.players.find(x => x.seat === p.seat);
  return {
    seat: p.seat,
    wallet: p.kind === "cpu" ? null : p.wallet.slice(0, 6) + "…" + p.wallet.slice(-4).toUpperCase(),
    you: p.wallet === viewer,
    tier: p.tier,
    connected: !!p.connected,
    cpu: p.kind === "cpu" || !!p.replaced,
    reconnectDeadlineAt: matchPlayer?.connectionStatus === "disconnected"
      ? (matchPlayer.reconnectDeadlineAt || null)
      : (!match && !p.connected ? (p.reconnectUntil || null) : null)
  };
}

export function isCpuTurn(room) {
  const game = room.match?.round;
  if (room.status !== "playing" || !game) return false;
  const seat = game.phase === "choose-trump" ? game.hakem : game.currentPlayer;
  return room.match.players.find(player => player.seat === seat)?.kind === "cpu";
}

export function scheduleCpuTurnAt(room, now = Date.now()) {
  const game = room.match?.round;
  if (!isCpuTurn(room)) return null;
  const difficulty = room.match.difficulty || "normal";
  const thinkDelay = difficulty === "veryhard" ? 850
    : difficulty === "hard" ? 650
    : difficulty === "normal" ? 520 : 380;
  return Math.max(
    room.cpuTurnAt || 0,
    now + thinkDelay,
    (room.cardFlightUntil || 0) + thinkDelay,
    (room.lastTrickClearAt || 0) + thinkDelay
  );
}

export function queueCpuTurnState(room, now = Date.now()) {
  const cpuTurnAt = scheduleCpuTurnAt(room, now);
  if (cpuTurnAt === null) {
    delete room.cpuTurnAt;
    if (!isCpuTurn(room)) {
      delete room.cpuTurnBlocked;
      delete room.cpuTurnFailures;
      if (typeof room.error === "string" && room.error.startsWith("CPU turn failed")) delete room.error;
    }
    return null;
  }
  delete room.trumpDeadlineAt;
  delete room.cpuTurnBlocked;
  room.cpuTurnAt = cpuTurnAt;
  delete room.pausedTrumpRemainingMs;
  const game = room.match?.round;
  if (game?.phase === "playing") {
    delete game.turnStartedAt;
    delete game.turnDeadlineAt;
    delete game.pausedTurnRemainingMs;
  }
  return cpuTurnAt;
}

// The winning team keeps the Hakem; otherwise the next seat in turn order becomes Hakem.
export function executeCpuTurn(room, now = Date.now(), rng = Math.random) {
  const game = room.match?.round;
  if (!game || room.status !== "playing" || !isCpuTurn(room)) return null;
  const difficulty = room.match.difficulty || "normal";
  if (game.phase === "choose-trump") {
    const suit = H.chooseCpuTrump(game, game.hakem, difficulty, rng);
    if (!H.SUITS.includes(suit)) throw new Error("CPU selected an invalid trump suit");
    H.chooseTrump(game, suit);
    H.startTurnClock(game, now);
    return { kind: "trump", suit };
  }
  if (game.phase === "playing") {
    const seat = game.currentPlayer;
    const card = H.chooseCpuCard(game, seat, difficulty, rng);
    if (!card || !H.legalCards(game, seat).some(legal => legal.id === card.id)) {
      throw new Error("CPU did not select a legal card");
    }
    return { kind: "card", result: H.playCard(game, seat, card.id), card };
  }
  throw new Error("CPU turn reached an unsupported game phase");
}

export function nextHakemAfterRound(previousHakem, roundWinner) {
  if (!Number.isInteger(previousHakem) || previousHakem < 0 || previousHakem > 3) {
    throw new Error("Invalid previous Hakem seat");
  }
  if (roundWinner !== 0 && roundWinner !== 1) {
    throw new Error("Invalid round-winning team");
  }
  return roundWinner === previousHakem % 2 ? previousHakem : H.nextSeat(previousHakem);
}

export function pauseTurnClockForDisconnectedPlayer(room, seat, now = Date.now()) {
  const game = room.match?.round;
  if (!game || game.finished) return false;
  if (game.phase === "choose-trump" && game.hakem === seat) {
    if (Number.isFinite(room.pausedTrumpRemainingMs)) return true;
    room.pausedTrumpRemainingMs = Number.isFinite(room.trumpDeadlineAt)
      ? Math.max(0, room.trumpDeadlineAt - now)
      : H.TURN_TIMEOUT_MS;
    delete room.trumpDeadlineAt;
    return true;
  }
  if (game.phase !== "playing" || game.currentPlayer !== seat) return false;
  if (Number.isFinite(game.pausedTurnRemainingMs)) return true;
  const remaining = Number.isFinite(game.turnDeadlineAt)
    ? Math.max(0, game.turnDeadlineAt - now)
    : H.TURN_TIMEOUT_MS;
  game.pausedTurnRemainingMs = remaining;
  delete game.turnStartedAt;
  delete game.turnDeadlineAt;
  return true;
}

export function resumeTurnClockForReconnectedPlayer(room, seat, now = Date.now()) {
  const game = room.match?.round;
  const player = room.match?.players.find(item => item.seat === seat);
  if (!game || game.finished || !player || player.kind === "cpu") return false;
  if (game.phase === "choose-trump" && game.hakem === seat) {
    const remaining = Number.isFinite(room.pausedTrumpRemainingMs)
      ? Math.max(0, room.pausedTrumpRemainingMs)
      : H.TURN_TIMEOUT_MS;
    room.trumpDeadlineAt = now + remaining;
    delete room.pausedTrumpRemainingMs;
    return true;
  }
  if (game.phase !== "playing" || game.currentPlayer !== seat) return false;
  const remaining = Number.isFinite(game.pausedTurnRemainingMs)
    ? Math.max(0, game.pausedTurnRemainingMs)
    : H.TURN_TIMEOUT_MS;
  const startAt = Math.max(now, room.cardFlightUntil || 0, room.lastTrickClearAt || 0);
  game.turnStartedAt = startAt;
  game.turnDeadlineAt = startAt + remaining;
  delete game.pausedTurnRemainingMs;
  return true;
}

export function prepareNextTurnClock(room, nextTurnAt) {
  const game = room.match?.round;
  if (!game || game.phase !== "playing" || game.finished) return;
  const player = room.match.players.find(item => item.seat === game.currentPlayer);
  if (!player || player.kind === "cpu" || player.connectionStatus === "disconnected" || player.connectionStatus === "replaced") {
    delete game.turnStartedAt;
    delete game.turnDeadlineAt;
    delete game.pausedTurnRemainingMs;
    return;
  }
  game.turnStartedAt = nextTurnAt;
  game.turnDeadlineAt = nextTurnAt + H.TURN_TIMEOUT_MS;
  delete game.pausedTurnRemainingMs;
}

export function createRoomSnapshot(room, wallet) {
  const seat = room.players.find(p => p.wallet === wallet)?.seat ?? -1;
  const game = room.match?.round || null;
  return {
    code: room.code,
    status: room.status,
    cpuDifficulty: room.match?.difficulty || room.cpuDifficulty || null,
    cardFlightUntil: room.cardFlightUntil || null,
    players: room.players.map(p => publicPlayer(p, wallet, room.match)),
    seat,
    maxPlayers: 4,
    match: room.match ? {
      maxRounds: room.match.maxRounds,
      targetWins: room.match.targetWins || Math.ceil(room.match.maxRounds / 2),
      roundsPlayed: room.match.roundsPlayed,
      matchPoints: room.match.matchPoints,
      hakemCounts: room.match.hakemCounts || [0, 0],
      matchWinner: room.match.finished
        ? ((room.match.matchPoints || [0, 0])[0] > (room.match.matchPoints || [0, 0])[1] ? 0 : 1)
        : null,
      accessTier: room.match.accessTier,
      finished: room.match.finished
    } : null,
    game: game ? {
      phase: game.phase,
      hakem: game.hakem,
      currentPlayer: game.currentPlayer,
      trump: game.trump,
      ownHand: game.hands[seat] || [],
      handCounts: game.hands.map(hand => hand.length),
      tricksWon: game.tricksWon,
      trick: game.trick,
      lastTrick: room.lastTrick || [],
      teamTricks: game.teamTricks,
      finished: game.finished,
      turnDeadlineAt: game.turnDeadlineAt || room.trumpDeadlineAt || null,
      reconnectGraceMs: H.RECONNECT_GRACE_MS,
      roundWinner: room.roundWinner ?? null
    } : null,
    cpuTurnAt: room.cpuTurnAt || null,
    cpuTurnDelayMs: room.match?.difficulty === "veryhard" ? 850
      : room.match?.difficulty === "hard" ? 650
      : room.match?.difficulty === "normal" ? 520 : 380,
    cpuTurnBlocked: !!room.cpuTurnBlocked,
    cpuTurnFailures: room.cpuTurnFailures || 0,
    error: room.error || null
  };
}

export function scheduleCpuRetryAt(room, now = Date.now(), maxRetries = 3) {
  const failures = (room.cpuTurnFailures || 0) + 1;
  room.cpuTurnFailures = failures;
  if (failures > maxRetries) {
    delete room.cpuTurnAt;
    room.cpuTurnBlocked = true;
    return null;
  }
  const retryAt = now + failures * 1000;
  room.cpuTurnAt = retryAt;
  return retryAt;
}

export function clearCpuRetryState(room) {
  delete room.cpuTurnFailures;
  delete room.cpuTurnBlocked;
  if (typeof room.error === "string" && room.error.startsWith("CPU turn failed")) {
    delete room.error;
  }
}
