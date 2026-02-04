#!/usr/bin/env python3
path = 'client/index.html'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

indices = [402319, 405498]

with open('error_lines.txt', 'w') as out:
    for idx in indices:
        line_num = content[:idx].count('\n') + 1
        out.write(f"Index {idx} is at Line {line_num}\n")
        lines = content.split('\n')
        if line_num <= len(lines):
            out.write(f"Line {line_num}: {lines[line_num-1]}\n")
        if line_num+1 <= len(lines):
            out.write(f"Line {line_num+1}: {lines[line_num]}\n")
        out.write("\n")
