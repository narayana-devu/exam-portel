const fs = require('fs');

const content = fs.readFileSync('client/index.html', 'utf8');
const lines = content.split('\n');

let balance = 0;
const stack = [];

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '{') {
            balance++;
            stack.push({ line: i + 1, char: '{' });
        } else if (char === '}') {
            balance--;
            stack.pop();
        } else if (char === '(') {
            balance++;
            stack.push({ line: i + 1, char: '(' });
        } else if (char === ')') {
            balance--;
            stack.pop();
        }
    }
    // Optional: Log balance changes for specific ranges
    if (i + 1 >= 7200 && i + 1 <= 10800) {
        // console.log(`Line ${i + 1}: Balance = ${balance}`);
    }
}

console.log('Final Balance:', balance);
if (stack.length > 0) {
    console.log('Unclosed items:', stack.slice(-10));
}
