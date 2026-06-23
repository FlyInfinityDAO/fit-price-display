const { ethers } = require('ethers');
const fs = require('fs');

// ==================== CONFIG ====================
const TOKEN_ADDRESS = "0xBebe4ea7aA4037CeF5D0bc25a10f9dcA16120Dfa";
const RPC_URL = "https://bsc-dataseed.binance.org/";
const HISTORY_FILE = "trading-volume.json";
const START_DATE = "2025-12-18"; // تاریخ شروع پروژه

// ==================== ABI کامل ====================
const TOKEN_ABI = [
    // ===== رویدادها =====
    {
        "anonymous": false,
        "inputs": [
            {"indexed": true, "internalType": "address", "name": "user", "type": "address"},
            {"indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256"},
            {"indexed": false, "internalType": "uint256", "name": "remaining", "type": "uint256"}
        ],
        "name": "PurchaseExecuted",
        "type": "event"
    },
    // ===== توابع =====
    {
        "inputs": [{"internalType": "address", "name": "_wallet", "type": "address"}, {"internalType": "uint256", "name": "_amount", "type": "uint256"}],
        "name": "Buy",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "uint256", "name": "_amount", "type": "uint256"}],
        "name": "Sell",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];

// ==================== SETUP ====================
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const iface = new ethers.utils.Interface(TOKEN_ABI);

// Selectorها برای فیلتر کردن
const BUY_SELECTOR = "0xe3d4187f"; // Buy(address,uint256)
const SELL_SELECTOR = "0x52288195"; // Sell(uint256)
const PURCHASE_EVENT_TOPIC = ethers.utils.id("PurchaseExecuted(address,uint256,uint256)");

// ==================== ۱. دریافت Buy از رویدادها ====================
async function fetchBuyEvents(fromBlock, toBlock) {
    try {
        const logs = await provider.getLogs({
            address: TOKEN_ADDRESS,
            topics: [PURCHASE_EVENT_TOPIC],
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
                // خطا در decode - نادیده گرفته میشه
            }
        }
        
        return { total: totalBuy, count: buyCount };
    } catch (error) {
        console.error(`  ❌ Error fetching buy events:`, error.message);
        return { total: 0, count: 0 };
    }
}

// ==================== ۲. دریافت Sell از تراکنش‌ها ====================
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
            // بررسی اینکه آیا این یک تراکنش Sell هست
            // در logs، داده‌های تراکنش در data ذخیره میشن
            if (log.data && log.data.length >= 10) {
                const selector = log.data.slice(0, 10);
                if (selector === SELL_SELECTOR) {
                    try {
                        // Decode کردن داده‌های Sell
                        const decoded = iface.decodeFunctionData("Sell", log.data);
                        const amount = parseFloat(ethers.utils.formatEther(decoded._amount));
                        totalSell += amount;
                        sellCount++;
                    } catch (e) {
                        // خطا در decode - نادیده گرفته میشه
                    }
                }
            }
        }
        
        return { total: totalSell, count: sellCount };
    } catch (error) {
        console.error(`  ❌ Error fetching sell transactions:`, error.message);
        return { total: 0, count: 0 };
    }
}

// ==================== ۳. دریافت بلاک شروع از تاریخ ====================
async function getStartBlock() {
    try {
        const startDate = new Date(START_DATE);
        const startTimestamp = Math.floor(startDate.getTime() / 1000);
        
        // جستجوی بلاک نزدیک به تاریخ شروع
        // روش ساده: از بلاک ۴۰۰۰۰۰۰۰ شروع کن (تخمینی برای BSC)
        // برای دقت بیشتر می‌تونی از API دیگه استفاده کنی
        return 40000000; // تخمین برای دسامبر ۲۰۲۵ در BSC
    } catch (error) {
        console.error('❌ Error getting start block:', error);
        return 40000000;
    }
}

// ==================== ۴. اسکن مرحله‌ای ====================
async function scanAllBlocks() {
    console.log('🔄 Starting blockchain scan for Trading Volume...');
    console.log(`📅 Start date: ${START_DATE}`);
    
    const startTime = Date.now();
    const currentBlock = await provider.getBlockNumber();
    console.log(`📊 Current block: ${currentBlock}`);
    
    // ===== دریافت بلاک شروع =====
    const fromBlock = await getStartBlock();
    console.log(`📍 Start block: ${fromBlock}`);
    
    // ===== پارامترهای اسکن =====
    const BATCH_SIZE = 5000; // هر بار ۵۰۰۰ بلاک
    let totalBuy = 0;
    let totalSell = 0;
    let buyCount = 0;
    let sellCount = 0;
    let scannedBlocks = 0;
    
    console.log(`📋 Scanning blocks ${fromBlock} to ${currentBlock}...`);
    console.log(`📦 Batch size: ${BATCH_SIZE} blocks\n`);
    
    // ===== اسکن مرحله‌ای =====
    for (let start = fromBlock; start < currentBlock; start += BATCH_SIZE) {
        const end = Math.min(start + BATCH_SIZE - 1, currentBlock);
        const progress = ((start - fromBlock) / (currentBlock - fromBlock) * 100).toFixed(1);
        console.log(`  🔍 [${progress}%] Scanning blocks ${start} to ${end}...`);
        
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
            
            // نمایش وضعیت هر ۵ مرحله
            if (scannedBlocks % (BATCH_SIZE * 5) === 0) {
                console.log(`  📊 Progress: ${scannedBlocks} blocks scanned`);
                console.log(`  💰 Buy: $${totalBuy.toFixed(2)} (${buyCount} txs)`);
                console.log(`  💰 Sell: $${totalSell.toFixed(2)} (${sellCount} txs)`);
                console.log(`  💰 Total: $${(totalBuy + totalSell).toFixed(2)}\n`);
                
                // ذخیره موقت
                saveProgress(totalBuy, totalSell, buyCount, sellCount, scannedBlocks);
            }
            
        } catch (error) {
            console.error(`  ❌ Error scanning blocks ${start}-${end}:`, error.message);
            // ادامه بده
        }
        
        // جلوگیری از rate limit
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // ===== محاسبه نهایی =====
    const totalVolume = totalBuy + totalSell;
    const daysSinceStart = Math.ceil((Date.now() - new Date(START_DATE).getTime()) / (1000 * 60 * 60 * 24));
    const dailyVolume = daysSinceStart > 0 ? totalVolume / daysSinceStart : 0;
    
    const result = {
        lastUpdated: new Date().toISOString(),
        totalVolume: Math.round(totalVolume * 100) / 100,
        dailyVolume: Math.round(dailyVolume * 100) / 100,
        scanInfo: {
            scannedBlocks: scannedBlocks,
            fromBlock: fromBlock,
            toBlock: currentBlock,
            buyCount: buyCount,
            sellCount: sellCount,
            daysSinceStart: daysSinceStart
        },
        transactions: {
            totalBuys: Math.round(totalBuy * 100) / 100,
            totalSells: Math.round(totalSell * 100) / 100,
            buyCount: buyCount,
            sellCount: sellCount
        }
    };
    
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(result, null, 2));
    
    console.log(`\n✅ ===== SCAN COMPLETED =====`);
    console.log(`⏱️  Time: ${(Date.now() - startTime) / 1000}s`);
    console.log(`📊 Scanned: ${scannedBlocks} blocks`);
    console.log(`📅 Days since start: ${daysSinceStart}`);
    console.log(`🪙 Buy: $${result.transactions.totalBuys.toFixed(2)} (${buyCount} txs)`);
    console.log(`🪙 Sell: $${result.transactions.totalSells.toFixed(2)} (${sellCount} txs)`);
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
