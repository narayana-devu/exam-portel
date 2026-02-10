#!/usr/bin/env python3
path = 'client/index.html'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

portal_idx = content.find("const StudentPortal =")
if portal_idx != -1:
    ref_idx = content.find("const mediaRecorderRef = useRef(null);", portal_idx)
    if ref_idx != -1:
        # Check if already added
        snippet = content[ref_idx:ref_idx+200]
        if "recordingSessionRef" in snippet:
            print("✅ Already in StudentPortal")
        else:
            # Replace
            target = "const mediaRecorderRef = useRef(null);"
            replacement = "const mediaRecorderRef = useRef(null);\n            const recordingSessionRef = useRef(null);\n            const segmentSequenceRef = useRef(0);"
            content = content[:ref_idx] + replacement + content[ref_idx+len(target):]
            print("✅ Added to StudentPortal")
            with open(path, 'w', encoding='utf-8') as f:
                f.write(content)
    else:
        print("❌ Could not find ref in StudentPortal")
else:
    print("❌ Could not find StudentPortal")
