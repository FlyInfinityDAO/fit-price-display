import { createAppKit } from 'https://cdn.jsdelivr.net/npm/@reown/appkit@1.6.3/dist/appkit.js';
import { EthersAdapter } from 'https://cdn.jsdelivr.net/npm/@reown/appkit-adapter-ethers@1.6.3/dist/appkit-adapter-ethers.js';
import { bsc } from 'https://cdn.jsdelivr.net/npm/@reown/appkit@1.6.3/dist/networks.js';

const projectId = '2e312445cba4a41a1aab5f01552c5668';
const networks = [bsc];
const ethersAdapter = new EthersAdapter();

const metadata = {
    name: 'Fly Infinity DAO',
    description: 'Fly Infinity DApp',
    url: window.location.origin,
    icons: [window.location.origin + '/logo.png']
};

const featuredWalletIds = [
    'c57ca95b47569778a828d19178114f2db125b25b778adf5cba72bd778e231769',
    '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0'
];

export const modal = createAppKit({
    adapters: [ethersAdapter],
    networks,
    projectId,
    metadata,
    allWallets: 'SHOW',
    featuredWalletIds,
    features: { analytics: false, email: false, socials: false },
    themeMode: 'dark',
    themeVariables: { '--w3m-accent': '#00C896', '--w3m-border-radius-master': '8px' }
});

export function openConnectModal() {
    modal.open();
}

export async function getSigner() {
    if (!modal.getIsConnected()) return null;
    const walletProvider = modal.getWalletProvider();
    if (!walletProvider) return null;
    const provider = new ethers.BrowserProvider(walletProvider);
    return provider.getSigner();
}

export function getAddress() {
    return modal.getAddress();
}

modal.subscribeEvents((event) => {
    if (event.data.event === 'CONNECT_SUCCESS' || event.data.event === 'DISCONNECT_SUCCESS') {
        window.dispatchEvent(new CustomEvent('walletStateChanged', {
            detail: { isConnected: modal.getIsConnected(), address: modal.getAddress() }
        }));
    }
});
