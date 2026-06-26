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
    
    // مقدار پیش‌فرض
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
    
    // مقدار پیش‌فرض
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

// ==================== ذخیره داده‌ها ====================
function saveProgress(progress) {
    try {
        fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
        console.log(`💾 Progress saved to ${PROGRESS_FILE}`);
    } catch (e) {
        console.error(`❌ Error saving progress: ${e.message}`);
    }
}

function saveMainData(data) {
    try {
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(data, null, 2));
        console.log(`💾 Main data saved to ${HISTORY_FILE}`);
    } catch (e) {
        console.error(`❌ Error saving main data: ${e.message}`);
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
    
    // ===== محدود کردن تعداد بلاک‌ها =====
    const MAX_BLOCKS_PER_RUN = 5000;
    if (toBlock - fromBlock + 1 > MAX_BLOCKS_PER_RUN) {
        toBlock = fromBlock + MAX_BLOCKS_PER_RUN - 1;
        console.log(`⚠️ Limiting to ${formatNumber(MAX_BLOCKS_PER_RUN)} blocks per run`);
        console.log(`📊 Scanning: ${formatNumber(fromBlock)} to ${formatNumber(toBlock)}`);
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
    
    // ===== اسکن تراکنش‌ها =====
    console.log('\n🔍 Scanning transactions...');
    console.log('═══════════════════════════════════════');
    
    let events = [];
    try {
        const filter = contract.filters.Transfer(null, null);
        events = await contract.queryFilter(filter, fromBlock, toBlock);
        console.log(`📝 Found ${formatNumber(events.length)} Transfer events`);
    } catch (e) {
        console.error(`❌ Error fetching events: ${e.message}`);
        // ذخیره پیشرفت و خروج
        progress.lastScannedBlock = toBlock;
        saveProgress(progress);
        throw e;
    }
    
    if (events.length === 0) {
        console.log('ℹ️ No transfer events found in this range');
        progress.lastScannedBlock = toBlock;
        saveProgress(progress);
        return;
    }
    
    // ===== پردازش رویدادها =====
    let totalBuy = progress.totalBuy || 0;
    let totalSell = progress.totalSell || 0;
    let buyCount = progress.buyCount || 0;
    let sellCount = progress.sellCount || 0;
    let processedCount = 0;
    let displayCount = 0;
    
    for (const event of events) {
        try {
            const { from, to, value } = event.args;
            const amount = parseFloat(ethers.utils.formatUnits(value, decimals));
            
            // فقط تراکنش‌های بزرگتر از ۰.۱ FIT رو حساب کن
            if (amount < 0.1) continue;
            
            const usdValue = amount * price;
            
            // تشخیص Buy (واریز به قرارداد)
            if (to.toLowerCase() === TOKEN_ADDRESS.toLowerCase()) {
                totalBuy += usdValue;
                buyCount++;
                processedCount++;
                if (displayCount < 20) {
                    console.log(`  🟢 BUY #${buyCount}: ${amount.toFixed(2)} FIT = $${usdValue.toFixed(2)}`);
                    displayCount++;
                }
            }
            // تشخیص Sell (برداشت از قرارداد)
            else if (from.toLowerCase() === TOKEN_ADDRESS.toLowerCase()) {
                totalSell += usdValue;
                sellCount++;
                processedCount++;
                if (displayCount < 20) {
                    console.log(`  🔴 SELL #${sellCount}: ${amount.toFixed(2)} FIT = $${usdValue.toFixed(2)}`);
                    displayCount++;
                }
            }
            
            // نمایش هر ۱۰۰ تراکنش
            if (processedCount % 100 === 0 && processedCount > 0) {
                console.log(`  📊 Processed ${formatNumber(processedCount)} transactions...`);
            }
            
        } catch (e) {
            // خطا در پردازش یک رویداد - نادیده گرفته میشه
        }
    }
    
    if (processedCount > 20) {
        console.log(`  ... and ${formatNumber(processedCount - 20)} more transactions`);
    }
    
    // ===== ذخیره پیشرفت =====
    progress.lastScannedBlock = toBlock;
    progress.totalBuy = totalBuy;
    progress.totalSell = totalSell;
    progress.buyCount = buyCount;
    progress.sellCount = sellCount;
    saveProgress(progress);
    
    // ===== محاسبه آمار =====
    const totalVolume = totalBuy + totalSell;
    const daysSinceStart = Math.ceil((Date.now() - new Date(START_DATE).getTime()) / (1000 * 60 * 60 * 24));
    const dailyVolume = daysSinceStart > 0 ? totalVolume / daysSinceStart : 0;
    
    // ===== ذخیره داده اصلی =====
    mainData.lastUpdated = new Date().toISOString();
    mainData.totalVolume = Math.round(totalVolume * 100) / 100;
    mainData.dailyVolume = Math.round(dailyVolume * 100) / 100;
    mainData.scanInfo = {
        scannedBlocks: toBlock - fromBlock + 1,
        fromBlock: fromBlock,
        toBlock: toBlock,
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
    console.log(`📊 Scanned: ${formatNumber(toBlock - fromBlock + 1)} blocks`);
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