import os

path = r"c:\Users\DELL\Downloads\portel-master (2)\portel-master\client\index.html"
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

print("Sidebar Logo Context:")
for i in range(2560, 2565):
    line = lines[i]
    if 'data:image/png;base64' in line:
        print(f"Line {i+1}: <BASE64 HIDDEN> " + line[-200:].strip())
    else:
        print(f"Line {i+1}: {line.strip()}")

