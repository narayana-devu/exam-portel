
const fs = require('fs');

const file = fs.readFileSync('client/index.html', 'utf8');
const lines = file.split('\n');

let balance = 0;
// StudentGradingView roughly starts at 6003 and ends at 6740
let startLineNumber = 6003;
let endLineNumber = 6740;

console.log(`Checking balance from ${startLineNumber} to ${endLineNumber}`);

for (let i = startLineNumber - 1; i < endLineNumber; i++) {
    const line = lines[i];
    // Simple comment removal (not perfect but good enough for structure)
    const cleanLine = line.split('//')[0];
    for (let char of cleanLine) {
        if (char === '{') balance++;
        if (char === '}') balance--;
    }
}

console.log(`Final Balance at line ${endLineNumber}: ${balance}`);
if (balance > 0) console.log(`Missing ${balance} closing brace(s).`);
if (balance < 0) console.log(`Extra ${Math.abs(balance)} closing brace(s).`);
