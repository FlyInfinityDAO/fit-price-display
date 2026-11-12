// Fly Ludo rules engine — pure state transitions shared by local, CPU and server play.
export const COLORS = ["red", "green", "yellow", "blue"];
export const COLOR_START = { red: 0, green: 13, yellow: 26, blue: 39 };
export const SAFE_CELLS = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
export const TRACK_LENGTH = 52;
export const HOME_LENGTH = 6;
const clone = value => structuredClone(value);
export function createGame(playerCount = 4, humanCount = playerCount) {
  const count = Math.max(1, Math.min(4, Number(playerCount) || 4));
  const humans = Math.max(1, Math.min(count, Number(humanCount) || 1));
  const colors = COLORS.slice(0, count);
  return {
    version: 1, status: "active", turn: 0, dice: null, consecutiveSixes: 0,
    players: colors.map((color, index) => ({
      color, kind: index < humans ? "human" : "cpu",
      pieces: [-1, -1, -1, -1], finished: 0
    })),
    lastAction: null, winner: null, moveNumber: 0
  };
}
export function playerAt(game, index = game.turn) { return game.players[index] || null; }
export function globalTrackIndex(color, progress) {
  return (COLOR_START[color] + progress) % TRACK_LENGTH;
}
export function legalPieceMoves(game, playerIndex = game.turn, dice = game.dice) {
  if (!dice || !Number.isInteger(dice) || dice < 1 || dice > 6) return [];
  const player = game.players[playerIndex];
  if (!player || player.finished === 4) return [];
  const moves = [];
  player.pieces.forEach((progress, pieceIndex) => {
    if (progress === -1) {
      if (dice === 6) moves.push({ pieceIndex, from: -1, to: 0, kind: "enter" });
      return;
    }
    if (progress >= 57) return;
    const next = progress + dice;
    if (next > 57) return;
    moves.push({ pieceIndex, from: progress, to: next, kind: next === 57 ? "finish" : next >= 52 ? "home" : "move" });
  });
  return moves;
}
export function applyMove(game, playerIndex, move) {
  const next = clone(game);
  const player = next.players[playerIndex];
  if (!player || !move || !Number.isInteger(move.pieceIndex)) throw new Error("Invalid move.");
  const current = player.pieces[move.pieceIndex];
  const options = legalPieceMoves(next, playerIndex, next.dice);
  const legal = options.find(item => item.pieceIndex === move.pieceIndex && item.from === current && item.to === move.to);
  if (!legal) throw new Error("Illegal Ludo move.");
  player.pieces[move.pieceIndex] = legal.to;
  if (legal.kind === "finish") player.finished++;
  let captured = 0;
  if (legal.to >= 0 && legal.to < 52) {
    const landed = globalTrackIndex(player.color, legal.to);
    if (!SAFE_CELLS.has(landed)) {
      for (const opponent of next.players) {
        if (opponent === player) continue;
        opponent.pieces = opponent.pieces.map(progress => {
          if (progress >= 0 && progress < 52 && globalTrackIndex(opponent.color, progress) === landed) {
            captured++;
            return -1;
          }
          return progress;
        });
      }
    }
  }
  next.lastAction = { type: "move", color: player.color, pieceIndex: legal.pieceIndex, dice: next.dice, captured };
  next.moveNumber++;
  const won = player.pieces.every(progress => progress === 57);
  if (won) {
    next.status = "finished";
    next.winner = player.color;
    next.dice = null;
    return next;
  }
  const rolledSix = next.dice === 6;
  next.dice = null;
  if (!(rolledSix || captured > 0 || legal.kind === "finish")) next.turn = (next.turn + 1) % next.players.length;
  return next;
}
export function roll(game, random = Math.random) {
  if (game.status !== "active" || game.dice !== null) throw new Error("The dice are not ready.");
  const next = clone(game);
  const value = 1 + Math.floor(random() * 6);
  if (value === 6) next.consecutiveSixes++;
  else next.consecutiveSixes = 0;
  if (next.consecutiveSixes >= 3) {
    next.dice = null;
    next.consecutiveSixes = 0;
    next.turn = (next.turn + 1) % next.players.length;
    next.lastAction = { type: "three-sixes" };
    return next;
  }
  next.dice = value;
  next.lastAction = { type: "roll", value };
  if (!legalPieceMoves(next).length) {
    next.dice = null;
    next.turn = (next.turn + 1) % next.players.length;
    next.consecutiveSixes = 0;
    next.consecutiveSixes = 0;
    next.lastAction = { type: "blocked", value };
  }
  return next;
}
export function chooseCpuMove(game, difficulty = "medium") {
  const options = legalPieceMoves(game);
  if (!options.length) return null;
  const score = move => {
    if (move.kind === "finish") return 1000;
    if (move.kind === "enter") return 80;
    let value = move.to * 1.3;
    const landed = globalTrackIndex(playerAt(game).color, move.to);
    if (!SAFE_CELLS.has(landed)) {
      const hit = game.players.some((p, i) => i !== game.turn && p.pieces.some(n => n >= 0 && n < 52 && globalTrackIndex(p.color, n) === landed));
      if (hit) value += difficulty === "easy" ? 12 : 80;
    }
    if (SAFE_CELLS.has(landed)) value += 18;
    if (difficulty === "hard" && move.to >= 46) value += 30;
    return value;
  };
  if (difficulty === "easy") return options[Math.floor(Math.random() * options.length)];
  return options.sort((a, b) => score(b) - score(a))[0];
}
export function isSafeProgress(color, progress) {
  return progress >= 0 && progress < 52 && SAFE_CELLS.has(globalTrackIndex(color, progress));
}
export function getPiecePosition(color, progress) {
  if (progress < 0) return { zone: "yard", index: -1 };
  if (progress >= 52) return { zone: "home", index: progress - 52 };
  return { zone: "track", index: globalTrackIndex(color, progress) };
}
