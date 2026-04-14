const fs = require('fs');

const content = fs.readFileSync('client/index.html', 'utf8');
const stack = [];
const lines = content.split('\n');

// Very simple regex for tags (won't catch everything but should catch the big ones)
const tagRegex = /<((\/)?([a-zA-Z0-9]+)(\s[^>]*?)?)>/g;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match;
    while ((match = tagRegex.exec(line)) !== null) {
        const fullTag = match[0];
        const isClosing = !!match[2];
        const tagName = match[3];
        
        if (fullTag.endsWith('/>')) continue; // self-closing
        
        if (isClosing) {
            if (stack.length === 0) {
                console.log(`Extra closing tag </${tagName}> at L${i + 1}`);
                continue;
            }
            const top = stack.pop();
            if (top.name !== tagName) {
                console.log(`Mismatch at L${i + 1}: Found </${tagName}>, expected </${top.name}> for <${top.name}> from L${top.line}`);
            }
        } else {
            stack.push({ name: tagName, line: i + 1 });
        }
    }
}

console.log("\nRemaining open tags:");
stack.forEach(s => console.log(`<${s.name}> from L${s.line}`));
