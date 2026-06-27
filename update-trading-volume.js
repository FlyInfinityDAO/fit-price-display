const { ethers } = require('ethers');
const fs = require('fs');

// ==================== CONFIG ====================
const TOKEN_ADDRESS = "0xBebe4ea7aA4037CeF5D0bc25a10f9dcA16120Dfa";
const DAI_ADDRESS = "0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3";
const NETWORK_ADDRESS = "0x7f1cB4fce7cB3b6C612c4A7Dd123D3865640dC1B";
const RPC_URL = "https://bsc-dataseed.binance.org/";
const HISTORY_FILE = "trading-volume.json";

const OLD_CONTRACT_OWNERS = 80897;
const PER_OWNER_INCOMING = 22; // 2 (membership) + 20 (reward) ✅ اصلاح شد

// ==================== ABI ====================
const DAI_ABI = [
    {
        "constant": true,
        "inputs": [{"name": "account", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "", "type": "uint256"}],
        "type": "function"
    }
];

const NETWORK_ABI = [
    {
        "constant": true,
        "inputs": [],
        "name": "All_Owner_Number",
        "outputs": [{"name": "", "type": "uint64"}],
        "type": "function"
    }
];

// ==================== SETUP ====================
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const daiContract = new ethers.Contract(DAI_ADDRESS, DAI_ABI, provider);
const networkContract = new ethers.Contract(NETWORK_ADDRESS, NETWORK_ABI, provider);

// ==================== بارگذاری داده قبلی ====================
function loadPreviousData() {
    try {
        if (fs.existsSync(HISTORY_FILE)) {
            const data = fs.readFileSync(HISTORY_FILE, 'utf8');
            const parsed = JSON.parse(data);
            return {
                tradingVolume: parsed.totalVolume || 30800,
                newOwners: parsed.scanInfo?.newOwners || 0,
                reserve: parsed.scanInfo?.reserve || 0
            };
        }
    } catch (e) {
        console.log('⚠️ Could not load history, starting fresh');
    }
    return {
        tradingVolume: 30800,
        newOwners: 0,
        reserve: 0
    };
}

// ==================== تابع اصلی ====================
async function updateTradingVolume() {
    console.log('🚀 UPDATING TRADING VOLUME (ONLY INCREASE)');
    console.log('═══════════════════════════════════════');
    console.log(`📊 Per Owner Incoming: ${PER_OWNER_INCOMING} (2 membership + 20 reward)`);
    
    try {
        // ===== 1. خواندن اطلاعات قبلی =====
        const prev = loadPreviousData();
        console.log(`📊 Previous Trading Volume: $${prev.tradingVolume.toFixed(2)}`);
        console.log(`📊 Previous New Owners: ${prev.newOwners}`);
        console.log(`📊 Previous Reserve: $${prev.reserve.toFixed(2)}`);
        
        // ===== 2. دریافت اطلاعات فعلی از بلاکچین =====
        console.log('\n📡 Reading current data from blockchain...');
        
        const reserveRaw = await daiContract.balanceOf(TOKEN_ADDRESS);
        const currentReserve = parseFloat(ethers.utils.formatEther(reserveRaw));
        console.log(`💰 Current Reserve: $${currentReserve.toFixed(2)}`);
        
        const totalOwnersRaw = await networkContract.All_Owner_Number();
        const totalOwners = parseInt(totalOwnersRaw.toString());
        console.log(`👥 Total Owners: ${totalOwners}`);
        
        const currentNewOwners = Math.max(0, totalOwners - OLD_CONTRACT_OWNERS);
        console.log(`🆕 Current New Owners: ${currentNewOwners}`);
        
        // ===== 3. محاسبه تغییرات =====
        const deltaNewOwners = currentNewOwners - prev.newOwners;
        const deltaReserve = currentReserve - prev.reserve;
        
        console.log(`\n📊 Changes:`);
        console.log(`   New Owners Delta: ${deltaNewOwners}`);
        console.log(`   Reserve Delta: $${deltaReserve.toFixed(2)}`);
        
        // ===== 4. محاسبه تغییرات تریدینگ ولوم =====
        const deltaVolume = deltaReserve - (deltaNewOwners * PER_OWNER_INCOMING);
        console.log(`   Raw Volume Delta: $${deltaVolume.toFixed(2)}`);
        
        // ===== 5. فقط در صورتی که مثبت باشه به Volume اضافه کن =====
        const volumeIncrease = Math.max(0, deltaVolume);
        console.log(`   ✅ Volume Increase: $${volumeIncrease.toFixed(2)}`);
        
        const newTradingVolume = prev.tradingVolume + volumeIncrease;
        console.log(`\n📊 New Trading Volume: $${newTradingVolume.toFixed(2)}`);
        
        // ===== 6. ذخیره =====
        const daysSinceStart = Math.ceil((Date.now() - new Date('2025-12-18').getTime()) / (1000 * 60 * 60 * 24));
        const dailyVolume = daysSinceStart > 0 ? newTradingVolume / daysSinceStart : 0;
        
        const result = {
            lastUpdated: new Date().toISOString(),
            totalVolume: Math.round(newTradingVolume * 100) / 100,
            dailyVolume: Math.round(dailyVolume * 100) / 100,
            scanInfo: {
                method: "AUTOMATIC_DELTA_FORMULA_ONLY_INCREASE",
                daysSinceStart: daysSinceStart,
                totalOwners: totalOwners,
                newOwners: currentNewOwners,
                reserve: Math.round(currentReserve * 100) / 100,
                deltaNewOwners: deltaNewOwners,
                deltaReserve: Math.round(deltaReserve * 100) / 100,
                deltaVolume: Math.round(deltaVolume * 100) / 100,
                volumeIncrease: Math.round(volumeIncrease * 100) / 100,
                perOwnerIncoming: PER_OWNER_INCOMING
            },
            transactions: {
                totalBuys: 0,
                totalSells: Math.round(volumeIncrease * 100) / 100,
                buyCount: 0,
                sellCount: 0
            }
        };
        
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(result, null, 2));
        console.log(`\n💾 Saved to: ${HISTORY_FILE}`);
        
        console.log('\n═══════════════════════════════════════');
        console.log('✅ ===== UPDATE COMPLETED =====');
        console.log(`💰 Trading Volume: $${newTradingVolume.toFixed(2)}`);
        console.log(`📈 Daily Avg: $${dailyVolume.toFixed(2)}`);
        console.log('═══════════════════════════════════════');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    }
}

// ==================== اجرا ====================
console.log('=' .repeat(50));
console.log('🚀 TRADING VOLUME UPDATER');
console.log('📊 ONLY INCREASE - Sell doesn\'t decrease volume');
console.log(`📊 Per Owner: ${PER_OWNER_INCOMING} DAI`);
console.log('=' .repeat(50));

updateTradingVolume()
    .then(() => {
        console.log('\n✨ Done!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Failed:', error.message);
        process.exit(1);
    });