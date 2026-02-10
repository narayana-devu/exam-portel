#!/usr/bin/env python3
"""Script to fix StudentPortal recording logic and UI"""

path = 'client/index.html'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add Refs
ref_marker = "const mediaRecorderRef = useRef(null);"
new_refs = """const mediaRecorderRef = useRef(null);
            const recordingSessionRef = useRef(null);
            const segmentSequenceRef = useRef(0);"""

if ref_marker in content and "const recordingSessionRef" not in content:
    content = content.replace(ref_marker, new_refs)
    print("✅ Added Session Refs")

# 2. Replace Recording Logic
# I'll use the exact start and end markers I found.
start_marker = "// Full Video Recording Logic (Single Continuous Video with PIP for Viva)"
end_marker = "}, [examMode, webcamActive, isLocked, remoteStream]);"

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

start_idx = content.find(start_marker)
if start_idx != -1:
    end_idx = content.find(end_marker, start_idx)
    if end_idx != -1:
        end_idx += len(end_marker)
        content = content[:start_idx] + new_logic + content[end_idx:]
        print("✅ Replaced Recording Logic")
    else:
        print("❌ Could not find end marker")
else:
    print("❌ Could not find start marker")

# 3. Update Video UI
video_ui = '<video id="student-cam" autoPlay muted playsInline className="w-full bg-black rounded mb-2"></video>'
new_video_ui = """<div className="relative">
                                <video id="student-cam" autoPlay muted playsInline className="w-full bg-black rounded mb-2 transform scale-x-[-1]"></video>
                                {isRecording && (
                                    <div className="absolute top-2 right-2 flex items-center gap-1 bg-red-600/90 text-white text-[10px] px-2 py-1 rounded-full animate-pulse shadow-lg z-10">
                                        <div className="w-2 h-2 bg-white rounded-full"></div> REC
                                    </div>
                                )}
                            </div>"""

if video_ui in content:
    content = content.replace(video_ui, new_video_ui)
    print("✅ Added REC Indicator UI")
else:
    print("❌ Could not find Video UI element")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
