#!/usr/bin/env python3
"""Script to check brace balance in StudentPortal"""

path = 'client/index.html'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

start_marker = "const StudentPortal = ({ user }) => {"
end_marker = "const AssessorPortal = ({ user }) => {"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx == -1 or end_idx == -1:
    print("❌ Could not find component boundaries")
    print(f"Start: {start_idx}, End: {end_idx}")
    exit()

portal_code = content[start_idx:end_idx]
print(f"Checking StudentPortal code ({len(portal_code)} chars)...")

# Remove comments
import re
portal_code = re.sub(r'//.*', '', portal_code)
portal_code = re.sub(r'/\*.*?\*/', '', portal_code, flags=re.DOTALL)

open_braces = portal_code.count('{')
close_braces = portal_code.count('}')

print(f"Open braces: {open_braces}")
print(f"Close braces: {close_braces}")

if open_braces != close_braces:
    print(f"❌ Mismatch! Diff: {open_braces - close_braces}")
    # If positive, we are missing closing braces.
else:
    print("✅ Braces are balanced")
