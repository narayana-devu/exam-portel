#!/usr/bin/env python3
"""Script to implement auto-sync and remove manual button"""

path = 'client/index.html'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove the Manual Button
button_code = """                            {captureOnly && (
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

if button_code in content:
    content = content.replace(button_code, "")
    print("✅ Removed manual sync button")
else:
    print("❌ Could not find manual sync button code")

# 2. Add Auto-Sync to recorder.onstop
old_onstop = """                            window.Utils.saveResponse(partialResponse);
                            setEvidence(prev => [...prev, newEvidence]);
                        } catch (err) {"""

new_onstop = """                            window.Utils.saveResponse(partialResponse);
                            setEvidence(prev => [...prev, newEvidence]);
                            
                            // AUTO SYNC
                            const statusBtn = document.getElementById('sync-status-text');
                            if(statusBtn) statusBtn.innerText = "Uploading Video...";
                            window.Utils.uploadToCloud(true).then(() => {
                                if(statusBtn) statusBtn.innerText = "Synced";
                            });
                            
                        } catch (err) {"""

if old_onstop in content:
    content = content.replace(old_onstop, new_onstop)
    print("✅ Added auto-sync logic")
else:
    print("❌ Could not find onstop logic")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
