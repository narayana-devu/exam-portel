#!/usr/bin/env python3
path = 'client/index.html'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

start_marker = "const StudentGradingView = ({ student, batch, examType, allQPapers, onBack, captureOnly = false }) => {"
end_marker = "const StudentPortal = ({ user }) => {"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

print(f"Start Index: {start_idx}")
print(f"End Index: {end_idx}")

if start_idx == -1:
    print("Start marker not found")
    exit()

grading_code = content[start_idx:end_idx]
print(f"Code length: {len(grading_code)}")

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
            # Map back to original content index is hard because of regex sub.
            # But we can look at the substring in clean code.
            print("Context in clean code:")
            print(grading_code_clean[max(0, i-50):i+50])
            
            # If this is significantly before the end
            if i < len(grading_code_clean) - 100:
                print("Function closes early!")
                break
