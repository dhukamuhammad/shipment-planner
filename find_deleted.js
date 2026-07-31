const fs = require('fs');

const logPath = 'C:\\Users\\HP\\.gemini\\antigravity-ide\\brain\\7332e1ef-b658-49d4-90ff-80f70ad1c49a\\.system_generated\\logs\\transcript_full.jsonl';
const lines = fs.readFileSync(logPath, 'utf8').split('\n');

for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].includes('const getCalculationHistory = async') 
        && !lines[i].includes('find_deleted.js')
        && !lines[i].includes('grep ')
        && !lines[i].includes('write_to_file')
        && !lines[i].includes('getCalculationHistory = async (req, res)') // skip my own thoughts from this turn
        ) {
        console.log("FOUND!");
        const json = JSON.parse(lines[i]);
        const content = json.tool_calls ? JSON.stringify(json.tool_calls) : json.content;
        fs.writeFileSync('C:\\Users\\HP\\.gemini\\antigravity-ide\\brain\\7332e1ef-b658-49d4-90ff-80f70ad1c49a\\scratch\\found_code.txt', content);
        break;
    }
}
