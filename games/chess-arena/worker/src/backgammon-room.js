import { initialPosition, legalTurnSequences, rollDice, winner, clonePosition, pipCount } from "../../../backgammon/js/backgammon-engine.js";

function evaluateForBlack(position) {
  let score = (pipCount(position, "w") - pipCount(position, "b")) * 0.7 +
    (position.off.b - position.off.w) * 32 + (position.bar.w - position.bar.b) * 28;
  for (let i = 0; i < 24; i++) {
    const count = position.points[i];
    if (count < 0) {
      const pieces = -count;
      score += pieces === 1 ? -11 : pieces * 2.2;
      if (i >= 18) score += pieces * 1.2;
    } else if (count > 0) score += count === 1 ? 10 : -count * 1.1;
  }
  return score;
}
function chooseCpuSequence(sequences, difficulty) {
  if (difficulty === "easy") return sequences[Math.floor(Math.random() * sequences.length)];
  let best = null, bestScore = -Infinity;
  for (const sequence of sequences) {
    let score = evaluateForBlack(sequence.position) +
      sequence.moves.reduce((total, move) => total + (move.hit ? 7 : 0), 0);
    if (difficulty === "hard") {
      let total = 0, weightTotal = 0;
      for (let a = 1; a <= 6; a++) for (let b = a; b <= 6; b++) {
        const weight = a === b ? 1 : 2;
        const replies = legalTurnSequences(sequence.position, "w", [a, b]);
        const replyScore = replies.length
          ? Math.min(...replies.map(reply => evaluateForBlack(reply.position)))
          : evaluateForBlack(sequence.position);
        total += replyScore * weight;
        weightTotal += weight;
      }
      score = total / weightTotal;
    }
    if (score > bestScore) { bestScore = score; best = sequence; }
  }
  return best || sequences[0];
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

function applyMove(position, side, move) {
  const next = clonePosition(position);
  const sign = side === "w" ? 1 : -1;
  if (move.from === "bar") next.bar[side]--;
  else next.points[move.from] -= sign;
  if (move.to === "off") {
    next.off[side]++;
    return next;
  }
  const opponent = side === "w" ? "b" : "w";
  if (Math.abs(next.points[move.to]) === 1 && next.points[move.to] * sign < 0) {
    next.bar[opponent]++;
    next.points[move.to] = 0;
  }
  next.points[move.to] += sign;
  return next;
}

export class BackgammonRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }

  async readGame() {
    return this.ctx.storage.get("game");
  }

  async saveGame(game) {
    if (game.status === "finished" && !game.statsRecorded && this.env?.DB) {
      await this.env.DB.prepare(
        "CREATE TABLE IF NOT EXISTS backgammon_player_results (room_code TEXT NOT NULL, wallet_address TEXT NOT NULL, outcome TEXT NOT NULL, reason TEXT NOT NULL, points INTEGER NOT NULL, multiplier INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, PRIMARY KEY (room_code, wallet_address))"
      ).run();
      const createdAt = Math.floor(Date.now() / 1000);
      const statements = [];
      for (const [side, wallet] of [["w", game.players.white], ["b", game.players.black]]) {
        if (!wallet || wallet === "cpu") continue;
        const outcome = game.result === "draw" ? "draw" : game.result === side ? "win" : "loss";
        const points = outcome === "draw" ? 1 : outcome === "win" ? 3 : 0;
        statements.push(this.env.DB.prepare(
          "INSERT OR IGNORE INTO backgammon_player_results (room_code, wallet_address, outcome, reason, points, multiplier, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
        ).bind(game.code, wallet.toLowerCase(), outcome, game.reason || "unknown", points, game.multiplier ?? 1, createdAt));
      }
      if (statements.length) await this.env.DB.batch(statements);
      game.statsRecorded = true;
      game.finishedAt = Date.now();
    }
    await this.ctx.storage.put("game", game);
  }

  async playCpuTurn(game) {
    const dice = rollDice();
    const options = legalTurnSequences(game.position, "b", dice);
    if (!options.length || !options[0].moves.length) {
      game.turn = "w";
      game.dice = null;
      game.sequenceOptions = [];
      return;
    }
    const chosen = chooseCpuSequence(options, game.difficulty || "medium");
    game.position = clonePosition(chosen.position);
    game.dice = null;
    game.sequenceOptions = [];
    const win = winner(game.position);
    if (win) {
      game.status = "finished";
      game.result = win.side;
      game.multiplier = win.multiplier;
      game.reason = "bear_off";
    } else game.turn = "w";
  }

  snapshot(game) {
    return {
      roomCode: game.code,
      players: game.players,
      mode: game.mode || "friend",
      difficulty: game.difficulty || null,
      status: game.status,
      position: game.position,
      turn: game.turn,
      dice: game.dice,
      legalMoves: game.sequenceOptions.map(seq => seq.moves[0]).filter(Boolean),
      movesLeft: Math.max(0, ...game.sequenceOptions.map(seq => seq.moves.length)),
      result: game.result,
      multiplier: game.multiplier,
      reason: game.reason,
      drawOffer: game.drawOffer,
      serverTime: Date.now()
    };
  }

  async broadcast(game, type = "state") {
    const payload = JSON.stringify({ type, game: this.snapshot(game) });
    for (const socket of this.ctx.getWebSockets()) {
      try { socket.send(payload); } catch { /* stale socket */ }
    }
  }

  async fetch(request) {
    const url = new URL(request.url);
    const wallet = (request.headers.get("x-backgammon-wallet") || "").toLowerCase();

    if (request.method === "POST" && url.pathname === "/create") {
      if (await this.readGame()) return json({ ok: false, error: "Room code collision." }, 409);
      if (!wallet) return json({ ok: false, error: "Wallet missing." }, 400);
      const mode = url.searchParams.get("mode") === "cpu" ? "cpu" : "friend";
      const difficulty = ["easy", "medium", "hard"].includes(url.searchParams.get("difficulty")) ? url.searchParams.get("difficulty") : "medium";
      const game = {
        code: url.searchParams.get("code") || "",
        players: mode === "cpu" ? { white: wallet, black: "cpu" } : { white: wallet, black: null },
        mode, difficulty: mode === "cpu" ? difficulty : null,
        status: mode === "cpu" ? "active" : "waiting",
        position: initialPosition(),
        turn: "w",
        dice: null,
        sequenceOptions: [],
        result: null,
        multiplier: 0,
        reason: null,
        drawOffer: null,
        createdAt: Date.now()
      };
      await this.saveGame(game);
      return json({ ok: true, room: this.snapshot(game) });
    }

    if (request.method === "POST" && url.pathname === "/join") {
      const game = await this.readGame();
      if (!game) return json({ ok: false, error: "Room not found." }, 404);
      if (!wallet) return json({ ok: false, error: "Wallet missing." }, 400);
      if (game.mode === "cpu") return json({ ok: false, error: "CPU rooms cannot be joined by another wallet." }, 409);
      if (wallet === game.players.white || wallet === game.players.black) return json({ ok: true, room: this.snapshot(game) });
      if (game.status !== "waiting" || game.players.black) return json({ ok: false, error: "This room is no longer available." }, 409);
      game.players.black = wallet;
      game.status = "active";
      await this.saveGame(game);
      await this.broadcast(game, "joined");
      return json({ ok: true, room: this.snapshot(game) });
    }

    if (request.method === "GET" && ["/snapshot", "/check-player"].includes(url.pathname)) {
      const game = await this.readGame();
      if (!game) return json({ ok: false, error: "Room not found." }, 404);
      if (wallet !== game.players.white && wallet !== game.players.black) return json({ ok: false, error: "Wallet is not a player in this room." }, 403);
      return url.pathname === "/check-player" ? json({ ok: true }) : json({ ok: true, room: this.snapshot(game) });
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
      server.send(JSON.stringify({ type: "state", game: this.snapshot(game) }));
      return new Response(null, { status: 101, webSocket: client });
    }

    return json({ ok: false, error: "Room route not found." }, 404);
  }

  async webSocketMessage(socket, message) {
    let action;
    try {
      if (typeof message !== "string" || message.length > 2048) throw new Error("Invalid message size.");
      action = JSON.parse(message);
    } catch {
      socket.send(JSON.stringify({ type: "error", error: "Invalid game message." }));
      return;
    }

    const wallet = socket.deserializeAttachment()?.wallet;
    const game = await this.readGame();
    if (!game || game.status !== "active" || !wallet ||
        (wallet !== game.players.white && wallet !== game.players.black)) {
      socket.send(JSON.stringify({ type: "error", error: "This game is not active for your wallet." }));
      return;
    }

    const side = wallet === game.players.white ? "w" : "b";
    const opponent = side === "w" ? "b" : "w";

    if (action.type === "resign") {
      game.status = "finished";
      game.result = opponent;
      game.multiplier = 1;
      game.reason = "resignation";
      game.dice = null;
      game.sequenceOptions = [];
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
      game.multiplier = 0;
      game.reason = "agreement";
      game.drawOffer = null;
      game.dice = null;
      game.sequenceOptions = [];
      await this.saveGame(game);
      await this.broadcast(game, "finished");
      return;
    }

    if (side !== game.turn) {
      socket.send(JSON.stringify({ type: "error", error: "It is not your turn." }));
      return;
    }

    if (action.type === "roll") {
      if (game.dice) {
        socket.send(JSON.stringify({ type: "error", error: "Finish the current dice before rolling again." }));
        return;
      }
      game.dice = rollDice();
      game.sequenceOptions = legalTurnSequences(game.position, side, game.dice);
      if (!game.sequenceOptions.length || !game.sequenceOptions[0].moves.length) {
        game.dice = null;
        game.sequenceOptions = [];
        game.turn = opponent;
        if (game.mode === "cpu" && opponent === "b") await this.playCpuTurn(game);
        await this.saveGame(game);
        await this.broadcast(game, game.status === "finished" ? "finished" : "turn_passed");
        return;
      }
      await this.saveGame(game);
      await this.broadcast(game, "rolled");
      return;
    }

    if (action.type !== "move" || !game.dice || !Array.isArray(game.sequenceOptions)) {
      socket.send(JSON.stringify({ type: "error", error: "Roll the dice before moving." }));
      return;
    }

    const from = action.from;
    const to = action.to;
    const candidates = game.sequenceOptions.filter(seq => seq.moves[0]?.from === from && seq.moves[0]?.to === to);
    if (!candidates.length) {
      socket.send(JSON.stringify({ type: "error", error: "Illegal backgammon move." }));
      return;
    }

    const move = candidates[0].moves[0];
    game.position = applyMove(game.position, side, move);
    game.sequenceOptions = candidates.map(seq => ({ moves: seq.moves.slice(1), position: seq.position }));
    const win = winner(game.position);
    if (win) {
      game.status = "finished";
      game.result = win.side;
      game.multiplier = win.multiplier;
      game.reason = "bear_off";
      game.dice = null;
      game.sequenceOptions = [];
      await this.saveGame(game);
      await this.broadcast(game, "finished");
      return;
    }

    if (!game.sequenceOptions.length || !game.sequenceOptions[0].moves.length) {
      game.dice = null;
      game.sequenceOptions = [];
      game.turn = opponent;
      if (game.mode === "cpu" && opponent === "b") await this.playCpuTurn(game);
      await this.saveGame(game);
      await this.broadcast(game, game.status === "finished" ? "finished" : "turn");
      return;
    }

    const remaining = [...game.dice];
    const used = remaining.indexOf(move.die);
    if (used >= 0) remaining.splice(used, 1);
    game.dice = remaining;
    await this.saveGame(game);
    await this.broadcast(game, "move");
  }
}
