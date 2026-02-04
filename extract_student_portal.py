#!/usr/bin/env python3
"""Script to extract StudentPortal code"""

path = 'client/index.html'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

start_marker = "const StudentPortal = ({ user }) => {"
start_idx = content.find(start_marker)

if start_idx != -1:
    # Print the first 2000 characters of StudentPortal to understand its logic
    print(content[start_idx:start_idx+2000])
else:
    print("Could not find StudentPortal")
