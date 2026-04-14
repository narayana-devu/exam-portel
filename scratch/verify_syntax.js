const fs = require('fs');
const content = fs.readFileSync('client/index.html', 'utf8');
const lines = content.split('\n');

const stack = [];
const openBrackets = ['{', '(', '['];
const closeBrackets = ['}', ')', ']'];
const pairs = { '}': '{', ')': '(', ']': '[' };

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (openBrackets.includes(char)) {
            stack.push({ char, line: i + 1, col: j + 1 });
        } else if (closeBrackets.includes(char)) {
            const last = stack.pop();
            if (!last || last.char !== pairs[char]) {
                console.log(`MISMATCH at L${i + 1}:C${j + 1}. Found "${char}", expected closure for "${last ? last.char : 'NONE'}" from L${last ? last.line : '?'}`);
                // Stop to avoid cascade? or continue?
            }
        }
    }
}

if (stack.length > 0) {
    console.log('UNCLOSED SYMBOLS:');
    stack.forEach(s => console.log(`  ${s.char} from L${s.line}:C${s.col}`));
} else {
    console.log('ALL SYMBOLS BALANCED');
}
