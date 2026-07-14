const fs = require('fs');
const https = require('https');

// ==================== CONFIG ====================
const CONTRACT_ADDRESS = '0xBebe4ea7aA4037CeF5D0bc25a10f9dcA16120Dfa';
const API_KEY = 'freekey';
const API_URL = `https://api.binplorer.com/getTopTokenHolders/${CONTRACT_ADDRESS}?apiKey=${API_KEY}&limit=1`;

// ==================== MAIN FUNCTION ====================
function updateHolders() {
    console.log('🔄 Fetching holder count from Binplorer API...');
    
    https.get(API_URL, (response) => {
        let data = '';
        
        response.on('data', (chunk) => {
            data += chunk;
        });
        
        response.on('end', () => {
            try {
                const json = JSON.parse(data);
                
                if (json.error) {
                    console.error('❌ API Error:', json.error.message || 'Unknown error');
                    process.exit(1);
                }
                
                const holdersCount = json.holdersCount || 0;
                const result = {
                    lastUpdated: new Date().toISOString(),
                    totalHolders: holdersCount,
                    source: 'Binplorer API',
                    contractAddress: CONTRACT_ADDRESS
                };
                
                fs.writeFileSync('holders-data.json', JSON.stringify(result, null, 2));
                console.log(`✅ Holders count updated successfully: ${holdersCount.toLocaleString()} holders`);
                console.log(`📁 Data saved to holders-data.json`);
                
            } catch (error) {
                console.error('❌ Error parsing response:', error.message);
                process.exit(1);
            }
        });
        
    }).on('error', (error) => {
        console.error('❌ Request failed:', error.message);
        process.exit(1);
    });
}

// ==================== RUN ====================
updateHolders();
