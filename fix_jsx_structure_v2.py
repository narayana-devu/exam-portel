#!/usr/bin/env python3
# Fix JSX Structure - Add missing closing div tag at correct location

path = 'client/index.html'

with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find line 7367 which should be "                    </div>"
# Insert the missing closing div BEFORE line 7368 (the ");")
# Line 7367 (0-indexed: 7366) should close the w-1/4 div
# We need to add another </div> after it to close the main flex container

# Insert closing div after line 7367 (0-indexed: 7366)
lines.insert(7367, '                    </div>\r\n')

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("✅ Added missing closing div tag after line 7367")
print("This should resolve all cascading syntax errors.")
