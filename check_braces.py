
import os

def check_balance(filename):
    if not os.path.exists(filename):
        print(f"File not found: {filename}")
        return
        
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()

    stack = []
    pairs = {')': '(', '}': '{', ']': '['}
    
    line_no = 1
    col_no = 1
    
    in_string = False
    quote_char = ''
    in_comment = False
    comment_type = '' # 'single' or 'multi'
    
    for i, char in enumerate(content):
        # Progress trackers
        current_char = char
        prev_char = content[i-1] if i > 0 else ''
        next_char = content[i+1] if i < len(content)-1 else ''

        if char == '\n':
            line_no += 1
            col_no = 1
        else:
            col_no += 1
            
        if not in_comment and not in_string:
            if char in "'\"`":
                in_string = True
                quote_char = char
            elif char == '/' and next_char == '/':
                in_comment = True
                comment_type = 'single'
            elif char == '/' and next_char == '*':
                in_comment = True
                comment_type = 'multi'
            elif char in '({[':
                stack.append((char, line_no, col_no))
            elif char in ')}]':
                if not stack:
                    print(f"Extra closing {char} at line {line_no}, col {col_no}")
                else:
                    top, l, c = stack.pop()
                    if top != pairs[char]:
                        print(f"Mismatched {char} at line {line_no}, col {col_no}. Expected closure for {top} from line {l}, col {c}")
        elif in_string:
            if char == quote_char and prev_char != '\\':
                in_string = False
        elif in_comment:
            if comment_type == 'single' and char == '\n':
                in_comment = False
            elif comment_type == 'multi' and char == '*' and next_char == '/':
                # We'll skip the '/' in the next iteration implicitly by logic or just handle it
                pass 
            elif comment_type == 'multi' and prev_char == '*' and char == '/':
                in_comment = False

    if stack:
        print(f"Found {len(stack)} unclosed symbols:")
        for char, l, c in stack:
            print(f"  Unclosed {char} from line {l}, col {c}")
    else:
        print("All symbols are balanced!")

if __name__ == "__main__":
    check_balance("c:\\Users\\DELL\\Downloads\\portel-master (2)\\portel-master\\client\\index.html")
