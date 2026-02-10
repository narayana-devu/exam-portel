#!/usr/bin/env python3
import re

path = 'client/index.html'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Remove comments
content = re.sub(r'//.*', '', content)
content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)

# Remove strings (simple approximation)
# We replace string contents with spaces to keep indices correct
def replace_strings(text):
    # Pattern for single, double, and backtick strings
    # This is not perfect (doesn't handle escaped quotes perfectly in all cases) but better
    pattern = r"('([^'\\]*(?:\\.[^'\\]*)*)'|\"([^\"\\]*(?:\\.[^\"\\]*)*)\"|`([^`\\]*(?:\\.[^`\\]*)*)`)"
    return re.sub(pattern, lambda m: ' ' * len(m.group(0)), text)

content = replace_strings(content)

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

with open('syntax_errors.txt', 'w') as f:
    if errors:
        f.write(f"Found {len(errors)} errors:\n")
        for e in errors:
            f.write(e + "\n")
            # Context
            try:
                err_idx = int(re.search(r'index (\d+)', e).group(1))
                start = max(0, err_idx - 50)
                end = min(len(content), err_idx + 50)
                f.write("Context:\n" + content[start:end] + "\n\n")
            except:
                pass
    else:
        f.write("No errors found.")
