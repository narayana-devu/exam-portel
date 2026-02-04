#!/usr/bin/env python3
"""Script to fix video recording storage"""

path = 'client/index.html'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old_code = """                    recorder.onstop = () => {
                        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
                        const reader = new FileReader();
                        reader.onloadend = () => {
                            addEvidence(reader.result, 'MANUAL_CAPTURE_VIDEO');
                        };
                        reader.readAsDataURL(blob);
                    };"""

new_code = """                    recorder.onstop = async () => {
                        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
                        const key = `vid_${student.id}_${Date.now()}`;
                        try {
                            await VideoDB.saveVideo(key, blob);
                            const newEvidence = { 
                                img: null, 
                                key: key, 
                                time: new Date().toISOString(), 
                                type: 'VIDEO_INDEXED_DB',
                                storage: 'indexeddb'
                            };
                            const partialResponse = {
                                studentId: student.id,
                                batchId: batch.id,
                                examType: examType,
                                evidence: [newEvidence],
                                status: 'draft'
                            };
                            window.Utils.saveResponse(partialResponse);
                            setEvidence(prev => [...prev, newEvidence]);
                        } catch (err) {
                            console.error("Failed to save video to DB", err);
                            alert("Video save failed: " + err.message);
                        }
                    };"""

if old_code in content:
    content = content.replace(old_code, new_code)
    print("✅ Successfully updated video recording logic")
else:
    print("❌ Could not find the target code block")
    # Debug: print surrounding lines to see what might be different
    start_marker = "recorder.onstop = () => {"
    idx = content.find(start_marker)
    if idx != -1:
        print("Found start marker at index:", idx)
        print("Surrounding content:\n", content[idx:idx+300])
    else:
        print("Could not find start marker")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
