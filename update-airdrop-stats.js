const fs = require('fs');

// ==================== به‌روزرسانی دستی ====================
function updateAirdropStats() {
    const totalOwners = 405; // تا تاریخ ۲۳ ژوئن ۲۰۲۶
    const airdropPerOwner = 2;
    const totalAirdrops = totalOwners * airdropPerOwner;
    
    const result = {
        lastUpdated: new Date().toISOString(),
        totalAirdrops: Math.round(totalAirdrops * 100) / 100,
        totalOwners: totalOwners,
        airdropPerOwner: airdropPerOwner
    };
    
    fs.writeFileSync('airdrop-stats.json', JSON.stringify(result, null, 2));
    console.log(`💾 Total Airdrops: $${result.totalAirdrops.toFixed(2)}`);
    console.log(`👥 Total Owners: ${result.totalOwners}`);
}

updateAirdropStats();
