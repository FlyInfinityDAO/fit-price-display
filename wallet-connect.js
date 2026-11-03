// wallet-connect.js
import { createAppKit } from 'https://cdn.jsdelivr.net/npm/@reown/appkit@1.6.3/dist/appkit.js';
import { Ethers5Adapter } from 'https://cdn.jsdelivr.net/npm/@reown/appkit-adapter-ethers5@1.6.3/dist/appkit-adapter-ethers5.js';
import { bsc } from 'https://cdn.jsdelivr.net/npm/@reown/appkit@1.6.3/dist/networks.js';

// Project ID شما
const projectId = '2e312445cba4a41a1aab5f01552c5668';

// تنظیمات شبکه (فقط BSC)
const networks = [bsc];

// آداپتور Ethers v5
const ethers5Adapter = new Ethers5Adapter();

// متادیتا
const metadata = {
    name: 'Fly Infinity DAO',
    description: 'Fly Infinity DApp',
    url: window.location.origin, // دامنه شما
    icons: [window.location.origin + '/logo.png']
};

// ایجاد نمونه AppKit
export const modal = createAppKit({
    adapters: [ethers5Adapter],
    networks,
    projectId,
    metadata,
    features: {
        analytics: false,
        email: false,
        socials: false
    },
    themeMode: 'dark',
    themeVariables: {
        '--w3m-accent': '#00C896',
        '--w3m-border-radius-master': '8px',
    }
});

// تابع باز کردن مودال اتصال
export function openConnectModal() {
    modal.open();
}

// تابع دریافت signer از AppKit (برای استفاده در کدهای موجود شما)
export async function getSigner() {
    if (!modal.getIsConnected()) return null;
    const walletProvider = modal.getWalletProvider();
    if (!walletProvider) return null;
    // با استفاده از ethers v5 که در صفحه لود شده است
    const provider = new ethers.providers.Web3Provider(walletProvider);
    return provider.getSigner();
}

// تابع دریافت آدرس متصل شده
export function getAddress() {
    return modal.getAddress();
}

// گوش دادن به تغییرات اتصال (اختیاری، برای به‌روزرسانی UI)
modal.subscribeEvents((event) => {
    if (event.data.event === 'CONNECT_SUCCESS' || event.data.event === 'DISCONNECT_SUCCESS') {
        // یک رویداد سفارشی برای کدهای صفحه ارسال می‌کنیم
        window.dispatchEvent(new CustomEvent('walletStateChanged', { 
            detail: { isConnected: modal.getIsConnected(), address: modal.getAddress() } 
        }));
    }
});
