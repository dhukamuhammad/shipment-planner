const fs = require('fs');

const filepath = 'server/controller/calculation/calculation.js';
let content = fs.readFileSync(filepath, 'utf8');

const search = `        const marketplace_id = req.body.marketplace_id || null;`;
const replace = `        const marketplace_id = req.body.marketplace_id || null;

        let marketplaceName = "";
        if (marketplace_id) {
            const [mpRows] = await connection.query("SELECT name FROM marketplaces WHERE id = ?", [marketplace_id]);
            marketplaceName = mpRows.length > 0 ? mpRows[0].name.toLowerCase().trim() : "";
        }`;

if (content.includes(search) && !content.includes('SELECT name FROM marketplaces WHERE id = ?')) {
    content = content.replace(search, replace);
    fs.writeFileSync(filepath, content);
    console.log("Added marketplaceName logic");
} else {
    console.log("Could not find marketplace_id declaration or already added");
}
