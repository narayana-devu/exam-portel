
const fs = require('fs');

const filename = "c:\\Users\\DELL\\Downloads\\portel-master (2)\\portel-master\\client\\index.html";
const content = fs.readFileSync(filename, 'utf8');

let stack = [];
const pairs = { ')': '(', '}': '{', ']': '[' };

let line_no = 1;
let col_no = 1;

let in_string = false;
let quote_char = '';
let in_comment = false;
let comment_type = ''; // 'single' or 'multi'

for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const prev_char = i > 0 ? content[i - 1] : '';
    const next_char = i < content.length - 1 ? content[i + 1] : '';

    if (char === '\n') {
        line_no++;
        col_no = 1;
    } else {
        col_no++;
    }

    if (!in_comment && !in_string) {
        if (char === "'" || char === '"' || char === '`') {
            in_string = true;
            quote_char = char;
        } else if (char === '/' && next_char === '/') {
            in_comment = true;
            comment_type = 'single';
        } else if (char === '/' && next_char === '*') {
            in_comment = true;
            comment_type = 'multi';
        } else if ('({['.includes(char)) {
            stack.push({ char, line: line_no, col: col_no });
        } else if (')}]'.includes(char)) {
            if (stack.length === 0) {
                console.log(`Extra closing ${char} at line ${line_no}, col ${col_no}`);
            } else {
                const top = stack.pop();
                if (top.char !== pairs[char]) {
                    console.log(`Mismatched ${char} at line ${line_no}, col ${col_no}. Expected closure for ${top.char} from line ${top.line}, col ${top.col}`);
                }
            }
        }
    } else if (in_string) {
        if (char === quote_char && prev_char !== '\\') {
            in_string = false;
        }
    } else if (in_comment) {
        if (comment_type === 'single' && char === '\n') {
            in_comment = false;
        } else if (comment_type === 'multi' && char === '*' && next_char === '/') {
            // next iter will handle the /
        } else if (comment_type === 'multi' && prev_char === '*' && char === '/') {
            in_comment = false;
        }
    }
}

if (stack.length > 0) {
    console.log(`Found ${stack.length} unclosed symbols:`);
    stack.forEach(s => {
        console.log(`  Unclosed ${s.char} from line ${s.line}, col ${s.col}`);
    });
} else {
    console.log("All symbols are balanced!");
}
