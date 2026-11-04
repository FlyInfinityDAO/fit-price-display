(function () {
  'use strict';

  const FIT_ADDRESS = '0xBebe4ea7aA4037CeF5D0bc25a10f9dcA16120Dfa';
  const BSC_CHAIN_ID = 56;
  const MIN_FIT = ethers.utils.parseUnits('1', 18);
  const FIT_ABI = ['function balanceOf(address account) view returns (uint256)'];
  const API_BASE = (window.CHESS_ARENA_API_URL || 'https://fly-chess-arena-api.flyinfinityplatform.workers.dev').replace(/\/$/, '');

  const $ = id => document.getElementById(id);
  const connectBtn = $('connectBtn');
  let activeProvider;
  let sessionToken = null;

  function status(message, isError) {
    $('status').textContent = message;
    $('status').style.color = isError ? '#ff9999' : '';
  }
  function setFitCheck(ok, detail) {
    $('fitStatus').textContent = detail;
    $('fitMark').textContent = ok ? '✓' : '✕';
    $('fitMark').style.color = ok ? '#00c896' : '#ff7777';
  }
  function resetChecks() {
    sessionToken = null;
    setFitCheck(false, 'At least 1 FIT required');
    $('eligiblePanel').hidden = true;
    $('deniedPanel').hidden = true;
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
    if (!response.ok || data.ok !== true) {
      throw new Error(data.error || 'Chess Arena API request failed (' + response.status + ').');
    }
    return data;
  }

  async function getWalletProvider() {
    if (typeof window.fiSelectWalletProvider === 'function') {
      return await window.fiSelectWalletProvider();
    }
    if (window.ethereum) {
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      return window.ethereum;
    }
    throw new Error('No compatible wallet found. Please open the page in a wallet browser or install a wallet.');
  }

  async function connectAndCheck() {
    connectBtn.disabled = true;
    connectBtn.textContent = 'Checking FIT balance…';
    resetChecks();
    try {
      activeProvider = await getWalletProvider();
      const provider = new ethers.providers.Web3Provider(activeProvider, 'any');
      const network = await provider.getNetwork();
      if (network.chainId !== BSC_CHAIN_ID) {
        try {
          await activeProvider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x38' }] });
        } catch (switchError) {
          if (switchError.code === 4902) throw new Error('Please add BNB Smart Chain to your wallet, then try again.');
          throw new Error('Switch your wallet to BNB Smart Chain (chain ID 56) to check your FIT balance.');
        }
      }

      const signer = provider.getSigner();
      const address = await signer.getAddress();
      const readProvider = new ethers.providers.JsonRpcProvider('https://bsc-dataseed.binance.org/');
      const fitContract = new ethers.Contract(FIT_ADDRESS, FIT_ABI, readProvider);

      status('Wallet connected: ' + address.slice(0, 6) + '…' + address.slice(-4) + '. Checking FIT balance…');
      const balance = await fitContract.balanceOf(address);
      const formatted = ethers.utils.formatUnits(balance, 18);
      const eligible = balance.gte(MIN_FIT);
      setFitCheck(eligible, formatted + ' FIT · Minimum required: 1 FIT');

      if (!eligible) {
        showDenied('Access denied: this wallet must hold at least 1 FIT.');
        return;
      }

      status('FIT balance is sufficient. Requesting a secure wallet signature…');
      connectBtn.textContent = 'Sign secure login…';
      const challenge = await api('/api/auth/challenge', { address });
      const signature = await signer.signMessage(challenge.message);

      status('Signature received. Server is independently checking your FIT balance…');
      connectBtn.textContent = 'Verifying on server…';
      const verified = await api('/api/auth/verify', {
        address,
        nonce: challenge.nonce,
        signature
      });

      sessionToken = verified.sessionToken;
      setFitCheck(true, ethers.utils.formatUnits(verified.fitBalanceWei, 18) + ' FIT · Verified by Chess Arena server');
      $('eligiblePanel').hidden = false;
      $('eligiblePanel').querySelector('strong').textContent = 'Server verification successful';
      $('eligiblePanel').querySelector('small').textContent = 'Your wallet passed the only entry requirement. Secure session expires in 30 minutes.';
      status('Access requirement verified by the Chess Arena server.');
      window.dispatchEvent(new CustomEvent('chess-arena:authenticated', {
        detail: { wallet: verified.wallet, expiresAt: verified.expiresAt }
      }));
    } catch (error) {
      console.error('[Chess Arena]', error);
      showDenied(error && error.message ? error.message : 'Wallet verification failed.');
    } finally {
      connectBtn.disabled = false;
      connectBtn.textContent = 'Reconnect / Check Again';
    }
  }

  connectBtn.addEventListener('click', connectAndCheck);
  if (window.ethereum && window.ethereum.on) {
    window.ethereum.on('accountsChanged', () => {
      resetChecks();
      status('Wallet changed. Please verify again.');
    });
    window.ethereum.on('chainChanged', () => {
      resetChecks();
      status('Network changed. Please verify again.');
    });
  }
  resetChecks();
})();