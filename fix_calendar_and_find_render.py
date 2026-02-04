#!/usr/bin/env python3
"""Script to fix duplicate loadEvents and find ReactDOM.render"""

path = 'client/index.html'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Fix duplicate loadEvents
# const loadEvents = () => {
#     const loadEvents = () => {
import re
pattern = r'(const loadEvents = \(\) => \{\s+const loadEvents = \(\) => \{)'
match = re.search(pattern, content)

if match:
    print("✅ Found duplicate loadEvents")
    # Replace with single definition
    # We need to be careful. The inner one is likely the real one?
    # Or maybe it was a copy-paste error?
    # Let's just remove the inner line?
    # "const loadEvents = () => {\n    const loadEvents = () => {"
    # -> "const loadEvents = () => {"
    
    # But wait, indentation?
    # The inner one is indented.
    
    # Let's look at the context again (Step 4309).
    # 5972:                 const loadEvents = () => {
    # 5973:                     const loadEvents = () => {
    # 5974:                         const batches = window.Utils.getBatches();
    
    # If I remove line 5973, I must also remove the matching closing brace?
    # Line 6002:                     };
    # Line 6003:                 };
    
    # This is risky to do with regex.
    # I'll just rename the inner one to `innerLoadEvents` and call it?
    # No, that's messy.
    
    # I'll try to remove the OUTER one?
    # No, the outer one is called by useEffect.
    
    # I'll remove the INNER declaration line, but keep the body.
    # And remove one closing brace at the end.
    
    # Actually, let's just rename the inner one to `_loadEvents` and call it immediately?
    # No.
    
    # Let's just replace "const loadEvents = () => {" with "" (empty string) for the second occurrence?
    # And remove the last "};"?
    
    # Too complex for regex.
    
    # Alternative: Rename the inner one to `fetchEvents`.
    # And update the recursive call if any? No recursive call.
    # But wait, line 6004 calls `loadEvents()`. Which one? The outer one.
    # The outer one defines the inner one and does nothing else?
    # 6003:                 };
    # 6004:                 loadEvents();
    
    # So the outer function runs, defines the inner function, and exits.
    # The inner function is NEVER CALLED!
    # So `events` are never set.
    # This is a BUG, but not a Syntax Error.
    
    # Fix: Remove the outer wrapper.
    # Change:
    # const loadEvents = () => {
    #     const loadEvents = () => {
    #         ...
    #     };
    # };
    # loadEvents();
    
    # To:
    # const loadEvents = () => {
    #     ...
    # };
    # loadEvents();
    
    # I will replace "const loadEvents = () => {\n                    const loadEvents = () => {"
    # with "const loadEvents = () => {"
    
    # And remove one "};" at the end?
    # The end is:
    # 6002:                     };
    # 6003:                 };
    # 6004:                 loadEvents();
    
    # I'll replace "                    };\n                };" with "                    };"
    
    content = content.replace("const loadEvents = () => {\n                    const loadEvents = () => {", "const loadEvents = () => {")
    content = content.replace("                    };\n                };", "                    };")
    
    print("✅ Fixed duplicate loadEvents")
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

else:
    print("❌ Duplicate loadEvents not found (maybe whitespace mismatch?)")
    # Debug
    idx = content.find("const loadEvents = () => {")
    if idx != -1:
        print("Context:")
        print(content[idx:idx+100])

# 2. Find ReactDOM.render
idx = content.find("ReactDOM.render")
if idx != -1:
    line_num = content[:idx].count('\n') + 1
    print(f"ReactDOM.render is at Line {line_num}")
else:
    print("❌ ReactDOM.render not found")
