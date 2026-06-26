const { ethers } = require('ethers');
const fs = require('fs');

// ==================== CONFIG ====================
const TOKEN_ADDRESS = "0xBebe4ea7aA4037CeF5D0bc25a10f9dcA16120Dfa";
const DAI_ADDRESS = "0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3";
const NETWORK_ADDRESS = "0x7f1cB4fce7cB3b6C612c4A7Dd123D3865640dC1B";
const RPC_URL = "https://bsc-dataseed.binance.org/";
const HISTORY_FILE = "trading-volume.json";
const PROGRESS_FILE = "trading-volume-progress.json";
const START_DATE = "2025-12-18";

// ==================== ABI ====================
const TOKEN_ABI = [
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

const DAI_ABI = [
    {
        "constant": true,
        "inputs": [{"name": "account", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "", "type": "uint256"}],
        "type": "function"
    }
];

const NETWORK_ABI = [
    {
        "constant": true,
        "inputs": [],
        "name": "All_Owner_Number",
        "outputs": [{"name": "", "type": "uint64"}],
        "type": "function"
    }
];

// ==================== SETUP ====================
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const tokenContract = new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, provider);
const daiContract = new ethers.Contract(DAI_ADDRESS, DAI_ABI, provider);
const networkContract = new ethers.Contract(NETWORK_ADDRESS, NETWORK_ABI, provider);

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
                lastScannedBlock: parsed.lastScannedBlock || 0,
                totalBuy: parsed.totalBuy || 0,
                buyCount: parsed.buyCount || 0,
                lastReserve: parsed.lastReserve || 0
            };
        }
    } catch (e) {
        console.log('⚠️ Could not load progress file, starting fresh');
    }
    
    return {
        lastScannedBlock: 0,
        totalBuy: 0,
        buyCount: 0,
        lastReserve: 0
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
        console.log(`💾 Progress saved`);
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

// ==================== اسکن تراکنش‌های DAI به قرارداد ====================
async function scanDAITransfers(fromBlock, toBlock) {
    try {
        // فیلتر برای تراکنش‌های DAI که به قرارداد FIT رفته
        const filter = {
            address: DAI_ADDRESS,
            topics: [
                ethers.utils.id("Transfer(address,address,uint256)"),
                null,
                ethers.utils.hexZeroPad(TOKEN_ADDRESS.toLowerCase(), 32)
            ],
            fromBlock: fromBlock,
            toBlock: toBlock
        };
        
        const logs = await provider.getLogs(filter);
        let totalDAI = 0;
        let count = 0;
        
        // دریافت decimals DAI
        let decimals = 18;
        try {
            const daiContractTemp = new ethers.Contract(DAI_ADDRESS, [
                "function decimals() view returns (uint8)"
            ], provider);
            decimals = await daiContractTemp.decimals();
        } catch (e) {
            decimals = 18;
        }
        
        for (const log of logs) {
            try {
                const decoded = ethers.utils.defaultAbiCoder.decode(
                    ['address', 'address', 'uint256'],
                    log.data
                );
                const amount = parseFloat(ethers.utils.formatUnits(decoded[2], decimals));
                if (amount > 0) {
                    totalDAI += amount;
                    count++;
                }
            } catch (e) {
                // خطا در decode - نادیده گرفته میشه
            }
        }
        
        return { totalDAI, count };
    } catch (error) {
        console.error(`  ❌ Error scanning DAI transfers:`, error.message);
        return { totalDAI: 0, count: 0 };
    }
}

// ==================== اسکن اصلی ====================
async function scanAllBlocks() {
    console.log('🚀 Starting Trading Volume scanner (DAI TRANSFER METHOD)...');
    console.log(`📦 Token: ${TOKEN_ADDRESS}`);
    console.log(`💰 DAI: ${DAI_ADDRESS}`);
    console.log(`🔗 RPC: ${RPC_URL}`);
    console.log('═══════════════════════════════════════');
    
    const startTime = Date.now();
    
    // ===== بارگذاری داده‌های قبلی =====
    const progress = loadProgress();
    const mainData = loadMainData();
    
    console.log(`📊 Previous data loaded:`);
    console.log(`   Total Buy: $${progress.totalBuy.toFixed(2)}`);
    console.log(`   Buys: ${progress.buyCount}`);
    console.log(`   Last Block: ${formatNumber(progress.lastScannedBlock)}`);
    
    // ===== دریافت بلاک فعلی =====
    console.log('\n📡 Connecting to blockchain...');
    const currentBlock = await provider.getBlockNumber();
    console.log(`📊 Current block: ${formatNumber(currentBlock)}`);
    
    // ===== تعیین محدوده اسکن =====
    const lastScanned = progress.lastScannedBlock || 0;
    let fromBlock = lastScanned + 1;
    let toBlock = currentBlock;
    
    console.log(`📍 Last scanned: ${formatNumber(lastScanned)}`);
    console.log(`🔄 New blocks: ${formatNumber(fromBlock)} to ${formatNumber(toBlock)}`);
    console.log(`📊 Total blocks to scan: ${formatNumber(toBlock - fromBlock + 1)}`);
    
    // اگر بلاک جدیدی نداریم
    if (fromBlock > toBlock) {
        console.log('\n✅ No new blocks to scan!');
        console.log(`📊 Trading Volume: ${formatCurrency(progress.totalBuy)}`);
        return;
    }
    
    // ===== دریافت قیمت =====
    console.log('\n📡 Fetching contract data...');
    let price = 6.00;
    try {
        const priceRaw = await tokenContract.Price();
        price = parseFloat(ethers.utils.formatEther(priceRaw));
        console.log(`💲 Current Price: $${price.toFixed(6)}`);
    } catch (e) {
        console.warn(`⚠️ Could not fetch price, using default: $${price.toFixed(2)}`);
    }
    
    // ===== اسکن مرحله‌ای =====
    console.log('\n🔍 Scanning DAI transfers to contract...');
    console.log('═══════════════════════════════════════');
    
    const BATCH_SIZE = 5000;
    const DELAY_BETWEEN_BATCHES = 2000;
    const MAX_BATCHES = 20;
    
    let totalBuy = progress.totalBuy || 0;
    let buyCount = progress.buyCount || 0;
    let scannedBlocks = 0;
    let batchNumber = 0;
    let currentFrom = fromBlock;
    
    while (currentFrom <= toBlock && batchNumber < MAX_BATCHES) {
        const currentTo = Math.min(currentFrom + BATCH_SIZE - 1, toBlock);
        batchNumber++;
        
        console.log(`\n📦 Batch ${batchNumber}/${Math.min(MAX_BATCHES, Math.ceil((toBlock - fromBlock + 1) / BATCH_SIZE))}`);
        console.log(`   Scanning: ${formatNumber(currentFrom)} to ${formatNumber(currentTo)}`);
        
        const result = await scanDAITransfers(currentFrom, currentTo);
        
        totalBuy += result.totalDAI;
        buyCount += result.count;
        scannedBlocks += (currentTo - currentFrom + 1);
        
        console.log(`   📝 Found ${result.count} DAI transfers`);
        console.log(`   💰 Total DAI: $${result.totalDAI.toFixed(2)}`);
        console.log(`   📊 Total so far: $${totalBuy.toFixed(2)} (${buyCount} txs)`);
        
        // ذخیره پیشرفت
        progress.lastScannedBlock = currentTo;
        progress.totalBuy = totalBuy;
        progress.buyCount = buyCount;
        saveProgress(progress);
        
        currentFrom = currentTo + 1;
        
        if (currentFrom <= toBlock && batchNumber < MAX_BATCHES) {
            console.log(`   ⏳ Waiting ${DELAY_BETWEEN_BATCHES/1000}s...`);
            await sleep(DELAY_BETWEEN_BATCHES);
        }
    }
    
    // ===== اگر بلاک‌های بیشتری مونده =====
    if (currentFrom <= toBlock) {
        console.log(`\n⏸️  Paused. ${formatNumber(toBlock - currentFrom + 1)} blocks remaining for next run.`);
        progress.lastScannedBlock = currentFrom - 1;
        saveProgress(progress);
    }
    
    // ===== دریافت نقدینگی فعلی و محاسبه =====
    console.log('\n📊 Calculating Trading Volume...');
    console.log('═══════════════════════════════════════');
    
    // دریافت نقدینگی فعلی
    const currentReserveRaw = await daiContract.balanceOf(TOKEN_ADDRESS);
    const currentReserve = parseFloat(ethers.utils.formatEther(currentReserveRaw));
    console.log(`💰 Current Reserve: $${currentReserve.toFixed(2)}`);
    
    // دریافت تعداد اعضا
    let totalOwners = 0;
    try {
        const totalOwnersRaw = await networkContract.All_Owner_Number();
        totalOwners = parseInt(totalOwnersRaw.toString());
    } catch (e) {
        console.warn('⚠️ Could not fetch owners count');
    }
    
    const OLD_CONTRACT_OWNERS = 80897;
    const newOwners = Math.max(0, totalOwners - OLD_CONTRACT_OWNERS);
    const totalAirdrops = newOwners * 2;
    const totalMembershipFees = newOwners * 2;
    const nonBuyIncoming = totalAirdrops + totalMembershipFees;
    
    // ===== محاسبه Sell با روش خودت =====
    // Sell = (Buy + Airdrops + MembershipFees) - Reserve
    const totalSell = Math.max(0, totalBuy + nonBuyIncoming - currentReserve);
    const tradingVolume = totalBuy + totalSell;
    
    console.log(`\n📊 Calculation Details:`);
    console.log(`   📥 Total Buys (DAI incoming): $${totalBuy.toFixed(2)} (${buyCount} txs)`);
    console.log(`   🎁 Airdrops: $${totalAirdrops.toFixed(2)}`);
    console.log(`   👥 Membership Fees: $${totalMembershipFees.toFixed(2)}`);
    console.log(`   💰 Current Reserve: $${currentReserve.toFixed(2)}`);
    console.log(`   📤 Total Sells: $${totalSell.toFixed(2)}`);
    console.log(`   📊 Trading Volume: $${tradingVolume.toFixed(2)}`);
    
    // ===== ذخیره داده‌ها =====
    const daysSinceStart = Math.ceil((Date.now() - new Date(START_DATE).getTime()) / (1000 * 60 * 60 * 24));
    const dailyVolume = daysSinceStart > 0 ? tradingVolume / daysSinceStart : 0;
    
    // آپدیت progress
    progress.totalBuy = totalBuy;
    progress.buyCount = buyCount;
    progress.lastReserve = currentReserve;
    saveProgress(progress);
    
    // آپدیت main data
    mainData.lastUpdated = new Date().toISOString();
    mainData.totalVolume = Math.round(tradingVolume * 100) / 100;
    mainData.dailyVolume = Math.round(dailyVolume * 100) / 100;
    mainData.scanInfo = {
        scannedBlocks: scannedBlocks,
        fromBlock: fromBlock,
        toBlock: currentFrom - 1,
        buyCount: buyCount,
        sellCount: 0,
        daysSinceStart: daysSinceStart,
        method: "DAI Transfer + Reserve"
    };
    mainData.transactions = {
        totalBuys: Math.round(totalBuy * 100) / 100,
        totalSells: Math.round(totalSell * 100) / 100,
        buyCount: buyCount,
        sellCount: 0
    };
    saveMainData(mainData);
    
    // ===== نمایش نتیجه نهایی =====
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n═══════════════════════════════════════');
    console.log('✅ ===== SCAN COMPLETED =====');
    console.log(`⏱️  Time: ${elapsed}s`);
    console.log(`📊 Scanned: ${formatNumber(scannedBlocks)} blocks`);
    console.log(`📅 Days since start: ${daysSinceStart}`);
    console.log(`💰 Trading Volume: ${formatCurrency(tradingVolume)}`);
    console.log(`📈 Daily Avg: ${formatCurrency(dailyVolume)}`);
    console.log(`🟢 Buys: ${formatCurrency(totalBuy)} (${buyCount} txs)`);
    console.log(`🔴 Sells: ${formatCurrency(totalSell)}`);
    console.log(`💾 Saved to: ${HISTORY_FILE}`);
    console.log('═══════════════════════════════════════');
}

// ==================== اجرا ====================
console.log('=' .repeat(50));
console.log('🚀 TRADING VOLUME UPDATER v6');
console.log('📊 METHOD: DAI Transfer + Reserve');
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