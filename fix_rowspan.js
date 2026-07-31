const fs = require('fs');
let code = fs.readFileSync('client/src/pages/calculation/Calculation.jsx', 'utf8');

const spanVars = ['productSpan', 'initWHSpan', 'variantsSpan', 'specsSpan', 'logisticsSpan'];

let tbodyStart = code.indexOf('<tbody className="bg-white">');
if (tbodyStart === -1) {
    console.log('tbody not found');
    process.exit(1);
}

let tbodyStr = code.substring(tbodyStart);
let theadStr = code.substring(0, tbodyStart);

spanVars.forEach(spanVar => {
    const regex = new RegExp('rowSpan=\\{' + spanVar + '\\}', 'g');
    tbodyStr = tbodyStr.replace(regex, '');
});

code = theadStr + tbodyStr;
fs.writeFileSync('client/src/pages/calculation/Calculation.jsx', code);
console.log('Fixed rowSpan bug successfully.');
