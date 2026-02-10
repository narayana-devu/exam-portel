#!/usr/bin/env python3
path = 'client/index.html'
with open(path, 'r', encoding='utf-8') as f:
    for i, line in enumerate(f, 1):
        if "const CalendarTab" in line:
            print(f"{i}: {line.strip()}")
