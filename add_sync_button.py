#!/usr/bin/env python3
"""Script to add Sync Evidence button"""

path = 'client/index.html'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Target the header in StudentGradingView
target = """                        <h3 className="text-xl font-bold">{captureOnly ? 'Capture Evidence: ' : 'Evidence: '}{student.name}</h3>
                        <div className="flex gap-2">"""

replacement = """                        <h3 className="text-xl font-bold">{captureOnly ? 'Capture Evidence: ' : 'Evidence: '}{student.name}</h3>
                        <div className="flex gap-2">
                            {captureOnly && (
                                <button onClick={async (e) => {
                                    const originalText = e.currentTarget.innerHTML;
                                    e.currentTarget.innerText = 'Syncing...';
                                    e.currentTarget.disabled = true;
                                    try {
                                        await window.Utils.uploadToCloud();
                                        alert('Sync Complete!');
                                    } catch(err) {
                                        alert('Sync Failed: ' + err.message);
                                    } finally {
                                        e.currentTarget.innerHTML = originalText;
                                        e.currentTarget.disabled = false;
                                    }
                                }} className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 flex items-center gap-2 font-bold transition-transform hover:scale-105">
                                    <Icons.UploadCloud className="w-4 h-4" /> Sync Evidence
                                </button>
                            )}"""

if target in content:
    content = content.replace(target, replacement)
    print("✅ Successfully added Sync Evidence button")
else:
    print("❌ Could not find target location")
    # Debug
    print("Searching for:", target[:50])

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
