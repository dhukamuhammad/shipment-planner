const fs = require('fs');

const currentFile = 'server/controller/calculation/calculation.js';
const backupData = fs.readFileSync('backup_getCalcData.js', 'utf8');
let currentCode = fs.readFileSync(currentFile, 'utf8');

const anchor = '// Master ke afs_days aur shipment_plan_days nikal rahe hain (Ship-WH formula ke liye)';
const backupStart = backupData.indexOf(anchor);
const backupPart = backupData.substring(backupStart);

// We need to replace everything in currentCode from the anchor until the end of getCalculationData
// Let's find the anchor in currentCode
const currentStart = currentCode.indexOf(anchor);
if (currentStart !== -1 && backupStart !== -1) {
    // Find the end of getCalculationData in currentCode
    // It ends with \n};\n before const updateMasterData
    const nextFuncStart = currentCode.indexOf('const updateMasterData', currentStart);
    // Find the nearest }; before nextFuncStart
    const endStr = '\n};\n';
    let endIdx = currentCode.lastIndexOf(endStr, nextFuncStart);
    if (endIdx !== -1) {
        endIdx += endStr.length;
        const currentPart = currentCode.substring(currentStart, endIdx);
        currentCode = currentCode.replace(currentPart, backupPart);
        fs.writeFileSync(currentFile, currentCode);
        console.log('Successfully restored stock alloc logic from backup!');
    } else {
        console.log('Could not find end of getCalculationData in currentCode');
    }
} else {
    console.log('Failed to find match');
}
