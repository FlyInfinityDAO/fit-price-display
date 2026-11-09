/* Fly Infinity — wallet selection and Reown WalletConnect bridge.
   Supports EIP-6963 injected wallets and WalletConnect on desktop and mobile. */
(function () {
  'use strict';

  const PROJECT_ID = 'ab10578e2b30d9e7bb63cee427cae780';
  const BSC_CHAIN_ID = 56;
  let wcProvider = null;
  let initPromise = null;
  let connectPromise = null;
  let iosWarmupPromise = null;
  let selectedInjectedProvider = null;
  const announcedProviders = new Map();
  // Keep the browser's original multi-wallet root separate from the active selection.
  const injectedRootProvider = window.ethereum;

  function userAgent() {
    return (navigator && navigator.userAgent) || '';
  }

  function isMobileBrowser() {
    return /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent());
  }

  function isIOSBrowser() {
    return /iPhone|iPad|iPod/i.test(userAgent()) ||
      (/Macintosh/i.test(userAgent()) && navigator && navigator.maxTouchPoints > 1);
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
      optionalChains: [BSC_CHAIN_ID],
      showQrModal: true,
      qrModalOptions: { enableMobileFullScreen: isMobileBrowser() },
      metadata: metadata()
    });

    provider.on('disconnect', function () { clearProvider(provider); });
    provider.on('accountsChanged', function (accounts) {
      if (!accounts || accounts.length === 0) clearProvider(provider);
    });
    provider.on('display_uri', function (uri) {
      console.info('[Fly Infinity WalletConnect] Wallet URI event:', {
        received: typeof uri === 'string' && uri.length > 0,
        length: typeof uri === 'string' ? uri.length : 0
      });
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
      // Preserve the existing iOS pre-initialization path. Android initializes
      // on demand so its first pairing starts from a clean Reown modal state.
      if (isIOSBrowser() && !initPromise && iosWarmupPromise) {
        const warmedProvider = await iosWarmupPromise;
        if (warmedProvider) {
          wcProvider = warmedProvider;
          initPromise = Promise.resolve(warmedProvider);
        }
        iosWarmupPromise = null;
      }

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
      let hasExistingSession = false;

      // Keep a valid WalletConnect session on Android and desktop. Recreating
      // it on every tap discards the pairing and can break the mobile return flow.
      // Preserve the existing iOS reconnect path to avoid changing its working UX.
      if (provider.session && !isIOSBrowser()) {
        try {
          const existingAccounts = await provider.request({ method: 'eth_accounts' });
          hasExistingSession = Array.isArray(existingAccounts) && existingAccounts.length > 0;
        } catch (error) {
          console.warn('[Fly Infinity WalletConnect] Existing session check failed:', error);
        }
      }

      if (provider.session && !hasExistingSession) {
        try { await provider.disconnect(); } catch (error) {
          console.warn('Could not clear stale WalletConnect session:', error);
        }

        if (isIOSBrowser()) {
          // Keep the previously working iOS reconnect behavior unchanged.
          clearProvider(provider);
          provider = await createProvider();
        } else {
          // disconnect() emits the provider's disconnect event, which clears
          // the shared references. Reuse this initialized instance instead of
          // calling EthereumProvider.init() again for the same page lifecycle.
          // This avoids repeatedly creating WalletConnect Core instances.
          wcProvider = provider;
          initPromise = Promise.resolve(provider);
        }

        wcProvider = provider;
        initPromise = Promise.resolve(provider);
      }

      try {
        if (!hasExistingSession) {
          // Start pairing explicitly with the optional BSC namespace. This
          // avoids making BSC a hard wallet capability requirement and lets
          // Reown create the pairing URI before the wallet handoff.
          await provider.connect({ optionalChains: [BSC_CHAIN_ID] });
        }
        const accounts = await provider.request({ method: 'eth_requestAccounts' });
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
      // Keep Android/desktop provider state after a user rejection so a retry
      // can reuse the initialized provider. Retain the historical iOS cleanup.
      if (isIOSBrowser() && wcProvider) clearProvider(wcProvider);
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

  // Keep the previously working iOS warmup; Android deliberately does not
  // preload because its Reown pairing flow is started only after user action.
  if (isIOSBrowser()) {
    iosWarmupPromise = createProvider().then(function (provider) {
      wcProvider = provider;
      return provider;
    }).catch(function (error) {
      console.warn('[Fly Infinity WalletConnect] iOS pre-initialization failed:', error);
      return null;
    });
  }

  window.fiSelectWalletProvider = selectWalletProvider;
  window.fiConnectWalletConnect = connectWithWalletConnect;
  window.fiDisconnectWalletConnect = disconnectWalletConnect;
  window.fiDisconnectSelectedWallet = disconnectSelectedWallet;
})();