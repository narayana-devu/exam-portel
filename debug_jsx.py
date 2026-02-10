
import re

def check_balance(filename, start_line, end_line):
    with open(filename, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # Adjust to 0-indexed
    subset = lines[start_line-1:end_line]
    content = "".join(subset)

    # Remove comments to avoid false positives
    # Remove single line comments
    content = re.sub(r'//.*', '', content)
    # Remove block comments (simple approximation)
    content = re.sub(r'/\*[\s\S]*?\*/', '', content)

    # Simple stack for tags
    # regex for tags: </?[\w\.-]+ ... /?>
    # specific case: <br /> or <input ... /> are self closing
    # components: <SessionPlayer ... />
    
    # Updated regex to capture attributes and self-closing slash correctly
    tag_re = re.compile(r'<(/?)(\w+)([^>]*?)(\/?)>')
    
    stack = []
    
    # We need to process tags in order
    matches = tag_count = 0
    
    for m in tag_re.finditer(content):
        is_closing_slash = m.group(1) == '/'
        tag_name = m.group(2)
        is_self_closing = m.group(4) == '/'
        
        # refinement: check if it is a void element
        void_elements = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']
        
        if tag_name in void_elements:
            continue
            
        if is_self_closing:
            continue
            
        if is_closing_slash:
            if not stack:
                print(f"Error: Unexpected closing tag </{tag_name}> at match index {m.start()}")
                return
            
            last = stack.pop()
            if last != tag_name:
                print(f"Error: Mismatched tag. Expected </{last}> but found </{tag_name}> at match index {m.start()}")
                return
        else:
            stack.append(tag_name)
            
    if stack:
        print(f"Error: Unclosed tags remaining: {stack}")
    else:
        print("Success: All tags balanced.")

if __name__ == "__main__":
    check_balance("client/index.html", 6003, 6740)
