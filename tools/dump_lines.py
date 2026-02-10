
def dump_lines(filename, start, end):
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            lines = f.readlines()
            for i in range(start-1, end):
                if i < len(lines):
                    print(f"{i+1}: {lines[i].rstrip()}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    dump_lines("client/index.html", 5220, 5240)
