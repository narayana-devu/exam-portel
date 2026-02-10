import re

def check_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # Find the script block
    start_line = -1
    end_line = -1
    for i, line in enumerate(lines):
        if '<script type="text/babel">' in line:
            start_line = i
        if '</script>' in line and start_line != -1:
            end_line = i
            # Don't break here, we want the LAST closing script tag if there are multiple?
            # Actually index.html has multiple scripts, but the big one is the text/babel one.
            # We assume there is only one text/babel script or we want the one that covers line 8434.
            pass
    
    # Refine end_line to be the one after 8434
    for i in range(len(lines) - 1, start_line, -1):
        if '</script>' in lines[i]:
            end_line = i
            break
            
    print(f"Checking lines {start_line+1} to {end_line+1}")

    content = "".join(lines[start_line:end_line])
    
    # Simple state machine to track braces and ignore strings/comments
    stack = []
    in_string = False
    string_char = ''
    in_comment_line = False
    in_comment_block = False
    
    # We need to process character by character but keep track of line numbers
    full_content = "".join(lines)
    # Actually let's iterate over lines to report error properly
    
    line_idx = start_line
    col_idx = 0
    
    # We will iterate characters of the specific range
    # But it is easier to iterate over the whole content and just start checking from start_line
    
    # Re-reading line by line
    
    state = "CODE" # CODE, STRING, LINE_COMMENT, BLOCK_COMMENT, REGEX?
    
    # Regex detection is hard. We will skip it for now and hope it doesn't cause issues.
    # JSX has < > which can be confusing.
    
    # Braces to track: { } ( ( ) )
    # In JSX, { } are used for expressions.
    # html tags < > are also balanced but different.
    
    current_line = start_line
    
    chars = []
    # Build a list of (char, line_num, col_num)
    for i in range(start_line, end_line):
        line = lines[i]
        for j, char in enumerate(line):
            chars.append((char, i+1, j+1))
            
    i = 0
    while i < len(chars):
        char, l, c = chars[i]
        
        if state == "CODE":
            if char == '/' and i+1 < len(chars) and chars[i+1][0] == '/':
                state = "LINE_COMMENT"
                i += 1
            elif char == '/' and i+1 < len(chars) and chars[i+1][0] == '*':
                state = "BLOCK_COMMENT"
                i += 1
            elif char in ("'", '"', '`'):
                state = "STRING"
                string_char = char
            elif char in ('{', '(', '['):
                stack.append((char, l, c))
            elif char in ('}', ')', ']'):
                if not stack:
                    print(f"Error: Unexpected {char} at line {l} col {c}")
                    return
                last, ll, lc = stack.pop()
                expected = {'{':'}', '(':')', '[':']'}[last]
                if char != expected:
                    print(f"Error: Mismatched {char} at line {l} col {c}. Expected {expected} (matched with line {ll} col {lc})")
                    return
            # Check for regex? /pattern/
            # This is hard.
            
        elif state == "LINE_COMMENT":
            if char == '\n':
                state = "CODE"
                
        elif state == "BLOCK_COMMENT":
            if char == '*' and i+1 < len(chars) and chars[i+1][0] == '/':
                state = "CODE"
                i += 1
                
        elif state == "STRING":
            if char == '\\':
                i += 1 # Skip next char
            elif char == string_char:
                state = "CODE"
                
        i += 1
        
    if stack:
        print(f"Error: Unclosed {stack[-1][0]} from line {stack[-1][1]} col {stack[-1][2]}")
    else:
        print("No brace mismatch found.")

check_file(r"c:/Users/DELL/Downloads/portel-master (2)/portel-master/client/index.html")
