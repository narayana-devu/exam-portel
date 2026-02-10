import sys

file_path = 'c:/Users/DELL/Downloads/portel-master (2)/portel-master/client/index.html'

try:
    with open(file_path, 'r', encoding='utf-8') as f:
        for i, line in enumerate(f, 1):
            if '<script' in line:
                print(f"Line {i}: {line.strip()}")
except Exception as e:
    print(f"Error: {e}")
