/* Fly Infinity — shared wallet connector for the DApp operation pages.
 *
 * Uses Reown AppKit (WalletConnect) so a wallet can be connected from
 * desktop browsers (extension or QR code) and from mobile browsers
 * (deep link to MetaMask / Trust Wallet / TokenPocket / any WalletConnect
 * wallet), as well as from inside a wallet's own in-app browser.
 *
 * The site has no build step, so AppKit is loaded lazily from an ES-module
 * CDN the first time it is needed. If it cannot be loaded, the pages fall
 * back to the original injected-wallet (window.ethereum) flow.
 *
 * Public API (window.FIWalletConnect):
 *   open()            -> opens the wallet modal (rejects with code FI_WC_UNAVAILABLE if AppKit cannot load)
 *   disconnect()      -> ends the WalletConnect / AppKit session
 *   ensureBsc(raw)    -> asks the wallet to use BNB Smart Chain; resolves true/false
 *   prefetch()        -> starts loading AppKit in the background
 * Events on window:
 *   fi-wallet-connected     detail: { provider, address }   (EIP-1193 provider)
 *   fi-wallet-disconnected
 */

const PROJECT_ID = '2e312445cba4a41a1aab5f01552c5668'; // Reown Cloud project ID (public by design)
const APPKIT_VERSION = '1.8.19';                       // all @reown/* packages must share one version
const ESM_CDN = 'https://esm.sh/';
const BSC_HEX = '0x38';

let kit = null;
let loading = null;
let connected = false;

function unavailable(cause) {
  const err = new Error('Wallet modal could not be loaded');
  err.code = 'FI_WC_UNAVAILABLE';
  err.cause = cause;
  return err;
}

function emit(name, detail) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

async function waitForProvider(timeoutMs) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const p = kit && kit.getWalletProvider && kit.getWalletProvider();
    if (p) return p;
    await new Promise((r) => setTimeout(r, 100));
  }
  return null;
}

async function onAccount(account) {
  const isConnected = !!(account && account.isConnected && account.address);
  if (isConnected && !connected) {
    connected = true;
    const provider = await waitForProvider(3000);
    if (!provider) { connected = false; return; }
    emit('fi-wallet-connected', { provider, address: account.address });
  } else if (!isConnected && connected) {
    connected = false;
    emit('fi-wallet-disconnected');
  }
}

function load() {
  if (kit) return Promise.resolve(kit);
  if (loading) return loading;
  loading = (async () => {
    try {
      const v = APPKIT_VERSION;
      const [core, adapter, networks] = await Promise.all([
        import(ESM_CDN + '@reown/appkit@' + v),
        import(ESM_CDN + '@reown/appkit-adapter-ethers5@' + v + '?deps=ethers@5.7.2'),
        import(ESM_CDN + '@reown/appkit@' + v + '/networks')
      ]);
      const base = new URL('.', location.href).href;
      kit = core.createAppKit({
        adapters: [new adapter.Ethers5Adapter()],
        networks: [networks.bsc],
        defaultNetwork: networks.bsc,
        projectId: PROJECT_ID,
        metadata: {
          name: 'Fly Infinity',
          description: 'Fly Infinity DApp',
          url: location.origin,
          icons: [new URL('logo.png', base).href]
        },
        features: { email: false, socials: false, onramp: false, swaps: false },
        themeMode: 'dark',
        themeVariables: { '--w3m-accent': '#D4AF37', '--w3m-z-index': 2147483000 }
      });
      kit.subscribeAccount(onAccount);
      return kit;
    } catch (err) {
      kit = null;
      loading = null; // allow a later retry
      console.warn('Reown AppKit failed to load:', err);
      throw unavailable(err);
    }
  })();
  return loading;
}

async function open() {
  const k = await load();
  if (connected) {
    // Already connected (restored session): let the page pick the provider up.
    const provider = k.getWalletProvider && k.getWalletProvider();
    if (provider) emit('fi-wallet-connected', { provider, address: '' });
    return;
  }
  await k.open({ view: 'Connect' });
}

async function disconnect() {
  if (!kit || !connected) return;
  connected = false; // set first so our own subscription does not re-emit
  try { await kit.disconnect(); } catch (err) { console.warn('Wallet disconnect failed:', err); }
}

async function ensureBsc(raw) {
  try {
    const chainId = await raw.request({ method: 'eth_chainId' });
    if (String(chainId).toLowerCase() === BSC_HEX) return true;
    await raw.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BSC_HEX }] });
    const after = await raw.request({ method: 'eth_chainId' });
    return String(after).toLowerCase() === BSC_HEX;
  } catch (err) {
    return false;
  }
}

function hasStoredSession() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) || '';
      if ((k.indexOf('wc@2:') === 0 && k.indexOf('session') > -1) || k.indexOf('connected_connector') > -1) return true;
    }
  } catch (e) { /* storage unavailable */ }
  return false;
}

window.FIWalletConnect = { open, disconnect, ensureBsc, prefetch: () => load().catch(() => {}) };

// Restore a previous session after a reload (e.g. returning from a wallet app on mobile).
if (hasStoredSession()) {
  const start = () => load().catch(() => {});
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
}
