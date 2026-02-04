#!/usr/bin/env python3
"""Script to verify brace count logic"""

path = 'client/index.html'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

start_marker = "const StudentGradingView = ({ student, batch, examType, allQPapers, onBack, captureOnly = false }) => {"
end_marker = "const StudentPortal = ({ user }) => {"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

grading_code = content[start_idx:end_idx]

# Remove comments
import re
grading_code = re.sub(r'//.*', '', grading_code)
grading_code = re.sub(r'/\*.*?\*/', '', grading_code, flags=re.DOTALL)

open_braces = grading_code.count('{')
close_braces = grading_code.count('}')

print(f"Grading Open: {open_braces}, Close: {close_braces}")
print(f"Diff: {open_braces - close_braces}")

# If Diff is -1, it means there is ONE extra closing brace.
# Since balance never went negative, it means the extra brace must be at the END?
# Or maybe the `end_marker` is NOT included in `grading_code` (slice excludes end), 
# so the last brace of `StudentGradingView` IS included?
# Wait, `end_marker` starts with `const StudentPortal`.
# So `grading_code` includes everything UP TO `const StudentPortal`.
# This includes the closing `};` of `StudentGradingView`.

# If `StudentGradingView` is properly closed, Diff should be 0.
# If Diff is -1, there is an extra `}` somewhere.

# Let's find where the balance goes to 0 (which should be the end).
# If it goes to 0 BEFORE the end, then we have code after the function closes.

balance = 0
zero_points = []
for i, char in enumerate(grading_code):
    if char == '{':
        balance += 1
    elif char == '}':
        balance -= 1
        if balance == 0:
            zero_points.append(i)

print(f"Balance reached 0 at indices: {zero_points}")
print(f"Total length: {len(grading_code)}")

if len(zero_points) > 0:
    last_zero = zero_points[-1]
    if last_zero < len(grading_code) - 10: # Allow some whitespace
        print(f"⚠️ Function seems to close early at index {last_zero}!")
        print("Code after closure:")
        print(grading_code[last_zero+1:last_zero+200])
