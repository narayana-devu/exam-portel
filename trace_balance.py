#!/usr/bin/env python3
path = 'client/index.html'
out_path = 'balance_trace.txt'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

start_marker = "const StudentGradingView = ({ student, batch, examType, allQPapers, onBack, captureOnly = false }) => {"
end_marker = "const StudentPortal = ({ user }) => {"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

body_start = content.find("=> {", start_idx) + 3
grading_code = content[body_start:end_idx]

# Remove comments but keep newlines to preserve line numbers?
# No, removing comments changes indices.
# Better to parse line by line.

with open(out_path, 'w', encoding='utf-8') as out:
    balance = 0
    lines = grading_code.split('\n')
    start_line_num = content[:body_start].count('\n') + 1
    
    for i, line in enumerate(lines):
        # Remove comments from line
        import re
        line_clean = re.sub(r'//.*', '', line)
        # Multi-line comments are hard line-by-line. Assuming none for now or handled simply.
        
        open_count = line_clean.count('{')
        close_count = line_clean.count('}')
        
        prev_balance = balance
        balance += open_count - close_count
        
        out.write(f"L{start_line_num + i}: Bal {prev_balance} -> {balance} | {line.strip()[:50]}\n")
        
        if balance <= 0:
            out.write(f"⚠️ BALANCE DROPPED TO {balance}!\n")
