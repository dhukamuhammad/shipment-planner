const fs = require('fs');
let code = fs.readFileSync('client/src/pages/calculation/Calculation.jsx', 'utf8');

// Change 1: totalToShip
const oldTotalToShip = `    const totalToShip = React.useMemo(() => {
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

const newTotalToShip = `    const totalToShip = React.useMemo(() => {
        return filteredData.reduce((total, item) => {
            if (shipmentMode === 'FC' && item.fc_breakdown) {
                let fcSum = 0;
                Object.values(item.fc_breakdown).forEach(fcData => {
                    const val = Number(fcData.final_wh);
                    fcSum += isNaN(val) ? 0 : val;
                });
                return total + fcSum;
            } else {
                const val = Number(item.final_wh);
                return total + (isNaN(val) ? 0 : val);
            }
        }, 0);
    }, [filteredData, shipmentMode]);`;

// Change 2: totalToSuggestShip
const oldTotalToSuggestShip = `    const totalToSuggestShip = React.useMemo(() => {
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

const newTotalToSuggestShip = `    const totalToSuggestShip = React.useMemo(() => {
        return filteredData.reduce((total, item) => {
            if (shipmentMode === 'FC' && item.fc_breakdown) {
                let fcSum = 0;
                Object.values(item.fc_breakdown).forEach(fcData => {
                    const val = Number(fcData.suggest_final_wh);
                    fcSum += isNaN(val) ? 0 : val;
                });
                return total + fcSum;
            } else {
                const val = Number(item.suggest_final_wh);
                return total + (isNaN(val) ? 0 : val);
            }
        }, 0);
    }, [filteredData, shipmentMode]);`;

// Change 3: parsedTotalAvailable
const oldParsed = `            let parsedTotalAvailable = null;
            if (item.stock_alloc && typeof item.stock_alloc === 'string' && item.stock_alloc.includes('/')) {
                const parts = item.stock_alloc.split('/');
                if (parts.length > 0) {
                    parsedTotalAvailable = Number(parts[0].trim());
                }
            }`;

const newParsed = `            let parsedTotalAvailable = null;
            if (item.stock_alloc && typeof item.stock_alloc === 'string' && item.stock_alloc.includes('/')) {
                const parts = item.stock_alloc.split('/');
                if (parts.length > 0) {
                    parsedTotalAvailable = Number(parts[0].trim());
                }
            } else if (item.group_available_qty !== undefined && item.group_available_qty !== null) {
                parsedTotalAvailable = Number(item.group_available_qty);
            }`;

code = code.replace(oldTotalToShip, newTotalToShip);
code = code.replace(oldTotalToSuggestShip, newTotalToSuggestShip);
code = code.replace(oldParsed, newParsed);

fs.writeFileSync('client/src/pages/calculation/Calculation.jsx', code);
console.log('Replaced JSX successfully.');
