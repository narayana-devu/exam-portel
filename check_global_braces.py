#!/usr/bin/env python3
path = 'client/index.html'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Find the script tag content
start_marker = '<script type="text/babel">'
end_marker = '</script>'

start_idx = content.find(start_marker)
end_idx = content.rfind(end_marker)

if start_idx == -1:
    print("Script tag not found")
    exit()

script_content = content[start_idx:end_idx]

import re
# Remove comments
script_content = re.sub(r'//.*', '', script_content)
script_content = re.sub(r'/\*.*?\*/', '', script_content, flags=re.DOTALL)

open_braces = script_content.count('{')
close_braces = script_content.count('}')

print(f"Global Open: {open_braces}, Close: {close_braces}")
print(f"Diff: {open_braces - close_braces}")
