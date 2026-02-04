#!/usr/bin/env python3
path = 'client/index.html'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

count = content.count("const startCameraManual =")
print(f"Count: {count}")

if count > 1:
    print("❌ DUPLICATE DETECTED!")
    # Find line numbers
    lines = content.split('\n')
    for i, line in enumerate(lines):
        if "const startCameraManual =" in line:
            print(f"Line {i+1}: {line.strip()}")
