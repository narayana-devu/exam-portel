#!/usr/bin/env python3
"""Script to find the first extra closing brace"""

path = 'client/index.html'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

start_marker = "const StudentGradingView = ({ student, batch, examType, allQPapers, onBack, captureOnly = false }) => {"
start_idx = content.find(start_marker)

if start_idx == -1:
    print("Start marker not found")
    exit()

# Scan from start_idx
balance = 0
for i in range(start_idx, len(content)):
    char = content[i]
    if char == '{':
        balance += 1
    elif char == '}':
        balance -= 1
    
    if balance < 0:
        # Found the extra closing brace!
        line_num = content[:i].count('\n') + 1
        print(f"❌ Extra closing brace found at Index {i}, Line {line_num}")
        
        # Print context
        start_ctx = max(start_idx, i - 100)
        end_ctx = min(len(content), i + 50)
        print("Context:")
        print(content[start_ctx:end_ctx])
        break

if balance >= 0:
    print("No negative balance found (maybe it's at the very end?)")
