const { ethers } = require('ethers');
const fs = require('fs');

// ==================== CONFIG ====================
const TOKEN_ADDRESS = "0xBebe4ea7aA4037CeF5D0bc25a10f9dcA16120Dfa";
const RPC_URL = "https://bsc-dataseed.binance.org/";
const HISTORY_FILE = "trading-volume.json";
const PROGRESS_FILE = "trading-volume-progress.json";

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

// ==================== بارگذاری داده‌های قبلی ====================
function loadProgress() {
    try {
        const data = fs.readFileSync(PROGRESS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        // اگر فایل وجود نداشت، از بلاک ۱۰۶۰۰۰۰۰۰ شروع کن (بلاک‌های اخیر)
        return {
            lastScannedBlock: 106000000,
            totalBuy: 0,
            totalSell: 0,
            buyCount: 0,
            sellCount: 0
        };
    }
}

function loadMainData() {
    try {
        const data = fs.readFileSync(HISTORY_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) {
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
}

// ==================== ذخیره داده‌ها ====================
function saveProgress(progress) {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

function saveMainData(data) {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(data, null, 2));
}

// ==================== اسکن اصلی ====================
async function scanAllBlocks() {
    console.log('🔄 Starting blockchain scan for Trading Volume...');
    console.log(`📦 Token: ${TOKEN_ADDRESS}`);
    console.log(`🔗 RPC: ${RPC_URL}`);
    console.log('═══════════════════════════════════════');
    
    const startTime = Date.now();
    
    // ===== بارگذاری داده‌های قبلی =====
    const progress = loadProgress();
    const mainData = loadMainData();
    
    // ===== دریافت بلاک فعلی =====
    const currentBlock = await provider.getBlockNumber();
    console.log(`📊 Current block: ${currentBlock.toLocaleString()}`);
    
    // ===== تعیین محدوده اسکن =====
    let fromBlock = progress.lastScannedBlock + 1;
    let toBlock = currentBlock;
    
    console.log(`📍 Last scanned: ${progress.lastScannedBlock.toLocaleString()}`);
    console.log(`🔄 New blocks: ${fromBlock.toLocaleString()} to ${toBlock.toLocaleString()}`);
    console.log(`📊 Total blocks to scan: ${(toBlock - fromBlock + 1).toLocaleString()}`);
    
    // اگر بلاک جدیدی نداریم
    if (fromBlock > toBlock) {
        console.log('✅ No new blocks to scan!');
        console.log(`📊 Total Volume: $${mainData.totalVolume.toFixed(2)}`);
        console.log(`🟢 Buys: ${mainData.transactions.buyCount}`);
        console.log(`🔴 Sells: ${mainData.transactions.sellCount}`);
        return;
    }
    
    // ===== محدود کردن تعداد بلاک‌ها برای جلوگیری از timeout =====
    const MAX_BLOCKS_PER_RUN = 5000;
    if (toBlock - fromBlock + 1 > MAX_BLOCKS_PER_RUN) {
        toBlock = fromBlock + MAX_BLOCKS_PER_RUN - 1;
        console.log(`⚠️ Limiting to ${MAX_BLOCKS_PER_RUN.toLocaleString()} blocks per run`);
        console.log(`📊 Scanning: ${fromBlock.toLocaleString()} to ${toBlock.toLocaleString()}`);
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
    
    const filter = contract.filters.Transfer(null, null);
    const events = await contract.queryFilter(filter, fromBlock, toBlock);
    
    console.log(`📝 Found ${events.length.toLocaleString()} Transfer events`);
    
    if (events.length === 0) {
        console.log('ℹ️ No transfer events found in this range');
        // آپدیت lastScannedBlock
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
                if (processedCount <= 20) {
                    console.log(`  🟢 BUY #${buyCount}: ${amount.toFixed(2)} FIT = $${usdValue.toFixed(2)}`);
                }
            }
            // تشخیص Sell (برداشت از قرارداد)
            else if (from.toLowerCase() === TOKEN_ADDRESS.toLowerCase()) {
                totalSell += usdValue;
                sellCount++;
                processedCount++;
                if (processedCount <= 20) {
                    console.log(`  🔴 SELL #${sellCount}: ${amount.toFixed(2)} FIT = $${usdValue.toFixed(2)}`);
                }
            }
            
            // نمایش هر ۱۰۰ تراکنش
            if (processedCount % 100 === 0 && processedCount > 0) {
                console.log(`  📊 Processed ${processedCount} transactions...`);
            }
            
        } catch (e) {
            // خطا در پردازش یک رویداد - نادیده گرفته میشه
        }
    }
    
    if (processedCount > 20) {
        console.log(`  ... and ${processedCount - 20} more transactions`);
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
    const daysSinceStart = Math.ceil((Date.now() - new Date('2025-12-18').getTime()) / (1000 * 60 * 60 * 24));
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
    console.log(`📊 Scanned: ${(toBlock - fromBlock + 1).toLocaleString()} blocks`);
    console.log(`📅 Days since start: ${daysSinceStart}`);
    console.log(`🟢 Buys: $${mainData.transactions.totalBuys.toFixed(2)} (${buyCount} txs)`);
    console.log(`🔴 Sells: $${mainData.transactions.totalSells.toFixed(2)} (${sellCount} txs)`);
    console.log(`💰 Total Volume: $${mainData.totalVolume.toFixed(2)}`);
    console.log(`📈 Daily Avg: $${mainData.dailyVolume.toFixed(2)}`);
    console.log(`💾 Saved to: ${HISTORY_FILE}`);
    console.log('═══════════════════════════════════════');
}

// ==================== اجرا ====================
scanAllBlocks()
    .then(() => {
        console.log('\n✨ Script finished successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Script failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    });