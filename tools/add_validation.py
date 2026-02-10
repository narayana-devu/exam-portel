#!/usr/bin/env python3
"""Script to update the handleUploadNOS function with validation"""

# Read the file
with open('client/index.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# New function code with validation
new_function = '''            const handleUploadNOS = (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = (evt) => {
                    const bstr = evt.target.result;
                    const wb = window.XLSX.read(bstr, { type: 'binary' });
                    const wsname = wb.SheetNames[0];
                    const ws = wb.Sheets[wsname];
                    const data = window.XLSX.utils.sheet_to_json(ws);

                    console.log("Uploaded NOS & PC Data:", data);

                    // Validation: Calculate totals from Excel
                    let totalTheory = 0;
                    let totalPractical = 0;
                    let totalViva = 0;

                    data.forEach(row => {
                        totalTheory += parseFloat(row['Theory Marks']) || 0;
                        totalPractical += parseFloat(row['Practical Marks']) || 0;
                        totalViva += parseFloat(row['Viva Marks']) || 0;
                    });

                    // Round to 2 decimal places to avoid floating point errors
                    totalTheory = Math.round(totalTheory * 100) / 100;
                    totalPractical = Math.round(totalPractical * 100) / 100;
                    totalViva = Math.round(totalViva * 100) / 100;

                    const qpTheory = parseFloat(selectedQP.theoryMarks) || 0;
                    const qpPractical = parseFloat(selectedQP.practicalMarks) || 0;
                    const qpViva = parseFloat(selectedQP.vivaMarks) || 0;

                    if (totalTheory !== qpTheory || totalPractical !== qpPractical || totalViva !== qpViva) {
                        alert(`Validation Failed! Marks do not match Qualification Pack limits.\\n\\n` +
                              `Excel Totals:\\nTheory: ${totalTheory}, Practical: ${totalPractical}, Viva: ${totalViva}\\n\\n` +
                              `QP Limits:\\nTheory: ${qpTheory}, Practical: ${qpPractical}, Viva: ${qpViva}\\n\\n` +
                              `Please correct the marks in your Excel file and try again.`);
                        e.target.value = ''; // Reset file input
                        return;
                    }

                    // Group data by NOS
                    const nosMap = new Map();
                    
                    data.forEach(row => {
                        const nosId = row['NOSID'] || row['NOS ID'];
                        const nosName = row['NOS Name'];
                        const pcNo = row['PC No'] || row['PC ID'];
                        const pcName = row['PC Name'];
                        
                        if (!nosId) return;
                        
                        // Create or get NOS entry
                        if (!nosMap.has(nosId)) {
                            nosMap.set(nosId, {
                                id: window.Utils.generateId(),
                                qpId: selectedQP.id,
                                code: nosId,
                                name: nosName || '',
                                theoryCutoff: '',
                                practicalCutoff: '',
                                vivaCutoff: '',
                                overallCutoff: '',
                                createdAt: new Date().toISOString(),
                                pcs: []
                            });
                        }
                        
                        // Add PC if present
                        if (pcNo && pcName) {
                            const nos = nosMap.get(nosId);
                            nos.pcs.push({
                                id: window.Utils.generateId(),
                                nosId: nos.id,
                                code: pcNo,
                                name: pcName,
                                theoryMarks: parseFloat(row['Theory Marks']) || 0,
                                practicalMarks: parseFloat(row['Practical Marks']) || 0,
                                vivaMarks: parseFloat(row['Viva Marks']) || 0,
                                totalMarks: parseFloat(row['Total Marks']) || (parseFloat(row['Theory Marks']) || 0) + (parseFloat(row['Practical Marks']) || 0) + (parseFloat(row['Viva Marks']) || 0),
                                createdAt: new Date().toISOString()
                            });
                        }
                    });

                    // Save all NOS and PCs
                    let nosCount = 0;
                    let pcCount = 0;
                    
                    nosMap.forEach(nos => {
                        const { pcs, ...nosData } = nos;
                        window.Utils.saveNOS(nosData);
                        nosCount++;
                        
                        pcs.forEach(pc => {
                            window.Utils.savePC(pc);
                            pcCount++;
                        });
                    });

                    window.Utils.uploadToCloud(true);
                    setNOSList(window.Utils.getNOS());
                    setPCList(window.Utils.getPCs());
                    setShowUploadNOSModal(false);
                    alert(`Successfully uploaded ${nosCount} NOS and ${pcCount} PC records.`);
                };
                reader.readAsBinaryString(file);
            };
'''

# Replace lines 2272-2352 (0-indexed: 2271-2351)
# The previous update replaced lines 2272-2311 with the new function.
# Let's check the current file content to be sure of the range.
# We can just search for the start of the function and the end.
# But since we know the file content from previous reads, we can estimate.
# However, to be safe, let's find the start index dynamically.

start_index = -1
for i, line in enumerate(lines):
    if "const handleUploadNOS = (e) => {" in line:
        start_index = i
        break

if start_index != -1:
    # Find the end of the function. It ends with "reader.readAsBinaryString(file);\n            };\n"
    # We can look for the closing brace of the function.
    # The function body is indented. The closing brace should be at the same indentation level.
    end_index = -1
    for i in range(start_index + 1, len(lines)):
        if lines[i].strip() == "};" and lines[i-1].strip() == "reader.readAsBinaryString(file);":
             end_index = i
             break
    
    if end_index != -1:
        new_lines = lines[:start_index] + [new_function + '\n'] + lines[end_index+1:]
        
        with open('client/index.html', 'w', encoding='utf-8') as f:
            f.writelines(new_lines)
        print("✅ Successfully updated handleUploadNOS with validation logic!")
    else:
        print("❌ Could not find end of handleUploadNOS function")
else:
    print("❌ Could not find start of handleUploadNOS function")
