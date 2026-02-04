import re

# Read the file
with open('d:/word/web/client/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix indentation for component definitions
# Replace 20 spaces before "const StudentPortal" with 8 spaces
content = re.sub(r'^                    const (StudentPortal|AssessorPortal)', r'        const \1', content, flags=re.MULTILINE)

# Fix indentation for console.log statements  
content = re.sub(r'^                    console\.log', r'        console.log', content, flags=re.MULTILINE)

# Write back
with open('d:/word/web/client/index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed indentation for StudentPortal and AssessorPortal")
