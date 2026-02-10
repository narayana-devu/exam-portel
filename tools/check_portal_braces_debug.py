#!/usr/bin/env python3
path = 'client/index.html'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

start_marker = "const StudentPortal = ({ user }) => {"
end_marker = "const AssessorPortal = ({ user }) => {"
start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

print(f"Start: {start_idx}, End: {end_idx}")

if start_idx != -1 and end_idx != -1:
    portal_code = content[start_idx:end_idx]
    print(f"Code length: {len(portal_code)}")
    import re
    portal_code = re.sub(r'//.*', '', portal_code)
    portal_code = re.sub(r'/\*.*?\*/', '', portal_code, flags=re.DOTALL)

    open_braces = portal_code.count('{')
    close_braces = portal_code.count('}')

    print(f"Open: {open_braces}, Close: {close_braces}")
    print(f"Diff: {open_braces - close_braces}")
else:
    print("Markers not found!")
