/* Fly Infinity — Reown/WalletConnect bridge for the existing ethers v5 flows.
   Injected browser wallets keep using the original connection path. */
(function () {
  'use strict';

  const PROJECT_ID = '2e312445cba4a41a1aab5f01552c5668';
  const BSC_CHAIN_ID = 56;
  let wcProvider = null;
  let initPromise = null;

  function appMetadata() {
    return {
      name: 'Fly Infinity',
      description: 'Connect your wallet to Fly Infinity',
      url: window.location.origin && window.location.origin !== 'null'
        ? window.location.origin
        : 'http://localhost',
      icons: [new URL('logo.png', window.location.href).href]
    };
  }

  async function connectWithWalletConnect() {
    if (wcProvider && wcProvider.accounts && wcProvider.accounts.length) {
      return wcProvider;
    }
    if (!initPromise) {
      initPromise = (async function () {
        const moduleUrl = 'https://esm.sh/@walletconnect/ethereum-provider@2.26.0?bundle';
        const module = await import(moduleUrl);
        const EthereumProvider = module.EthereumProvider ||
          (module.default && module.default.EthereumProvider);
        if (!EthereumProvider) {
          throw new Error('WalletConnect provider could not be loaded.');
        }

        wcProvider = await EthereumProvider.init({
          projectId: PROJECT_ID,
          optionalChains: [BSC_CHAIN_ID],
          showQrModal: true,
          metadata: appMetadata()
        });
        wcProvider.on('disconnect', function () {
          wcProvider = null;
          initPromise = null;
        });
        return wcProvider;
      })().catch(function (error) {
        initPromise = null;
        wcProvider = null;
        throw error;
      });
    }

    const provider = await initPromise;
    if (!provider.accounts || provider.accounts.length === 0) {
      await provider.enable();
    }
    window.ethereum = provider;
    return provider;
  }

  window.fiConnectWalletConnect = connectWithWalletConnect;

  function wrapDisconnect() {
    if (typeof window.disconnectWallet !== 'function' ||
        window.disconnectWallet.__fiWalletConnectWrapped) return false;
    const original = window.disconnectWallet;
    const wrapped = function () {
      if (wcProvider) {
        const current = wcProvider;
        wcProvider = null;
        initPromise = null;
        current.disconnect().catch(function (error) {
          console.warn('WalletConnect disconnect:', error);
        });
        if (window.ethereum === current) {
          try { delete window.ethereum; } catch (_) { window.ethereum = undefined; }
        }
      }
      return original.apply(this, arguments);
    };
    wrapped.__fiWalletConnectWrapped = true;
    window.disconnectWallet = wrapped;
    return true;
  }

  if (!wrapDisconnect()) {
    const observer = new MutationObserver(function () {
      if (wrapDisconnect()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener('load', function () {
      wrapDisconnect();
      observer.disconnect();
    }, { once: true });
  }
})();
