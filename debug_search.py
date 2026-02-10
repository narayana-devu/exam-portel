
def search_file(filename, terms):
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            for i, line in enumerate(f):
                for term in terms:
                    if term in line:
                        print(f"Found '{term}' at line {i+1}: {line.strip()}")
    except Exception as e:
        print(f"Error reading file: {e}")

if __name__ == "__main__":
    search_file("client/index.html", ["showCamera", "captureOnly"])
