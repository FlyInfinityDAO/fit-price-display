import { Chess } from "chess.js";

const INITIAL_CLOCK_MS = 10 * 60 * 1000;
const PIECE_VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
function evaluatePosition(chess, perspective) {
  if (chess.isCheckmate()) return chess.turn() === perspective ? -100000 : 100000;
  if (chess.isDraw()) return 0;
  let score = 0;
  for (const row of chess.board()) for (const piece of row) {
    if (!piece) continue;
    const value = PIECE_VALUE[piece.type] || 0;
    score += piece.color === perspective ? value : -value;
  }
  if (chess.isCheck()) score += chess.turn() === perspective ? -35 : 35;
  return score;
}
function chooseCpuMove(chess, difficulty) {
  const moves = chess.moves({ verbose: true });
  if (!moves.length) return null;
  if (difficulty === "easy") return moves[Math.floor(Math.random() * moves.length)];
  if (difficulty === "medium") {
    let best = -Infinity, choices = [];
    for (const move of moves) {
      chess.move(move);
      const score = evaluatePosition(chess, chess.turn() === "w" ? "b" : "w");
      chess.undo();
      if (score > best) { best = score; choices = [move]; }
      else if (score === best) choices.push(move);
    }
    return choices[Math.floor(Math.random() * choices.length)];
  }
  const rootSide = chess.turn();
  function search(depth, alpha, beta) {
    if (depth === 0 || chess.isGameOver()) return evaluatePosition(chess, rootSide) * (chess.turn() === rootSide ? 1 : -1);
    const legal = chess.moves({ verbose: true });
    if (!legal.length) return evaluatePosition(chess, rootSide);
    let best = -Infinity;
    for (const move of legal) {
      chess.move(move);
      const score = -search(depth - 1, -beta, -alpha);
      chess.undo();
      if (score > best) best = score;
      if (score > alpha) alpha = score;
      if (alpha >= beta) break;
    }
    return best;
  }
  let best = -Infinity, choices = [];
  for (const move of moves) {
    chess.move(move);
    const score = -search(2, -Infinity, Infinity);
    chess.undo();
    if (score > best) { best = score; choices = [move]; }
    else if (score === best) choices.push(move);
  }
  return choices[Math.floor(Math.random() * choices.length)];
}


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
      turnStartedAt: game.turnStartedAt,
      result: game.result,
      reason: game.reason,
      drawOffer: game.drawOffer,
      mode: game.mode || "friend",
      difficulty: game.difficulty || null,
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
      const mode = url.searchParams.get("mode") === "cpu" ? "cpu" : "friend";
      const difficulty = ["easy", "medium", "hard"].includes(url.searchParams.get("difficulty")) ? url.searchParams.get("difficulty") : "medium";
      const playerColor = url.searchParams.get("color") === "b" ? "b" : "w";
      const game = {
        code: url.searchParams.get("code") || "",
        players: mode === "cpu"
          ? (playerColor === "w" ? { white: wallet, black: "cpu" } : { white: "cpu", black: wallet })
          : { white: wallet, black: null },
        mode,
        difficulty: mode === "cpu" ? difficulty : null,
        status: mode === "cpu" ? "active" : "waiting",
        fen: new Chess().fen(),
        pgn: "",
        turn: "w",
        remainingMs: { w: INITIAL_CLOCK_MS, b: INITIAL_CLOCK_MS },
        turnStartedAt: mode === "cpu" ? Date.now() : null,
        result: null,
        reason: null,
        drawOffer: null,
        createdAt: Date.now()
      };
      if (mode === "cpu" && playerColor === "b") {
        const chess = new Chess(game.fen);
        const cpuMove = chooseCpuMove(chess, difficulty);
        if (cpuMove) {
          chess.move(cpuMove);
          game.fen = chess.fen();
          game.pgn = chess.pgn();
          game.turn = chess.turn();
        }
      }
      await this.saveGame(game);
      if (game.status === "active") await this.ctx.storage.setAlarm(game.turnStartedAt + game.remainingMs[game.turn]);
      return json({ ok: true, room: await this.snapshot(game), timeControl: "10+0" });
    }

    if (request.method === "POST" && url.pathname === "/join") {
      const game = await this.readGame();
      if (!game) return json({ ok: false, error: "Room not found." }, 404);
      if (game.mode === "cpu" || game.status !== "waiting" || game.players.black) return json({ ok: false, error: "This room is no longer available." }, 409);
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

    if (game.status === "active" && game.mode === "cpu" && game.players[game.turn === "w" ? "white" : "black"] === "cpu") {
      const cpuSide = game.turn;
      const cpuChess = new Chess(game.fen);
      const cpuMove = chooseCpuMove(cpuChess, game.difficulty || "medium");
      if (cpuMove) {
        cpuChess.move(cpuMove);
        game.fen = cpuChess.fen();
        game.pgn = cpuChess.pgn();
        game.turn = cpuChess.turn();
        game.turnStartedAt = Date.now();
        if (cpuChess.isCheckmate()) {
          game.status = "finished"; game.result = cpuSide; game.reason = "checkmate"; game.turnStartedAt = null;
          await this.ctx.storage.deleteAlarm();
        } else if (cpuChess.isDraw()) {
          game.status = "finished"; game.result = "draw"; game.reason = cpuChess.isStalemate() ? "stalemate" : "draw"; game.turnStartedAt = null;
          await this.ctx.storage.deleteAlarm();
        } else {
          await this.ctx.storage.setAlarm(game.turnStartedAt + game.remainingMs[game.turn]);
        }
      }
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
