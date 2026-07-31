const fs = require('fs');
let code = fs.readFileSync('client/src/pages/calculation/Calculation.jsx', 'utf8');

const target1 = `    const totalToShip = React.useMemo(() => {
        return filteredData.reduce((total, item) => {
            if (shipmentMode === 'FC' && item.fc_breakdown) {
                let fcSum = 0;
                Object.values(item.fc_breakdown).forEach(fcData => {
                    const val = Number(fcData.final_wh);
                    fcSum += isNaN(val) ? 0 : val;
                });
                return total + fcSum;
            } else {
                let val = 0;
                if (item.stock_alloc && item.stock_alloc.includes(' / ')) {
                    val = Number(item.stock_alloc.split(' / ')[1]);
                } else {
                    val = Number(item.final_wh);
                }
                return total + (isNaN(val) ? 0 : val);
            }
        }, 0);
    }, [filteredData, shipmentMode]);`;

const target2 = `    const totalToSuggestShip = React.useMemo(() => {
        return filteredData.reduce((total, item) => {
            if (shipmentMode === 'FC' && item.fc_breakdown) {
                let fcSum = 0;
                Object.values(item.fc_breakdown).forEach(fcData => {
                    const val = Number(fcData.suggest_final_wh);
                    fcSum += isNaN(val) ? 0 : val;
                });
                return total + fcSum;
            } else {
                let val = 0;
                if (item.stock_alloc && item.stock_alloc.includes(' / ')) {
                    val = Number(item.stock_alloc.split(' / ')[1]);
                } else {
                    val = Number(item.suggest_final_wh);
                }
                return total + (isNaN(val) ? 0 : val);
            }
        }, 0);
    }, [filteredData, shipmentMode]);`;

const replacement1 = `    const totalToShip = React.useMemo(() => {
        return filteredData.reduce((total, item) => {
            if (shipmentMode === 'FC' && item.fc_breakdown) {
                let fcSum = 0;
                Object.values(item.fc_breakdown).forEach(fcData => {
                    const val = Number(fcData.final_wh);
                    fcSum += isNaN(val) ? 0 : val;
                });
                return total + fcSum;
            } else {
                let val = 0;
                if (item.stock_alloc && item.stock_alloc.includes(' / ')) {
                    val = Number(item.stock_alloc.split(' / ')[1]);
                }
                return total + (isNaN(val) ? 0 : val);
            }
        }, 0);
    }, [filteredData, shipmentMode]);`;

const replacement2 = `    const totalToSuggestShip = React.useMemo(() => {
        return filteredData.reduce((total, item) => {
            if (shipmentMode === 'FC' && item.fc_breakdown) {
                let fcSum = 0;
                Object.values(item.fc_breakdown).forEach(fcData => {
                    const val = Number(fcData.suggest_final_wh);
                    fcSum += isNaN(val) ? 0 : val;
                });
                return total + fcSum;
            } else {
                let val = 0;
                if (item.stock_alloc && item.stock_alloc.includes(' / ')) {
                    val = Number(item.stock_alloc.split(' / ')[1]);
                }
                return total + (isNaN(val) ? 0 : val);
            }
        }, 0);
    }, [filteredData, shipmentMode]);`;

let replaced = false;

// Remove carriage returns for matching
const normalizedCode = code.replace(/\r\n/g, '\n');
const normalizedTarget1 = target1.replace(/\r\n/g, '\n');
const normalizedTarget2 = target2.replace(/\r\n/g, '\n');

if (normalizedCode.includes(normalizedTarget1) && normalizedCode.includes(normalizedTarget2)) {
    code = normalizedCode.replace(normalizedTarget1, replacement1);
    code = code.replace(normalizedTarget2, replacement2);
    replaced = true;
}

if (replaced) {
    fs.writeFileSync('client/src/pages/calculation/Calculation.jsx', code);
    console.log('Successfully applied changes (removed fallback)!');
} else {
    console.log('Failed to find targets!');
}
