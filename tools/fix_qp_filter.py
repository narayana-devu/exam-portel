#!/usr/bin/env python3
"""Script to update QP filtering logic"""

path = 'client/index.html'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update filtering logic
old_logic = "const filteredQPs = selectedSSC ? qpList.filter(q => q.sscId === selectedSSC) : qpList;"
new_logic = "const filteredQPs = selectedSSC ? qpList.filter(q => q.sscId === selectedSSC) : [];"

if old_logic in content:
    content = content.replace(old_logic, new_logic)
    print("✅ Updated filtering logic")
else:
    print("❌ Could not find filtering logic line")

# 2. Update dropdown text
old_option = '<option value="">All Sectors</option>'
new_option = '<option value="">Select Sector Skill Council</option>'

if old_option in content:
    content = content.replace(old_option, new_option)
    print("✅ Updated dropdown text")
else:
    print("❌ Could not find dropdown option")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
