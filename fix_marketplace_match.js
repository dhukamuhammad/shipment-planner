const fs = require('fs');
const filepath = 'server/controller/calculation/calculation.js';
let content = fs.readFileSync(filepath, 'utf8');

const search = `                                if (cell.value && cell.value.toString().toLowerCase().trim() === marketplaceName) {
                                    targetColIdx = colNumber;
                                }`;

const replace = `                                if (cell.value) {
                                    const cellStr = cell.value.toString().toLowerCase().trim();
                                    const mName = marketplaceName.toLowerCase().trim();
                                    if (cellStr === mName || (cellStr.includes('amazon') && mName.includes('amazon'))) {
                                        targetColIdx = colNumber;
                                    }
                                }`;

if (content.includes(search)) {
    content = content.replace(search, replace);
}

fs.writeFileSync(filepath, content);
console.log('Fixed marketplace matching in excel parser');
