const fs = require('fs');
const path = require('path');

const TOKENS = [
    { id: 'bitcoin', symbol: 'BTC', coinGeckoId: 'bitcoin' },
    { id: 'ethereum', symbol: 'ETH', coinGeckoId: 'ethereum' },
    { id: 'binancecoin', symbol: 'BNB', coinGeckoId: 'binancecoin' },
    { id: 'ripple', symbol: 'XRP', coinGeckoId: 'ripple' },
    { id: 'solana', symbol: 'SOL', coinGeckoId: 'solana' },
    { id: 'cardano', symbol: 'ADA', coinGeckoId: 'cardano' },
    { id: 'dogecoin', symbol: 'DOGE', coinGeckoId: 'dogecoin' },
    { id: 'tron', symbol: 'TRX', coinGeckoId: 'tron' },
    { id: 'zcash', symbol: 'ZEC', coinGeckoId: 'zcash' },
    { id: 'stellar', symbol: 'XLM', coinGeckoId: 'stellar' },
    { id: 'pancakeswap', symbol: 'CAKE', coinGeckoId: 'pancakeswap-token' },
    { id: 'toncoin', symbol: 'TON', coinGeckoId: 'the-open-network' },
    { id: 'shibainu', symbol: 'SHIB', coinGeckoId: 'shiba-inu' },
    { id: 'trump', symbol: 'TRUMP', coinGeckoId: 'official-donald-trump' }
];

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(url, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url);
            if (response.ok) return await response.json();
            if (response.status === 429) {
                console.log(`⚠️ Rate limited, waiting 5 seconds...`);
                await delay(5000);
                continue;
            }
        } catch(e) {
            console.log(`⚠️ Attempt ${i+1} failed: ${e.message}`);
            if (i < retries - 1) await delay(3000);
        }
    }
    return null;
}

async function fetchCurrentPrices() {
    const ids = TOKENS.map(t => t.coinGeckoId).join(',');
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;
    
    console.log('📊 Fetching current prices...');
    const data = await fetchWithRetry(url);
    
    if (data) {
        const prices = {};
        for (const token of TOKENS) {
            if (data[token.coinGeckoId]) {
                prices[token.id] = {
                    price: data[token.coinGeckoId].usd,
                    change24h: data[token.coinGeckoId].usd_24h_change || 0
                };
            }
        }
        console.log(`✅ Current prices fetched for ${Object.keys(prices).length} tokens`);
        return prices;
    }
    return {};
}

async function fetchHistoricalData(tokenId, coinGeckoId, days = 365) {
    console.log(`📜 Fetching historical data for ${tokenId}...`);
    const url = `https://api.coingecko.com/api/v3/coins/${coinGeckoId}/market_chart?vs_currency=usd&days=${days}&interval=daily`;
    const data = await fetchWithRetry(url);
    
    if (data && data.prices && data.prices.length > 0) {
        const dates = [];
        const prices = [];
        
        for (let i = 0; i < data.prices.length; i++) {
            const date = new Date(data.prices[i][0]);
            const dateStr = date.toISOString().split('T')[0];
            const price = data.prices[i][1];
            
            if (price > 0 && !isNaN(price)) {
                dates.push(dateStr);
                prices.push(price);
            }
        }
        
        console.log(`✅ ${tokenId}: ${dates.length} data points`);
        return { dates, prices };
    }
    return null;
}

async function main() {
    console.log('🚀 Starting crypto cache update...');
    console.log(`🕐 Started at: ${new Date().toISOString()}`);
    
    const cache = {
        lastUpdated: new Date().toISOString(),
        currentPrices: {},
        historicalData: {}
    };
    
    // Fetch current prices
    cache.currentPrices = await fetchCurrentPrices();
    
    // Fetch historical data for each token
    for (const token of TOKENS) {
        console.log(`🔄 Processing ${token.symbol}...`);
        const historical = await fetchHistoricalData(token.id, token.coinGeckoId, 365);
        if (historical) {
            cache.historicalData[token.id] = historical;
        }
        // Wait between requests
        await delay(3000);
    }
    
    // Save to file
    const outputPath = path.join(__dirname, 'crypto-cache.json');
    fs.writeFileSync(outputPath, JSON.stringify(cache, null, 2));
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ CACHE UPDATE COMPLETE!');
    console.log(`📦 Saved to: ${outputPath}`);
    console.log(`🕐 Last updated: ${cache.lastUpdated}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main().catch(console.error);
