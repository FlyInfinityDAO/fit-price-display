(function () {
  'use strict';

  const BSC_CHAIN_ID = 56;
  const API_BASE = (window.CHESS_ARENA_API_URL || 'https://fly-chess-arena-api.flyinfinityplatform.workers.dev').replace(/\/$/, '');
  const $ = id => document.getElementById(id);
  const connectBrowserBtn = $('connectBrowserBtn');
  const connectWalletBtn = $('connectWalletBtn');

  let activeProvider = null;
  let sessionToken = null;
  let currentWallet = null;
  let activeRoomCode = null;
  let roomSocket = null;
  let currentGame = null;
  let myColor = null;
  let selectedSquare = null;
  let clockTimer = null;
  let lastStatsRoom = null;

  function status(message, isError) {
    $('status').textContent = message;
    $('status').style.color = isError ? '#ff9999' : '';
  }
  function setFitCheck(ok, detail) {
    $('fitStatus').textContent = detail;
    $('fitMark').textContent = ok ? '✓' : '✕';
    $('fitMark').style.color = ok ? '#00c896' : '#ff7777';
  }
  function closeRoom() {
    if (roomSocket) {
      roomSocket.close();
      roomSocket = null;
    }
    currentGame = null;
    activeRoomCode = null;
    selectedSquare = null;
    $('gamePanel').hidden = true;
    if (clockTimer) clearInterval(clockTimer);
    clockTimer = null;
  }
  function resetChecks() {
    sessionToken = null;
    currentWallet = null;
    closeRoom();
    $('roomsPanel').hidden = true;
    $('statsPanel').hidden = true;
    $('finalResultPanel').hidden = true;
    lastStatsRoom = null;
    $('eligiblePanel').hidden = true;
    $('deniedPanel').hidden = true;
    setFitCheck(false, 'At least 1 FIT required');
  }
  function showDenied(message) {
    $('deniedPanel').textContent = message;
    $('deniedPanel').hidden = false;
    status(message, true);
  }
  async function api(path, body, token) {
    const response = await fetch(API_BASE + path, {
      method: body ? 'POST' : 'GET',
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: 'Bearer ' + token } : {})
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store'
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok !== true) throw new Error(data.error || 'Chess Arena API request failed (' + response.status + ').');
    return data;
  }
  async function loadStats() {
    if (!sessionToken) return;
    $('statsPanel').hidden = false;
    $('statsWallet').textContent = currentWallet || '—';
    try {
      const [profile, board] = await Promise.all([
        api('/api/stats/me', null, sessionToken),
        api('/api/stats/leaderboard', null, sessionToken)
      ]);
      const stats = profile.stats || {};
      $('statsPoints').textContent = stats.points || 0;
      $('statsRank').textContent = '#' + (stats.rank || 1);
      $('statsGames').textContent = stats.games || 0;
      $('statsWins').textContent = stats.wins || 0;
      $('statsLosses').textContent = stats.losses || 0;
      $('statsDraws').textContent = stats.draws || 0;
      const list = $('statsLeaderboard');
      list.textContent = '';
      (board.leaderboard || []).forEach((player, index) => {
        const row = document.createElement('div');
        row.className = 'leaderboard-row';
        const rank = document.createElement('span');
        rank.textContent = '#' + (index + 1);
        const wallet = document.createElement('strong');
        wallet.textContent = shortWallet(player.wallet_address);
        const points = document.createElement('b');
        points.textContent = (player.points || 0) + ' FIGS';
        row.append(rank, wallet, points);
        list.appendChild(row);
      });
      if (!list.children.length) list.textContent = 'No ranked games yet.';
    } catch (error) {
      console.warn('[Chess Arena stats]', error);
      $('statsLeaderboard').textContent = 'Stats could not be loaded. Please reconnect and try again.';
    }
  }
  // WalletConnect can leave a signing request pending if the wallet app
  // approves it but the response never reaches the browser. Bound the wait
  // and report the exact stage instead of leaving the UI stuck indefinitely.
  async function requestWalletSignature(signer, message) {
    let timeoutId;
    const signing = signer.signMessage(message);
    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(
          'Wallet signature timed out after 120 seconds. The wallet did not return its response to this browser. ' +
          'Do not approve another signature yet; reload Chess Arena and reconnect before retrying.'
        ));
      }, 120000);
    });
    try {
      return await Promise.race([signing, timeout]);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function getWalletProvider(method) {
    // Primary method: preserve the original, previously tested wallet flow.
    if (method === 'browser') {
      if (typeof window.fiSelectWalletProvider === 'function') {
        return await window.fiSelectWalletProvider();
      }
      if (window.ethereum && typeof window.ethereum.request === 'function') {
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        return window.ethereum;
      }
      throw new Error('No compatible wallet found. Please open the page in a wallet browser or install a wallet.');
    }

    // Secondary method: injected provider only, intended for a wallet's own
    // built-in browser (for example TokenPocket DApp browser).
    if (!window.ethereum || typeof window.ethereum.request !== 'function') {
      throw new Error('کیف پولی در این مرورگر پیدا نشد. بازی را از داخل مرورگر خود کیف پول باز کنید.');
    }
    await window.ethereum.request({ method: 'eth_requestAccounts' });
    window.fiWalletConnectActive = false;
    return window.ethereum;
  }

  async function connectAndCheck(method) {
    const buttons = [connectBrowserBtn, connectWalletBtn];
    buttons.forEach(button => { button.disabled = true; });
    const activeButton = method === 'browser' ? connectBrowserBtn : connectWalletBtn;
    const originalLabel = activeButton.textContent;
    activeButton.textContent = 'Connecting…';
    resetChecks();
    try {
      activeProvider = await getWalletProvider(method);
      const provider = new ethers.providers.Web3Provider(activeProvider, 'any');
      const network = await provider.getNetwork();
      if (network.chainId !== BSC_CHAIN_ID) {
        try {
          await activeProvider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x38' }] });
        } catch (switchError) {
          if (switchError.code === 4902) throw new Error('Please add BNB Smart Chain to your wallet, then try again.');
          throw new Error('Switch your wallet to BNB Smart Chain (chain ID 56).');
        }
      }
      const signer = provider.getSigner();
      const address = await signer.getAddress();
      status('Wallet connected: ' + address.slice(0, 6) + '…' + address.slice(-4) + '. Requesting a free wallet signature…');
      activeButton.textContent = 'Sign secure login…';
      const challenge = await api('/api/auth/challenge', { address });
      const signature = await requestWalletSignature(signer, challenge.message);
      status('Signature received. Server is independently checking your FIT balance…');
      activeButton.textContent = 'Verifying on server…';
      const verified = await api('/api/auth/verify', { address, nonce: challenge.nonce, signature });

      sessionToken = verified.sessionToken;
      currentWallet = verified.wallet.toLowerCase();
      setFitCheck(true, ethers.utils.formatUnits(verified.fitBalanceWei, 18) + ' FIT · Verified by server');
      $('eligiblePanel').hidden = false;
      $('eligiblePanel').querySelector('strong').textContent = 'Server verification successful';
      $('eligiblePanel').querySelector('small').textContent = 'Your wallet passed the only entry requirement. No token transfer or transaction was requested.';
      $('roomsPanel').hidden = false;
      await loadStats();
      status('Access verified. You can now create or join a private room.');
      window.dispatchEvent(new CustomEvent('chess-arena:authenticated', { detail: { wallet: verified.wallet, expiresAt: verified.expiresAt } }));
    } catch (error) {
      console.error('[Chess Arena]', error);
      showDenied(error && error.message ? error.message : 'Wallet verification failed.');
    } finally {
      buttons.forEach(button => { button.disabled = false; });
      activeButton.textContent = originalLabel;
    }
  }

  async function createCpuGame() {
    if (!sessionToken) return;
    const button = $("createCpuBtn");
    button.disabled = true;
    $("roomStatus").textContent = "Starting your CPU match…";
    try {
      const result = await api("/api/rooms/cpu", {
        difficulty: $("cpuDifficulty").value,
        color: $("cpuColor").value
      }, sessionToken);
      await enterRoom(result.roomCode);
    } catch (error) {
      $("roomStatus").textContent = error.message;
    } finally {
      button.disabled = false;
    }
  }

  async function createRoom() {
    if (!sessionToken) return;
    $('createRoomBtn').disabled = true;
    $('roomStatus').textContent = 'Creating a private room…';
    try {
      const result = await api('/api/rooms/create', {}, sessionToken);
      await enterRoom(result.roomCode);
    } catch (error) {
      $('roomStatus').textContent = error.message;
    } finally {
      $('createRoomBtn').disabled = false;
    }
  }

  async function joinRoom() {
    if (!sessionToken) return;
    const code = $('roomCodeInput').value.trim().toUpperCase();
    $('joinRoomBtn').disabled = true;
    $('roomStatus').textContent = 'Joining room…';
    try {
      const result = await api('/api/rooms/join', { roomCode: code }, sessionToken);
      await enterRoom(result.room.roomCode || code);
    } catch (error) {
      $('roomStatus').textContent = error.message;
    } finally {
      $('joinRoomBtn').disabled = false;
    }
  }

  async function enterRoom(code) {
    activeRoomCode = code;
    $('activeRoomCode').textContent = code;
    $('roomStatus').textContent = 'Preparing secure real-time connection…';
    $('gamePanel').hidden = false;
    $('finalResultPanel').hidden = true;
    const ticket = await api('/api/rooms/' + code + '/ticket', {}, sessionToken);
    roomSocket = new WebSocket(ticket.socketUrl);
    roomSocket.addEventListener('open', () => {
      console.info('[Chess Arena WS] open', { roomCode: code });
      $('roomStatus').textContent = 'Real-time connection established. Loading game…';
      $('gameMessage').textContent = 'Connected. Waiting for the server game state…';
    });
    roomSocket.addEventListener('message', event => {
      let payload;
      try { payload = JSON.parse(event.data); } catch (error) {
        console.warn('[Chess Arena WS] received non-JSON message');
        return;
      }
      console.info('[Chess Arena WS] message', {
        type: payload.type || 'unknown',
        hasGame: Boolean(payload.game),
        mode: payload.game?.mode || null,
        status: payload.game?.status || null
      });
      if (payload.type === 'error') {
        $('gameMessage').textContent = payload.error || 'The game server reported an error.';
        return;
      }
      if (payload.game) renderGame(payload.game, payload.type);
    });
    roomSocket.addEventListener('close', event => {
      console.warn('[Chess Arena WS] closed', {
        code: event.code,
        reason: event.reason || '(no reason supplied)',
        wasClean: event.wasClean
      });
      $('roomStatus').textContent = 'Real-time connection closed (code ' + event.code + ').';
      $('gameMessage').textContent = 'Connection closed. Code: ' + event.code +
        '. Reason: ' + (event.reason || 'not supplied') +
        '. Clean close: ' + (event.wasClean ? 'yes' : 'no') + '.';
    });
    roomSocket.addEventListener('error', event => {
      console.error('[Chess Arena WS] error', event);
      $('gameMessage').textContent = 'Real-time connection error. See browser console for the WebSocket diagnostic details.';
    });
    $('gamePanel').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function pieceMap(fen) {
    const rows = fen.split(' ')[0].split('/');
    const map = {};
    rows.forEach((row, rowIndex) => {
      let fileIndex = 0;
      for (const char of row) {
        if (/^[1-8]$/.test(char)) fileIndex += Number(char);
        else {
          map['abcdefgh'[fileIndex] + (8 - rowIndex)] = char;
          fileIndex++;
        }
      }
    });
    return map;
  }
  function renderBoard() {
    if (!currentGame) return;
    const pieces = pieceMap(currentGame.fen);
    const files = myColor === 'b' ? 'hgfedcba' : 'abcdefgh';
    const ranks = myColor === 'b' ? [1,2,3,4,5,6,7,8] : [8,7,6,5,4,3,2,1];
    const glyphs = { K:'♔',Q:'♕',R:'♖',B:'♗',N:'♘',P:'♙',k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟' };
    const board = $('chessBoard');
    board.innerHTML = '';
    ranks.forEach(rank => files.split('').forEach((file, fileIndex) => {
      const square = file + rank;
      const piece = pieces[square] || '';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'square ' + ((fileIndex + rank) % 2 ? 'dark' : 'light') + (selectedSquare === square ? ' selected' : '');
      button.dataset.square = square;
      button.textContent = piece ? glyphs[piece] : '';
      button.setAttribute('aria-label', square + (piece ? ' ' + piece : ' empty'));
      board.appendChild(button);
    }));
  }
  function renderGame(game, eventType) {
    currentGame = game;
    myColor = currentWallet === (game.players.white || '').toLowerCase() ? 'w' :
      currentWallet === (game.players.black || '').toLowerCase() ? 'b' : null;
    $('activeRoomCode').textContent = game.roomCode || activeRoomCode;
    $('whitePlayer').textContent = game.players.white === 'cpu' ? 'CPU (' + (game.difficulty || 'medium') + ')' : game.players.white ? shortWallet(game.players.white) + (myColor === 'w' ? ' (YOU)' : '') : 'Waiting…';
    $('blackPlayer').textContent = game.players.black === 'cpu' ? 'CPU (' + (game.difficulty || 'medium') + ')' : game.players.black ? shortWallet(game.players.black) + (myColor === 'b' ? ' (YOU)' : '') : 'Waiting for opponent…';
    const cpuMatch = game.mode === 'cpu';
    $('offerDrawBtn').hidden = cpuMatch;
    $('activeRoomCode').textContent = cpuMatch ? 'CPU MATCH' : (game.roomCode || activeRoomCode);
    $('gameTypeLabel').textContent = cpuMatch ? 'SOLO MATCH · VS CPU' : 'PRIVATE MATCH';
    if (cpuMatch) $('roomStatus').textContent = 'Solo match connected. The CPU is ready to play.';
    $('copyRoomBtn').hidden = cpuMatch;
    $('gameStatus').textContent = game.status === 'waiting' ? 'Waiting for opponent to join…' :
      game.status === 'finished' ? finishText(game) :
      (game.turn === myColor ? 'Your turn' : 'Opponent’s turn');
    $('acceptDrawBtn').hidden = !game.drawOffer || game.drawOffer.toLowerCase() === currentWallet;
    $('declineDrawBtn').hidden = !game.drawOffer || game.drawOffer.toLowerCase() === currentWallet;
    $('offerDrawBtn').disabled = game.status !== 'active' || cpuMatch;
    $('resignBtn').disabled = game.status !== 'active';
    $('gameMessage').textContent = eventType === 'draw_offer' ? 'Your opponent offered a draw.' :
      eventType === 'draw_declined' ? 'Draw offer declined.' :
      eventType === 'finished' ? 'Game finished: ' + reasonLabel(game.reason) : '';
    if (game.status === 'finished') {
      renderFinalResult(game);
      const roomKey = game.roomCode || activeRoomCode;
      if (roomKey && lastStatsRoom !== roomKey) {
        lastStatsRoom = roomKey;
        loadStats();
      }
    }
    renderBoard();
    updateClocks();
    if (!clockTimer) clockTimer = setInterval(updateClocks, 1000);
  }
  function shortWallet(wallet) {
    return wallet ? wallet.slice(0,6) + '…' + wallet.slice(-4) : '—';
  }
  function reasonLabel(reason) {
    return ({
      checkmate: 'Checkmate',
      resignation: 'Opponent resigned',
      timeout: 'Time expired',
      agreement: 'Draw by agreement',
      stalemate: 'Stalemate',
      draw: 'Draw'
    })[reason] || reason || 'Game finished';
  }
  function renderFinalResult(game) {
    const whitePoints = game.result === 'draw' ? 1 : game.result === 'w' ? 3 : 0;
    const blackPoints = game.result === 'draw' ? 1 : game.result === 'b' ? 3 : 0;
    $('finalResultPanel').hidden = false;
    $('finalResultTitle').textContent = game.result === 'draw' ? 'Draw game' :
      game.result === myColor ? 'You won!' : 'You lost';
    $('finalResultReason').textContent = reasonLabel(game.reason);
    $('finalWhiteWallet').textContent = game.players.white === 'cpu' ? 'CPU' : game.players.white || '—';
    $('finalBlackWallet').textContent = game.players.black === 'cpu' ? 'CPU' : game.players.black || '—';
    $('finalWhitePoints').textContent = '+' + whitePoints + ' FIGS';
    $('finalBlackPoints').textContent = '+' + blackPoints + ' FIGS';
  }
  function finishText(game) {
    if (game.result === 'draw') return 'Draw · ' + reasonLabel(game.reason);
    const winner = game.result === 'w' ? 'White wins' : 'Black wins';
    return winner + ' · ' + reasonLabel(game.reason);
  }
  function updateClocks() {
    if (!currentGame) return;
    const remaining = { ...currentGame.remainingMs };
    if (currentGame.status === 'active' && currentGame.turnStartedAt) {
      const elapsed = Math.max(0, Date.now() - currentGame.serverTime);
      remaining[currentGame.turn] = Math.max(0, remaining[currentGame.turn] - elapsed);
    }
    $('whiteClock').textContent = formatClock(remaining.w);
    $('blackClock').textContent = formatClock(remaining.b);
  }
  function formatClock(ms) {
    const total = Math.ceil(Math.max(0, ms) / 1000);
    return Math.floor(total / 60) + ':' + String(total % 60).padStart(2, '0');
  }

  $('chessBoard').addEventListener('click', event => {
    const button = event.target.closest('button[data-square]');
    if (!button || !currentGame || currentGame.status !== 'active' || !roomSocket || roomSocket.readyState !== WebSocket.OPEN) return;
    if (currentGame.turn !== myColor) return;
    const square = button.dataset.square;
    const pieces = pieceMap(currentGame.fen);
    const piece = pieces[square];
    if (!selectedSquare) {
      if (piece && (myColor === 'w' ? piece === piece.toUpperCase() : piece === piece.toLowerCase())) {
        selectedSquare = square;
        renderBoard();
      }
      return;
    }
    if (piece && (myColor === 'w' ? piece === piece.toUpperCase() : piece === piece.toLowerCase())) {
      selectedSquare = square;
      renderBoard();
      return;
    }
    roomSocket.send(JSON.stringify({ type: 'move', from: selectedSquare, to: square, promotion: 'q' }));
    selectedSquare = null;
    renderBoard();
  });

  $('createRoomBtn').addEventListener('click', createRoom);
  $('createCpuBtn').addEventListener('click', createCpuGame);
  $('joinRoomBtn').addEventListener('click', joinRoom);
  $('roomCodeInput').addEventListener('input', () => {
    $('roomCodeInput').value = $('roomCodeInput').value.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, '').slice(0,6);
  });
  $('copyRoomBtn').addEventListener('click', async () => {
    if (!activeRoomCode) return;
    try {
      await navigator.clipboard.writeText(activeRoomCode);
      $('gameMessage').textContent = 'Room code copied.';
    } catch {
      $('gameMessage').textContent = 'Room code: ' + activeRoomCode;
    }
  });
  $('offerDrawBtn').addEventListener('click', () => roomSocket?.readyState === WebSocket.OPEN && roomSocket.send(JSON.stringify({ type: 'offer_draw' })));
  $('acceptDrawBtn').addEventListener('click', () => roomSocket?.readyState === WebSocket.OPEN && roomSocket.send(JSON.stringify({ type: 'accept_draw' })));
  $('declineDrawBtn').addEventListener('click', () => roomSocket?.readyState === WebSocket.OPEN && roomSocket.send(JSON.stringify({ type: 'decline_draw' })));
  $('resignBtn').addEventListener('click', () => {
    if (roomSocket?.readyState === WebSocket.OPEN && confirm('Are you sure you want to resign this game?')) roomSocket.send(JSON.stringify({ type: 'resign' }));
  });

  connectBrowserBtn.addEventListener('click', () => connectAndCheck('browser'));
  connectWalletBtn.addEventListener('click', () => connectAndCheck('wallet'));
  const walletChanged = () => {
    resetChecks();
    status('Wallet or network changed. Please verify again.');
  };
  if (window.ethereum && window.ethereum.on) {
    window.ethereum.on('accountsChanged', walletChanged);
    window.ethereum.on('chainChanged', walletChanged);
  }
  resetChecks();
})();