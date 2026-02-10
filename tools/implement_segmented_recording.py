#!/usr/bin/env python3
"""Script to implement segmented recording for long exams"""

path = 'client/index.html'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# I need to match the exact existing function to replace it.
# Since I modified it recently, I'll construct the search string carefully.
# Or I can use a regex or just match the start and end if I'm confident.

# Let's try to match the start of the function and enough unique content.
start_marker = "const toggleRecording = () => {"
end_marker = "mediaRecorderRef.current = recorder;"

# This is risky if there are multiple occurrences or if I miss the closing brace.
# Better to use the exact content I saw in view_file.

old_code = """            const toggleRecording = () => {
                if (isRecording) {
                    if (mediaRecorderRef.current) mediaRecorderRef.current.stop();
                    setIsRecording(false);
                } else {
                    if (!mediaStreamRef.current) return;
                    chunksRef.current = [];
                    const recorder = new MediaRecorder(mediaStreamRef.current);
                    recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
                    recorder.onstop = async () => {
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
                            
                            // AUTO SYNC
                            const statusBtn = document.getElementById('sync-status-text');
                            if(statusBtn) statusBtn.innerText = "Uploading Video...";
                            window.Utils.uploadToCloud(true).then(() => {
                                if(statusBtn) statusBtn.innerText = "Synced";
                            });
                            
                        } catch (err) {
                            console.error("Failed to save video to DB", err);
                            alert("Video save failed: " + err.message);
                        }
                    };
                    recorder.start();
                    setIsRecording(true);
                    mediaRecorderRef.current = recorder;
                }
            };"""

new_code = """            const toggleRecording = () => {
                if (isRecording) {
                    // STOP MANUAL
                    if (mediaRecorderRef.current) mediaRecorderRef.current.stop();
                    setIsRecording(false);
                    if (window.recordingInterval) clearInterval(window.recordingInterval);
                } else {
                    // START
                    if (!mediaStreamRef.current) return;

                    const startSegment = () => {
                        let localChunks = [];
                        const recorder = new MediaRecorder(mediaStreamRef.current);
                        recorder.ondataavailable = e => { if (e.data.size > 0) localChunks.push(e.data); };
                        recorder.onstop = async () => {
                            const blob = new Blob(localChunks, { type: 'video/webm' });
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
                                
                                // AUTO SYNC
                                const statusBtn = document.getElementById('sync-status-text');
                                if(statusBtn) statusBtn.innerText = "Uploading Video Segment...";
                                window.Utils.uploadToCloud(true).then(() => {
                                    if(statusBtn) statusBtn.innerText = "Synced";
                                });
                                
                            } catch (err) {
                                console.error("Failed to save video to DB", err);
                            }
                        };
                        recorder.start();
                        mediaRecorderRef.current = recorder;
                    };

                    startSegment();
                    setIsRecording(true);

                    // Auto-split every 10 minutes (600,000 ms)
                    window.recordingInterval = setInterval(() => {
                        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                            console.log("Auto-splitting video segment...");
                            mediaRecorderRef.current.stop(); 
                            setTimeout(startSegment, 200); 
                        }
                    }, 600000);
                }
            };"""

if old_code in content:
    content = content.replace(old_code, new_code)
    print("✅ Successfully implemented segmented recording")
else:
    print("❌ Could not find exact function match")
    # Fallback: Try to match without the whitespace if indentation differs
    # Or print the section to debug
    start_idx = content.find("const toggleRecording = () => {")
    if start_idx != -1:
        print("Found start at", start_idx)
        print("Actual content:\n", content[start_idx:start_idx+500])

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
