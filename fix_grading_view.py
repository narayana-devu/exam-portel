#!/usr/bin/env python3
"""Script to remove accidental code in StudentGradingView"""

path = 'client/index.html'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Identify the block
# const [streamActive, setStreamActive] = useState(false);
# ...
# }, [examMode]);

import re

pattern = r'(const \[streamActive, setStreamActive\] = useState\(false\);.*?\}, \[examMode\]\);)'

matches = list(re.finditer(pattern, content, re.DOTALL))

if len(matches) > 0:
    print(f"Found {len(matches)} occurrences.")
    
    # We want to remove the one in StudentGradingView.
    # StudentGradingView starts around line 5000.
    # StudentPortal starts around line 6600.
    
    # I'll check the index.
    for m in matches:
        start = m.start()
        # Check if it's before StudentPortal definition
        portal_def = content.find("const StudentPortal =")
        
        if start < portal_def:
            print(f"Removing occurrence at index {start} (inside StudentGradingView)")
            content = content[:start] + content[m.end():]
            # Adjust portal_def index for next iteration if needed (but we only expect 1 wrong one)
            break
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("✅ Removed accidental code from StudentGradingView")

else:
    print("❌ No occurrences found")
