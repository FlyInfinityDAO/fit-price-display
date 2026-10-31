const { ethers } = require('ethers');
const fs = require('fs');

// ==================== CONFIG ====================
const RPC_URL = "https://bsc-dataseed.binance.org/";
const NETWORK_ADDRESS = "0x7f1cB4fce7cB3b6C612c4A7Dd123D3865640dC1B";

// ==================== ABI ====================
const NETWORK_ABI = [
    // ===== All_Owner_Number function =====
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

// ==================== Get the total number of owners ====================
async function fetchTotalOwners() {
    try {
        // ✅ We read directly from the contract, without API
        const totalOwners = await networkContract.All_Owner_Number();
        return parseInt(totalOwners.toString());
    } catch (error) {
        console.error('❌ Error fetching All_Owner_Number:', error);
        return 0;
    }
}

// ==================== Calculate and save ====================
async function updateAirdropStats() {
    console.log('🔄 Updating Airdrop Stats from blockchain...');
    
    const startTime = Date.now();
    
    try {
        // 1. Get the total number of owners from the contract
        const totalOwners = await fetchTotalOwners();
        console.log(`👥 Total Owners: ${totalOwners}`);
        
        // 2. Airdrops Calculation ($2 per owner)
        const airdropPerOwner = 2;
        const totalAirdrops = totalOwners * airdropPerOwner;
        console.log(`🎁 Total Airdrops: $${totalAirdrops.toFixed(2)}`);
        
        // 3. Save to JSON file
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

// ==================== Execution ====================
updateAirdropStats();
