const fs = require('fs');
const { ethers } = require('ethers');

const CONTRACT_ADDRESS = "0xBebe4ea7aA4037CeF5D0bc25a10f9dcA16120Dfa";
const ABI = [{"constant":true,"inputs":[],"name":"Price","outputs":[{"name":"","type":"uint256"}],"type":"function"}];
const RPC_URL = "https://bsc-dataseed.binance.org/";
const HISTORY_FILE = "price-history.json";

function getTodayUTC() {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

async function main() {
    console.log("🔄 Fetching current FIT price...");
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
    
    let priceInDAI;
    try {
        priceInDAI = await contract.Price();
    } catch (error) {
        console.error("❌ Failed to call Price():", error);
        process.exit(1);
    }
    
    const priceValue = parseFloat(ethers.utils.formatEther(priceInDAI));
    const todayUTC = getTodayUTC();
    
    let history = { records: [] };
    if (fs.existsSync(HISTORY_FILE)) {
        const rawData = fs.readFileSync(HISTORY_FILE);
        history = JSON.parse(rawData);
    }
    
    const existingIndex = history.records.findIndex(r => r.date === todayUTC);
    if (existingIndex !== -1) {
        history.records[existingIndex].price = priceValue;
        console.log(`📝 Updated price for ${todayUTC}: $${priceValue}`);
    } else {
        history.records.push({ date: todayUTC, price: priceValue });
        console.log(`➕ Added new record for ${todayUTC}: $${priceValue}`);
    }
    
    history.records.sort((a, b) => new Date(a.date) - new Date(b.date));
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
    console.log(`💾 Saved to ${HISTORY_FILE}`);
}

main().catch(console.error);
