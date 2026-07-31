const fs = require('fs');
const filepath = 'client/src/pages/calculation/Calculation.jsx';
let content = fs.readFileSync(filepath, 'utf8');

const search = `fc: item.ixd_ixd_fulfilment_id,`;
const replace = `fc: item.ixd_fulfilment_id,`;

if (content.includes(search)) {
    content = content.replace(search, replace);
}

fs.writeFileSync(filepath, content);
console.log('Fixed typo in Calculation.jsx');
