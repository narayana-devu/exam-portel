import sys

file_path = 'c:/Users/DELL/Downloads/portel-master (2)/portel-master/client/index.html'

def search_strings(targets):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            for i, line in enumerate(f, 1):
                for target in targets:
                    if target in line:
                        print(f"FOUND '{target}' at line {i}: {line.strip()[:100]}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    search_strings(['<script', 'StudentGradingView', 'const showCamera = captureOnly;'])
