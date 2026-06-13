const fs = require('fs');
const { ethers } = require('ethers');

// ==================== CONFIGURATION ====================
const CONTRACT_ADDRESS = "0xBebe4ea7aA4037CeF5D0bc25a10f9dcA16120Dfa";
const ABI = [
    {
        "constant": true,
        "inputs": [],
        "name": "Price",
        "outputs": [{"name": "", "type": "uint256"}],
        "type": "function"
    }
];
const RPC_URL = "https://bsc-dataseed.binance.org/";
const HISTORY_FILE = "price-history.json";

// ==================== HELPER FUNCTIONS ====================
function getTodayUTC() {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// ==================== MAIN SCRIPT ====================
async function main() {
    console.log("=".repeat(50));
    console.log(`🕐 UTC Time: ${new Date().toISOString()}`);
    console.log("=".repeat(50));
    
    console.log("🔄 Fetching current FIT price from contract...");

    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

    let currentPriceDAI;
    try {
        currentPriceDAI = await contract.Price();
    } catch (error) {
        console.error("❌ Failed to call Price():", error);
        process.exit(1);
    }

    const priceInDAI = parseFloat(ethers.utils.formatEther(currentPriceDAI));
    
    // Get current USD price of DAI
    let daiPriceUSD = 1.00;
    try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=dai&vs_currencies=usd');
        const data = await response.json();
        daiPriceUSD = data.dai?.usd || 1.00;
    } catch(e) {
        console.log("⚠️ Could not fetch DAI price, using $1.00");
    }
    
    const priceInUSD = priceInDAI * daiPriceUSD;
    const todayUTC = getTodayUTC();

    console.log(`✅ Current price: $${priceInUSD.toFixed(6)} USD`);
    console.log(`📅 Today (UTC): ${todayUTC}`);

    // Read existing history
    let history = { records: [] };
    if (fs.existsSync(HISTORY_FILE)) {
        const rawData = fs.readFileSync(HISTORY_FILE);
        history = JSON.parse(rawData);
        console.log(`📂 Loaded ${history.records.length} existing records`);
    } else {
        console.error("❌ price-history.json not found!");
        process.exit(1);
    }
    
    // Check if we already have a record for today
    const existingIndex = history.records.findIndex(record => record.date === todayUTC);
    
    if (existingIndex !== -1) {
        // Update today's record
        const oldPrice = history.records[existingIndex].price;
        history.records[existingIndex].price = priceInUSD;
        
        if (Math.abs(oldPrice - priceInUSD) > 0.000001) {
            console.log(`\n📝 UPDATED TODAY'S PRICE:`);
            console.log(`   Date: ${todayUTC}`);
            console.log(`   Old: $${oldPrice.toFixed(6)} → New: $${priceInUSD.toFixed(6)}`);
        } else {
            console.log(`\n✓ Price unchanged for ${todayUTC}: $${priceInUSD.toFixed(6)}`);
        }
    } else {
        // Add new record for today
        history.records.push({
            date: todayUTC,
            price: priceInUSD
        });
        console.log(`\n➕ ADDED NEW RECORD:`);
        console.log(`   Date: ${todayUTC}`);
        console.log(`   Price: $${priceInUSD.toFixed(6)}`);
    }

    // Sort records by date
    history.records.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Write back to file
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
    
    console.log("\n" + "=".repeat(50));
    console.log(`💾 Saved to ${HISTORY_FILE}`);
    console.log(`📈 Total records: ${history.records.length}`);
    console.log("=".repeat(50));
}

main().catch(console.error);
