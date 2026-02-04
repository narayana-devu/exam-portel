#!/usr/bin/env python3
path = 'client/index.html'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

indices = [402319, 405498]

for idx in indices:
    # Count newlines up to idx
    line_num = content[:idx].count('\n') + 1
    print(f"Index {idx} is at Line {line_num}")
    # Print context lines
    lines = content.split('\n')
    print(f"Line {line_num}: {lines[line_num-1]}")
    print(f"Line {line_num+1}: {lines[line_num]}")
