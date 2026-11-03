/* Fly Infinity — wallet selection and Reown WalletConnect bridge.
   Supports EIP-6963 injected wallets and WalletConnect on desktop and mobile. */
(function () {
  'use strict';

  const PROJECT_ID = '2e312445cba4a41a1aab5f01552c5668';
  const BSC_CHAIN_ID = 56;
  let wcProvider = null;
  let initPromise = null;
  let connectPromise = null;
  let selectedInjectedProvider = null;
  const announcedProviders = new Map();
  // Keep the browser's original multi-wallet root separate from the active selection.
  const injectedRootProvider = window.ethereum;

  function isMobileBrowser() {
    return /Android|iPhone|iPad|iPod|Mobile/i.test(
      (navigator && navigator.userAgent) || ''
    );
  }

  function resetInjectedSelection() {
    selectedInjectedProvider = null;
    if (injectedRootProvider) window.ethereum = injectedRootProvider;
    else {
      try { delete window.ethereum; } catch (_) { window.ethereum = undefined; }
    }
  }

  // EIP-6963 announcements let users choose between multiple browser extensions.
  window.addEventListener('eip6963:announceProvider', function (event) {
    const detail = event && event.detail;
    if (detail && detail.provider && detail.info) {
      const key = detail.info.uuid || detail.info.rdns || detail.info.name;
      if (key) announcedProviders.set(key, detail);
    }
  });
  try { window.dispatchEvent(new Event('eip6963:requestProvider')); } catch (_) {}

  function getInjectedWallets() {
    const found = [];
    function add(provider, info) {
      if (!provider || typeof provider.request !== 'function') return;
      if (found.some(item => item.provider === provider)) return;
      found.push({
        provider: provider,
        name: (info && info.name) || provider.name || 'Browser wallet'
      });
    }
    announcedProviders.forEach(detail => add(detail.provider, detail.info));
    const ethereum = injectedRootProvider;
    if (ethereum && Array.isArray(ethereum.providers)) {
      ethereum.providers.forEach(provider => add(provider, provider.providerInfo || provider));
    }
    add(ethereum, ethereum && (ethereum.providerInfo || ethereum));
    return found;
  }

  async function selectWalletProvider() {
    // On phones, always use Reown's own wallet explorer. Do not replace its
    // mobile handoff with injected-provider discovery or a delayed prompt.
    if (isMobileBrowser()) {
      selectedInjectedProvider = null;
      return connectWithWalletConnect();
    }

    // Allow EIP-6963 wallet extensions a short time to announce themselves.
    try { window.dispatchEvent(new Event('eip6963:requestProvider')); } catch (_) {}
    await new Promise(resolve => setTimeout(resolve, 350));
    const injected = getInjectedWallets();
    if (!injected.length) {
      selectedInjectedProvider = null;
      window.ethereum = await connectWithWalletConnect();
      return window.ethereum;
    }

    const choices = injected.map(item => item.name);
    choices.push('WalletConnect (Trust Wallet / TokenPocket / SafePal / QR)');
    let selected = 0;
    if (choices.length > 1) {
      const menu = choices.map((name, index) => (index + 1) + '. ' + name).join('\n');
      const answer = window.prompt('Choose a wallet to connect:\n\n' + menu + '\n\nEnter the number:');
      if (answer === null) throw new Error('Wallet selection cancelled.');
      selected = Number.parseInt(answer, 10) - 1;
      if (!Number.isInteger(selected) || selected < 0 || selected >= choices.length) {
        throw new Error('Invalid wallet selection. Please try again.');
      }
    }

    if (selected === injected.length) {
      selectedInjectedProvider = null;
      window.ethereum = await connectWithWalletConnect();
      return window.ethereum;
    }
    selectedInjectedProvider = injected[selected].provider;
    window.ethereum = selectedInjectedProvider;
    await selectedInjectedProvider.request({ method: 'eth_requestAccounts' });
    window.fiWalletConnectActive = false;
    return selectedInjectedProvider;
  }

  function clearProvider(provider) {
    if (provider && window.ethereum === provider) {
      try { delete window.ethereum; } catch (_) { window.ethereum = undefined; }
    }
    if (!provider || wcProvider === provider) {
      wcProvider = null;
      initPromise = null;
    }
    window.fiWalletConnectActive = false;
  }

  function metadata() {
    const origin = window.location.origin;
    return {
      name: 'Fly Infinity',
      description: 'Connect your wallet to Fly Infinity',
      url: origin && origin !== 'null' ? origin : 'https://example.com',
      icons: [new URL('logo.png', window.location.href).href]
    };
  }

  async function createProvider() {
    const module = await import('https://esm.sh/@walletconnect/ethereum-provider@2.26.0?bundle');
    const EthereumProvider = module.EthereumProvider ||
      (module.default && module.default.EthereumProvider);
    if (!EthereumProvider) throw new Error('WalletConnect provider could not be loaded.');

    const provider = await EthereumProvider.init({
      projectId: PROJECT_ID,
      chains: [BSC_CHAIN_ID],
      showQrModal: true,
      metadata: metadata()
    });

    provider.on('disconnect', function () { clearProvider(provider); });
    provider.on('accountsChanged', function (accounts) {
      if (!accounts || accounts.length === 0) clearProvider(provider);
    });
    provider.on('display_uri', function () {
      console.info('[Fly Infinity WalletConnect] Wallet URI generated.');
    });
    provider.on('connect', function (info) {
      console.info('[Fly Infinity WalletConnect] Connected:', info);
    });
    provider.on('session_event', function (event) {
      console.info('[Fly Infinity WalletConnect] Session event:', event && event.name);
    });
    provider.on('error', function (error) {
      console.error('[Fly Infinity WalletConnect] Provider error:', error);
    });
    return provider;
  }

  async function connectWithWalletConnect() {
    if (connectPromise) return connectPromise;

    connectPromise = (async function () {
      if (!initPromise) {
        initPromise = createProvider().then(function (provider) {
          wcProvider = provider;
          return provider;
        }).catch(function (error) {
          initPromise = null;
          wcProvider = null;
          throw error;
        });
      }

      let provider = await initPromise;
      if (provider.session) {
        try { await provider.disconnect(); } catch (error) {
          console.warn('Could not clear previous WalletConnect session:', error);
        }
        clearProvider(provider);
        provider = await createProvider();
        wcProvider = provider;
        initPromise = Promise.resolve(provider);
      }

      try {
        await provider.enable();
        const accounts = await provider.request({ method: 'eth_accounts' });
        if (!accounts || accounts.length === 0) {
          throw new Error('The wallet approved the connection but returned no account.');
        }
      } catch (error) {
        const onlineState = typeof navigator !== 'undefined' ? navigator.onLine : 'unknown';
        console.error('[Fly Infinity WalletConnect] Connection diagnostics:', {
          online: onlineState,
          userAgent: navigator && navigator.userAgent,
          error: error
        });
        if (error && /No internet connection detected/i.test(error.message || '')) {
          error.message += ' (Browser online flag: ' + onlineState + '. Check the wallet app return path and WalletConnect relay connectivity.)';
        }
        throw error;
      }

      wcProvider = provider;
      initPromise = Promise.resolve(provider);
      window.ethereum = provider;
      window.fiWalletConnectActive = true;
      return provider;
    })().catch(function (error) {
      if (wcProvider) clearProvider(wcProvider);
      throw error;
    }).finally(function () {
      connectPromise = null;
    });

    return connectPromise;
  }

  function disconnectWalletConnect() {
    const provider = wcProvider;
    clearProvider(provider);
    if (provider) {
      return provider.disconnect().catch(function (error) {
        console.warn('WalletConnect disconnect:', error);
      });
    }
    return Promise.resolve();
  }

  function disconnectSelectedWallet() {
    const wasInjected = !!selectedInjectedProvider;
    resetInjectedSelection();
    if (!window.fiWalletConnectActive) window.fiWalletConnectActive = false;
    if (wasInjected) return Promise.resolve();
    return disconnectWalletConnect();
  }

  // Preload the WalletConnect provider on mobile before the user taps Connect.
  // This avoids delaying the wallet-launch flow while importing the SDK after
  // the click, which can cause Android browsers to lose transient user activation.
  if (isMobileBrowser()) {
    initPromise = createProvider().then(function (provider) {
      wcProvider = provider;
      return provider;
    }).catch(function (error) {
      initPromise = null;
      wcProvider = null;
      console.warn('[Fly Infinity WalletConnect] Mobile pre-initialization failed:', error);
      return null;
    });
  }

  window.fiSelectWalletProvider = selectWalletProvider;
  window.fiConnectWalletConnect = connectWithWalletConnect;
  window.fiDisconnectWalletConnect = disconnectWalletConnect;
  window.fiDisconnectSelectedWallet = disconnectSelectedWallet;
})();