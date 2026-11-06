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
const publicPlayer = (p, viewer) => ({
  seat: p.seat,
  wallet: p.wallet.slice(0, 6) + "…" + p.wallet.slice(-4),
  you: p.wallet === viewer,
  tier: p.tier,
  connected: !!p.connected
});

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
      players: room.players.map(p => publicPlayer(p, wallet)),
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
        trick: game.trick,
        lastTrick: room.lastTrick || [],
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
    if (request.method === "POST" && url.pathname === "/join") return this.join(request);
    if (request.method === "POST" && url.pathname === "/ticket") return this.issueTicket(request);
    if (request.method === "GET" && url.pathname === "/ws") return this.connect(request);
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
      players: [{ wallet, seat: 0, tier, connected: false, joinedAt: Date.now() }],
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
      current.tier = tier;
      current.connected = false;
      current.reconnectUntil = Date.now() + 30000;
      await this.saveRoom(room);
      return json({ ok: true, code: room.code, seat: current.seat, status: room.status, reconnect: true });
    }
    if (room.status !== "waiting" || room.players.length >= 4) return json({ ok: false, error: "Room is full or already started" }, 409);
    const used = new Set(room.players.map(p => p.seat));
    const seat = [0, 1, 2, 3].find(s => !used.has(s));
    room.players.push({ wallet, seat, tier, connected: false, joinedAt: Date.now() });
    await this.saveRoom(room);
    return json({ ok: true, code: room.code, seat, status: room.status, reconnect: false });
  }
  async issueTicket(request) {
    const wallet = cleanWallet(request.headers.get("x-player-wallet"));
    const room = await this.loadRoom();
    const player = room?.players.find(p => p.wallet === wallet);
    if (!player) return json({ ok: false, error: "Join this room before connecting" }, 403);
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
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ wallet: claim.wallet, seat: claim.seat });
    player.connected = true;
    delete player.reconnectUntil;
    if (room.match) {
      const matchPlayer = room.match.players.find(p => p.seat === player.seat);
      if (matchPlayer) {
        matchPlayer.connectionStatus = "connected";
        delete matchPlayer.disconnectedAt;
        delete matchPlayer.reconnectDeadlineAt;
      }
    }
    await this.maybeStart(room);
    await this.saveRoom(room);
    this.broadcast(room);
    return new Response(null, { status: 101, webSocket: client });
  }
  async maybeStart(room) {
    if (room.status !== "waiting" || room.players.length !== 4 || !room.players.every(p => p.connected)) return;
    try {
      room.match = H.createMatch({
        mode: "online",
        players: room.players.map(p => ({ seat: p.seat, kind: "human", balance: p.tier >= 2 ? 10 : 1, wallet: p.wallet, connectionStatus: "connected" })),
        difficulty: "normal"
      });
      room.status = "playing";
      room.lastTrick = [];
      room.roundWinner = null;
      this.startRound(room, 0);
    } catch (error) {
      room.status = "waiting";
      room.error = error.message || "Unable to start match";
    }
  }
  startRound(room, hakem) {
    H.startRound(room.match, { humanSeat: 0, hakem });
    room.lastTrick = [];
    room.roundWinner = null;
    room.status = "playing";
    const game = room.match.round;
    if (game.phase === "playing") {
      H.startTurnClock(game);
      this.ctx.storage.setAlarm(game.turnDeadlineAt);
    } else {
      this.ctx.storage.deleteAlarm();
    }
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
        H.startTurnClock(game);
        await this.ctx.storage.setAlarm(game.turnDeadlineAt);
      } else if (data.type === "play_card") {
        if (room.status !== "playing" || room.lastTrick?.length) throw new Error("Please wait for the current trick to finish");
        const game = room.match?.round;
        if (!game || game.currentPlayer !== player.seat) throw new Error("It is not your turn");
        const result = H.playCardWithClock(game, player.seat, String(data.cardId || ""));
        await this.applyResult(room, result);
      } else if (data.type === "leave") {
        player.connected = false;
        if (room.match) H.markPlayerDisconnected(room.match, player.seat);
      } else {
        throw new Error("Unknown game action");
      }
      await this.saveRoom(room);
      this.broadcast(room);
    } catch (error) {
      this.send(ws, { type: "error", error: error.message || "Action rejected" });
    }
  }
  async applyResult(room, result) {
    const game = room.match.round;
    if (result.roundWinner !== undefined) {
      const round = H.finishRound(room.match, game, result.roundWinner);
      room.roundWinner = result.roundWinner;
      room.status = round.matchFinished ? "finished" : "round-break";
      if (!round.matchFinished) await this.ctx.storage.setAlarm(Date.now() + 1800);
      else await this.ctx.storage.deleteAlarm();
      return;
    }
    if (result.completed) {
      room.lastTrick = result.trick || [];
      await this.ctx.storage.setAlarm(Date.now() + 900);
    } else if (Number.isFinite(game.turnDeadlineAt)) {
      await this.ctx.storage.setAlarm(game.turnDeadlineAt);
    }
  }
  async alarm() {
    const room = await this.loadRoom();
    if (!room) return;
    const now = Date.now();
    if (room.status === "round-break" && room.match && !room.match.finished) {
      const hakem = room.match.roundsPlayed % 4;
      this.startRound(room, hakem);
      await this.saveRoom(room);
      this.broadcast(room);
      return;
    }
    if (room.lastTrick?.length) {
      room.lastTrick = [];
      const game = room.match?.round;
      if (game && Number.isFinite(game.turnDeadlineAt)) await this.ctx.storage.setAlarm(game.turnDeadlineAt);
      await this.saveRoom(room);
      this.broadcast(room);
      return;
    }
    const game = room.match?.round;
    if (room.status !== "playing" || !game || game.phase !== "playing" || !Number.isFinite(game.turnDeadlineAt) || now < game.turnDeadlineAt) return;
    try {
      const result = H.resolveTurnTimeout(game, { now, difficulty: "normal" });
      await this.applyResult(room, result);
      await this.saveRoom(room);
      this.broadcast(room);
    } catch (error) {
      room.error = error.message || "Turn timeout failed";
      await this.saveRoom(room);
      this.broadcast(room);
    }
  }
  async webSocketClose(ws) {
    const attachment = ws.deserializeAttachment() || {};
    const room = await this.loadRoom();
    const player = room?.players.find(p => p.wallet === cleanWallet(attachment.wallet) && p.seat === attachment.seat);
    if (!player) return;
    player.connected = false;
    if (room.match) {
      try { H.markPlayerDisconnected(room.match, player.seat); } catch {}
    }
    await this.saveRoom(room);
    this.broadcast(room);
  }
}
