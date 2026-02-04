#!/usr/bin/env python3
path = 'client/index.html'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

pattern = "const videoChunksRef = useRef([]);"
if pattern in content and "const recordingSessionRef" not in content:
    content = content.replace(pattern, pattern + "\n            const recordingSessionRef = useRef(null);\n            const segmentSequenceRef = useRef(0);")
    print("✅ Added Session Refs (via videoChunksRef)")
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
else:
    print("❌ Could not find videoChunksRef")
