#!/usr/bin/env python3
path = 'client/index.html'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

start_marker = "const StudentPortal = ({ user }) => {"
end_marker = "const AssessorPortal = ({ user }) => {"
start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

portal_code = content[start_idx:end_idx]
import re
portal_code = re.sub(r'//.*', '', portal_code)
portal_code = re.sub(r'/\*.*?\*/', '', portal_code, flags=re.DOTALL)

open_div = portal_code.count('<div')
close_div = portal_code.count('</div>')

open_paren = portal_code.count('(')
close_paren = portal_code.count(')')

print(f"Divs: Open {open_div}, Close {close_div}, Diff {open_div - close_div}")
print(f"Parens: Open {open_paren}, Close {close_paren}, Diff {open_paren - close_paren}")
