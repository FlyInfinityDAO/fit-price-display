const { ethers } = require('ethers');
const fs = require('fs');

// ==================== CONFIG ====================
const TOKEN_ADDRESS = "0xBebe4ea7aA4037CeF5D0bc25a10f9dcA16120Dfa";
const RPC_URL = "https://bsc-dataseed.binance.org/";
const HISTORY_FILE = "trading-volume.json";
const START_BLOCK = 40000000; // بلاک شروع (تخمینی برای دسامبر 2025)

// ==================== ABI ====================
const ERC20_ABI = [
    // ===== رویداد Transfer استاندارد =====
    {
        "anonymous": false,
        "inputs": [
            {"indexed": true, "internalType": "address", "name": "from", "type": "address"},
            {"indexed": true, "internalType": "address", "name": "to", "type": "address"},
            {"indexed": false, "internalType": "uint256", "name": "value", "type": "uint256"}
        ],
        "name": "Transfer",
        "type": "event"
    },
    // ===== تابع Price =====
    {
        "constant": true,
        "inputs": [],
        "name": "Price",
        "outputs": [{"name": "", "type": "uint256"}],
        "type": "function"
    },
    // ===== تابع decimals =====
    {
        "constant": true,
        "inputs": [],
        "name": "decimals",
        "outputs": [{"name": "", "type": "uint8"}],
        "type": "function"
    }
];

// ==================== SETUP ====================
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const contract = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, provider);

// ==================== ۱. دریافت قیمت فعلی ====================
async function getCurrentPrice() {
    try {
        const priceRaw = await contract.Price();
        return parseFloat(ethers.utils.formatEther(priceRaw));
    } catch (e) {
        console.warn('⚠️ Could not fetch price, using default 6.00');
        return 6.00;
    }
}

// ==================== ۲. دریافت decimals ====================
async function getDecimals() {
    try {
        const dec = await contract.decimals();
        return dec;
    } catch (e) {
        return 18; // default
    }
}

// ==================== ۳. اسکن تراکنش‌ها ====================
async function scanTransactions(fromBlock, toBlock, price, decimals) {
    console.log(`  🔍 Scanning blocks ${fromBlock} to ${toBlock}...`);
    
    // فیلتر رویداد Transfer
    const filter = contract.filters.Transfer(null, null);
    const events = await contract.queryFilter(filter, fromBlock, toBlock);
    
    let totalBuy = 0;
    let totalSell = 0;
    let buyCount = 0;
    let sellCount = 0;
    
    for (const event of events) {
        const { from, to, value } = event.args;
        const amountInTokens = parseFloat(ethers.utils.formatUnits(value, decimals));
        
        // فقط تراکنش‌های بزرگتر از ۱ FIT رو حساب کن
        if (amountInTokens < 1) continue;
        
        const usdValue = amountInTokens * price;
        
        // ===== تشخیص Buy =====
        // اگر گیرنده = قرارداد FIT (یعنی دارن FIT میخرن)
        if (to.toLowerCase() === TOKEN_ADDRESS.toLowerCase()) {
            totalBuy += usdValue;
            buyCount++;
            console.log(`  🟢 BUY: ${amountInTokens.toFixed(2)} FIT = $${usdValue.toFixed(2)}`);
        }
        // ===== تشخیص Sell =====
        // اگر فرستنده = قرارداد FIT (یعنی دارن FIT میفروشن)
        else if (from.toLowerCase() === TOKEN_ADDRESS.toLowerCase()) {
            totalSell += usdValue;
            sellCount++;
            console.log(`  🔴 SELL: ${amountInTokens.toFixed(2)} FIT = $${usdValue.toFixed(2)}`);
        }
        // تراکنش‌های دیگه (انتقال بین کیف‌پول‌ها) نادیده گرفته میشن
    }
    
    return { totalBuy, totalSell, buyCount, sellCount };
}

