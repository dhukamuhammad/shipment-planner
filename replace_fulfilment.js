const fs = require('fs');

function replaceInFile(filepath) {
    if (fs.existsSync(filepath)) {
        let content = fs.readFileSync(filepath, 'utf8');
        content = content.replace(/fulfilment_id/g, 'ixd_fulfilment_id');
        fs.writeFileSync(filepath, content);
        console.log('Replaced in ' + filepath);
    }
}

replaceInFile('server/controller/calculation/calculation.js');
replaceInFile('client/src/pages/calculation/Calculation.jsx');
replaceInFile('client/src/pages/calculation/Extra.jsx');
replaceInFile('client/src/pages/calculation/Calculation.jsx'); // For Extra
