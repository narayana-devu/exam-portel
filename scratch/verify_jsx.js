const fs = require('fs');

const code = fs.readFileSync('client/index.html', 'utf8');

// Basic JSX tag balancer
let lines = code.split('\n');
let stack = [];
let inScript = false;

for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    
    if (line.includes('<script type="text/babel">')) {
        inScript = true;
        continue;
    }
    if (line.includes('</script>') && inScript) {
        inScript = false;
        break;
    }
    
    if (!inScript) continue;

    // Ignore comments
    if (line.trim().startsWith('//') || line.trim().startsWith('/*') || line.trim().startsWith('*')) continue;

    // Match tags very elementarily.
    // This regex looks for <TagName ...> or </TagName>
    // It's brittle but might work for clear mismatches.
    // Ignore things inside strings and curly braces if possible. 
    // This basic parser only looks at the raw string.
    const regex = /<\/?([A-Za-z]+(\.[A-Za-z]+)?)\b[^>]*>/g;
    let match;
    while ((match = regex.exec(line)) !== null) {
        const fullTag = match[0];
        const tagName = match[1];
        
        // ignore self-closing tags and standard HTML empties
        if (fullTag.endsWith('/>') || ['img', 'input', 'br', 'hr', 'meta', 'link'].includes(tagName.toLowerCase())) {
            continue;
        }

        if (fullTag.startsWith('</')) {
            if (stack.length === 0) {
                console.log(`Unmatched closing tag: ${fullTag} at line ${i + 1}\n` + line);
            } else {
                const last = stack.pop();
                if (last.tagName !== tagName && last.tagName.split('.')[0] !== tagName.split('.')[0]) { // Handle Icons.X vs X
                    console.log(`Mismatch at line ${i + 1}: expected </${last.tagName}> (from line ${last.line}) but found ${fullTag}\n` + line);
                    // Push it back to resync if it was an accidental extra close.
                    stack.push(last); // keep the last one on
                }
            }
        } else {
            stack.push({ tagName, line: i + 1, fullTag });
        }
    }
}

if (stack.length > 0) {
    console.log(`Unclosed tags remaining: ${stack.length}`);
    stack.slice(-5).forEach(s => {
        console.log(`Line ${s.line}: ${s.fullTag}`);
    });
} else {
    console.log("All tags perfectly balanced.");
}
