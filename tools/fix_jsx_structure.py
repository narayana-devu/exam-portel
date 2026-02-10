#!/usr/bin/env python3
# Fix JSX Structure - Add missing closing div tag

path = 'client/index.html'

with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Insert closing div after line 7366 (0-indexed: 7365)
lines.insert(7366, '                        </div>\r\n')

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("✅ Added missing closing div tag at line 7366")
print("This should resolve all 44+ cascading syntax errors.")
