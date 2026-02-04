#!/usr/bin/env python3
"""Script to add Debug Alerts and VideoDB Check"""

path = 'client/index.html'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add VideoDB Check
# I'll insert it at the start of StudentPortal
# Find "const StudentPortal = ({ user }) => {"
portal_start = "const StudentPortal = ({ user }) => {"
check_code = """
            useEffect(() => {
                if (!window.VideoDB) alert("CRITICAL: Video Storage System Missing!");
                else window.VideoDB.init().catch(e => alert("CRITICAL: Video Storage Init Failed: " + e.message));
            }, []);"""

if portal_start in content and "Video Storage System Missing" not in content:
    content = content.replace(portal_start, portal_start + check_code)
    print("✅ Added VideoDB Check")

# 2. Add Alerts to Recording Logic
# I'll replace the catch block in the recording logic
# Old: .catch(err => console.error("Save Failed", err));
# New: .catch(err => { console.error("Save Failed", err); alert("VIDEO SAVE FAILED: " + err.message); });

old_catch = '.catch(err => console.error("Save Failed", err));'
new_catch = '.catch(err => { console.error("Save Failed", err); alert("VIDEO SAVE FAILED: " + err.message); });'

if old_catch in content:
    content = content.replace(old_catch, new_catch)
    print("✅ Added Save Failure Alert")
else:
    print("❌ Could not find catch block (might be different whitespace)")
    # Try regex
    import re
    content = re.sub(r'\.catch\(err => console\.error\("Save Failed", err\)\);', 
                     '.catch(err => { console.error("Save Failed", err); alert("VIDEO SAVE FAILED: " + err.message); });', 
                     content)

# 3. Add Start Alert
# Find setIsRecording(true);
# Replace with setIsRecording(true); console.log("Recording Started");
# I won't alert here to avoid spam, but I'll add a visual log if possible.
# For now, the REC indicator is enough.

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
