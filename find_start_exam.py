#!/usr/bin/env python3
path = 'client/index.html'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

start_idx = content.find("const startExam =")
if start_idx != -1:
    print(content[start_idx:start_idx+1000])
else:
    print("Could not find startExam")
