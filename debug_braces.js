const fs = require('fs');

const content = fs.readFileSync('client/index.html', 'utf8');
const stack = [];
const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '{' || char === '(' || char === '[') {
            stack.push({ char, line: i + 1, col: j + 1 });
        } else if (char === '}' || char === ')' || char === ']') {
            if (stack.length === 0) {
                console.log(`Extra closing ${char} at L${i + 1}C${j + 1}`);
                continue;
            }
            const top = stack.pop();
            const pairs = { '}': '{', ')': '(', ']': '[' };
            if (top.char !== pairs[char]) {
                console.log(`Mismatch at L${i + 1}C${j + 1}: Found ${char}, expected ${top.char} closing for ${top.char} from L${top.line}C${top.col}`);
            }
        }
    }
}

console.log("\nRemaining open symbols:");
stack.forEach(s => console.log(`${s.char} from L${s.line}C${s.col}`));