// ==================== ۴. اسکن کامل ====================
async function scanAllBlocks() {
    console.log('🔄 Starting blockchain scan for Trading Volume...');
    console.log(`📦 Token: ${TOKEN_ADDRESS}`);
    
    const startTime = Date.now();
    const currentBlock = await provider.getBlockNumber();
    console.log(`📊 Current block: ${currentBlock}`);
    console.log(`📍 Start block: ${START_BLOCK}`);
    
    // ===== دریافت قیمت و decimals =====
    const price = await getCurrentPrice();
    const decimals = await getDecimals();
    console.log(`💲 Current Price: $${price.toFixed(4)}`);
    console.log(`🔢 Decimals: ${decimals}`);
    
    // ===== پارامترهای اسکن =====
    const BATCH_SIZE = 5000; // هر بار ۵۰۰۰ بلاک
    let totalBuy = 0;
    let totalSell = 0;
    let totalBuyCount = 0;
    let totalSellCount = 0;
    let scannedBlocks = 0;
    
    console.log(`📋 Scanning blocks ${START_BLOCK} to ${currentBlock}...`);
    console.log(`📦 Batch size: ${BATCH_SIZE} blocks\n`);
    
    // ===== اسکن مرحله‌ای =====
    for (let start = START_BLOCK; start < currentBlock; start += BATCH_SIZE) {
        const end = Math.min(start + BATCH_SIZE - 1, currentBlock);
        const progress = ((start - START_BLOCK) / (currentBlock - START_BLOCK) * 100).toFixed(1);
        console.log(`  📊 [${progress}%] Processing batch...`);
        
        try {
            const result = await scanTransactions(start, end, price, decimals);
            
            totalBuy += result.totalBuy;
            totalSell += result.totalSell;
            totalBuyCount += result.buyCount;
            totalSellCount += result.sellCount;
            scannedBlocks += (end - start + 1);
            
            // نمایش خلاصه هر ۵ مرحله
            if (scannedBlocks % (BATCH_SIZE * 5) === 0 || scannedBlocks === (currentBlock - START_BLOCK)) {
                console.log(`  📈 Summary so far:`);
                console.log(`     🟢 Buys: $${totalBuy.toFixed(2)} (${totalBuyCount} txs)`);
                console.log(`     🔴 Sells: $${totalSell.toFixed(2)} (${totalSellCount} txs)`);
                console.log(`     💰 Total: $${(totalBuy + totalSell).toFixed(2)}\n`);
                
                // ذخیره موقت
                saveProgress(totalBuy, totalSell, totalBuyCount, totalSellCount, scannedBlocks);
            }
            
        } catch (error) {
            console.error(`  ❌ Error scanning blocks ${start}-${end}:`, error.message);
        }
        
        // جلوگیری از rate limit
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // ===== ذخیره نهایی =====
    const totalVolume = totalBuy + totalSell;
    const daysSinceStart = Math.ceil((Date.now() - new Date('2025-12-18').getTime()) / (1000 * 60 * 60 * 24));
    const dailyVolume = daysSinceStart > 0 ? totalVolume / daysSinceStart : 0;
    
    const result = {
        lastUpdated: new Date().toISOString(),
        totalVolume: Math.round(totalVolume * 100) / 100,
        dailyVolume: Math.round(dailyVolume * 100) / 100,
        scanInfo: {
            scannedBlocks: scannedBlocks,
            fromBlock: START_BLOCK,
            toBlock: currentBlock,
            buyCount: totalBuyCount,
            sellCount: totalSellCount,
            daysSinceStart: daysSinceStart
        },
        transactions: {
            totalBuys: Math.round(totalBuy * 100) / 100,
            totalSells: Math.round(totalSell * 100) / 100,
            buyCount: totalBuyCount,
            sellCount: totalSellCount
        }
    };
    
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(result, null, 2));
    
    console.log(`\n✅ ===== SCAN COMPLETED =====`);
    console.log(`⏱️  Time: ${(Date.now() - startTime) / 1000}s`);
    console.log(`📊 Scanned: ${scannedBlocks} blocks`);
    console.log(`📅 Days since start: ${daysSinceStart}`);
    console.log(`🪙 Buy: $${result.transactions.totalBuys.toFixed(2)} (${totalBuyCount} txs)`);
    console.log(`🪙 Sell: $${result.transactions.totalSells.toFixed(2)} (${totalSellCount} txs)`);
    console.log(`💰 Total Volume: $${result.totalVolume.toFixed(2)}`);
    console.log(`📈 Daily Avg: $${result.dailyVolume.toFixed(2)}`);
    console.log(`💾 Saved to: ${HISTORY_FILE}`);
}

// ==================== ذخیره موقت ====================
function saveProgress(totalBuy, totalSell, buyCount, sellCount, scannedBlocks) {
    const tempResult = {
        lastUpdated: new Date().toISOString(),
        totalVolume: Math.round((totalBuy + totalSell) * 100) / 100,
        scanInfo: {
            scannedBlocks: scannedBlocks,
            buyCount: buyCount,
            sellCount: sellCount
        },
        transactions: {
            totalBuys: Math.round(totalBuy * 100) / 100,
            totalSells: Math.round(totalSell * 100) / 100,
            buyCount: buyCount,
            sellCount: sellCount
        }
    };
    
    fs.writeFileSync('trading-volume-progress.json', JSON.stringify(tempResult, null, 2));
}

// ==================== اجرا ====================
scanAllBlocks().catch(console.error);