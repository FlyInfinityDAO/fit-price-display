import { DurableObject } from "cloudflare:workers";
import "../../engine/hokm-engine.js";

const H = globalThis.HokmEngine;
const ROOM_TTL = 6 * 60 * 60;
const TICKET_TTL = 60;
const TURN_TIMEOUT_MS = 15000;
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});
const cleanWallet = value => typeof value === "string" ? value.toLowerCase() : "";
const publicPlayer = (p, viewer, match) => {
  const matchPlayer = match?.players.find(x => x.seat === p.seat);
  return {
    seat: p.seat,
    wallet: p.kind === "cpu" ? null : p.wallet.slice(0, 3) + "..." + p.wallet.slice(-3),
    you: p.wallet === viewer,
    tier: p.tier,
    connected: !!p.connected,
    cpu: p.kind === "cpu" || !!p.replaced,
    reconnectDeadlineAt: matchPlayer?.connectionStatus === "disconnected" ? (matchPlayer.reconnectDeadlineAt || null) : (!match && !p.connected ? (p.reconnectUntil || null) : null)
  };
};

export class HokmRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
  }

  async loadRoom() {
    return await this.ctx.storage.get("room") || null;
  }
  async saveRoom(room) {
    room.updatedAt = Date.now();
    await this.ctx.storage.put("room", room);
  }
  snapshot(room, wallet) {
    const seat = room.players.find(p => p.wallet === wallet)?.seat ?? -1;
    const game = room.match?.round || null;
    return {
      code: room.code,
      status: room.status,
      players: room.players.map(p => publicPlayer(p, wallet, room.match)),
      seat,
      maxPlayers: 4,
      match: room.match ? {
        maxRounds: room.match.maxRounds,
        roundsPlayed: room.match.roundsPlayed,
        matchPoints: room.match.matchPoints,
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
        trickPiles: room.trickPiles || [],
        teamTricks: game.teamTricks,
        finished: game.finished,
        turnDeadlineAt: game.turnDeadlineAt || null,
        roundWinner: room.roundWinner ?? null
      } : null,
      error: room.error || null
    };
  }
  send(ws, payload) {
    try { ws.send(JSON.stringify(payload)); } catch {}
  }
  broadcast(room) {
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = ws.deserializeAttachment() || {};
      this.send(ws, { type: "state", state: this.snapshot(room, cleanWallet(attachment.wallet)) });
    }
  }
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/create") return this.create(request);
    if (request.method === "POST" && url.pathname === "/cpu") return this.addCpuSeats(request);
    if (request.method === "POST" && url.pathname === "/join") return this.join(request);
    if (request.method === "POST" && url.pathname === "/ticket") return this.issueTicket(request);
    if (request.method === "GET" && (url.pathname === "/ws" || url.pathname.endsWith("/ws"))) return this.connect(request);
    return json({ ok: false, error: "Not found" }, 404);
  }
  async create(request) {
    const wallet = cleanWallet(request.headers.get("x-player-wallet"));
    const tier = Number(request.headers.get("x-player-tier"));
    if (!wallet || ![1, 2].includes(tier)) return json({ ok: false, error: "Verified wallet required" }, 401);
    const existing = await this.loadRoom();
    if (existing && existing.status !== "closed" && Date.now() - existing.updatedAt < ROOM_TTL * 1000) {
      return json({ ok: false, error: "Room already exists" }, 409);
    }
    const code = new URL(request.url).searchParams.get("code") || "";
    const room = {
      code, status: "waiting", createdAt: Date.now(), updatedAt: Date.now(),
      players: [{ wallet, seat: 0, tier, kind: "human", connected: false, joinedAt: Date.now() }],
      tickets: {}, match: null, lastTrick: [], roundWinner: null
    };
    await this.saveRoom(room);
    return json({ ok: true, code, seat: 0, status: room.status });
  }
  async join(request) {
    const wallet = cleanWallet(request.headers.get("x-player-wallet"));
    const tier = Number(request.headers.get("x-player-tier"));
    if (!wallet || ![1, 2].includes(tier)) return json({ ok: false, error: "Verified wallet required" }, 401);
    const room = await this.loadRoom();
    if (!room || room.status === "closed" || Date.now() - room.updatedAt > ROOM_TTL * 1000) {
      return json({ ok: false, error: "Room not found or expired" }, 404);
    }
    const current = room.players.find(p => p.wallet === wallet);
    if (current) {
      if (current.connected) return json({ ok: false, error: "This wallet is already in the room" }, 409);
      const matchPlayer = room.match?.players.find(p => p.seat === current.seat);
      if (matchPlayer?.connectionStatus === "replaced") return json({ ok: false, error: "Reconnect window expired; this seat is now controlled by CPU" }, 409);
      const deadline = matchPlayer?.reconnectDeadlineAt || current.reconnectUntil;
      if (deadline && Date.now() >= deadline) return json({ ok: false, error: "Reconnect window expired" }, 409);
      current.tier = tier;
      current.connected = false;
      await this.saveRoom(room);
      return json({ ok: true, code: room.code, seat: current.seat, status: room.status, reconnect: true });
    }
    if (room.status !== "waiting" || room.players.length >= 4) return json({ ok: false, error: "Room is full or already started" }, 409);
    const used = new Set(room.players.map(p => p.seat));
    const seat = [0, 1, 2, 3].find(s => !used.has(s));
    room.players.push({ wallet, seat, tier, kind: "human", connected: false, joinedAt: Date.now() });
    await this.saveRoom(room);
    return json({ ok: true, code: room.code, seat, status: room.status, reconnect: false });
  }
  async addCpuSeats(request) {
    const wallet = cleanWallet(request.headers.get("x-player-wallet"));
    let body;
    try { body = await request.json(); } catch { return json({ ok: false, error: "Invalid JSON body" }, 400); }
    const seats = body?.seats;
    if (!Array.isArray(seats) || !([2, 3].every((s, i) => seats.length === 2 && seats[i] === s) && seats.length === 2) && !(seats.length === 1 && seats[0] === 3)) {
      return json({ ok: false, error: "Choose CPU seats 3 and 4, or seat 4 only" }, 400);
    }
    const room = await this.loadRoom();
    if (!room || room.status !== "waiting") return json({ ok: false, error: "CPU seats can only be added before the match starts" }, 409);
    const owner = room.players.find(p => p.seat === 0 && p.kind !== "cpu");
    if (!owner || owner.wallet !== wallet) return json({ ok: false, error: "Only the room creator can add CPU players" }, 403);
    const occupied = new Set(room.players.map(p => p.seat));
    if (seats.some(seat => occupied.has(seat))) return json({ ok: false, error: "One or more selected seats are already occupied" }, 409);
    for (const seat of seats) {
      room.players.push({ wallet: "cpu-seat-" + seat, seat, tier: 0, kind: "cpu", connected: true, replaced: true, joinedAt: Date.now() });
    }
    await this.maybeStart(room);
    await this.saveRoom(room);
    await this.scheduleAlarm(room);
    this.broadcast(room);
    return json({ ok: true, code: room.code, cpuSeats: seats, status: room.status });
  }
  async issueTicket(request) {
    const wallet = cleanWallet(request.headers.get("x-player-wallet"));
    const room = await this.loadRoom();
    const player = room?.players.find(p => p.wallet === wallet);
    if (!player) return json({ ok: false, error: "Join this room before connecting" }, 403);
    const matchPlayer = room.match?.players.find(p => p.seat === player.seat);
    if (matchPlayer?.connectionStatus === "replaced") return json({ ok: false, error: "Reconnect window expired; this seat is now controlled by CPU" }, 409);
    const ticket = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    room.tickets ||= {};
    room.tickets[ticket] = { wallet, seat: player.seat, expiresAt: Date.now() + TICKET_TTL * 1000 };
    for (const [key, value] of Object.entries(room.tickets)) if (value.expiresAt <= Date.now()) delete room.tickets[key];
    await this.saveRoom(room);
    return json({ ok: true, ticket, expiresIn: TICKET_TTL });
  }
  async connect(request) {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") return json({ ok: false, error: "WebSocket upgrade required" }, 426);
    const ticket = new URL(request.url).searchParams.get("ticket") || "";
    const room = await this.loadRoom();
    const claim = room?.tickets?.[ticket];
    if (!claim || claim.expiresAt <= Date.now()) return json({ ok: false, error: "Connection ticket is invalid or expired" }, 401);
    delete room.tickets[ticket];
    const player = room.players.find(p => p.wallet === claim.wallet && p.seat === claim.seat);
    if (!player) return json({ ok: false, error: "Room seat is no longer available" }, 403);
    const matchPlayer = room.match?.players.find(p => p.seat === player.seat);
    if (matchPlayer?.connectionStatus === "replaced") return json({ ok: false, error: "Reconnect window expired; this seat is now controlled by CPU" }, 409);
    const deadline = matchPlayer?.reconnectDeadlineAt || player.reconnectUntil;
    if (deadline && Date.now() >= deadline) return json({ ok: false, error: "Reconnect window expired" }, 409);
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ wallet: claim.wallet, seat: claim.seat });
    player.connected = true;
    delete player.reconnectUntil;
    for (const existing of this.ctx.getWebSockets()) {
      if (existing === server) continue;
      const old = existing.deserializeAttachment() || {};
      if (cleanWallet(old.wallet) === claim.wallet && old.seat === claim.seat) {
        try { existing.close(4001, "Reconnected on another client"); } catch {}
      }
    }
    if (room.match) {
      if (matchPlayer) {
        matchPlayer.connectionStatus = "connected";
        delete matchPlayer.disconnectedAt;
        delete matchPlayer.reconnectDeadlineAt;
      }
    }
    await this.maybeStart(room);
    await this.saveRoom(room);
    await this.scheduleAlarm(room);
    this.broadcast(room);
    return new Response(null, { status: 101, webSocket: client });
  }
  async maybeStart(room) {
    if (room.status !== "waiting" || room.players.length !== 4 || !room.players.filter(p => p.kind !== "cpu").every(p => p.connected)) return;
    try {
      room.match = H.createMatch({
        mode: "online",
        players: room.players.map(p => ({ seat: p.seat, kind: p.kind || "human", balance: p.kind === "cpu" ? 0 : (p.tier >= 2 ? 10 : 1), wallet: p.wallet, connectionStatus: p.kind === "cpu" ? "replaced" : "connected" })),
        difficulty: "normal",
        allowCpuSeats: true
      });
      room.status = "playing";
      room.lastTrick = [];
      room.trickPiles = [];
      room.roundWinner = null;
      await this.startRound(room);
    } catch (error) {
      room.status = "waiting";
      room.error = error.message || "Unable to start match";
    }
  }
  async startRound(room, hakem) {
    H.startRound(room.match, { humanSeat: 0, hakem });
    room.lastTrick = [];
    room.trickPiles = [];
    room.roundWinner = null;
    room.status = "playing";
    const game = room.match.round;
    if (game.phase === "playing") {
      H.startTurnClock(game);
      this.queueCpuTurn(room);
    } else if (room.match.players.find(p => p.seat === game.hakem)?.kind === "cpu") {
      room.cpuTurnAt = Date.now() + 650;
      delete room.trumpDeadlineAt;
    } else {
      room.trumpDeadlineAt = Date.now() + TURN_TIMEOUT_MS;
    }
    await this.scheduleAlarm(room);
  }
  queueCpuTurn(room) {
    const game = room.match?.round;
    if (room.status !== "playing" || !game) { delete room.cpuTurnAt; return; }
    const cpuSeat = game.phase === "choose-trump" ? game.hakem : game.currentPlayer;
    const cpu = room.match.players.find(p => p.seat === cpuSeat)?.kind === "cpu";
    if (cpu) {
      delete room.trumpDeadlineAt;
      room.cpuTurnAt ||= Date.now() + 650;
    } else {
      delete room.cpuTurnAt;
    }
  }
  async playCpuTurn(room, now) {
    const game = room.match?.round;
    if (!game || room.status !== "playing") return;
    if (game.phase === "choose-trump") {
      const hand = game.hands[game.hakem] || [];
      const scores = H.SUITS.map(suit => ({
        suit,
        score: hand.filter(card => card.suit === suit).reduce((sum, card) => sum + (card.rank === "A" ? 5 : card.rank === "K" ? 3 : card.rank === "Q" ? 2 : card.rank === "J" ? 1 : 0) + 3, 0)
      })).sort((a, b) => b.score - a.score);
      H.chooseTrump(game, scores[0]?.suit || H.SUITS[0]);
      H.startTurnClock(game, now);
    } else if (game.phase === "playing") {
      const seat = game.currentPlayer;
      const card = H.chooseCpuCard(game, seat, room.match.difficulty || "normal");
      const result = H.playCard(game, seat, card.id);
      if (!game.finished) H.startTurnClock(game, now);
      else { delete game.turnStartedAt; delete game.turnDeadlineAt; }
      await this.applyResult(room, result);
    }
    this.queueCpuTurn(room);
  }
  async scheduleAlarm(room) {
    const times = [];
    const game = room.match?.round;
    if (room.status === "round-break" && room.nextRoundAt) times.push(room.nextRoundAt);
    if (room.lastTrickClearAt) times.push(room.lastTrickClearAt);
    if (room.trumpDeadlineAt) times.push(room.trumpDeadlineAt);
    if (room.cpuTurnAt) times.push(room.cpuTurnAt);
    if (game?.phase === "playing" && Number.isFinite(game.turnDeadlineAt)) times.push(game.turnDeadlineAt);
    for (const p of room.players) {
      const mp = room.match?.players.find(x => x.seat === p.seat);
      const deadline = mp?.connectionStatus === "disconnected" ? mp.reconnectDeadlineAt : (!room.match ? p.reconnectUntil : null);
      if (deadline) times.push(deadline);
    }
    if (times.length) await this.ctx.storage.setAlarm(Math.min(...times));
    else await this.ctx.storage.deleteAlarm();
  }
  async webSocketMessage(ws, message) {
    const attachment = ws.deserializeAttachment() || {};
    const wallet = cleanWallet(attachment.wallet);
    let data;
    try {
      if (typeof message !== "string" || message.length > 4096) throw new Error("Invalid message");
      data = JSON.parse(message);
    } catch {
      this.send(ws, { type: "error", error: "Invalid message format" });
      return;
    }
    const room = await this.loadRoom();
    const player = room?.players.find(p => p.wallet === wallet && p.seat === attachment.seat);
    if (!room || !player || !player.connected) {
      this.send(ws, { type: "error", error: "Player is not active in this room" });
      return;
    }
    try {
      if (data.type === "choose_trump") {
        const game = room.match?.round;
        if (room.status !== "playing" || !game || game.phase !== "choose-trump" || game.hakem !== player.seat) throw new Error("It is not your turn to choose trump");
        H.chooseTrump(game, data.suit);
        delete room.trumpDeadlineAt;
        H.startTurnClock(game);
        this.queueCpuTurn(room);
        await this.scheduleAlarm(room);
      } else if (data.type === "play_card") {
        if (room.status !== "playing" || room.lastTrick?.length) throw new Error("Please wait for the current trick to finish");
        const game = room.match?.round;
        if (!game || game.currentPlayer !== player.seat) throw new Error("It is not your turn");
        const result = H.playCardWithClock(game, player.seat, String(data.cardId || ""));
        await this.applyResult(room, result);
        this.queueCpuTurn(room);
      } else if (data.type === "leave") {
        player.connected = false;
        player.reconnectUntil = Date.now() + H.RECONNECT_GRACE_MS;
        if (room.match) H.markPlayerDisconnected(room.match, player.seat);
      } else {
        throw new Error("Unknown game action");
      }
      await this.saveRoom(room);
      await this.scheduleAlarm(room);
      this.broadcast(room);
    } catch (error) {
      this.send(ws, { type: "error", error: error.message || "Action rejected" });
    }
  }
  async applyResult(room, result) {
    const game = room.match.round;
    if (result.roundWinner !== undefined) {
      room.lastTrick = result.trick || [];
      room.lastTrickClearAt = Date.now() + 1200;
      const round = H.finishRound(room.match, game, result.roundWinner);
      room.roundWinner = result.roundWinner;
      room.status = round.matchFinished ? "finished" : "round-break";
      if (!round.matchFinished) room.nextRoundAt = Date.now() + 1800;
      else delete room.nextRoundAt;
      await this.scheduleAlarm(room);
      return;
    }
    if (result.completed) {
      room.trickPiles ||= [];
      room.trickPiles.push({ winner: result.winner, cards: result.trick || [] });
      room.lastTrick = result.trick || [];
      room.lastTrickClearAt = Date.now() + 900;
    }
    await this.scheduleAlarm(room);
  }
  async alarm() {
    const room = await this.loadRoom();
    if (!room) return;
    const now = Date.now();
    let changed = false;
    if (room.match) {
      const replaced = H.expireDisconnectedPlayers(room.match, now);
      if (replaced.length) {
        for (const seat of replaced) {
          const player = room.players.find(p => p.seat === seat);
          if (player) { player.connected = false; player.replaced = true; }
        }
        changed = true;
      }
    } else {
      const remaining = room.players.filter(p => p.connected || !p.reconnectUntil || p.reconnectUntil > now);
      if (remaining.length !== room.players.length) {
        room.players = remaining;
        changed = true;
      }
    }
    if (room.status === "round-break" && room.match && !room.match.finished && room.nextRoundAt && now >= room.nextRoundAt) {
      const hakem = (room.match.round.hakem + 1) % 4;
      delete room.nextRoundAt;
      await this.startRound(room, hakem);
      changed = true;
    }
    if (room.lastTrickClearAt && now >= room.lastTrickClearAt) {
      room.lastTrick = [];
      delete room.lastTrickClearAt;
      changed = true;
    }
    const game = room.match?.round;
    if (room.status === "playing" && room.cpuTurnAt && now >= room.cpuTurnAt) {
      delete room.cpuTurnAt;
      try { await this.playCpuTurn(room, now); changed = true; }
      catch (error) { room.error = error.message || "CPU turn failed"; changed = true; }
    }
    if (room.status === "playing" && game?.phase === "choose-trump" && room.trumpDeadlineAt && now >= room.trumpDeadlineAt) {
      const hand = game.hands[game.hakem] || [];
      const scores = H.SUITS.map(suit => ({
        suit,
        score: hand.filter(card => card.suit === suit).reduce((sum, card) => sum + (card.rank === "A" ? 5 : card.rank === "K" ? 3 : card.rank === "Q" ? 2 : card.rank === "J" ? 1 : 0) + 3, 0)
      })).sort((a, b) => b.score - a.score);
      H.chooseTrump(game, scores[0]?.suit || H.SUITS[0]);
      delete room.trumpDeadlineAt;
      H.startTurnClock(game);
      this.queueCpuTurn(room);
      changed = true;
    }
    if (room.status === "playing" && game?.phase === "playing" && Number.isFinite(game.turnDeadlineAt) && now >= game.turnDeadlineAt) {
      try {
        const result = H.resolveTurnTimeout(game, { now, difficulty: "normal" });
        await this.applyResult(room, result);
        this.queueCpuTurn(room);
        changed = true;
      } catch (error) {
        room.error = error.message || "Turn timeout failed";
        changed = true;
      }
    }
    await this.saveRoom(room);
    await this.scheduleAlarm(room);
    if (changed) this.broadcast(room);
  }
  async webSocketClose(ws) {
    const attachment = ws.deserializeAttachment() || {};
    const room = await this.loadRoom();
    const player = room?.players.find(p => p.wallet === cleanWallet(attachment.wallet) && p.seat === attachment.seat);
    if (!player) return;
    const anotherLiveSocket = this.ctx.getWebSockets().some(other => {
      if (other === ws || other.readyState !== WebSocket.OPEN) return false;
      const current = other.deserializeAttachment() || {};
      return cleanWallet(current.wallet) === cleanWallet(attachment.wallet) && current.seat === attachment.seat;
    });
    if (anotherLiveSocket) return;
    player.connected = false;
    player.reconnectUntil = Date.now() + H.RECONNECT_GRACE_MS;
    if (room.match) {
      try { H.markPlayerDisconnected(room.match, player.seat); } catch {}
    }
    await this.saveRoom(room);
    await this.scheduleAlarm(room);
    this.broadcast(room);
  }
}
