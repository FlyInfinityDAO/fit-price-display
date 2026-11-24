/* Fly Infinity Owner Profile — wallet-gated account and live BSC reads */
(() => {
  'use strict';

  const API = 'https://fly-infinity-social-api.flyinfinityplatform.workers.dev';
  const NETWORK = '0x7f1cB4fce7cB3b6C612c4A7Dd123D3865640dC1B';
  const ZERO = '0x0000000000000000000000000000000000000000';
  const TOKEN_KEY = 'fly_owner_profile_session';
  const NETWORK_ABI = [
    'function Owner_Exists(address owner) view returns (bool)',
    'function Owner_Left_Right_All(address owner) view returns (uint32,uint32)',
    'function Owner_Directs(address owner) view returns (address,address)',
    'function Fly_Infinity_Token_Contract() view returns (address)'
  ];
  const TOKEN_ABI = [
    'function Owner_Info_FIT(address user) view returns (uint256 purchased,uint256 allowedLimit,uint256 remaining)',
    'function balanceOf(address account) view returns (uint256)',
    'function Price() view returns (uint256)'
  ];
  const RPC_URLS = [
    'https://bsc-rpc.publicnode.com',
    'https://bsc-dataseed.binance.org/',
    'https://1rpc.io/bnb'
  ];
  const $ = id => document.getElementById(id);
  function shortAddress(address) {
    const value = String(address || '');
    return /^0x[0-9a-f]{40}$/i.test(value) ? value.slice(0, 3) + '...' + value.slice(-3) : value;
  }
  const tr = key => {
    const value = typeof window.t === 'function' ? window.t('ownerProfile.' + key) : key;
    return value === 'ownerProfile.' + key ? key : value;
  };
  const state = {
    token: sessionStorage.getItem(TOKEN_KEY) || '',
    profile: null,
    selectedWallet: '',
    provider: null,
    reader: null,
    history: [],
    snapshot: null,
    treeCache: new Map(),
    treeExpanded: new Set(),
    treeLoading: new Map(),
    treeErrors: new Map(),
    treeEpoch: 0,
    requestId: 0
  };

  async function api(path, body, token = state.token, method = body === undefined ? 'GET' : 'POST') {
    const headers = { 'Accept': 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = 'Bearer ' + token;
    const response = await fetch(API + path, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store'
    });
    let payload = {};
    try { payload = await response.json(); } catch {}
    if (!response.ok) throw new Error(payload.error || ('Request failed (' + response.status + ')'));
    return payload;
  }

  function setStatus(message, kind = '') {
    const node = $('opAuthStatus');
    if (!node) return;
    node.textContent = message || '';
    node.className = 'op-status' + (kind ? ' ' + kind : '');
  }

  function setBusy(buttons, busy) {
    buttons.forEach(id => { const node = $(id); if (node) node.disabled = busy; });
  }

  function showAuthView() {
    $('opAuthPanel').classList.remove('op-hidden');
    $('opProfilePanel').classList.add('op-hidden');
    $('opRecoveryPanel').classList.add('op-hidden');
  }

  function showProfileView() {
    $('opAuthPanel').classList.add('op-hidden');
    $('opRecoveryPanel').classList.add('op-hidden');
    $('opProfilePanel').classList.remove('op-hidden');
    renderProfile();
  }

  function showRecoveryView() {
    $('opAuthPanel').classList.add('op-hidden');
    $('opProfilePanel').classList.add('op-hidden');
    $('opRecoveryPanel').classList.remove('op-hidden');
    setStatus('');
    $('opRecoveryStatus').textContent = '';
  }

  function setTab(tab) {
    const register = tab === 'register';
    $('opTabRegister').classList.toggle('active', register);
    $('opTabLogin').classList.toggle('active', !register);
    $('opRegisterForm').classList.toggle('op-hidden', !register);
    $('opLoginForm').classList.toggle('op-hidden', register);
    $('opTabRegister').setAttribute('aria-selected', String(register));
    $('opTabLogin').setAttribute('aria-selected', String(!register));
    setStatus('');
  }

  function normalizeProviderAccount(address) {
    if (!window.ethers || !ethers.utils.isAddress(address)) throw new Error(tr('walletInvalid'));
    return ethers.utils.getAddress(address);
  }

  async function ensureWalletSelector() {
    if (typeof window.fiSelectWalletProvider === 'function') return;
    await new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-op-wallet-selector]');
      if (existing) {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', () => reject(new Error(tr('walletUnavailable'))), { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = 'walletconnect-bridge.js?v=20261104-android-pairing';
      script.async = true;
      script.dataset.opWalletSelector = '1';
      script.onload = () => typeof window.fiSelectWalletProvider === 'function'
        ? resolve() : reject(new Error(tr('walletUnavailable')));
      script.onerror = () => reject(new Error(tr('walletUnavailable')));
      document.head.appendChild(script);
    });
  }

  async function connectProvider(mode) {
    let provider;
    if (mode === 'browser') {
      const root = window.ethereum;
      const list = root && Array.isArray(root.providers) ? root.providers : (root ? [root] : []);
      provider = list.find(item => item && item.isTokenPocket)
        || list.find(item => item && item.isTrust)
        || list.find(item => item && typeof item.request === 'function');
      if (!provider) throw new Error(tr('walletUnavailable'));
      await provider.request({ method: 'eth_requestAccounts' });
    } else {
      await ensureWalletSelector();
      provider = await window.fiSelectWalletProvider();
    }
    if (!provider || typeof provider.request !== 'function') throw new Error(tr('walletUnavailable'));
    const accounts = await provider.request({ method: 'eth_accounts' });
    if (!Array.isArray(accounts) || !accounts[0]) throw new Error(tr('walletNoAccount'));
    state.provider = provider;
    return normalizeProviderAccount(accounts[0]);
  }

  async function obtainWalletProof(mode, statusTarget) {
    const address = await connectProvider(mode);
    const challenge = await api('/api/owner-profile/auth/challenge', { address }, '');
    if (statusTarget) statusTarget.textContent = tr('signing');
    const web3 = new ethers.providers.Web3Provider(state.provider, 'any');
    const signature = await web3.getSigner(address).signMessage(challenge.message);
    const verified = await api('/api/owner-profile/auth/verify', {
      address, nonce: challenge.nonce, signature
    }, '');
    return { address, proofToken: verified.proofToken };
  }

  function saveSession(payload) {
    state.token = payload.token;
    sessionStorage.setItem(TOKEN_KEY, state.token);
    state.profile = payload.profile;
    state.selectedWallet = payload.profile.primaryWallet;
    clearTree();
    showProfileView();
    selectWallet(state.selectedWallet);
  }

  function clearSession() {
    state.token = '';
    state.profile = null;
    state.selectedWallet = '';
    sessionStorage.removeItem(TOKEN_KEY);
    clearTree();
    state.snapshot = null;
    showAuthView();
  }

  async function register(mode) {
    const username = $('opRegisterUsername').value.trim();
    const password = $('opRegisterPassword').value;
    const confirm = $('opRegisterConfirm').value;
    if (password !== confirm) {
      setStatus(tr('passwordMismatch'), 'error');
      return;
    }
    if (username.length < 3 || username.length > 24 || !/^[a-zA-Z0-9_]+$/.test(username)) {
      setStatus(tr('usernameRules'), 'error');
      return;
    }
    if (password.length < 8 || password.length > 128) {
      setStatus(tr('passwordRules'), 'error');
      return;
    }
    setBusy(['opRegisterBrowser','opRegisterReown'], true);
    try {
      setStatus(tr('connectWallet'));
      const proof = await obtainWalletProof(mode, $('opAuthStatus'));
      setStatus(tr('creating'));
      const payload = await api('/api/owner-profile/register', {
        username, password, proofToken: proof.proofToken
      }, '');
      saveSession(payload);
      $('opRegisterPassword').value = '';
      $('opRegisterConfirm').value = '';
      setStatus(tr('created'), 'success');
    } catch (error) {
      setStatus(error.message || tr('genericError'), 'error');
    } finally {
      setBusy(['opRegisterBrowser','opRegisterReown'], false);
    }
  }

  async function login() {
    setBusy(['opLoginButton'], true);
    try {
      const payload = await api('/api/owner-profile/login', {
        username: $('opLoginUsername').value.trim(),
        password: $('opLoginPassword').value
      }, '');
      saveSession(payload);
      $('opLoginPassword').value = '';
    } catch (error) {
      setStatus(error.message || tr('genericError'), 'error');
    } finally {
      setBusy(['opLoginButton'], false);
    }
  }

  async function addWallet(mode) {
    setBusy(['opAddWalletBrowser','opAddWalletReown'], true);
    try {
      setProfileStatus(tr('connectWallet'));
      const proof = await obtainWalletProof(mode, $('opProfileStatus'));
      const payload = await api('/api/owner-profile/wallets', { proofToken: proof.proofToken });
      state.profile = payload.profile;
      setProfileStatus(tr('walletAdded'), 'success');
      renderProfile();
      selectWallet(proof.address);
    } catch (error) {
      setProfileStatus(error.message || tr('genericError'), 'error');
    } finally {
      setBusy(['opAddWalletBrowser','opAddWalletReown'], false);
    }
  }

  async function recoverPassword(mode) {
    const password = $('opRecoveryPassword').value;
    const confirm = $('opRecoveryConfirm').value;
    if (password !== confirm) {
      $('opRecoveryStatus').textContent = tr('passwordMismatch');
      return;
    }
    if (password.length < 8 || password.length > 128) {
      $('opRecoveryStatus').textContent = tr('passwordRules');
      return;
    }
    setBusy(['opRecoveryBrowser','opRecoveryReown'], true);
    try {
      $('opRecoveryStatus').textContent = tr('connectWallet');
      const proof = await obtainWalletProof(mode, $('opRecoveryStatus'));
      const payload = await api('/api/owner-profile/password/recover', {
        password, proofToken: proof.proofToken
      }, '');
      $('opRecoveryPassword').value = '';
      $('opRecoveryConfirm').value = '';
      saveSession(payload);
      $('opRecoveryStatus').textContent = tr('passwordRecovered');
    } catch (error) {
      $('opRecoveryStatus').textContent = error.message || tr('genericError');
    } finally {
      setBusy(['opRecoveryBrowser','opRecoveryReown'], false);
    }
  }

  async function removeWallet(address) {
    const message = tr('removeConfirm');
    if (!window.confirm(message)) return;
    try {
      const result = await api('/api/owner-profile/wallets/' + encodeURIComponent(address), undefined, state.token, 'DELETE');
      state.profile = result.profile;
      if (state.selectedWallet.toLowerCase() === address.toLowerCase()) {
        state.selectedWallet = state.profile.primaryWallet;
        clearTree();
      }
      renderProfile();
      selectWallet(state.selectedWallet);
      setProfileStatus(tr('walletRemoved'), 'success');
    } catch (error) {
      setProfileStatus(error.message || tr('genericError'), 'error');
    }
  }

  async function logout() {
    try { await api('/api/owner-profile/logout', {}, state.token, 'POST'); } catch {}
    clearSession();
    setStatus(tr('loggedOut'), 'success');
  }

  function setProfileStatus(message, kind = '') {
    const node = $('opProfileStatus');
    if (!node) return;
    node.textContent = message || '';
    node.className = 'op-status' + (kind ? ' ' + kind : '');
  }

  function renderProfile() {
    if (!state.profile) return;
    $('opProfileUsername').textContent = '@' + state.profile.username;
    const list = $('opWalletList');
    list.replaceChildren();
    state.profile.wallets.forEach(wallet => {
      const item = document.createElement('div');
      item.className = 'op-wallet-item' + (state.selectedWallet.toLowerCase() === wallet.address.toLowerCase() ? ' active' : '');
      const select = document.createElement('button');
      select.type = 'button';
      select.className = 'op-wallet-select';
      select.addEventListener('click', () => selectWallet(wallet.address));
      const address = document.createElement('strong');
      address.textContent = shortAddress(wallet.address);
      address.title = wallet.address;
      address.setAttribute('aria-label', wallet.address);
      const role = document.createElement('small');
      role.textContent = wallet.isPrimary ? tr('primaryWallet') : tr('linkedWallet');
      select.append(address, role);
      const tools = document.createElement('div');
      tools.className = 'op-wallet-tools';
      const copy = document.createElement('button');
      copy.type = 'button';
      copy.className = 'op-icon-btn';
      copy.title = tr('copyAddress');
      copy.setAttribute('aria-label', tr('copyAddress'));
      copy.innerHTML = '<i class="fa-regular fa-copy" aria-hidden="true"></i>';
      copy.addEventListener('click', () => copyAddress(wallet.address));
      tools.appendChild(copy);
      if (!wallet.isPrimary) {
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'op-icon-btn danger';
        remove.title = tr('removeWallet');
        remove.setAttribute('aria-label', tr('removeWallet'));
        remove.innerHTML = '<i class="fa-solid fa-trash-can" aria-hidden="true"></i>';
        remove.addEventListener('click', () => removeWallet(wallet.address));
        tools.appendChild(remove);
      }
      item.append(select, tools);
      list.appendChild(item);
    });
    $('opAddWalletControls').classList.toggle('op-hidden', state.profile.wallets.length >= 20);
  }

  async function copyAddress(address) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(address);
      } else {
        const input = document.createElement('textarea');
        input.value = address;
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.select();
        const copied = document.execCommand('copy');
        input.remove();
        if (!copied) throw new Error('copy failed');
      }
      setProfileStatus(tr('copied'), 'success');
    } catch {
      setProfileStatus(tr('copyFailed'), 'error');
    }
  }

  function providerForRead(url) {
    return new ethers.providers.JsonRpcProvider(url, { name: 'bnb', chainId: 56 });
  }

  async function withReadProvider(fn) {
    let lastError;
    for (const url of RPC_URLS) {
      const reader = providerForRead(url);
      try {
        return await fn(reader);
      } catch (error) {
        lastError = error;
      } finally {
        try { reader.destroy(); } catch {}
      }
    }
    throw lastError || new Error(tr('readFailed'));
  }

  function displayUnits(value, decimals = 4) {
    const amount = Number(ethers.utils.formatUnits(value, 18));
    return Number.isFinite(amount) ? amount.toLocaleString('en-US', { maximumFractionDigits: decimals }) : '—';
  }

  function usd(value, decimals = 2) {
    const amount = Number(value);
    return Number.isFinite(amount) ? '$' + amount.toLocaleString('en-US', {
      minimumFractionDigits: 2, maximumFractionDigits: decimals
    }) : '—';
  }

  function setMetric(id, value, className = '') {
    const node = $(id);
    if (!node) return;
    node.textContent = value;
    node.className = 'op-metric-value' + (className ? ' ' + className : '');
  }

  function shiftDate(date, period) {
    const target = new Date(date.getTime());
    if (period === 'day1') target.setUTCDate(target.getUTCDate() - 1);
    if (period === 'day7') target.setUTCDate(target.getUTCDate() - 7);
    if (period === 'day30') target.setUTCDate(target.getUTCDate() - 30);
    if (period === 'month3') target.setUTCMonth(target.getUTCMonth() - 3);
    if (period === 'month6') target.setUTCMonth(target.getUTCMonth() - 6);
    if (period === 'year1') target.setUTCFullYear(target.getUTCFullYear() - 1);
    return target.toISOString().slice(0, 10);
  }

  function historicalPrice(period) {
    if (!state.history.length) return null;
    const target = shiftDate(new Date(), period);
    let found = null;
    for (const row of state.history) {
      if (row.date <= target) found = row;
      else break;
    }
    return found ? Number(found.price) : null;
  }

  async function loadPriceHistory() {
    const response = await fetch('price-history.json?v=' + Date.now(), { cache: 'no-store' });
    if (!response.ok) throw new Error('Price history HTTP ' + response.status);
    const payload = await response.json();
    const records = Array.isArray(payload) ? payload : payload.records;
    if (!Array.isArray(records)) throw new Error('Invalid FIT price history');
    state.history = records.filter(row =>
      row && /^\d{4}-\d{2}-\d{2}$/.test(row.date) &&
      Number.isFinite(Number(row.price)) && Number(row.price) > 0
    ).sort((a, b) => a.date.localeCompare(b.date));
  }

  function renderProfit(balance, currentPrice) {
    const periods = ['day1','day7','day30','month3','month6','year1'];
    periods.forEach(period => {
      const price = historicalPrice(period);
      const target = $('opProfit' + period);
      if (!target) return;
      if (price === null) {
        target.textContent = tr('historyUnavailable');
        target.className = 'op-profit-value';
        return;
      }
      const difference = balance * (currentPrice - price);
      const sign = difference > 0 ? '+' : difference < 0 ? '−' : '';
      target.textContent = sign + usd(Math.abs(difference), 4);
      target.className = 'op-profit-value ' + (difference > 0 ? 'positive' : difference < 0 ? 'negative' : '');
    });
  }

  async function selectWallet(address) {
    if (!state.profile || !address) return;
    state.selectedWallet = address;
    state.requestId += 1;
    const requestId = state.requestId;
    clearTree();
    renderProfile();
    $('opWalletContent').classList.remove('op-hidden');
    $('opSelectedAddress').textContent = shortAddress(address);
    $('opSelectedAddress').title = address;
    $('opSelectedAddress').setAttribute('aria-label', address);
    setProfileStatus(tr('loadingWallet'));
    ['opPurchased','opLimit','opRemaining','opBalance','opPrice','opValue','opLeft','opRight'].forEach(id => setMetric(id, tr('loading')));
    $('opTreeRoot').textContent = tr('loading');
    try {
      const result = await withReadProvider(async reader => {
        const network = new ethers.Contract(ethers.utils.getAddress(NETWORK.toLowerCase()), NETWORK_ABI, reader);
        const isOwner = await network.Owner_Exists(address);
        if (!isOwner) throw new Error(tr('notOwner'));
        const tokenAddress = await network.Fly_Infinity_Token_Contract();
        const token = new ethers.Contract(tokenAddress, TOKEN_ABI, reader);
        const results = await Promise.all([
          token.Owner_Info_FIT(address),
          token.balanceOf(address),
          token.Price(),
          network.Owner_Left_Right_All(address),
          network.Owner_Directs(address)
        ]);
        return { tokenAddress, ownerInfo: results[0], balanceRaw: results[1], priceRaw: results[2], totals: results[3], directs: results[4] };
      });
      if (requestId !== state.requestId) return;
      const balance = Number(ethers.utils.formatUnits(result.balanceRaw, 18));
      const price = Number(ethers.utils.formatUnits(result.priceRaw, 18));
      const value = balance * price;
      const bought = Number(ethers.utils.formatUnits(result.ownerInfo.purchased, 18));
      const limit = Number(ethers.utils.formatUnits(result.ownerInfo.allowedLimit, 18));
      const remaining = Number(ethers.utils.formatUnits(result.ownerInfo.remaining, 18));
      setMetric('opPurchased', usd(bought, 4), 'gold');
      setMetric('opLimit', usd(limit, 4), 'gold');
      setMetric('opRemaining', usd(remaining, 4), 'gold');
      setMetric('opBalance', displayUnits(result.balanceRaw, 6) + ' FIT', 'gold');
      setMetric('opPrice', usd(price, 6), 'gold');
      setMetric('opValue', usd(value, 4), 'gold');
      setMetric('opLeft', Number(result.totals[0]).toLocaleString('en-US'), 'green');
      setMetric('opRight', Number(result.totals[1]).toLocaleString('en-US'), 'green');
      try {
        await loadPriceHistory();
        renderProfit(balance, price);
      } catch (error) {
        console.warn('Owner Profile FIT price history unavailable:', error);
        ['day1','day7','day30','month3','month6','year1'].forEach(period => {
          $('opProfit' + period).textContent = tr('historyUnavailable');
        });
      }
      state.snapshot = { address, balance, price, value, totals: result.totals };
      state.treeCache.set(address.toLowerCase(), [result.directs[0], result.directs[1]]);
      renderTree();
      setProfileStatus(tr('walletLoaded'), 'success');
    } catch (error) {
      if (requestId !== state.requestId) return;
      setProfileStatus(error.message || tr('readFailed'), 'error');
      $('opTreeRoot').textContent = error.message || tr('readFailed');
    }
  }

  function clearTree() {
    state.treeEpoch += 1;
    state.treeCache.clear();
    state.treeExpanded.clear();
    state.treeLoading.clear();
    state.treeErrors.clear();
    state.treeCache.delete('');
  }

  async function readDirects(address) {
    const key = address.toLowerCase();
    if (state.treeCache.has(key)) return state.treeCache.get(key);
    if (state.treeLoading.has(key)) return state.treeLoading.get(key);
    const epoch = state.treeEpoch;
    const promise = withReadProvider(async reader => {
      const network = new ethers.Contract(ethers.utils.getAddress(NETWORK.toLowerCase()), NETWORK_ABI, reader);
      const directs = await network.Owner_Directs(address);
      return [directs[0], directs[1]];
    }).then(pair => {
      if (epoch === state.treeEpoch) state.treeCache.set(key, pair);
      return pair;
    }).catch(error => {
      if (epoch === state.treeEpoch) state.treeErrors.set(key, error.message || tr('readFailed'));
      throw error;
    }).finally(() => {
      state.treeLoading.delete(key);
      if (epoch === state.treeEpoch) renderTree();
    });
    state.treeLoading.set(key, promise);
    renderTree();
    return promise;
  }

  function makeTreeNode(address, side, ancestors, depth, counter) {
    counter.count += 1;
    const card = document.createElement('div');
    const zero = address.toLowerCase() === ZERO.toLowerCase();
    card.className = 'op-tree-node' + (zero ? ' zero' : '');

    const head = document.createElement('div');
    head.className = 'op-tree-node-head';
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'op-tree-toggle';
    toggle.textContent = zero ? '·' : (state.treeExpanded.has(address.toLowerCase()) ? '−' : '+');
    toggle.disabled = zero || depth >= 40 || counter.count >= 500;
    toggle.setAttribute('aria-label', state.treeExpanded.has(address.toLowerCase()) ? tr('collapseBranch') : tr('expandBranch'));
    const value = document.createElement('div');
    value.className = 'op-tree-address';
    value.textContent = shortAddress(address);
    value.title = address;
    value.setAttribute('aria-label', address);
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'op-tree-copy';
    copy.title = tr('copyAddress');
    copy.setAttribute('aria-label', tr('copyAddress'));
    copy.innerHTML = '<i class="fa-regular fa-copy" aria-hidden="true"></i>';
    copy.addEventListener('click', () => copyAddress(address));
    head.append(toggle, value, copy);
    card.appendChild(head);

    const label = document.createElement('div');
    label.className = 'op-tree-label';
    label.textContent = zero ? tr('emptyAddress') : (side === 'left' ? tr('leftBranch') : tr('rightBranch'));
    card.appendChild(label);

    if (!zero) {
      toggle.addEventListener('click', async () => {
        const key = address.toLowerCase();
        if (state.treeExpanded.has(key)) {
          state.treeExpanded.delete(key);
          renderTree();
          return;
        }
        if (depth >= 40) return;
        state.treeExpanded.add(key);
        renderTree();
        try { await readDirects(address); }
        catch (error) {
          state.treeErrors.set(key, error.message || tr('readFailed'));
          renderTree();
        }
      });

      if (state.treeExpanded.has(address.toLowerCase())) {
        const key = address.toLowerCase();
        const branch = document.createElement('div');
        branch.className = 'op-tree-branch';
        if (ancestors.has(key)) {
          branch.textContent = tr('cycleDetected');
        } else if (state.treeLoading.has(key)) {
          branch.className += ' op-tree-loading';
          branch.textContent = tr('loading');
        } else if (state.treeErrors.has(key)) {
          branch.className += ' op-tree-loading';
          branch.textContent = state.treeErrors.get(key);
          const retry = document.createElement('button');
          retry.type = 'button';
          retry.className = 'op-btn subtle';
          retry.textContent = tr('retry');
          retry.addEventListener('click', () => {
            state.treeErrors.delete(key);
            readDirects(address).catch(() => {});
          });
          branch.appendChild(retry);
        } else if (state.treeCache.has(key)) {
          const nextAncestors = new Set(ancestors);
          nextAncestors.add(key);
          branch.appendChild(makeChildren(state.treeCache.get(key), nextAncestors, depth + 1, counter));
        }
        card.appendChild(branch);
      }
    }
    if (counter.count >= 500) {
      const cap = document.createElement('div');
      cap.className = 'op-tree-loading';
      cap.textContent = tr('treeLimit');
      card.appendChild(cap);
    }
    return card;
  }

  function makeChildren(pair, ancestors, depth, counter) {
    const children = document.createElement('div');
    children.className = 'op-tree-children';
    ['left','right'].forEach((side, index) => {
      const column = document.createElement('div');
      column.className = 'op-tree-side ' + side;
      const tag = document.createElement('div');
      tag.className = 'op-tree-side-label';
      tag.textContent = side === 'left' ? tr('leftBranch') : tr('rightBranch');
      column.appendChild(tag);
      const child = pair[index] || ZERO;
      const childKey = child.toLowerCase();
      if (ancestors.has(childKey) && childKey !== ZERO.toLowerCase()) {
        const repeated = document.createElement('div');
        repeated.className = 'op-tree-node zero';
        repeated.textContent = shortAddress(child) + ' · ' + tr('cycleDetected');
        repeated.title = child;
        column.appendChild(repeated);
      } else if (counter.count < 500) {
        column.appendChild(makeTreeNode(child, side, ancestors, depth, counter));
      } else {
        const cap = document.createElement('div');
        cap.className = 'op-tree-node zero';
        cap.textContent = tr('treeLimit');
        column.appendChild(cap);
      }
      children.appendChild(column);
    });
    return children;
  }

  function renderTree() {
    const root = $('opTreeRoot');
    if (!root) return;
    root.replaceChildren();
    if (!state.selectedWallet || !state.treeCache.has(state.selectedWallet.toLowerCase())) {
      root.textContent = tr('treeWaiting');
      return;
    }
    const rootNode = document.createElement('div');
    rootNode.className = 'op-tree-root';
    const label = document.createElement('div');
    label.className = 'op-tree-root-label';
    label.textContent = shortAddress(state.selectedWallet);
    label.title = state.selectedWallet;
    label.setAttribute('aria-label', state.selectedWallet);
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'op-icon-btn';
    copy.title = tr('copyAddress');
    copy.innerHTML = '<i class="fa-regular fa-copy" aria-hidden="true"></i>';
    copy.addEventListener('click', () => copyAddress(state.selectedWallet));
    label.appendChild(copy);
    const counter = { count: 0 };
    const pair = state.treeCache.get(state.selectedWallet.toLowerCase());
    const emptyOrChildren = makeChildren(pair, new Set([state.selectedWallet.toLowerCase()]), 1, counter);
    rootNode.append(label, emptyOrChildren);
    root.appendChild(rootNode);
  }

  function resetWalletData() {
    state.requestId += 1;
    state.snapshot = null;
    state.history = [];
    clearTree();
    $('opWalletContent').classList.add('op-hidden');
  }

  async function restoreSession() {
    if (!state.token) return showAuthView();
    try {
      const result = await api('/api/owner-profile/me', undefined, state.token);
      state.profile = result.profile;
      state.selectedWallet = result.profile.primaryWallet;
      showProfileView();
      await selectWallet(state.selectedWallet);
    } catch (error) {
      clearSession();
      setStatus(error.message || tr('sessionExpired'), 'error');
    }
  }

  function bindNavigation() {
    const open = () => { $('opSidebar').classList.add('active'); $('opSidebarOverlay').classList.add('active'); };
    const close = () => { $('opSidebar').classList.remove('active'); $('opSidebarOverlay').classList.remove('active'); };
    $('opHamburger').addEventListener('click', open);
    $('opSidebarClose').addEventListener('click', close);
    $('opSidebarOverlay').addEventListener('click', close);
    document.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
  }

  function init() {
    $('opTabRegister').addEventListener('click', () => setTab('register'));
    $('opTabLogin').addEventListener('click', () => setTab('login'));
    $('opRegisterBrowser').addEventListener('click', () => register('browser'));
    $('opRegisterReown').addEventListener('click', () => register('reown'));
    $('opLoginButton').addEventListener('click', login);
    $('opLoginPassword').addEventListener('keydown', event => { if (event.key === 'Enter') login(); });
    $('opForgotPassword').addEventListener('click', showRecoveryView);
    $('opRecoveryBack').addEventListener('click', showAuthView);
    $('opRecoveryBrowser').addEventListener('click', () => recoverPassword('browser'));
    $('opRecoveryReown').addEventListener('click', () => recoverPassword('reown'));
    $('opAddWalletBrowser').addEventListener('click', () => addWallet('browser'));
    $('opAddWalletReown').addEventListener('click', () => addWallet('reown'));
    $('opLogout').addEventListener('click', logout);
    $('opRefresh').addEventListener('click', () => selectWallet(state.selectedWallet));
    $('opTreeRefresh').addEventListener('click', async () => {
      if (!state.selectedWallet) return;
      clearTree();
      $('opTreeRoot').textContent = tr('loading');
      try {
        const pair = await withReadProvider(async reader => {
          const network = new ethers.Contract(ethers.utils.getAddress(NETWORK.toLowerCase()), NETWORK_ABI, reader);
          return network.Owner_Directs(state.selectedWallet);
        });
        state.treeCache.set(state.selectedWallet.toLowerCase(), [pair[0], pair[1]]);
        renderTree();
      } catch (error) {
        $('opTreeRoot').textContent = error.message || tr('readFailed');
      }
    });
    bindNavigation();
    document.addEventListener('fi-language-updated', () => {
      renderProfile();
      if (state.snapshot) {
        const s = state.snapshot;
        renderProfit(s.balance, s.price);
      }
      renderTree();
    });
    restoreSession();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
