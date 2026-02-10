const fs = require('fs');
const path = 'c:/Users/DELL/Downloads/portel-master (2)/portel-master/client/index.html';

const targets = ['<script', 'StudentGradingView', 'const showCamera = captureOnly;'];

try {
    const content = fs.readFileSync(path, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, i) => {
        const lineNum = i + 1;
        targets.forEach(target => {
            if (line.includes(target)) {
                console.log(`FOUND '${target}' at line ${lineNum}: ${line.trim().substring(0, 100)}`);
            }
        });
    });
} catch (err) {
    console.error(err);
}
