#!/usr/bin/env python3
"""Script to fix ReferenceError by moving code block"""

import re

path = 'client/index.html'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Identify the block to move
# It starts with const [streamActive
# It ends with }, [examMode]);
pattern = r'(const \[streamActive, setStreamActive\].*?\}\, \[examMode\]\);)'

match = re.search(pattern, content, re.DOTALL)

if match:
    block = match.group(1)
    print("✅ Found block to move")
    
    # Remove it from original location
    content = content.replace(block, "")
    
    # 2. Find insertion point
    # Insert after const [isRecording, setIsRecording] = useState(false); // UI Indicator
    # Note: I need to be careful with exact string match as I might have modified it before.
    # I'll search for "const [isRecording, setIsRecording]" and find the end of line.
    
    insert_pattern = r'const \[isRecording, setIsRecording\] = useState\(false\);.*?$'
    insert_match = re.search(insert_pattern, content, re.MULTILINE)
    
    if insert_match:
        insert_idx = insert_match.end()
        # Insert with some newlines
        content = content[:insert_idx] + "\n\n" + block + content[insert_idx:]
        print("✅ Moved block after isRecording")
        
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
    else:
        print("❌ Could not find insertion point (isRecording)")
        # Fallback: Insert after const [webcamActive, setWebcamActive]
        fallback_pattern = r'const \[webcamActive, setWebcamActive\] = useState\(false\);'
        fallback_match = re.search(fallback_pattern, content)
        if fallback_match:
            insert_idx = fallback_match.end()
            content = content[:insert_idx] + "\n\n" + block + content[insert_idx:]
            print("✅ Moved block after webcamActive (Fallback)")
            with open(path, 'w', encoding='utf-8') as f:
                f.write(content)
        else:
            print("❌ Could not find fallback insertion point")

else:
    print("❌ Could not find block (streamActive)")
