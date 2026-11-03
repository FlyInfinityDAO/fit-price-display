/* Fly Infinity — Reown WalletConnect bridge for ethers v5 pages.
   Uses the required BNB Smart Chain namespace and resets sessions on disconnect. */
(function () {
  'use strict';

  const PROJECT_ID = '2e312445cba4a41a1aab5f01552c5668';
  const BSC_CHAIN_ID = 56;
  let wcProvider = null;
  let initPromise = null;
  let connectPromise = null;

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

      const provider = await initPromise;

      // A previous session must not silently bypass the wallet chooser.
      if (provider.session) {
        try { await provider.disconnect(); } catch (error) {
          console.warn('Could not clear previous WalletConnect session:', error);
        }
      }

      await provider.enable();
      const accounts = await provider.request({ method: 'eth_accounts' });
      if (!accounts || accounts.length === 0) {
        throw new Error('The wallet approved the connection but returned no account.');
      }

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

  window.fiConnectWalletConnect = connectWithWalletConnect;
  window.fiDisconnectWalletConnect = disconnectWalletConnect;
})();
