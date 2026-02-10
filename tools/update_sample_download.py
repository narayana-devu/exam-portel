#!/usr/bin/env python3
"""Script to update the downloadNOSSample function"""

# Read the file
with open('client/index.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# New function code
new_function = '''            const downloadNOSSample = () => {
                const headers = [['QualificationPackID', 'NOSID', 'NOS Name', 'PC No', 'PC Name', 'Theory Marks', 'Practical Marks', 'Viva Marks', 'Total Marks']];
                const data = [
                    ['QP001', 'NOS101', 'Introduction to IT', 'PC1', 'Understand Basic Concepts', '10', '20', '5', '35'],
                    ['QP001', 'NOS101', 'Introduction to IT', 'PC2', 'Demonstrate Skills', '15', '25', '10', '50']
                ];
                const ws = window.XLSX.utils.aoa_to_sheet([...headers, ...data]);
                const wb = window.XLSX.utils.book_new();
                window.XLSX.utils.book_append_sheet(wb, ws, "NOS_PC_Sample");
                window.XLSX.writeFile(wb, "NOS_PC_Upload_Sample.xlsx");
            };
'''

# Replace lines 2403-2419 (0-indexed: 2402-2418)
# We want to replace from index 2402 up to 2419 (exclusive of 2419, so it covers 2418)
# But wait, let's double check the line numbers from the view_file output.
# 2403: const downloadNOSSample...
# ...
# 2419: };

# So we want to replace lines[2402] through lines[2418].
# In Python slice notation, that is lines[2402:2419].

new_lines = lines[:2402] + [new_function + '\n'] + lines[2419:]

# Write back
with open('client/index.html', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("✅ Successfully updated downloadNOSSample function and removed downloadPCSample!")
