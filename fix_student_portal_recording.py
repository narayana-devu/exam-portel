#!/usr/bin/env python3
"""Script to fix StudentPortal recording logic"""

path = 'client/index.html'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add Refs
# Find mediaRecorderRef definition
ref_marker = "const mediaRecorderRef = useRef(null);"
new_refs = """const mediaRecorderRef = useRef(null);
            const recordingSessionRef = useRef(null);
            const segmentSequenceRef = useRef(0);"""

if ref_marker in content and "const recordingSessionRef" not in content:
    content = content.replace(ref_marker, new_refs)
    print("✅ Added Session Refs to StudentPortal")

# 2. Replace Recording Logic
# I need to match the useEffect block.
# Start: // Full Video Recording Logic
# End: I need to find the end of the useEffect.

start_marker = "// Full Video Recording Logic (Single Continuous Video with PIP for Viva)"
# I'll look for the start of the useEffect
effect_start = "useEffect(() => {"

# The new logic is complex. I'll define it here.
new_logic = """// SEGMENTED RECORDING LOGIC (StudentPortal)
            useEffect(() => {
                const shouldRecord = examMode && !isLocked && (webcamActive || examMode === 'VivaLive' || examMode === 'VivaWait');

                if (!shouldRecord) {
                    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                        mediaRecorderRef.current.stop();
                        setIsRecording(false);
                        if (window.studentRecordingInterval) clearInterval(window.studentRecordingInterval);
                        recordingSessionRef.current = null;
                    }
                    return;
                }

                // Initialize Session if needed
                if (!recordingSessionRef.current) {
                    recordingSessionRef.current = `session_${user.id}_${Date.now()}`;
                    segmentSequenceRef.current = 1;
                }

                const startSegment = () => {
                    const stream = document.getElementById('student-cam')?.srcObject;
                    // For Viva, we might need the complex canvas logic, but for now let's prioritize standard exams
                    // If Viva, we should use the canvas stream if possible, or just the student cam for simplicity/stability
                    
                    if (!stream) return;

                    let localChunks = [];
                    let options = { mimeType: 'video/webm; codecs=vp8' };
                    if (!MediaRecorder.isTypeSupported(options.mimeType)) options = { mimeType: 'video/webm' };

                    const recorder = new MediaRecorder(stream, options);
                    recorder.ondataavailable = e => { if (e.data.size > 0) localChunks.push(e.data); };
                    
                    recorder.onstop = () => {
                        const blob = new Blob(localChunks, { type: 'video/webm' });
                        const currentSeq = segmentSequenceRef.current;
                        const videoKey = `vid_${user.id}_${Date.now()}_part${currentSeq}`;
                        
                        console.log(`Segment ${currentSeq} Finalized. Size: ${blob.size}`);

                        VideoDB.saveVideo(videoKey, blob).then(() => {
                            window.Utils.saveResponse({
                                studentId: user.id,
                                examType: examMode,
                                evidence: [{ 
                                    img: null, 
                                    time: new Date().toISOString(), 
                                    type: 'VIDEO_INDEXED_DB', 
                                    key: videoKey,
                                    sessionId: recordingSessionRef.current,
                                    sequence: currentSeq,
                                    isSegment: true
                                }]
                            });
                            // Auto-upload immediately
                            window.Utils.uploadToCloud(true);
                        }).catch(err => console.error("Save Failed", err));
                    };

                    recorder.start(1000);
                    mediaRecorderRef.current = recorder;
                    setIsRecording(true);
                };

                // Start First Segment
                if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
                    startSegment();
                    
                    // Setup Interval for Splits (10 mins)
                    if (window.studentRecordingInterval) clearInterval(window.studentRecordingInterval);
                    window.studentRecordingInterval = setInterval(() => {
                        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                            console.log("Auto-splitting student video...");
                            mediaRecorderRef.current.stop();
                            segmentSequenceRef.current += 1;
                            setTimeout(startSegment, 200);
                        }
                    }, 600000);
                }

                return () => {
                    if (window.studentRecordingInterval) clearInterval(window.studentRecordingInterval);
                };
            }, [examMode, isLocked, webcamActive, user.id]);"""

# I need to find the exact block to replace.
# I'll use regex to match from start_marker to the end of the useEffect.
# The useEffect ends with `}, [examMode, isLocked, webcamActive, user.id, user.batchId]);` or similar.
# Actually, the dependencies in the file are `[examMode, isLocked, webcamActive, user.id, user.batchId]`.
# Let's check the file content again.
# Line 6960: `}, [examMode, isLocked, webcamActive, user.id, user.batchId]);`

import re
# I'll construct a regex that matches the start marker and goes until the dependency array.
# Be careful with greedy matching.

# Alternative: Find start index and find the closing `}, [...]`
start_idx = content.find(start_marker)
if start_idx != -1:
    # Find the closing of useEffect
    # It ends with `}, [examMode, isLocked, webcamActive, user.id, user.batchId]);`
    # or just `}, [examMode`
    end_pattern = "}, [examMode, isLocked, webcamActive, user.id, user.batchId]);"
    end_idx = content.find(end_pattern, start_idx)
    
    if end_idx == -1:
        # Try a shorter pattern
        end_pattern = "}, [examMode, isLocked, webcamActive"
        end_idx = content.find(end_pattern, start_idx)

    if end_idx != -1:
        # Find the end of the line
        end_idx = content.find(";", end_idx) + 1
        
        # Replace
        content = content[:start_idx] + new_logic + content[end_idx:]
        print("✅ Replaced StudentPortal Recording Logic")
    else:
        print("❌ Could not find end of useEffect")
else:
    print("❌ Could not find start of Recording Logic")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
