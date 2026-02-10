#!/usr/bin/env python3
path = 'client/index.html'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

if "recordingSessionRef" in content:
    print("✅ Refs ALREADY EXIST")
else:
    print("❌ Refs DO NOT EXIST")
    # Try to find the context
    import re
    match = re.search(r'const\s+mediaRecorderRef', content)
    if match:
        print(f"Found mediaRecorderRef at {match.start()}")
    else:
        print("Could not find mediaRecorderRef")
