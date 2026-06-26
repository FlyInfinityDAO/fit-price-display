const { ethers } = require('ethers');
const fs = require('fs');

// ==================== CONFIG ====================
const TOKEN_ADDRESS = "0xBebe4ea7aA4037CeF5D0bc25a10f9dcA16120Dfa";
const RPC_URL = "https://bsc-dataseed.binance.org/";
const HISTORY_FILE = "trading-volume.json";
const PROGRESS_FILE = "trading-volume-progress.json";
const START_DATE = "2025-12-18";

// ==================== ABI ====================
const ERC20_ABI = [
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
    {
        "constant": true,
        "inputs": [],
        "name": "Price",
        "outputs": [{"name": "", "type": "uint256"}],
        "type": "function"
    },
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

// ==================== توابع کمکی ====================
function formatNumber(num) {
    if (num === undefined || num === null) return '0';
    return Number(num).toLocaleString();
}

function formatCurrency(num) {
    if (num === undefined || num === null) return '$0.00';
    return '$' + Number(num).toFixed(2);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ==================== بارگذاری داده‌های قبلی ====================
function loadProgress() {
    try {
        if (fs.existsSync(PROGRESS_FILE)) {
            const data = fs.readFileSync(PROGRESS_FILE, 'utf8');
            const parsed = JSON.parse(data);
            return {
                lastScannedBlock: parsed.lastScannedBlock || 106000000,
                totalBuy: parsed.totalBuy || 0,
                totalSell: parsed.totalSell || 0,
                buyCount: parsed.buyCount || 0,
                sellCount: parsed.sellCount || 0
            };
        }
    } catch (e) {
        console.log('⚠️ Could not load progress file, starting fresh');
    }
    
    return {
        lastScannedBlock: 106000000,
        totalBuy: 0,
        totalSell: 0,
        buyCount: 0,
        sellCount: 0
    };
}

function loadMainData() {
    try {
        if (fs.existsSync(HISTORY_FILE)) {
            const data = fs.readFileSync(HISTORY_FILE, 'utf8');
            const parsed = JSON.parse(data);
            return {
                lastUpdated: parsed.lastUpdated || new Date().toISOString(),
                totalVolume: parsed.totalVolume || 0,
                dailyVolume: parsed.dailyVolume || 0,
                scanInfo: parsed.scanInfo || {
                    scannedBlocks: 0,
                    fromBlock: 0,
                    toBlock: 0,
                    buyCount: 0,
                    sellCount: 0,
                    daysSinceStart: 0
                },
                transactions: parsed.transactions || {
                    totalBuys: 0,
                    totalSells: 0,
                    buyCount: 0,
                    sellCount: 0
                }
            };
        }
    } catch (e) {
        console.log('⚠️ Could not load main data file, starting fresh');
    }
    
    return {
        lastUpdated: new Date().toISOString(),
        totalVolume: 0,
        dailyVolume: 0,
        scanInfo: {
            scannedBlocks: 0,
            fromBlock: 0,
            toBlock: 0,
            buyCount: 0,
            sellCount: 0,
            daysSinceStart: 0
        },
        transactions: {
            totalBuys: 0,
            totalSells: 0,
            buyCount: 0,
            sellCount: 0
        }
    };
}

function saveProgress(progress) {
    try {
        fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
    } catch (e) {
        console.error(`❌ Error saving progress: ${e.message}`);
    }
}

function saveMainData(data) {
    try {
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(`❌ Error saving main data: ${e.message}`);
    }
}

// ==================== اسکن یک بازه کوچک ====================
async function scanBlockRange(fromBlock, toBlock, price, decimals) {
    try {
        const filter = contract.filters.Transfer(null, null);
        const events = await contract.queryFilter(filter, fromBlock, toBlock);
        
        let buyTotal = 0;
        let sellTotal = 0;
        let buyCount = 0;
        let sellCount = 0;
        
        for (const event of events) {
            try {
                const { from, to, value } = event.args;
                const amount = parseFloat(ethers.utils.formatUnits(value, decimals));
                
                if (amount < 0.1) continue;
                
                const usdValue = amount * price;
                
                if (to.toLowerCase() === TOKEN_ADDRESS.toLowerCase()) {
                    buyTotal += usdValue;
                    buyCount++;
                } else if (from.toLowerCase() === TOKEN_ADDRESS.toLowerCase()) {
                    sellTotal += usdValue;
                    sellCount++;
                }
            } catch (e) {
                // خطا در پردازش یک رویداد - نادیده گرفته میشه
            }
        }
        
        return { buyTotal, sellTotal, buyCount, sellCount, eventCount: events.length };
    } catch (error) {
        console.error(`  ❌ Error scanning blocks ${fromBlock}-${toBlock}:`, error.message);
        return { buyTotal: 0, sellTotal: 0, buyCount: 0, sellCount: 0, eventCount: 0, error: error.message };
    }
}

// ==================== اسکن اصلی ====================
async function scanAllBlocks() {
    console.log('🚀 Starting blockchain scan for Trading Volume...');
    console.log(`📦 Token: ${TOKEN_ADDRESS}`);
    console.log(`🔗 RPC: ${RPC_URL}`);
    console.log('═══════════════════════════════════════');
    
    const startTime = Date.now();
    
    // ===== بارگذاری داده‌های قبلی =====
    const progress = loadProgress();
    const mainData = loadMainData();
    
    console.log(`📊 Previous data loaded:`);
    console.log(`   Total Volume: ${formatCurrency(progress.totalBuy + progress.totalSell)}`);
    console.log(`   Buys: ${progress.buyCount}`);
    console.log(`   Sells: ${progress.sellCount}`);
    console.log(`   Last Block: ${formatNumber(progress.lastScannedBlock)}`);
    
    // ===== دریافت بلاک فعلی =====
    console.log('\n📡 Connecting to blockchain...');
    let currentBlock;
    try {
        currentBlock = await provider.getBlockNumber();
        console.log(`📊 Current block: ${formatNumber(currentBlock)}`);
    } catch (e) {
        console.error(`❌ Failed to get current block: ${e.message}`);
        throw e;
    }
    
    // ===== تعیین محدوده اسکن =====
    const lastScanned = progress.lastScannedBlock || 106000000;
    let fromBlock = lastScanned + 1;
    let toBlock = currentBlock;
    
    console.log(`📍 Last scanned: ${formatNumber(lastScanned)}`);
    console.log(`🔄 New blocks: ${formatNumber(fromBlock)} to ${formatNumber(toBlock)}`);
    console.log(`📊 Total blocks to scan: ${formatNumber(toBlock - fromBlock + 1)}`);
    
    // اگر بلاک جدیدی نداریم
    if (fromBlock > toBlock) {
        console.log('\n✅ No new blocks to scan!');
        console.log(`📊 Total Volume: ${formatCurrency(mainData.totalVolume || 0)}`);
        console.log(`🟢 Buys: ${mainData.transactions?.buyCount || 0}`);
        console.log(`🔴 Sells: ${mainData.transactions?.sellCount || 0}`);
        return;
    }
    
    // ===== دریافت قیمت و decimals =====
    console.log('\n📡 Fetching contract data...');
    let price = 6.00;
    let decimals = 18;
    
    try {
        const priceRaw = await contract.Price();
        price = parseFloat(ethers.utils.formatEther(priceRaw));
        console.log(`💲 Current Price: $${price.toFixed(6)}`);
    } catch (e) {
        console.warn(`⚠️ Could not fetch price, using default: $${price.toFixed(2)}`);
    }
    
    try {
        decimals = await contract.decimals();
        console.log(`🔢 Decimals: ${decimals}`);
    } catch (e) {
        console.warn(`⚠️ Could not fetch decimals, using default: ${decimals}`);
    }
    
    // ===== اسکن مرحله‌ای با بلاک‌های کوچک =====
    console.log('\n🔍 Scanning transactions in batches...');
    console.log('═══════════════════════════════════════');
    
    const BATCH_SIZE = 1000; // هر بار ۱۰۰۰ بلاک
    const DELAY_BETWEEN_BATCHES = 2000; // ۲ ثانیه بین هر اسکن
    
    let totalBuy = progress.totalBuy || 0;
    let totalSell = progress.totalSell || 0;
    let buyCount = progress.buyCount || 0;
    let sellCount = progress.sellCount || 0;
    let scannedBlocks = 0;
    let batchNumber = 0;
    let hasError = false;
    
    // محدود کردن به ۵۰ بچ (۵۰,۰۰۰ بلاک) در هر اجرا
    const MAX_BATCHES = 50;
    let currentFrom = fromBlock;
    
    while (currentFrom <= toBlock && batchNumber < MAX_BATCHES) {
        const currentTo = Math.min(currentFrom + BATCH_SIZE - 1, toBlock);
        batchNumber++;
        
        console.log(`\n📦 Batch ${batchNumber}/${Math.min(MAX_BATCHES, Math.ceil((toBlock - fromBlock + 1) / BATCH_SIZE))}`);
        console.log(`   Scanning: ${formatNumber(currentFrom)} to ${formatNumber(currentTo)}`);
        
        const result = await scanBlockRange(currentFrom, currentTo, price, decimals);
        
        if (result.error) {
            console.log(`   ⚠️ Error in batch, will retry with smaller size...`);
            // اگر خطا داشت، با سایز کوچکتر امتحان کن
            const SMALL_BATCH = 200;
            let smallFrom = currentFrom;
            let smallTo = Math.min(smallFrom + SMALL_BATCH - 1, currentTo);
            
            while (smallFrom <= currentTo) {
                console.log(`   🔄 Retry: ${formatNumber(smallFrom)} to ${formatNumber(smallTo)}`);
                const smallResult = await scanBlockRange(smallFrom, smallTo, price, decimals);
                
                if (smallResult.error) {
                    console.log(`   ❌ Still failing, skipping this range`);
                    break;
                }
                
                totalBuy += smallResult.buyTotal;
                totalSell += smallResult.sellTotal;
                buyCount += smallResult.buyCount;
                sellCount += smallResult.sellCount;
                scannedBlocks += (smallTo - smallFrom + 1);
                
                smallFrom = smallTo + 1;
                smallTo = Math.min(smallFrom + SMALL_BATCH - 1, currentTo);
                
                // ذخیره موقت هر بار
                progress.lastScannedBlock = smallTo;
                progress.totalBuy = totalBuy;
                progress.totalSell = totalSell;
                progress.buyCount = buyCount;
                progress.sellCount = sellCount;
                saveProgress(progress);
                
                await sleep(1000);
            }
        } else {
            totalBuy += result.buyTotal;
            totalSell += result.sellTotal;
            buyCount += result.buyCount;
            sellCount += result.sellCount;
            scannedBlocks += (currentTo - currentFrom + 1);
            
            console.log(`   📝 Found ${result.eventCount} events`);
            console.log(`   🟢 Buys: ${result.buyCount} ($${result.buyTotal.toFixed(2)})`);
            console.log(`   🔴 Sells: ${result.sellCount} ($${result.sellTotal.toFixed(2)})`);
            
            // ذخیره پیشرفت
            progress.lastScannedBlock = currentTo;
            progress.totalBuy = totalBuy;
            progress.totalSell = totalSell;
            progress.buyCount = buyCount;
            progress.sellCount = sellCount;
            saveProgress(progress);
        }
        
        currentFrom = currentTo + 1;
        
        // صبر بین بچ‌ها
        if (currentFrom <= toBlock && batchNumber < MAX_BATCHES) {
            console.log(`   ⏳ Waiting ${DELAY_BETWEEN_BATCHES/1000}s before next batch...`);
            await sleep(DELAY_BETWEEN_BATCHES);
        }
    }
    
    // ===== اگر بلاک‌های بیشتری مونده، ذخیره کن برای دفعه بعد =====
    if (currentFrom <= toBlock) {
        console.log(`\n⏸️  Paused. ${formatNumber(toBlock - currentFrom + 1)} blocks remaining for next run.`);
        console.log(`   Last scanned: ${formatNumber(currentFrom - 1)}`);
        progress.lastScannedBlock = currentFrom - 1;
        saveProgress(progress);
    }
    
    // ===== محاسبه آمار نهایی =====
    const totalVolume = totalBuy + totalSell;
    const daysSinceStart = Math.ceil((Date.now() - new Date(START_DATE).getTime()) / (1000 * 60 * 60 * 24));
    const dailyVolume = daysSinceStart > 0 ? totalVolume / daysSinceStart : 0;
    
    // ===== ذخیره داده اصلی =====
    mainData.lastUpdated = new Date().toISOString();
    mainData.totalVolume = Math.round(totalVolume * 100) / 100;
    mainData.dailyVolume = Math.round(dailyVolume * 100) / 100;
    mainData.scanInfo = {
        scannedBlocks: scannedBlocks,
        fromBlock: fromBlock,
        toBlock: currentFrom - 1,
        buyCount: buyCount,
        sellCount: sellCount,
        daysSinceStart: daysSinceStart
    };
    mainData.transactions = {
        totalBuys: Math.round(totalBuy * 100) / 100,
        totalSells: Math.round(totalSell * 100) / 100,
        buyCount: buyCount,
        sellCount: sellCount
    };
    saveMainData(mainData);
    
    // ===== نمایش نتیجه نهایی =====
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n═══════════════════════════════════════');
    console.log('✅ ===== SCAN COMPLETED =====');
    console.log(`⏱️  Time: ${elapsed}s`);
    console.log(`📊 Scanned: ${formatNumber(scannedBlocks)} blocks`);
    console.log(`📅 Days since start: ${daysSinceStart}`);
    console.log(`🟢 Buys: ${formatCurrency(mainData.transactions.totalBuys)} (${buyCount} txs)`);
    console.log(`🔴 Sells: ${formatCurrency(mainData.transactions.totalSells)} (${sellCount} txs)`);
    console.log(`💰 Total Volume: ${formatCurrency(mainData.totalVolume)}`);
    console.log(`📈 Daily Avg: ${formatCurrency(mainData.dailyVolume)}`);
    console.log(`💾 Saved to: ${HISTORY_FILE}`);
    console.log('═══════════════════════════════════════');
}

// ==================== اجرا ====================
console.log('=' .repeat(50));
console.log('🚀 TRADING VOLUME UPDATER');
console.log('=' .repeat(50));

scanAllBlocks()
    .then(() => {
        console.log('\n✨ Script finished successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Script failed:', error.message);
        if (error.stack) {
            console.error('📋 Stack trace:');
            console.error(error.stack);
        }
        process.exit(1);
    });