#!/usr/bin/env python3
"""Script to comment out auto-start camera logic"""

path = 'client/index.html'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Find the useEffect block
# It starts with useEffect(() => {
# It contains setTimeout(startCameraManual, 1000);
# It ends with }, [examMode]);

import re

pattern = r'(useEffect\(\(\) => \{\s*if \(examMode && !streamActive\) \{\s*setTimeout\(startCameraManual, 1000\);\s*\}\s*\}, \[examMode\]\);)'

match = re.search(pattern, content)
if match:
    block = match.group(1)
    print("✅ Found auto-start block")
    
    # Comment it out
    commented_block = "/* " + block + " */"
    content = content.replace(block, commented_block)
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("✅ Commented out auto-start logic")
else:
    print("❌ Could not find auto-start block")
    # Debug: print context
    idx = content.find("setTimeout(startCameraManual")
    if idx != -1:
        print("Context around setTimeout:")
        print(content[idx-100:idx+100])
