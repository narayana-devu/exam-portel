#!/usr/bin/env python3
"""Script to implement seamless video recording metadata and grouping"""

path = 'client/index.html'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add Refs for Session Management
# Find the start of StudentGradingView and add new refs
view_start = "const StudentGradingView = ({ student, batch, examType, allQPapers, onBack, captureOnly = false }) => {"
refs_add = """            const recordingSessionRef = useRef(null);
            const segmentSequenceRef = useRef(0);"""

if view_start in content and "recordingSessionRef" not in content:
    # Insert after the existing refs (e.g., after chunksRef)
    target_ref = "const chunksRef = useRef([]);"
    if target_ref in content:
        content = content.replace(target_ref, target_ref + "\n" + refs_add)
        print("✅ Added Session Refs")
    else:
        print("❌ Could not find chunksRef to insert new refs")

# 2. Update toggleRecording to use Session ID
# I will replace the ENTIRE toggleRecording function with the updated version
# that handles Session ID and Sequence.

old_toggle = """            const toggleRecording = () => {
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

new_toggle = """            const toggleRecording = () => {
                if (isRecording) {
                    // STOP MANUAL
                    if (mediaRecorderRef.current) mediaRecorderRef.current.stop();
                    setIsRecording(false);
                    if (window.recordingInterval) clearInterval(window.recordingInterval);
                    recordingSessionRef.current = null; // Reset Session
                } else {
                    // START
                    if (!mediaStreamRef.current) return;
                    
                    // Initialize New Session
                    recordingSessionRef.current = `session_${Date.now()}`;
                    segmentSequenceRef.current = 1;

                    const startSegment = () => {
                        let localChunks = [];
                        const recorder = new MediaRecorder(mediaStreamRef.current);
                        recorder.ondataavailable = e => { if (e.data.size > 0) localChunks.push(e.data); };
                        recorder.onstop = async () => {
                            const blob = new Blob(localChunks, { type: 'video/webm' });
                            const key = `vid_${student.id}_${Date.now()}`;
                            const currentSeq = segmentSequenceRef.current; // Capture current seq
                            
                            try {
                                await VideoDB.saveVideo(key, blob);
                                const newEvidence = { 
                                    img: null, 
                                    key: key, 
                                    time: new Date().toISOString(), 
                                    type: 'VIDEO_INDEXED_DB',
                                    storage: 'indexeddb',
                                    // METADATA FOR GROUPING
                                    sessionId: recordingSessionRef.current,
                                    sequence: currentSeq,
                                    isSegment: true
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
                                if(statusBtn) statusBtn.innerText = `Uploading Part ${currentSeq}...`;
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
                            segmentSequenceRef.current += 1; // Increment Sequence
                            setTimeout(startSegment, 200); 
                        }
                    }, 600000);
                }
            };"""

# Normalize whitespace for matching
def normalize(s):
    return ' '.join(s.split())

if normalize(old_toggle) in normalize(content):
    # We use exact string replacement if possible, but normalization helps check existence.
    # Since exact replacement is safer for indentation, let's try strict first.
    if old_toggle in content:
        content = content.replace(old_toggle, new_toggle)
        print("✅ Updated toggleRecording with Metadata")
    else:
        # Fallback: Replace by finding start and end if exact match fails due to whitespace
        # (This is a simplified fallback for this script)
        print("⚠️ Exact match failed, trying fuzzy replacement...")
        import re
        # Escape special chars for regex
        pattern = re.escape(old_toggle).replace(r'\ ', r'\s+')
        # This might be too complex. Let's trust the user hasn't modified it since last step.
        # Actually, I just wrote it in the previous step, so it should match exactly.
        print("❌ Could not find toggleRecording code block (Check whitespace)")

else:
    print("❌ Could not find toggleRecording logic")


with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
