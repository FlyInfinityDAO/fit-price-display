import { Chess } from "chess.js";

const INITIAL_CLOCK_MS = 10 * 60 * 1000;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

export class ChessRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }

  async readGame() {
    return await this.ctx.storage.get("game");
  }

  async saveGame(game) {
    await this.ctx.storage.put("game", game);
  }

  async snapshot(game) {
    const remaining = { ...game.remainingMs };
    if (game.status === "active" && game.turnStartedAt) {
      const side = game.turn;
      remaining[side] = Math.max(0, remaining[side] - (Date.now() - game.turnStartedAt));
    }
    return {
      roomCode: game.code,
      players: game.players,
      status: game.status,
      fen: game.fen,
      pgn: game.pgn,
      turn: game.turn,
      remainingMs: remaining,
      result: game.result,
      reason: game.reason,
      drawOffer: game.drawOffer,
      serverTime: Date.now()
    };
  }

  async broadcast(game, type = "state") {
    const payload = JSON.stringify({ type, game: await this.snapshot(game) });
    for (const socket of this.ctx.getWebSockets()) {
      try { socket.send(payload); } catch { /* stale socket */ }
    }
  }

  async fetch(request) {
    const url = new URL(request.url);
    const wallet = (request.headers.get("x-chess-wallet") || "").toLowerCase();

    if (request.method === "POST" && url.pathname === "/create") {
      const existing = await this.readGame();
      if (existing) return json({ ok: false, error: "Room code collision." }, 409);
      if (!wallet) return json({ ok: false, error: "Wallet missing." }, 400);
      const game = {
        code: url.searchParams.get("code") || "",
        players: { white: wallet, black: null },
        status: "waiting",
        fen: new Chess().fen(),
        pgn: "",
        turn: "w",
        remainingMs: { w: INITIAL_CLOCK_MS, b: INITIAL_CLOCK_MS },
        turnStartedAt: null,
        result: null,
        reason: null,
        drawOffer: null,
        createdAt: Date.now()
      };
      await this.saveGame(game);
      return json({ ok: true, room: await this.snapshot(game), timeControl: "10+0" });
    }

    if (request.method === "POST" && url.pathname === "/join") {
      const game = await this.readGame();
      if (!game) return json({ ok: false, error: "Room not found." }, 404);
      if (game.status !== "waiting" || game.players.black) return json({ ok: false, error: "This room is no longer available." }, 409);
      if (!wallet || wallet === game.players.white) return json({ ok: false, error: "A different wallet is required to join." }, 400);
      game.players.black = wallet;
      game.status = "active";
      game.turnStartedAt = Date.now();
      await this.saveGame(game);
      await this.ctx.storage.setAlarm(game.turnStartedAt + game.remainingMs.w);
      await this.broadcast(game);
      return json({ ok: true, room: await this.snapshot(game), timeControl: "10+0" });
    }

    if (request.method === "GET" && url.pathname === "/snapshot") {
      const game = await this.readGame();
      if (!game) return json({ ok: false, error: "Room not found." }, 404);
      if (wallet !== game.players.white && wallet !== game.players.black) return json({ ok: false, error: "Wallet is not a player in this room." }, 403);
      return json({ ok: true, room: await this.snapshot(game) });
    }

    if (request.method === "GET" && url.pathname === "/check-player") {
      const game = await this.readGame();
      if (!game) return json({ ok: false, error: "Room not found." }, 404);
      if (wallet !== game.players.white && wallet !== game.players.black) return json({ ok: false, error: "Wallet is not a player in this room." }, 403);
      return json({ ok: true });
    }

    if (request.method === "GET" && url.pathname === "/ws") {
      const game = await this.readGame();
      if (!game) return json({ ok: false, error: "Room not found." }, 404);
      if (wallet !== game.players.white && wallet !== game.players.black) return json({ ok: false, error: "Wallet is not a player in this room." }, 403);
      if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") return json({ ok: false, error: "WebSocket upgrade required." }, 426);
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server);
      server.serializeAttachment({ wallet });
      server.send(JSON.stringify({ type: "state", game: await this.snapshot(game) }));
      return new Response(null, { status: 101, webSocket: client });
    }

    return json({ ok: false, error: "Room route not found." }, 404);
  }

  async webSocketMessage(socket, message) {
    let action;
    try {
      if (typeof message !== "string" || message.length > 4096) throw new Error("Invalid message size.");
      action = JSON.parse(message);
    } catch {
      socket.send(JSON.stringify({ type: "error", error: "Invalid game message." }));
      return;
    }

    const attachment = socket.deserializeAttachment();
    const wallet = attachment?.wallet;
    const game = await this.readGame();
    if (!game || game.status !== "active" || !wallet ||
        (wallet !== game.players.white && wallet !== game.players.black)) {
      socket.send(JSON.stringify({ type: "error", error: "This game is not active for your wallet." }));
      return;
    }

    const side = wallet === game.players.white ? "w" : "b";
    const opponentSide = side === "w" ? "b" : "w";
    const now = Date.now();

    if (action.type === "resign") {
      game.status = "finished";
      game.result = opponentSide;
      game.reason = "resignation";
      game.turnStartedAt = null;
      await this.ctx.storage.deleteAlarm();
      await this.saveGame(game);
      await this.broadcast(game, "finished");
      return;
    }

    if (action.type === "offer_draw") {
      if (game.drawOffer && game.drawOffer !== wallet) {
        socket.send(JSON.stringify({ type: "error", error: "A draw offer is already pending." }));
        return;
      }
      game.drawOffer = wallet;
      await this.saveGame(game);
      await this.broadcast(game, "draw_offer");
      return;
    }

    if (action.type === "decline_draw") {
      if (!game.drawOffer || game.drawOffer === wallet) return;
      game.drawOffer = null;
      await this.saveGame(game);
      await this.broadcast(game, "draw_declined");
      return;
    }

    if (action.type === "accept_draw") {
      if (!game.drawOffer || game.drawOffer === wallet) return;
      game.status = "finished";
      game.result = "draw";
      game.reason = "agreement";
      game.turnStartedAt = null;
      game.drawOffer = null;
      await this.ctx.storage.deleteAlarm();
      await this.saveGame(game);
      await this.broadcast(game, "finished");
      return;
    }

    if (action.type !== "move") {
      socket.send(JSON.stringify({ type: "error", error: "Unknown game action." }));
      return;
    }

    const chess = new Chess(game.fen);
    if (chess.turn() !== side) {
      socket.send(JSON.stringify({ type: "error", error: "It is not your turn." }));
      return;
    }

    const elapsed = Math.max(0, now - game.turnStartedAt);
    if (elapsed >= game.remainingMs[side]) {
      await this.finishOnTime(game, side);
      return;
    }

    let move;
    try {
      move = chess.move({
        from: action.from,
        to: action.to,
        ...(action.promotion ? { promotion: action.promotion } : {})
      });
    } catch { move = null; }
    if (!move) {
      socket.send(JSON.stringify({ type: "error", error: "Illegal chess move." }));
      return;
    }

    game.remainingMs[side] = Math.max(0, game.remainingMs[side] - elapsed);
    game.fen = chess.fen();
    game.pgn = chess.pgn();
    game.turn = chess.turn();
    game.turnStartedAt = now;
    game.drawOffer = null;

    if (chess.isCheckmate()) {
      game.status = "finished";
      game.result = side;
      game.reason = "checkmate";
      game.turnStartedAt = null;
      await this.ctx.storage.deleteAlarm();
    } else if (chess.isDraw()) {
      game.status = "finished";
      game.result = "draw";
      game.reason = chess.isStalemate() ? "stalemate" : "draw";
      game.turnStartedAt = null;
      await this.ctx.storage.deleteAlarm();
    } else {
      await this.ctx.storage.setAlarm(now + game.remainingMs[game.turn]);
    }

    await this.saveGame(game);
    await this.broadcast(game, game.status === "finished" ? "finished" : "move");
  }

  async finishOnTime(game, losingSide) {
    const chess = new Chess(game.fen);
    game.status = "finished";
    game.result = chess.isInsufficientMaterial() ? "draw" : (losingSide === "w" ? "b" : "w");
    game.reason = "timeout";
    game.turnStartedAt = null;
    await this.ctx.storage.deleteAlarm();
    await this.saveGame(game);
    await this.broadcast(game, "finished");
  }

  async alarm() {
    const game = await this.readGame();
    if (!game || game.status !== "active" || !game.turnStartedAt) return;
    const side = game.turn;
    const elapsed = Date.now() - game.turnStartedAt;
    if (elapsed >= game.remainingMs[side]) {
      await this.finishOnTime(game, side);
      return;
    }
    await this.ctx.storage.setAlarm(game.turnStartedAt + game.remainingMs[side]);
  }
}
