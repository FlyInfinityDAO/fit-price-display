const { ethers } = require('ethers');
const fs = require('fs');

// ==================== CONFIG ====================
const RPC_URL = "https://bsc-dataseed.binance.org/";
const NETWORK_ADDRESS = "0x7f1cB4fce7cB3b6C612c4A7Dd123D3865640dC1B";

// ==================== ABI ====================
const NETWORK_ABI = [
    // ===== تابع All_Owner_Number =====
    {
        "constant": true,
        "inputs": [],
        "name": "All_Owner_Number",
        "outputs": [{ "name": "", "type": "uint64" }],
        "type": "function"
    }
];

const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const networkContract = new ethers.Contract(NETWORK_ADDRESS, NETWORK_ABI, provider);

// ==================== دریافت تعداد کل مالکین ====================
async function fetchTotalOwners() {
    try {
        // ✅ مستقیماً از قرارداد میخونیم، بدون API
        const totalOwners = await networkContract.All_Owner_Number();
        return parseInt(totalOwners.toString());
    } catch (error) {
        console.error('❌ Error fetching All_Owner_Number:', error);
        return 0;
    }
}

// ==================== محاسبه و ذخیره ====================
async function updateAirdropStats() {
    console.log('🔄 Updating Airdrop Stats from blockchain...');
    
    const startTime = Date.now();
    
    try {
        // ۱. دریافت تعداد کل مالکین از قرارداد
        const totalOwners = await fetchTotalOwners();
        console.log(`👥 Total Owners: ${totalOwners}`);
        
        // ۲. محاسبه Airdrops (هر مالک ۲ دلار)
        const airdropPerOwner = 2;
        const totalAirdrops = totalOwners * airdropPerOwner;
        console.log(`🎁 Total Airdrops: $${totalAirdrops.toFixed(2)}`);
        
        // ۳. ذخیره در فایل JSON
        const result = {
            lastUpdated: new Date().toISOString(),
            totalAirdrops: Math.round(totalAirdrops * 100) / 100,
            totalOwners: totalOwners,
            airdropPerOwner: airdropPerOwner
        };
        
        fs.writeFileSync('airdrop-stats.json', JSON.stringify(result, null, 2));
        
        console.log(`\n✅ Updated in ${(Date.now() - startTime) / 1000}s`);
        console.log(`💾 Saved: airdrop-stats.json`);
        console.log(`📊 Total Airdrops: $${result.totalAirdrops.toFixed(2)}`);
        
    } catch (error) {
        console.error('❌ Error updating airdrop stats:', error);
        process.exit(1);
    }
}

// ==================== اجرا ====================
updateAirdropStats();
