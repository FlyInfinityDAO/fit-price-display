const { ethers } = require('ethers');
const fs = require('fs');

// ==================== CONFIG ====================
const TOKEN_ADDRESS = "0xBebe4ea7aA4037CeF5D0bc25a10f9dcA16120Dfa";
const RPC_URL = "https://bsc-dataseed.binance.org/";
const HISTORY_FILE = "trading-volume.json";

// ==================== ABI ====================
const TOKEN_ABI = [
    // فقط برای decode کردن رویدادها نیاز داریم
    "event PurchaseExecuted(address indexed user, uint256 amount, uint256 remaining)"
];

const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const iface = new ethers.utils.Interface(TOKEN_ABI);

// ==================== پارامترها ====================
const EVENT_TOPIC = "0x9b20b36b6f0e4d87b0fd6f3af2d1ad8b0dce5ebd3a7036ca102bfd5ba9d96cc"; // PurchaseExecuted
const BUY_SELECTOR = "0xe3d4187f"; // تابع Buy
const SELL_SELECTOR = "0x52288195"; // تابع Sell

// ==================== تابع برای دریافت تراکنش‌های Sell ====================
async function fetchSellTransactions(fromBlock, toBlock) {
    try {
        // دریافت تراکنش‌های قرارداد در بازه
        const logs = await provider.getLogs({
            address: TOKEN_ADDRESS,
            fromBlock: fromBlock,
            toBlock: toBlock
        });
        
        let totalSell = 0;
        let sellCount = 0;
        
        for (const log of logs) {
            // بررسی اینکه آیا تراکنش Sell هست
            // روش ۱: بررسی selector در data
            if (log.data && log.data.length >= 10) {
                const selector = log.data.slice(0, 10);
                if (selector === SELL_SELECTOR) {
                    // استخراج مقدار از data (نیاز به decode داره)
                    // اینجا ساده شده - در واقعیت باید ABI کامل داشته باشی
                    sellCount++;
                }
            }
            
            // روش ۲: بررسی topic (اگر رویداد Sell وجود داشت)
            //但目前 رویداد Sell وجود ندارد
        }
        
        // محاسبه تقریبی (در صورت عدم وجود داده دقیق)
        // برای دقت بیشتر باید ABI کامل داشته باشی
        return { total: totalSell, count: sellCount };
    } catch (error) {
        console.error(`❌ Error fetching sell transactions:`, error);
        return { total: 0, count: 0 };
    }
}

// ==================== تابع برای دریافت Buy از رویدادها ====================
async function fetchBuyEvents(fromBlock, toBlock) {
    try {
        const logs = await provider.getLogs({
            address: TOKEN_ADDRESS,
            topics: [EVENT_TOPIC],
            fromBlock: fromBlock,
            toBlock: toBlock
        });
        
        let totalBuy = 0;
        let buyCount = 0;
        
        for (const log of logs) {
            try {
                const decoded = iface.parseLog(log);
                const amount = parseFloat(ethers.utils.formatEther(decoded.args.amount));
                totalBuy += amount;
                buyCount++;
            } catch (e) {
                // خطا در decode
            }
        }
        
        return { total: totalBuy, count: buyCount };
    } catch (error) {
        console.error(`❌ Error fetching buy events:`, error);
        return { total: 0, count: 0 };
    }
}

// ==================== اسکن مرحله‌ای ====================
async function scanAllBlocks() {
    console.log('🔄 Starting block scan...');
    
    const startTime = Date.now();
    const currentBlock = await provider.getBlockNumber();
    console.log(`📊 Current block: ${currentBlock}`);
    
    // ===== پارامترهای اسکن =====
    const BATCH_SIZE = 5000; // هر بار ۵۰۰۰ بلاک
    let totalBuy = 0;
    let totalSell = 0;
    let buyCount = 0;
    let sellCount = 0;
    let scannedBlocks = 0;
    
    // ===== اسکن از بلاک ۰ تا کنون =====
    // ⚠️ توجه: ممکنه خیلی طول بکشه!
    const fromBlock = 0;
    const toBlock = currentBlock;
    
    console.log(`📋 Scanning blocks ${fromBlock} to ${toBlock}...`);
    
    // اسکن مرحله‌ای
    for (let start = fromBlock; start < toBlock; start += BATCH_SIZE) {
        const end = Math.min(start + BATCH_SIZE - 1, toBlock);
        console.log(`  🔍 Scanning blocks ${start} to ${end}...`);
        
        try {
            // دریافت Buy از رویدادها
            const buyResult = await fetchBuyEvents(start, end);
            totalBuy += buyResult.total;
            buyCount += buyResult.count;
            
            // دریافت Sell از تراکنش‌ها
            const sellResult = await fetchSellTransactions(start, end);
            totalSell += sellResult.total;
            sellCount += sellResult.count;
            
            scannedBlocks += (end - start + 1);
            
            // ذخیره موقت هر ۵ مرحله
            if (scannedBlocks % (BATCH_SIZE * 5) === 0) {
                console.log(`  💾 Progress: ${scannedBlocks} blocks scanned`);
                saveProgress(totalBuy, totalSell, buyCount, sellCount, scannedBlocks);
            }
            
        } catch (error) {
            console.error(`  ❌ Error scanning blocks ${start}-${end}:`, error.message);
            // ادامه بده
        }
        
        // جلوگیری از rate limit
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // ===== ذخیره نهایی =====
    const totalVolume = totalBuy + totalSell;
    const daysSinceStart = Math.ceil((Date.now() - new Date('2025-12-18').getTime()) / (1000 * 60 * 60 * 24));
    
    const result = {
        lastUpdated: new Date().toISOString(),
        totalVolume: Math.round(totalVolume * 100) / 100,
        dailyVolume: daysSinceStart > 0 ? Math.round((totalVolume / daysSinceStart) * 100) / 100 : 0,
        scanInfo: {
            scannedBlocks: scannedBlocks,
            fromBlock: fromBlock,
            toBlock: toBlock,
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
    
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(result, null, 2));
    
    console.log(`\n✅ Scan completed in ${(Date.now() - startTime) / 1000}s`);
    console.log(`📊 Scanned ${scannedBlocks} blocks`);
    console.log(`🪙 Total Buy: $${result.transactions.totalBuys.toFixed(2)} (${buyCount} txs)`);
    console.log(`🪙 Total Sell: $${result.transactions.totalSells.toFixed(2)} (${sellCount} txs)`);
    console.log(`💰 Total Volume: $${result.totalVolume.toFixed(2)}`);
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
