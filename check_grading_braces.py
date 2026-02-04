#!/usr/bin/env python3
path = 'client/index.html'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

start_marker = "const StudentGradingView = ({ student, batch, examType, allQPapers, onBack, captureOnly = false }) => {"
end_marker = "const StudentPortal = ({ user }) => {"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

grading_code = content[start_idx:end_idx]
import re
grading_code = re.sub(r'//.*', '', grading_code)
grading_code = re.sub(r'/\*.*?\*/', '', grading_code, flags=re.DOTALL)

open_braces = grading_code.count('{')
close_braces = grading_code.count('}')

print(f"Grading Open: {open_braces}, Close: {close_braces}")
print(f"Diff: {open_braces - close_braces}")
