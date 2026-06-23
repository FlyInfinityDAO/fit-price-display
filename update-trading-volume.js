const XLSX = require('xlsx');
const fs = require('fs');

// ==================== خواندن فایل‌های اکسل ====================
function calculateTradingVolume() {
    let totalBuy = 0;
    let totalSell = 0;
    let buyCount = 0;
    let sellCount = 0;
    
    // خواندن buy.xlsx
    try {
        const buyWorkbook = XLSX.readFile('buy.xlsx');
        const buySheet = buyWorkbook.Sheets['buy'];
        const buyData = XLSX.utils.sheet_to_json(buySheet);
        
        buyData.forEach(row => {
            const amount = parseFloat(row['Amount']) || 0;
            if (amount > 0) {
                totalBuy += amount;
                buyCount++;
            }
        });
        console.log(`✅ Buy: ${buyCount} transactions, Total: $${totalBuy.toFixed(2)}`);
    } catch(e) {
        console.log('⚠️ Could not read buy.xlsx');
    }
    
    // خواندن sell.xlsx
    try {
        const sellWorkbook = XLSX.readFile('sell.xlsx');
        const sellSheet = sellWorkbook.Sheets['sell'];
        const sellData = XLSX.utils.sheet_to_json(sellSheet);
        
        sellData.forEach(row => {
            const amount = parseFloat(row['Amount']) || 0;
            if (amount > 0) {
                totalSell += amount;
                sellCount++;
            }
        });
        console.log(`✅ Sell: ${sellCount} transactions, Total: $${totalSell.toFixed(2)}`);
    } catch(e) {
        console.log('⚠️ Could not read sell.xlsx');
    }
    
    const totalVolume = totalBuy + totalSell;
    const daysSinceStart = Math.ceil((Date.now() - new Date('2025-12-18').getTime()) / (1000 * 60 * 60 * 24));
    const dailyVolume = daysSinceStart > 0 ? totalVolume / daysSinceStart : 0;
    
    // ==================== ذخیره در JSON ====================
    const result = {
        lastUpdated: new Date().toISOString(),
        totalVolume: Math.round(totalVolume * 100) / 100,
        dailyVolume: Math.round(dailyVolume * 100) / 100,
        transactions: {
            totalBuys: Math.round(totalBuy * 100) / 100,
            totalSells: Math.round(totalSell * 100) / 100,
            buyCount: buyCount,
            sellCount: sellCount
        }
    };
    
    fs.writeFileSync('trading-volume.json', JSON.stringify(result, null, 2));
    console.log(`💾 Trading Volume saved: $${result.totalVolume.toFixed(2)}`);
    console.log(`📊 Daily Average: $${result.dailyVolume.toFixed(2)}`);
}

calculateTradingVolume();
