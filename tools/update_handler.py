#!/usr/bin/env python3
"""Script to update the handleUploadNOS function"""

# Read the file
with open('client/index.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# New function code
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

# Replace lines 2271-2310 (0-indexed: 2270-2309)
# Line 2272 is index 2271, line 2311 is index 2310
new_lines = lines[:2271] + [new_function + '\n'] + lines[2310:]

# Write back
with open('client/index.html', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("✅ Successfully updated handleUploadNOS function!")
print(f"   Replaced lines 2272-2311 with new combined upload handler")
