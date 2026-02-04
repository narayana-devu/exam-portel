#!/usr/bin/env python3
path = 'client/index.html'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

start_marker = "const StudentGradingView = ({ student, batch, examType, allQPapers, onBack, captureOnly = false }) => {"
end_marker = "const StudentPortal = ({ user }) => {"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx == -1:
    print("Start marker not found")
    exit()

# Find the start of the function body
body_start = content.find("=> {", start_idx)
if body_start == -1:
    print("Body start not found")
    exit()

body_start += 3 # Skip "=> " (wait, "=> {" is 4 chars. Index points to =. So +3 points to {? No. +2 points to space. +3 points to {.)
# "=> {" -> index of = is X. X+1=>, X+2= , X+3={.
# So content[body_start] should be {.

print(f"Body starts at {body_start}, char: '{content[body_start]}'")

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
            print(f"⚠️ Balance reached 0 at index {i}")
            print("Context:")
            print(grading_code_clean[max(0, i-50):i+50])
            
            if i < len(grading_code_clean) - 50:
                print("Function closes early!")
                # Find line number
                # We need to map back to original content to get line number.
                # This is hard with regex sub.
                # But we can search for the context string in the original content.
                ctx = grading_code_clean[max(0, i-20):i]
                loc = content.find(ctx, body_start)
                if loc != -1:
                    line_num = content[:loc].count('\n') + 1
                    print(f"Approx Line Number: {line_num}")
                break
