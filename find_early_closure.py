#!/usr/bin/env python3
path = 'client/index.html'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

start_marker = "const StudentGradingView = ({ student, batch, examType, allQPapers, onBack, captureOnly = false }) => {"
end_marker = "const StudentPortal = ({ user }) => {"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx == -1 or end_idx == -1:
    print("Markers not found")
    exit()

grading_code = content[start_idx:end_idx]

# Remove comments
import re
grading_code = re.sub(r'//.*', '', grading_code)
grading_code = re.sub(r'/\*.*?\*/', '', grading_code, flags=re.DOTALL)

balance = 0
for i, char in enumerate(grading_code):
    if char == '{':
        balance += 1
    elif char == '}':
        balance -= 1
        if balance == 0:
            print(f"⚠️ Balance reached 0 at index {i}")
            # Check if this is the end
            if i < len(grading_code) - 100: # If significantly before end
                print("Function closes early!")
                # Find line number
                line_num = content[:start_idx+i].count('\n') + 1
                print(f"Line Number: {line_num}")
                print("Context:")
                print(content[start_idx+i-50:start_idx+i+50])
                break
