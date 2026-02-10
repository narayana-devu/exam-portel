#!/usr/bin/env python3
"""Script to check for basic syntax balance"""

path = 'client/index.html'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Remove comments (simple approximation)
import re
content = re.sub(r'//.*', '', content)
content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)

stack = []
errors = []

for i, char in enumerate(content):
    if char in '({[':
        stack.append((char, i))
    elif char in ')}]':
        if not stack:
            errors.append(f"Unexpected closing '{char}' at index {i}")
        else:
            last, idx = stack.pop()
            if (last == '(' and char != ')') or \
               (last == '{' and char != '}') or \
               (last == '[' and char != ']'):
                errors.append(f"Mismatched '{char}' at index {i}, expected closing for '{last}' from index {idx}")

if stack:
    errors.append(f"Unclosed '{stack[-1][0]}' from index {stack[-1][1]}")

if errors:
    print(f"❌ Found {len(errors)} potential syntax errors:")
    for e in errors[:5]:
        print(e)
    # Print context for first error
    if errors:
        import sys
        err_idx = int(re.search(r'index (\d+)', errors[0]).group(1))
        start = max(0, err_idx - 50)
        end = min(len(content), err_idx + 50)
        print("\nContext:")
        print(content[start:end])
else:
    print("✅ Basic syntax check passed (balanced braces)")
