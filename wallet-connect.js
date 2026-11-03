/* Reown / WalletConnect connector shared by the FIT dApp pages. */
(function () {
  'use strict';
  const PROJECT_ID = '2e312445cba4a41a1aab5f01552c5668';
  const BSC_CHAIN_ID = 56;
  let walletConnectProviderPromise = null;

  function getInjectedProvider() {
    if (!window.ethereum) return null;
    const providers = Array.isArray(window.ethereum.providers) ? window.ethereum.providers : [window.ethereum];
    return providers.find(p => p && p.isMetaMask)
      || providers.find(p => p && p.isTrust)
      || providers.find(p => p && p.isTokenPocket)
      || providers[0]
      || window.ethereum;
  }

  async function getWalletConnectProvider() {
    if (!walletConnectProviderPromise) {
      walletConnectProviderPromise = (async () => {
        const module = await import('https://esm.sh/@walletconnect/ethereum-provider@2.21.1');
        const EthereumProvider = module.default || module.EthereumProvider;
        if (!EthereumProvider || typeof EthereumProvider.init !== 'function') {
          throw new Error('WalletConnect provider could not be loaded.');
        }
        return EthereumProvider.init({
          projectId: PROJECT_ID,
          chains: [BSC_CHAIN_ID],
          optionalChains: [BSC_CHAIN_ID],
          showQrModal: true,
          methods: ['eth_sendTransaction','eth_signTransaction','eth_sign','personal_sign',
            'eth_signTypedData','eth_signTypedData_v4','eth_call','eth_getBalance',
            'eth_estimateGas','eth_chainId','eth_accounts','wallet_switchEthereumChain',
            'wallet_addEthereumChain'],
          events: ['chainChanged','accountsChanged'],
          metadata: {
            name: 'Fly Infinity',
            description: 'Fly Infinity FIT decentralized application',
            url: window.location.origin,
            icons: [new URL('logo.png', window.location.href).href]
          }
        });
      })().catch(error => { walletConnectProviderPromise = null; throw error; });
    }
    return walletConnectProviderPromise;
  }

  async function connect() {
    const injected = getInjectedProvider();
    if (injected) {
      await injected.request({ method: 'eth_requestAccounts' });
      return injected;
    }
    const provider = await getWalletConnectProvider();
    await provider.connect();
    return provider;
  }
  window.FlyWalletConnect = { connect };
})();
