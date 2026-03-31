
const fs = require('fs');
const content = fs.readFileSync("c:\\Users\\DELL\\Downloads\\portel-master (2)\\portel-master\\client\\index.html", 'utf8');
const lines = content.split('\n');

let stack = [];
let foundStart = false;

for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const line = lines[i];

    if (line.includes('const AdminDashboard = () => {')) {
        foundStart = true;
        console.log(`Found AdminDashboard start at line ${lineNo}`);
    }

    if (foundStart) {
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '{') stack.push('{');
            else if (char === '}') {
                if (stack.length === 0) {
                    console.log(`Extra } at line ${lineNo}`);
                } else {
                    stack.pop();
                    if (stack.length === 0) {
                        console.log(`AdminDashboard closed at line ${lineNo}`);
                        foundStart = false; // We found the end?
                        break;
                    }
                }
            }
        }
    }
}
if (foundStart && stack.length > 0) {
    console.log(`AdminDashboard UNCLOSED. Stack depth: ${stack.length}`);
}
