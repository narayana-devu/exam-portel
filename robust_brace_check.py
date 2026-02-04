#!/usr/bin/env python3
"""Robust brace parser"""

path = 'client/index.html'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Simple state machine
state = 'CODE' # CODE, STRING_SINGLE, STRING_DOUBLE, STRING_BACKTICK, COMMENT_SINGLE, COMMENT_MULTI
stack = []

lines = content.split('\n')
line_map = [] # Map index to line number
current_line = 1
for char in content:
    line_map.append(current_line)
    if char == '\n':
        current_line += 1

for i, char in enumerate(content):
    if state == 'CODE':
        if char == "'": state = 'STRING_SINGLE'
        elif char == '"': state = 'STRING_DOUBLE'
        elif char == '`': state = 'STRING_BACKTICK'
        elif char == '/' and i+1 < len(content):
            if content[i+1] == '/': state = 'COMMENT_SINGLE'
            elif content[i+1] == '*': state = 'COMMENT_MULTI'
        
        elif char in '{[(':
            stack.append((char, i))
        elif char in '}])':
            if not stack:
                print(f"❌ Unexpected '{char}' at Line {line_map[i]} (Index {i})")
                # Print context
                start = max(0, i - 50)
                end = min(len(content), i + 50)
                print(content[start:end])
                exit()
            else:
                last, idx = stack.pop()
                expected = {'{':'}', '[':']', '(':')'}[last]
                if char != expected:
                    print(f"❌ Mismatched '{char}' at Line {line_map[i]}, expected '{expected}' for '{last}' from Line {line_map[idx]}")
                    exit()

    elif state == 'STRING_SINGLE':
        if char == "'" and content[i-1] != '\\': state = 'CODE'
    elif state == 'STRING_DOUBLE':
        if char == '"' and content[i-1] != '\\': state = 'CODE'
    elif state == 'STRING_BACKTICK':
        if char == '`' and content[i-1] != '\\': state = 'CODE'
    elif state == 'COMMENT_SINGLE':
        if char == '\n': state = 'CODE'
    elif state == 'COMMENT_MULTI':
        if char == '/' and content[i-1] == '*': state = 'CODE'

if stack:
    print(f"❌ Unclosed '{stack[-1][0]}' from Line {line_map[stack[-1][1]]}")
else:
    print("✅ All braces balanced!")
