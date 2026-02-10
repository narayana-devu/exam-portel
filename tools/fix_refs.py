#!/usr/bin/env python3
path = 'client/index.html'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Find mediaRecorderRef with flexible whitespace
import re
pattern = r"const\s+mediaRecorderRef\s*=\s*useRef\(null\);"
match = re.search(pattern, content)

if match and "const recordingSessionRef" not in content:
    start, end = match.span()
    original = content[start:end]
    replacement = original + "\n            const recordingSessionRef = useRef(null);\n            const segmentSequenceRef = useRef(0);"
    content = content[:start] + replacement + content[end:]
    print("✅ Added Session Refs (Regex)")
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
else:
    print("❌ Could not find mediaRecorderRef or Refs already exist")
