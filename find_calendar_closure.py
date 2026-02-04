#!/usr/bin/env python3
path = 'client/index.html'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

start_marker = "const CalendarTab = () => {"
end_marker = "const StudentPortal = ({ user }) => {"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx == -1:
    print("Start marker not found")
    exit()

print(f"CalendarTab starts at {start_idx}")

# Find body start
body_start = content.find("=> {", start_idx) + 3
code = content[body_start:end_idx]

# Remove comments
import re
code_clean = re.sub(r'//.*', '', code)
code_clean = re.sub(r'/\*.*?\*/', '', code_clean, flags=re.DOTALL)

balance = 0
for i, char in enumerate(code_clean):
    if char == '{':
        balance += 1
    elif char == '}':
        balance -= 1
        if balance == 0:
            print(f"CalendarTab closes at index {i} (relative to body start)")
            print("Context:")
            print(code_clean[max(0, i-50):i+50])
            break
