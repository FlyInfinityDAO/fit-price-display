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

export function scheduleCpuTurnAt(room, now = Date.now()) {
  const game = room.match?.round;
  if (room.status !== "playing" || !game) return null;
  const cpuSeat = game.phase === "choose-trump" ? game.hakem : game.currentPlayer;
  const cpu = room.match.players.find(p => p.seat === cpuSeat)?.kind === "cpu";
  if (!cpu) return null;
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
      roundsPlayed: room.match.roundsPlayed,
      matchPoints: room.match.matchPoints,
      hakemCounts: room.match.hakemCounts || [0, 0],
      matchWinner: room.match.finished
        ? ((room.match.hakemCounts || [0, 0])[0] >= room.match.maxRounds ? 0 : 1)
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
    error: room.error || null
  };
}
