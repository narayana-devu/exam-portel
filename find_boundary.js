
const fs = require('fs');
const content = fs.readFileSync("c:\\Users\\DELL\\Downloads\\portel-master (2)\\portel-master\\client\\index.html", 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
    if (line.includes('ErrorBoundary')) {
        console.log(`${i + 1}: ${line}`);
    }
});
