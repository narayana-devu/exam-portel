#!/usr/bin/env python3
path = 'client/index.html'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

terms = ["const StudentGradingView =", "const StudentPortal =", "const App ="]

for term in terms:
    count = content.count(term)
    print(f"{term}: {count}")
    if count > 1:
        print(f"❌ DUPLICATE {term}")
