#!/usr/bin/env python3
"""Script to remove startCameraManual and debug script error"""

path = 'client/index.html'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove startCameraManual definition in StudentPortal
# It starts with const startCameraManual = async () => {
# It is inside StudentPortal (after line 6600)
# I'll use regex to find and remove it.

import re

# Match the function definition block
pattern = r'(const startCameraManual = async \(\) => \{.*?\}\;)'
# Use DOTALL
matches = list(re.finditer(pattern, content, re.DOTALL))

# We expect 2 matches (one in Assessor, one in Student).
# The second one (Student) is the one we want to remove.
if len(matches) >= 2:
    student_match = matches[1] # The second one
    print(f"Found StudentPortal function at index {student_match.start()}")
    
    # Remove it
    content = content[:student_match.start()] + content[student_match.end():]
    print("✅ Removed startCameraManual from StudentPortal")
else:
    print("⚠️ Could not find 2 instances of startCameraManual")
    if len(matches) == 1:
        print("Found 1 instance. Is it the Student one?")
        # Check context
        start = matches[0].start()
        context = content[start-100:start]
        if "StudentPortal" in context or "useState" in context:
             print("Yes, removing it.")
             content = content[:matches[0].start()] + content[matches[0].end():]

# 2. Update Button to use alert
# <button onClick={startCameraManual}
# Replace with <button onClick={() => alert('Camera Debug')}

if "onClick={startCameraManual}" in content:
    content = content.replace("onClick={startCameraManual}", "onClick={() => alert('Camera Debug')}")
    print("✅ Replaced button onClick")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
