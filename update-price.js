const fs = require('fs');
const { ethers } = require('ethers');

// CONFIGURATION
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

async function main() {
    console.log("🔄 Fetching current FIT price...");

    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

    let rawPrice;
    try {
        rawPrice = await contract.Price();
    } catch (error) {
        console.error("❌ Failed to call Price():", error);
        process.exit(1);
    }

    const priceInDAI = parseFloat(ethers.utils.formatEther(rawPrice));
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    console.log(`✅ Current price: ${priceInDAI} DAI on ${today}`);

    // Read existing history
    let history = { records: [] };
    if (fs.existsSync(HISTORY_FILE)) {
        const rawData = fs.readFileSync(HISTORY_FILE);
        history = JSON.parse(rawData);
    }

    // Check if we already have a record for today
    const existingIndex = history.records.findIndex(record => record.date === today);
    if (existingIndex !== -1) {
        // Update today's record
        history.records[existingIndex].price = priceInDAI;
        console.log(`📝 Updated existing record for ${today}`);
    } else {
        // Add new record
        history.records.push({
            date: today,
            price: priceInDAI
        });
        console.log(`➕ Added new record for ${today}`);
    }

    // Sort records by date (oldest first)
    history.records.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Write back to file
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
    console.log(`💾 Saved to ${HISTORY_FILE}`);
}

main().catch(console.error);
