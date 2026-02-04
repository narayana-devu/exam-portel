#!/usr/bin/env python3
path = 'client/index.html'
out_path = 'closure_debug.txt'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

start_marker = "const StudentGradingView = ({ student, batch, examType, allQPapers, onBack, captureOnly = false }) => {"
end_marker = "const StudentPortal = ({ user }) => {"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

with open(out_path, 'w', encoding='utf-8') as out:
    if start_idx == -1:
        out.write("Start marker not found\n")
        exit()

    # Find the start of the function body
    body_start = content.find("=> {", start_idx)
    if body_start == -1:
        out.write("Body start not found\n")
        exit()

    body_start += 3 
    out.write(f"Body starts at {body_start}, char: '{content[body_start]}'\n")

    grading_code = content[body_start:end_idx]

    # Remove comments
    import re
    grading_code_clean = re.sub(r'//.*', '', grading_code)
    grading_code_clean = re.sub(r'/\*.*?\*/', '', grading_code_clean, flags=re.DOTALL)

    balance = 0
    for i, char in enumerate(grading_code_clean):
        if char == '{':
            balance += 1
        elif char == '}':
            balance -= 1
            if balance == 0:
                out.write(f"⚠️ Balance reached 0 at index {i}\n")
                out.write("Context:\n")
                out.write(grading_code_clean[max(0, i-50):i+50] + "\n")
                
                if i < len(grading_code_clean) - 50:
                    out.write("Function closes early!\n")
                    ctx = grading_code_clean[max(0, i-20):i]
                    loc = content.find(ctx, body_start)
                    if loc != -1:
                        line_num = content[:loc].count('\n') + 1
                        out.write(f"Approx Line Number: {line_num}\n")
                    break
    out.write("Done.\n")
