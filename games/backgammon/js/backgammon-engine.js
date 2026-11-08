// Pure, deterministic backgammon rules engine. Board points are indexed 0..23.
// Positive checkers (white) move toward 0; negative checkers (black) move toward 23.
export const START_POSITION = Object.freeze({
  points: Object.freeze([ -2,0,0,0,0,5,0,3,0,0,0,-5,5,0,0,0,-3,0,-5,0,0,0,0,2 ]),
  bar: Object.freeze({ w: 0, b: 0 }),
  off: Object.freeze({ w: 0, b: 0 })
});

export function initialPosition() {
  return { points: [...START_POSITION.points], bar: { w: 0, b: 0 }, off: { w: 0, b: 0 } };
}
export function clonePosition(p) {
  return { points: [...p.points], bar: { ...p.bar }, off: { ...p.off } };
}
const sign = side => side === "w" ? 1 : -1;
const homeStart = side => side === "w" ? 0 : 18;
const homeEnd = side => side === "w" ? 5 : 23;
const isHome = (p, side) => p >= homeStart(side) && p <= homeEnd(side);
export function allInHome(position, side) {
  if (position.bar[side] > 0) return false;
  return position.points.every((n, i) => n * sign(side) <= 0 || isHome(i, side));
}
function canLand(position, side, to) {
  const n = position.points[to];
  return n * sign(side) >= 0 || Math.abs(n) === 1;
}
function hasCheckerBehind(position, side, from) {
  if (side === "w") return position.points.slice(from + 1).some(n => n > 0);
  return position.points.slice(0, from).some(n => n < 0);
}
function applySingle(position, side, from, die) {
  const next = clonePosition(position), s = sign(side);
  let to;
  if (from === "bar") {
    if (!next.bar[side]) return null;
    to = side === "w" ? 24 - die : die - 1;
    if (!canLand(next, side, to)) return null;
    next.bar[side]--;
  } else {
    if (!Number.isInteger(from) || from < 0 || from > 23 || next.points[from] * s <= 0) return null;
    if (next.bar[side] > 0) return null;
    const raw = side === "w" ? from - die : from + die;
    if (raw >= 0 && raw <= 23) {
      to = raw;
      if (!canLand(next, side, to)) return null;
    } else {
      if (!allInHome(position, side)) return null;
      const exact = side === "w" ? from + 1 === die : 24 - from === die;
      if (!exact && hasCheckerBehind(position, side, from)) return null;
      to = "off";
    }
    next.points[from] -= s;
  }
  if (to === "off") {
    next.off[side]++;
    return { position: next, move: { from, to, die, hit: false } };
  }
  if (Math.abs(next.points[to]) === 1 && next.points[to] * s < 0) {
    const opponent = side === "w" ? "b" : "w";
    next.bar[opponent]++;
    next.points[to] = 0;
    const hit = true;
    next.points[to] += s;
    return { position: next, move: { from, to, die, hit } };
  }
  next.points[to] += s;
  return { position: next, move: { from, to, die, hit: false } };
}
function expand(position, side, dice, moves) {
  if (!dice.length) return [{ position, moves }];
  const results = [];
  const tried = new Set();
  for (let i = 0; i < dice.length; i++) {
    const die = dice[i];
    if (tried.has(die)) continue;
    tried.add(die);
    const sources = position.bar[side] > 0 ? ["bar"] : position.points.map((n, idx) => n * sign(side) > 0 ? idx : -1).filter(x => x >= 0);
    for (const from of sources) {
      const applied = applySingle(position, side, from, die);
      if (!applied) continue;
      const rest = dice.slice(0, i).concat(dice.slice(i + 1));
      results.push(...expand(applied.position, side, rest, moves.concat(applied.move)));
    }
  }
  return results.length ? results : [{ position, moves }];
}
export function legalTurnSequences(position, side, dice) {
  if (!["w", "b"].includes(side) || !Array.isArray(dice) || !dice.every(d => Number.isInteger(d) && d >= 1 && d <= 6)) return [];
  const usable = dice.length === 2 && dice[0] === dice[1] ? [dice[0], dice[0], dice[0], dice[0]] : [...dice];
  const sequences = expand(position, side, usable, []);
  const maxMoves = Math.max(0, ...sequences.map(s => s.moves.length));
  let filtered = sequences.filter(s => s.moves.length === maxMoves);
  if (dice.length === 2 && dice[0] !== dice[1] && maxMoves === 1) {
    const high = Math.max(...dice);
    const highPlayable = filtered.some(s => s.moves[0]?.die === high);
    if (highPlayable) filtered = filtered.filter(s => s.moves[0]?.die === high);
  }
  const unique = new Map();
  for (const seq of filtered) {
    const key = seq.moves.map(m => `${m.from}:${m.to}:${m.die}`).join("|");
    if (!unique.has(key)) unique.set(key, seq);
  }
  return [...unique.values()];
}
export function winner(position) {
  if (position.off.w === 15) return { side: "w", multiplier: lossMultiplier(position, "b", "w") };
  if (position.off.b === 15) return { side: "b", multiplier: lossMultiplier(position, "w", "b") };
  return null;
}
function lossMultiplier(position, loser, winnerSide) {
  if (position.off[loser] > 0) return 1;
  const winnerHome = position.points.some((n, i) => n * sign(loser) > 0 && isHome(i, winnerSide));
  return position.bar[loser] > 0 || winnerHome ? 3 : 2;
}
export function pipCount(position, side) {
  let total = position.bar[side] * 25;
  for (let i = 0; i < 24; i++) {
    const n = position.points[i] * sign(side);
    if (n > 0) total += n * (side === "w" ? i + 1 : 24 - i);
  }
  return total;
}
export function rollDice(random = Math.random) {
  return [1 + Math.floor(random() * 6), 1 + Math.floor(random() * 6)];
}
