        const StudentPortal = ({ user }) => {


            useEffect(() => {
                if (!window.VideoDB) alert("CRITICAL: Video Storage System Missing!");
                else window.VideoDB.init().catch(e => alert("CRITICAL: Video Storage Init Failed: " + e.message));
            }, []);
            const [examMode, setExamMode] = useState(null); // 'Theory', 'Practical', 'VivaWait'
            const [questions, setQuestions] = useState([]);
            const [currentQ, setCurrentQ] = useState(0);
            const [answers, setAnswers] = useState({});

            // Poll for Assessor "Admit" signal (Replaced by Socket.io in VivaWait)
            // useEffect(() => { ... }, []);



            const [timeLeft, setTimeLeft] = useState(0);
            const [webcamActive, setWebcamActive] = useState(false);
            const [mediaStream, setMediaStream] = useState(null); // NEW: Track stream state
            const mediaRecorderRef = useRef(null);
            const videoRef = useRef(null);
            const [warnings, setWarnings] = useState(0);
            const [isLocked, setIsLocked] = useState(false);
            const [proctoringModel, setProctoringModel] = useState(null);
            const [proctoringLogs, setProctoringLogs] = useState([]);
            const [lastWarning, setLastWarning] = useState(null); // State for Visual Alert
            // State for Visual Alert
            const detectionInterval = useRef(null);
            const autoCaptureInterval = useRef(null);

            const recordingSessionRef = useRef(null);
            const recordingStartTimeRef = useRef(null);
            const segmentSequenceRef = useRef(0); // v19.0.19: Sequence Tracker
            const pendingChunkWrites = useRef(0); // v24: Track Active DB Writes
            const videoChunksRef = useRef([]);
            const recordingExamType = useRef(null); // Persist exam type for the recording session
            const [isRecording, setIsRecording] = useState(false); // UI Indicator
            const [isSubmitting, setIsSubmitting] = useState(false);
            const isSubmittingRef = useRef(false);
            useEffect(() => { isSubmittingRef.current = isSubmitting; }, [isSubmitting]);

            const [streamActive, setStreamActive] = useState(false);
            const compositeReqRef = useRef(null); // Reference for Canvas Animation Frame

            const startCameraManual = async () => {
                try {
                    console.log("Requesting Camera...");
                    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                    const video = videoRef.current;
                    if (video) {
                        video.srcObject = stream;
                        video.play().catch(e => console.error("Play Error", e));
                        setStreamActive(true);
                        setWebcamActive(true);
                        setMediaStream(stream); // Fix: Prevent useEffect loop
                        console.log("Camera Started Successfully");
                    } else {
                        alert("Error: Video element not found. Please refresh.");
                    }
                } catch (err) {
                    console.error("Camera Error", err);
                    alert("Camera Failed: " + err.message + "\nPlease check permissions and try again.");
                }
            };




            /* useEffect(() => {
                if (examMode && !streamActive) {
                    setTimeout(startCameraManual, 1000);
                }
            }, [examMode]); */


            // WEBRTC STATE FOR VIVA LIVE
            const [remoteStream, setRemoteStream] = useState(null);
            const peerRef = useRef(null);
            const signalingRef = useRef(null);

            useEffect(() => {
                if (examMode !== 'VivaLive') return;

                const initViva = async () => {
                    console.log("Initializing Viva Connection...");

                    // 1. Signaling
                    const signaling = new VivaSignaling(user.batchId, user.id, 'student');
                    signalingRef.current = signaling;

                    try {
                        await signaling.joinRoom();
                    } catch (e) {
                        alert(e.message);
                        setExamMode('VivaWait');
                        return;
                    }

                    // 2. PeerConnection
                    const pc = new RTCPeerConnection({
                        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
                    });
                    peerRef.current = pc;

                    // 3. Local Stream
                    try {
                        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                        const video = document.getElementById('student-cam-viva');
                        if (video) video.srcObject = stream;
                        stream.getTracks().forEach(track => pc.addTrack(track, stream));
                    } catch (e) {
                        console.error("Viva Camera Error", e);
                    }

                    // 4. Remote Stream
                    pc.ontrack = (event) => {
                        console.log("Remote Stream Received");
                        setRemoteStream(event.streams[0]);
                        const remoteVid = document.getElementById('remote-assessor-video');
                        if (remoteVid) remoteVid.srcObject = event.streams[0];
                    };

                    // 5. ICE Candidates
                    pc.onicecandidate = (event) => {
                        if (event.candidate) signaling.sendIceCandidate(event.candidate);
                    };
                    signaling.onIceCandidate(candidate => {
                        pc.addIceCandidate(new RTCIceCandidate(candidate));
                    });

                    // 6. Listen for Offer
                    signaling.onRemoteDescription(async (offer) => {
                        console.log("Received Offer");
                        await pc.setRemoteDescription(new RTCSessionDescription(offer));
                        const answer = await pc.createAnswer();
                        await pc.setLocalDescription(answer);
                        await signaling.sendAnswer(answer);
                    });
                };

                initViva();

                return () => {
                    if (peerRef.current) peerRef.current.close();
                    // Stop local tracks? Maybe keep them if we want fast reconnect
                };
            }, [examMode]);
            // Poll for Assessor "Admit" signal
            // (Socket logic handled separately)

            // Dynamic Update Listener (For Exam Start Times etc)
            const [forceUpdate, setForceUpdate] = useState(0);
            useEffect(() => {
                const refresh = () => setForceUpdate(n => n + 1);
                window.addEventListener('cloud-sync-complete', refresh);
                return () => window.removeEventListener('cloud-sync-complete', refresh);
            }, []);

            // Cleanup Polling (Deleted)


            // No need for syncing effect that clears on null

            // Load Model
            useEffect(() => {
                if (window.cocoSsd) {
                    window.cocoSsd.load().then(model => {
                        console.log("Proctoring Model Loaded");
                        setProctoringModel(model);
                    });
                }
            }, []);

            // Check Lock Status on Load
            useEffect(() => {
                const checkLock = () => {
                    const status = JSON.parse(localStorage.getItem('se_student_lock_' + user.id) || 'null');
                    if (status) {
                        setIsLocked(false); // MODIFIED: Never restore lock state
                        setWarnings(status.warnings);
                    }
                };
                checkLock();
                const interval = setInterval(checkLock, 2000); // Poll for unlock
                return () => clearInterval(interval);
            }, [user.id]);

            // Save Lock Status
            const updateLockStatus = (newWarnings, locked) => {
                setWarnings(newWarnings);
                if (locked) setIsLocked(true);
                localStorage.setItem('se_student_lock_' + user.id, JSON.stringify({ isLocked: locked, warnings: newWarnings }));
            };

            // Log Violation
            const logViolation = (msg) => {
                if (isLocked) return;
                const newWarnings = warnings + 1;
                const log = `${new Date().toLocaleTimeString()}: ${msg} (Strike ${newWarnings}/5)`;
                setProctoringLogs(prev => [log, ...prev]);

                // Show Visual Warning
                setLastWarning(`${msg} (Strike ${newWarnings}/5)`);
                setTimeout(() => setLastWarning(null), 4000); // Hide after 4s

                // SAVE VIOLATION AS EVIDENCE
                window.Utils.saveResponse({
                    studentId: user.id,
                    examType: examMode,
                    evidence: [{ img: null, time: new Date().toISOString(), type: 'VIOLATION_LOG', message: msg }]
                });

                // MODIFIED: Never Lock Exam, just count warnings
                updateLockStatus(newWarnings, false);
                if (newWarnings >= 5) {
                    alert(`Warning: You have reached ${newWarnings} violations! The proctor has been notified.`);
                }
            };

            // 60-Second Auto-Capture Loop (Photos)
            useEffect(() => {
                if (!examMode || isLocked) {
                    if (autoCaptureInterval.current) clearInterval(autoCaptureInterval.current);
                    return;
                }

                autoCaptureInterval.current = setInterval(() => {
                    const video = videoRef.current;
                    if (video && video.readyState >= 2) {
                        console.log("AutoCapture: Success");
                        const c = document.createElement('canvas'); c.width = 320; c.height = 240;
                        c.getContext('2d').drawImage(video, 0, 0, c.width, c.height);
                        const img = c.toDataURL('image/jpeg', 0.5);

                        window.Utils.saveResponse({
                            studentId: user.id,
                            examType: examMode,
                            evidence: [{ img, time: new Date().toISOString(), type: 'AUTO_CAPTURE_PHOTO' }]
                        });
                    }
                }, 60000); // v19.0.21: Every 60 Seconds (As requested)

                return () => clearInterval(autoCaptureInterval.current);
            }, [examMode, isLocked, user.id]);

            // SEGMENTED RECORDING LOGIC (StudentPortal)
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

                // v23: CONTINUOUS RECORDING (One File, Many Chunks)
                const startSegment = () => {
                    const stream = mediaStream;
                    if (!stream) return;

                    // v19.0.19 Options
                    let options = { mimeType: 'video/webm;codecs=vp8', videoBitsPerSecond: 300000 };
                    if (!MediaRecorder.isTypeSupported(options.mimeType)) options = { mimeType: 'video/mp4' };
                    if (!MediaRecorder.isTypeSupported(options.mimeType)) options = {};

                    const recorder = new MediaRecorder(stream, options);

                    // v25: RAM-Buffered Single Recording (No Parts in DB)
                    recorder.ondataavailable = (e) => {
                        if (e.data.size > 0) {
                            videoChunksRef.current.push(e.data);
                        }
                    };

                    recorder.onstop = async () => {
                        console.log("Recorder Stopped. Saving Full Video...");
                        const fullBlob = new Blob(videoChunksRef.current, { type: options.mimeType || 'video/webm' });
                        const fullKey = `vid_full_${user.id}_${Date.now()}`;

                        try {
                            // Save ONE Single File
                            await window.VideoDB.saveVideo(fullKey, fullBlob);

                            const fullEvidence = {
                                img: fullKey, key: fullKey, time: new Date().toISOString(),
                                type: 'VIDEO_FULL_MERGED', storage: 'indexeddb',
                                isFullVideo: true,
                                duration: recordingStartTimeRef.current ? Math.floor((Date.now() - recordingStartTimeRef.current) / 1000) : 0
                            };

                            // Merge with existing response instead of overwriting
                            const existingResp = window.Utils.getResponses().find(r => r.studentId === user.id && r.examType === examMode) || {};
                            const mergedEvidence = [...(existingResp.evidence || []), fullEvidence];
                            await window.Utils.saveResponse({
                                ...existingResp,
                                studentId: user.id, examType: examMode, evidence: mergedEvidence
                            });

                            // Trigger Upload
                            window.Utils.uploadToCloud(true, 'responses');
                            alert("Exam Video Saved Successfully!");

                        } catch (err) {
                            console.error("Final Save Error", err);
                            alert("Error saving final video: " + err.message);
                        }

                        // Clear RAM
                        videoChunksRef.current = [];
                    };

                    // Start ONCE with 5s slice
                    
ecordingStartTimeRef.current = Date.now();
                    recorder.start(5000);
                    mediaRecorderRef.current = recorder;
                    setIsRecording(true);
                };

                // Entry Point
                if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
                    if (mediaStream) {
                        startSegment();
                        // No more setInterval loop!
                    }
                }

                return () => {
                    if (window.studentRecordingInterval) clearInterval(window.studentRecordingInterval);
                    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                        console.log("Stopping recorder on unmount...");
                        mediaRecorderRef.current.stop();
                    }
                };
            }, [examMode, isLocked, webcamActive, user.id, mediaStream, isSubmitting]); // Added isSubmitting dep
            // Ensure Camera Stream is Attached to Video Element
            useEffect(() => {
                if (webcamActive && examMode && examMode !== 'VivaLive') {
                    // Check if we already have a stream
                    if (mediaStream) {
                        const video = videoRef.current;
                        if (video && !video.srcObject) video.srcObject = mediaStream;
                        return;
                    }

                    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
                        const video = videoRef.current;
                        if (video) video.srcObject = stream;
                        setMediaStream(stream); // Set state
                    }).catch(e => {
                        console.error("Camera Error", e);
                        alert("Camera/Audio Access Denied! Please allow access to proceed.");
                    });
                }
            }, [webcamActive, examMode, mediaStream]);

            // Security: Block Right Click, Copy, Paste
            useEffect(() => {
                if (!examMode || isLocked) return;

                const preventDefault = (e) => {
                    e.preventDefault();
                    // Optional: logViolation("Action Blocked"); // Can be too noisy
                };

                const blockCopyPaste = (e) => {
                    e.preventDefault();
                    // logViolation("Copy/Paste Attempted");
                    alert("Copy/Paste is disabled during the exam!");
                };

                document.addEventListener('contextmenu', preventDefault);
                document.addEventListener('copy', blockCopyPaste);
                document.addEventListener('cut', blockCopyPaste);
                document.addEventListener('paste', blockCopyPaste);
                document.addEventListener('selectstart', preventDefault); // Block Selection

                return () => {
                    document.removeEventListener('contextmenu', preventDefault);
                    document.removeEventListener('copy', blockCopyPaste);
                    document.removeEventListener('cut', blockCopyPaste);
                    document.removeEventListener('paste', blockCopyPaste);
                    document.removeEventListener('selectstart', preventDefault);
                };
            }, [examMode, isLocked]);

            useEffect(() => {
                if (examMode === 'VivaLive') {
                    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
                        const v = document.getElementById('student-cam-viva');
                        if (v) v.srcObject = stream;
                    });
                }
            }, [examMode]);
            useEffect(() => {
                if (!examMode || isLocked) return;

                // DISABLE PROCTORING FOR VIVA (To allow 2-tab simulation)
                if (examMode === 'VivaWait' || examMode === 'VivaLive') return;

                const handleVisibility = () => {
                    if (document.hidden) {
                        logViolation("Tab Switch / Minimized Browser");
                    }
                };

                document.addEventListener('visibilitychange', handleVisibility);
                return () => document.removeEventListener('visibilitychange', handleVisibility);
            }, [examMode, isLocked, warnings]);

            // Object Detection Loop
            useEffect(() => {
                if (!examMode || !webcamActive || isLocked || !proctoringModel) {
                    if (detectionInterval.current) clearInterval(detectionInterval.current);
                    return;
                }

                let tick = 0;
                detectionInterval.current = setInterval(async () => {
                    tick++;
                    const video = videoRef.current;
                    if (video && video.readyState >= 2) {
                        const predictions = await proctoringModel.detect(video);

                        // Check for Mobile Phone
                        const hasPhone = predictions.some(p => p.class === 'cell phone' || p.class === 'remote'); // cell phone usually
                        if (hasPhone) {
                            logViolation("Mobile Device Detected");
                            // Capture Violation Evidence
                            const c = document.createElement('canvas'); c.width = 300; c.height = 200;
                            c.getContext('2d').drawImage(video, 0, 0, 300, 200);
                            window.Utils.saveResponse({
                                studentId: user.id, examType: examMode,
                                evidence: [{ img: c.toDataURL(), time: new Date().toISOString(), type: 'VIOLATION_PHONE' }]
                            });
                        }

                        // Check for Person Count
                        const personCount = predictions.filter(p => p.class === 'person').length;
                        if (personCount > 1) {
                            logViolation("Multiple Persons Detected");
                            // Capture Violation Evidence
                            const c = document.createElement('canvas'); c.width = 300; c.height = 200;
                            c.getContext('2d').drawImage(video, 0, 0, 300, 200);
                            window.Utils.saveResponse({
                                studentId: user.id, examType: examMode,
                                evidence: [{ img: c.toDataURL(), time: new Date().toISOString(), type: 'VIOLATION_MULTIPLE_PERSONS' }]
                            });
                        }

                        // PERIODIC SNAPSHOT REMOVED (Moved to independent loop)
                    }
                }, 3000); // Check every 3 seconds

                return () => clearInterval(detectionInterval.current);
            }, [examMode, webcamActive, isLocked, proctoringModel, warnings]);

            // INDEPENDENT PHOTO CAPTURE LOOP (Decoupled from AI Model)
            useEffect(() => {
                if (!examMode || isLocked || !webcamActive || examMode === 'VivaLive' || examMode === 'VivaWait') return;

                const capturePhoto = () => {
                    const video = videoRef.current;
                    if (video && video.readyState >= 2) {
                        const c = document.createElement('canvas'); c.width = 300; c.height = 200;
                        c.getContext('2d').drawImage(video, 0, 0, 300, 200);
                        console.log("Auto-Snapshot Taken (Independent Loop)");
                        window.Utils.saveResponse({
                            studentId: user.id, examType: examMode,
                            evidence: [{ img: c.toDataURL(), time: new Date().toISOString(), type: 'AUTO_SNAPSHOT' }]
                        });
                    }
                };

                // Capture immediately on start (optional)
                // capturePhoto();

                const interval = setInterval(capturePhoto, 60000); // v19.0.21: Every 60 Seconds
                return () => clearInterval(interval);
            }, [examMode, webcamActive, isLocked]);

            useEffect(() => {
                let interval;
                if (examMode && timeLeft > 0 && !isSubmitting) interval = setInterval(() => setTimeLeft(t => t - 1), 1000);
                return () => clearInterval(interval);
            }, [examMode, timeLeft, isSubmitting]);

            const startExam = async (mode) => {
                let batch = window.Utils.getBatches().find(b => String(b.id || '').trim() === String(user.batchId || '').trim());

                // AUTO-HEAL: If batch not found locally, try one-time sync before erroring
                if (!batch && user.batchId) {
                    console.log(`[Auto-Heal] Batch ${user.batchId} missing locally. Syncing...`);
                    const statusText = document.getElementById('sync-status-text');
                    if (statusText) statusText.innerText = "Checking Cloud for Batch...";

                    try {
                        // Force a non-destructive download
                        const ok = await window.Utils.downloadFromCloud(true);
                        batch = window.Utils.getBatches().find(b => String(b.id || '').trim() === String(user.batchId || '').trim());
                        if (statusText) statusText.innerText = batch ? "Batch Found!" : "Sync Complete";
                    } catch (e) {
                        console.error("Auto-heal batch sync failed", e);
                    }
                }

                // v19.0.10: Enhanced Diagnostic Logger
                console.log("[Diagnostic] Current Batch Lookup:", {
                    assignedId: user.batchId,
                    assignedIdTrimmed: String(user.batchId || '').trim(),
                    foundLocally: !!batch,
                    localBatchCount: window.Utils.getBatches().length,
                    localIds: window.Utils.getBatches().map(b => b.id)
                });

                if (!batch) {
                    const errorMsg = `Exam Error: Your assigned Batch (ID: ${user.batchId || 'NONE'}) was not found locally even after sync.\n\n` +
                        `1. Ensure you have an internet connection.\n` +
                        `2. Ask Admin to ensure the Batch is "Synced" to Cloud.\n` +
                        `3. Click OK to try Syncing one more time.`;

                    if (confirm(errorMsg)) {
                        await window.Utils.downloadFromCloud(false); // Manual sync if they confirm
                    }
                    return;
                }

                // Helper to parse potential DD-MM-YYYY, DD/MM/YYYY or YYYY-MM-DD
                const parseDateTime = (dateStr, timeStr) => {
                    if (!dateStr || !timeStr) return null;
                    // Remove ISO T part if accidentally included
                    const pureDate = dateStr.split('T')[0];

                    // Try direct parse (works for YYYY-MM-DD)
                    let d = new Date(`${pureDate}T${timeStr}`);

                    if (isNaN(d.getTime())) {
                        // Handle DD-MM-YYYY or DD/MM/YYYY
                        const sep = pureDate.includes('-') ? '-' : (pureDate.includes('/') ? '/' : null);
                        if (sep) {
                            const parts = pureDate.split(sep);
                            if (parts.length === 3) {
                                // If first part is 4 digits, assume YYYY-MM-DD (already tried but for safety)
                                if (parts[0].length === 4) d = new Date(`${parts[0]}-${parts[1]}-${parts[2]}T${timeStr}`);
                                else d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T${timeStr}`);
                            }
                        }
                    }
                    return d;
                };

                const checkExpiry = (b) => {
                    if (!b.startDate || !b.startTime || !b.endDate || !b.endTime) return 'OK';
                    const now = new Date();
                    const start = parseDateTime(b.startDate, b.startTime);
                    const end = parseDateTime(b.endDate, b.endTime);
                    if (!start || !end) return 'ERROR';
                    if (now < start) return { status: 'FUTURE', time: start };
                    if (now > end) return { status: 'EXPIRED', time: end };
                    return 'OK';
                };

                let status = checkExpiry(batch);

                // AUTO-HEAL: If expired, try syncing once in case it's stale data
                if (status && status.status === 'EXPIRED') {
                    const btn = document.getElementById('sync-status-text');
                    if (btn) btn.innerText = "Verifying Date...";

                    try {
                        await window.Utils.downloadFromCloud(true);
                        // Re-fetch batch
                        batch = window.Utils.getBatches().find(b => b.id === user.batchId);
                        status = checkExpiry(batch);

                        console.log(`Auto-Sync Completed.\nNew End Date: ${batch.endDate} ${batch.endTime}\nStatus: ${status === 'OK' ? 'Active' : status.status}`);

                    } catch (e) {
                        console.error("Auto-heal sync failed", e);
                        // alert(`Auto-Sync Failed: ${e.message}\nPlease check internet connection.`);
                    }
                }

                if (status === 'ERROR') {
                    alert("Date Error: Invalid Date Format in Batch settings.");
                    return;
                }
                if (status && status.status === 'FUTURE') {
                    alert(`Exam has not started yet.\nStart Time: ${status.time.toLocaleString()}`);
                    return;
                }
                if (status && status.status === 'EXPIRED') {
                    alert(`Exam has expired.\nEnd Time: ${status.time.toLocaleString()}`);
                    return;
                }

                const pid = mode === 'Theory' ? batch.theoryPaperId : batch.practicalPaperId;
                console.log(`Starting ${mode}: Batch=${batch.name}, AssignedID=${pid}, AvailableQPs=${window.Utils.getQuestionPapers().length}`);

                let qp = window.Utils.getQuestionPapers().find(q => String(q.id) === String(pid));

                // AUTO-HEAL 2: QP Missing? Try Syncing.
                if (!qp) {
                    const btn = document.getElementById('sync-status-text');
                    if (btn) btn.innerText = "Fetching Exam Paper...";
                    try {
                        await window.Utils.downloadFromCloud(true);
                        qp = window.Utils.getQuestionPapers().find(q => String(q.id) === String(pid));
                    } catch (e) {
                        console.error("Auto-heal QP sync failed", e);
                    }
                }

                if (qp) {
                    setQuestions(qp.questions);
                    setTimeLeft(qp.totalTime * 60);
                    setExamMode(mode);

                    if (mode === 'Practical') {
                        // COMPOSITE RECORDING: Screen + Webcam
                        try {
                            const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: "always" }, audio: true });
                            const camStream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240, facingMode: "user" }, audio: true });

                            // Hidden Video Elements for Source
                            const screenVid = document.createElement('video');
                            screenVid.srcObject = screenStream;
                            screenVid.muted = true;
                            screenVid.play();

                            const camVid = document.createElement('video');
                            camVid.srcObject = camStream;
                            camVid.muted = true;
                            camVid.play();

                            // Canvas for Compositing
                            const canvas = document.createElement('canvas');
                            canvas.width = 1280; // Standard HD
                            canvas.height = 720;
                            const ctx = canvas.getContext('2d');

                            // Animation Loop
                            const drawComposite = () => {
                                if (!screenVid.paused && !screenVid.ended) {
                                    // 1. Draw Screen (Background)
                                    ctx.drawImage(screenVid, 0, 0, canvas.width, canvas.height);

                                    // 2. Draw Webcam (Bottom Right Overlay)
                                    if (!camVid.paused && !camVid.ended) {
                                        const camW = 240; // 20% width approx
                                        const camH = 180;
                                        const margin = 20;
                                        ctx.strokeStyle = "red";
                                        ctx.lineWidth = 2;
                                        ctx.drawImage(camVid, canvas.width - camW - margin, canvas.height - camH - margin, camW, camH);
                                        ctx.strokeRect(canvas.width - camW - margin, canvas.height - camH - margin, camW, camH);
                                    }
                                }
                                compositeReqRef.current = requestAnimationFrame(drawComposite);
                            };

                            // Wait for video load
                            screenVid.onloadedmetadata = () => {
                                drawComposite();
                            };

                            // Merge Audio Tracks (Sys Audio + Mic)
                            const audioTracks = [...screenStream.getAudioTracks(), ...camStream.getAudioTracks()];
                            const compositeStream = canvas.captureStream(30); // 30 FPS
                            if (audioTracks.length > 0) {
                                audioTracks.forEach(t => compositeStream.addTrack(t));
                            }

                            setMediaStream(compositeStream);
                            setWebcamActive(true);
                            setStreamActive(true);

                            // Handle Stop (Stop both source streams)
                            compositeStream.getVideoTracks()[0].onended = () => {
                                screenStream.getTracks().forEach(t => t.stop());
                                camStream.getTracks().forEach(t => t.stop());
                                if (compositeReqRef.current) cancelAnimationFrame(compositeReqRef.current);
                            };

                        } catch (err) {
                            console.error("Composite Setup Failed", err);
                            alert("Error: You MUST allow BOTH Screen Share and Camera permissions for Practical Exams.\nPlease reload and try again.");
                            setExamMode(null);
                        }
                    } else {
                        setWebcamActive(true);
                        // stream useEffect will handle getUserMedia for Theory (Webcam)
                    }
                } else {
                    alert(`Exam Error: The Question Paper (ID: ${pid}) assigned to this batch was not found.\nPlease contact Admin to Assign QP and Sync.`);
                }
            };



            const endExam = () => {
                // STOP RECORDING FIRST
                if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                    console.log("Stopping MediaRecorder in endExam...");
                    mediaRecorderRef.current.stop();
                    setIsRecording(false);
                }

                // STOP MEDIA
                // STOP VIDEO ELEMENT FIRST
                if (videoRef.current && videoRef.current.srcObject) {
                    videoRef.current.srcObject.getTracks().forEach(track => track.stop());
                    videoRef.current.srcObject = null;
                }

                if (mediaStream) {
                    mediaStream.getTracks().forEach(track => track.stop());
                }
                if (compositeReqRef.current) {
                    cancelAnimationFrame(compositeReqRef.current);
                    compositeReqRef.current = null;
                }
                // RESET STATE
                setMediaStream(null);
                setWebcamActive(false);
                setStreamActive(false);
                setExamMode(null);
                setIsSubmitting(false);
            };

            const submitExam = async () => {
                if (isSubmitting) return;
                setIsSubmitting(true);

                // Capture final image (Safe Mode)
                let finalPhoto = null;
                try {
                    const v = videoRef.current;
                    if (v && v.readyState === 4) { // HAVE_ENOUGH_DATA
                        const c = document.createElement('canvas'); c.width = 300; c.height = 200;
                        c.getContext('2d').drawImage(v, 0, 0, 300, 200);
                        finalPhoto = { img: c.toDataURL(), time: new Date().toISOString(), type: 'SUBMISSION' };
                    }
                } catch (e) {
                    console.error("Final Capture Failed", e);
                }

                // STOP RECORDING EXPLICITLY & WAIT
                if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                    // DEBUG v22: Visible Alerts for Tracing
                    console.log("Stopping Recorder for Submission...");

                    // CRITICAL FIX: Preserve original onstop to ensure last segment is saved
                    const originalOnStop = mediaRecorderRef.current.onstop;
                    const stopPromise = new Promise(resolve => {
                        mediaRecorderRef.current.onstop = async (e) => {
                            console.log("Final Segment Saving...");
                            if (originalOnStop) await originalOnStop(e);
                            resolve();
                        };
                    });

                    mediaRecorderRef.current.stop();
                    setIsRecording(false);
                    await stopPromise;

                    // v25: No more waiting for chunk writes, as we write at onstop
                    // Safety Buffer
                    await new Promise(r => setTimeout(r, 200));
                }

                // v25: REMOVED MERGE LOGIC (Video is already saved in onstop)
                /*
                try {
                   // ... merge logic removed ...
                }
                */
            }

            // v25: MERGE LOGIC REMOVED (Video saved at onstop)
            /*
            // NEW: Full Video Merge (Stitch segments for User Convenience)
            try {
                console.log("Generating Full Video from Segments...");
                alert("DEBUG 2/4: Starting Merge Check...");

                const currentResp = window.Utils.getResponses().find(r => r.studentId === user.id && r.examType === examMode);
                if (currentResp && currentResp.evidence) {
                    // Filter and Sort Segments by Time (v23: Support Chunks)
                    const segments = currentResp.evidence
                        .filter(e => (e.isSegment || e.type === 'VIDEO_INDEXED_DB' || e.type === 'VIDEO_CHUNK') && e.key)
                        .sort((a, b) => new Date(a.time) - new Date(b.time));

                    // alert(`DEBUG 3/4: Found ${segments.length} segments.`);
                    console.log(`[v23 Debug] Found ${segments.length} chunks/segments to merge.`);

                    if (segments.length > 0) {
                        const blobPromises = segments.map(s => window.VideoDB.getVideo(s.key));
                        const blobs = await Promise.all(blobPromises);
                        const validBlobs = blobs.filter(b => b);

                        if (validBlobs.length > 0) {
                            const fullBlob = new Blob(validBlobs, { type: 'video/webm' });
                            const fullKey = `vid_full_${user.id}_${Date.now()}`;
                            await window.VideoDB.saveVideo(fullKey, fullBlob);

                            // Add Full Video to Evidence
                            const fullEvidence = {
                                img: fullKey, key: fullKey, time: new Date().toISOString(),
                                type: 'VIDEO_FULL_MERGED', storage: 'indexeddb',
                                isFullVideo: true
                            };
                            currentResp.evidence.push(fullEvidence);
                            await window.Utils.saveResponse(currentResp);

                            // DEBUG ALERTS (v23)
                            console.log(`Full Video Generated: ${fullKey}`);
                            alert(`DEBUG 4/4: Merge Success! Size: ${(fullBlob.size / 1024 / 1024).toFixed(2)} MB`);

                            // AUTO-CLEANUP (v23): Delete Chunks & Segments
                            // The user wants ONLY the full video. We must delete the loose parts.
                            console.log(`[Cleanup] Deleting ${segments.length} segments to keep only Full Video.`);

                            // 1. Remove from Evidence Array (Metadata) to hide from UI immediately
                            currentResp.evidence = currentResp.evidence.filter(e => !e.isSegment);
                            currentResp.evidence.push(fullEvidence); // Ensure full video is there
                            await window.Utils.saveResponse(currentResp);

                            // 2. Background Delete (Storage & Cloud)
                            segments.forEach(async (seg) => {
                                // Delete Local Blob
                                try {
                                    if (seg.key) await window.VideoDB.deleteVideo(seg.key);
                                } catch (e) {
                                    console.warn("Local delete failed for " + seg.key, e);
                                }

                                // Delete Cloud Object (if uploaded)
                                if (seg.url && seg.url.includes('amazonaws.com')) {
                                    try {
                                        const urlObj = new URL(seg.url);
                                        let s3Key = urlObj.pathname.startsWith('/') ? urlObj.pathname.substring(1) : urlObj.pathname;
                                        s3Key = decodeURIComponent(s3Key);
                                        fetch(`${API_BASE}/media?key=${encodeURIComponent(s3Key)}&apiKey=portel_secure_key_2025`, { method: 'DELETE' });
                                    } catch (e) {
                                        console.warn("Cloud delete failed for " + seg.key, e);
                                    }
                                }
                            });
                        }
                    }
                }
            } catch (mergeErr) {
                console.error("Full Video Merge Failed", mergeErr);
                alert("DEBUG ERROR: Merge crashed! " + mergeErr.message);
            }
            */
            if (window.studentRecordingInterval) clearInterval(window.studentRecordingInterval);

            // RE-FETCH EVIDENCE (Includes the just-saved video)
            // We need to re-fetch because saveResponse updates LocalStorage
            const updatedRespForUpload = window.Utils.getResponses().find(r => r.studentId === user.id && r.examType === examMode);
            const finalEvidence = updatedRespForUpload?.evidence || []; // Use updated evidence list

            // Add Final Photo
            if (finalPhoto) finalEvidence.push(finalPhoto);

            // Calculate Auto-Grades (Initial System Grading)
            const autoGrades = {};
            questions.forEach((q, idx) => {
                if (q.questionType !== 'CODING' && q.questionType !== 'PRACTICAL' && q.questionType !== 'VIVA') {
                    // Exact String Match (Case-Insensitive Trimmed)
                    const studentAns = String(answers[idx] || '').trim().toLowerCase();
                    const correctAns = String(q.correctAnswer || '').trim().toLowerCase();
                    if (studentAns && studentAns === correctAns) {
                        autoGrades[idx] = q.totalMarks;
                    } else {
                        autoGrades[idx] = 0;
                    }
                } else {
                    // For Coding/Practical, leave as 0 or undefined for Manual Grading
                    autoGrades[idx] = 0;
                }
            });

            const respObj = {
                studentId: user.id,
                examType: examMode,
                answers,
                assessorMarks: autoGrades, // Pre-fill with system grades
                evidence: finalEvidence
            };

            // AUTO-UPLOAD: Attempt to sync immediately (Scoped to Current Student)
            try {
                const statusBtn = document.getElementById('sync-status-text');
                if (statusBtn) statusBtn.innerText = "Uploading Answer...";

                await window.Utils.saveResponse(respObj);

                // Wait for local video save (give it a moment to finish async IndexedDB writes)
                await new Promise(r => setTimeout(r, 200));

                // Trigger Visible Sync (Only Responses & Only This Student)
                // Robust Check: String convert and Force Full Sync (Visible Errors) to ensure evidence is safely in cloud
                // Pass 'false' for silent to enable alerts if something goes wrong
                const filterByStudent = (item) => String(item.studentId || '').trim() === String(user.id || '').trim();
                window.Utils.uploadToCloud(true, 'responses', filterByStudent);

                // SUMMARY POPUP (User Request)
                const totalPhotos = finalEvidence.filter(e => e.type && (e.type.includes('PHOTO') || e.type.includes('MANUAL'))).length;

                // Improved Video Calculation: Count segments * 30s + any remaining manual clips
                // Since we use 30s fixed segments now, count filtering by 'VIDEO' or 'SEGMENT'
                // Calculate actual video duration from stored metadata
                const fullVideo = finalEvidence.find(e => e.type === 'VIDEO_FULL_MERGED' || e.isFullVideo);
                const videoSegments = finalEvidence.filter(e => e.type && (e.type.includes('VIDEO') || e.isSegment));
                const totalVideoSec = fullVideo?.duration || Math.max(videoSegments.length * 30, 0);

                alert(`Exam Submitted Successfully!\n\nSummary:\n- Video Uploaded: ~${totalVideoSec} Seconds\n- Photos Uploaded: ${totalPhotos}`);

                endExam();

            } catch (e) {
                console.error("Submit Sync Failed", e);
                alert("Submitted to LOCAL STORAGE. Cloud Sync Failed (" + e.message + "). The system will retry automatically when online.");
                endExam();
            }
        };


        if (examMode) {
            if (isLocked) return (
                <div className="flex h-screen fixed inset-0 z-50 bg-red-50 flex-col items-center justify-center text-center p-8 box-border">
                    <Icons.Lock className="w-24 h-24 text-red-600 mb-6" />
                    <h1 className="text-4xl font-bold text-red-700 mb-4">Exam Locked</h1>
                    <p className="text-xl text-gray-700 mb-8">You have exceeded the maximum number of warnings (5/5).<br />Please contact your Assessor to unlock your exam.</p>
                    <div className="bg-white p-6 rounded shadow max-w-md w-full text-left">
                        <h3 className="font-bold mb-2">Violation Log:</h3>
                        <ul className="text-sm text-red-600 list-disc pl-5 max-h-48 overflow-y-auto">
                            {proctoringLogs.map((l, i) => <li key={i}>{l}</li>)}
                        </ul>
                    </div>
                </div>
            );

            if (examMode === 'VivaWait') return (
                <div className="flex h-screen fixed inset-0 z-50 bg-gray-900 flex-col items-center justify-center text-center p-8 box-border text-white animate-fade-in">
                    <div className="w-32 h-32 bg-gray-800 rounded-full flex items-center justify-center mb-8 border-4 border-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.5)] animate-pulse">
                        <Icons.Video className="w-16 h-16 text-indigo-400" />
                    </div>
                    <h1 className="text-4xl font-bold mb-4 tracking-tight">Waiting for Host</h1>
                    <p className="text-xl text-gray-400 mb-8 max-w-md">Please wait here. The assessor will admit you to the Viva session shortly.</p>
                    <div className="bg-gray-800 p-2 rounded text-xs px-4 mb-4 font-mono text-gray-500">
                        Room: {`${user.batchId}_${user.id}`}
                    </div>
                    <div className="flex gap-2 justify-center mb-12">
                        <div className="w-3 h-3 bg-white rounded-full animate-bounce delay-0"></div>
                        <div className="w-3 h-3 bg-white rounded-full animate-bounce delay-100"></div>
                        <div className="w-3 h-3 bg-white rounded-full animate-bounce delay-200"></div>
                    </div>
                    <div className="flex gap-4">
                        <button onClick={() => setExamMode('VivaLive')} className="px-6 py-2 bg-indigo-600 rounded-lg text-white hover:bg-indigo-700 transition-colors text-sm font-bold">
                            Join Now (Force)
                        </button>
                        <button onClick={endExam} className="px-6 py-2 border border-gray-600 rounded-lg text-gray-400 hover:text-white hover:border-gray-400 transition-colors text-sm">
                            Leave Waiting Room
                        </button>
                    </div>
                </div>
            );

            if (examMode === 'VivaLive') return (
                <div className="flex h-screen fixed inset-0 z-50 bg-black flex-col animate-fade-in">
                    <div className="flex-1 relative">
                        {/* Assessor Feed (Center) */}
                        {
                            remoteStream ? (
                                <video
                                    id="remote-assessor-video"
                                    ref={ref => { if (ref && remoteStream) ref.srcObject = remoteStream }}
                                    autoPlay
                                    className="absolute inset-0 w-full h-full object-contain bg-black"
                                />
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="text-center text-gray-500">
                                        <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gray-800 flex items-center justify-center animate-pulse">
                                            <Icons.Video className="w-12 h-12 text-gray-600" />
                                        </div>
                                        <h2 className="text-2xl font-bold text-gray-400">Connecting to Assessor...</h2>
                                        <p className="text-sm">Please wait for the video stream.</p>
                                    </div>
                                </div>
                            )
                        }

                        {/* Student Self-View (Bottom Right) */}
                        <div className="absolute bottom-6 right-6 w-48 h-36 bg-gray-900 rounded-lg border-2 border-gray-700 shadow-xl overflow-hidden">
                            <video id="student-cam-viva" autoPlay muted className="w-full h-full object-cover transform scale-x-[-1]" />
                        </div>

                        {/* Controls */}
                        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex gap-6 bg-gray-900/80 backdrop-blur-md px-8 py-3 rounded-full border border-gray-700">
                            <div className="p-3 rounded-full bg-gray-700 text-white"><Icons.Microphone className="w-6 h-6" /></div>
                            <div className="p-3 rounded-full bg-gray-700 text-white"><Icons.Video className="w-6 h-6" /></div>
                            <button onClick={endExam} className="p-3 rounded-full bg-red-600 text-white hover:bg-red-700"><Icons.PhoneMissed className="w-6 h-6" /></button>
                        </div>
                    </div >
                </div >
            );

            return (
                <div className="flex h-screen fixed inset-0 z-50 bg-white">
                    <div className="w-3/4 p-8 overflow-y-auto">
                        <div className="flex justify-between mb-4">
                            <h2 className="font-bold text-xl">Exam: {examMode}</h2>
                            <div className="flex items-center gap-4">
                                <div className={`px-4 py-1 rounded font-bold ${warnings > 2 ? 'bg-red-100 text-red-700' : (warnings > 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700')}`}>
                                    Warnings: {warnings}/5
                                </div>
                                <div className="font-mono text-xl">{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</div>
                            </div>
                        </div>
                        {lastWarning && (
                            <div className="bg-red-600 text-white p-4 rounded shadow-lg mb-6 text-center font-bold text-lg animate-pulse flex items-center justify-center">
                                <Icons.TriangleAlert className="inline w-8 h-8 mr-3" />
                                <span>WARNING: {lastWarning}</span>
                            </div>
                        )}
                        {questions[currentQ] && (
                            <div>
                                <h3 className="text-lg font-medium mb-4">Q{currentQ + 1}: {questions[currentQ].question}</h3>
                                {questions[currentQ].questionType === 'CODING' ? (
                                    <div className="h-[500px] mb-4">
                                        <CodeRunner
                                            code={answers[currentQ] || ''}
                                            onChange={val => setAnswers({ ...answers, [currentQ]: val })}
                                        />
                                    </div>
                                ) : (questions[currentQ].questionType === 'PRACTICAL' || questions[currentQ].questionType === 'VIVA') ? (
                                    <PracticalQuestionRunner
                                        question={questions[currentQ]}
                                        answer={answers[currentQ] || {}}
                                        onAnswer={val => setAnswers({ ...answers, [currentQ]: val })}
                                    />
                                ) : (
                                    <div className="space-y-2">
                                        {questions[currentQ].options.map(o => (
                                            <button key={o} onClick={() => setAnswers({ ...answers, [currentQ]: o })}
                                                className={`w-full text-left p-3 border rounded ${answers[currentQ] === o ? 'bg-indigo-100 border-indigo-500' : ''}`}>{o}</button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                        <div className="mt-6 flex justify-between">
                            <button disabled={currentQ === 0} onClick={() => setCurrentQ(c => c - 1)} className="px-4 py-2 border rounded">Prev</button>
                            {currentQ < questions.length - 1 ?
                                <button onClick={() => setCurrentQ(c => c + 1)} className="px-4 py-2 bg-indigo-600 text-white rounded">Next</button> :
                                <button onClick={submitExam} disabled={isSubmitting} className={`px-4 py-2 text-white rounded flex items-center gap-2 ${isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}>
                                    {isSubmitting && <Icons.Loader className="w-4 h-4 animate-spin" />}
                                    {isSubmitting ? 'Submitting...' : 'Submit Exam'}
                                </button>
                            }
                        </div>
                    </div>
                    <div className="w-1/4 bg-gray-100 p-4 border-l">
                        <div className="relative">
                            <div className="relative bg-black rounded mb-2 h-48 flex items-center justify-center overflow-hidden">
                                <video ref={videoRef} id="student-cam" autoPlay muted playsInline className={`w-full h-full object-cover transform ${examMode === 'Practical' ? '' : 'scale-x-[-1]'} ${streamActive ? 'block' : 'hidden'}`}></video>
                                {!streamActive && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
                                        <p className="text-white text-xs mb-2">Camera Off</p>
                                        <button onClick={startCameraManual} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-full font-bold shadow text-sm">
                                            Start Camera
                                        </button>
                                    </div>
                                )}
                                {isRecording && (
                                    <div className="absolute top-2 right-2 flex items-center gap-1 bg-red-600/90 text-white text-[10px] px-2 py-1 rounded-full animate-pulse shadow-lg z-10">
                                        <div className="w-2 h-2 bg-white rounded-full"></div> REC
                                    </div>
                                )}
                            </div>
                            <div className="grid grid-cols-4 gap-2">
                                {questions.map((_, i) => <div key={i} onClick={() => setCurrentQ(i)} className={`h-8 flex items-center justify-center cursor-pointer rounded ${answers[i] ? 'bg-green-200' : 'bg-white'}`}>{i + 1}</div>)}
                            </div>
                        </div>
                    </div>
                </div>

            );
        }

        return (
            <div className="p-8">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold">Student Portal</h2>
                    <button onClick={async () => {
                        const batches = window.Utils.getBatches();
                        const statusText = document.getElementById('sync-status-text');
                        if (statusText) statusText.innerText = "Running Deep Diag...";

                        let cloudBatches = [];
                        let cloudStudent = null;
                        let apiOk = false;
                        try {
                            const [bRes, sRes] = await Promise.all([
                                fetch(`${API_BASE}/batches`, { headers: { 'x-api-key': 'portel_secure_key_2025' } }),
                                fetch(`${API_BASE}/students`, { headers: { 'x-api-key': 'portel_secure_key_2025' } })
                            ]);
                            if (bRes.ok) cloudBatches = await bRes.json();
                            if (sRes.ok) {
                                const allS = await sRes.json();
                                cloudStudent = allS.find(s => s.id === user.id);
                            }
                            apiOk = true;
                        } catch (e) { console.error("Cloud fetch failed", e); }

                        const targetId = String(user.batchId || '').trim();
                        const foundInCloud = cloudBatches.some(b => String(b.id || '').trim() === targetId);

                        const diag = {
                            "My User ID": user.id,
                            "Record Found in Cloud?": cloudStudent ? "YES ✅" : "NO ❌",
                            "Target Batch ID": targetId,
                            "Found in Cloud Batches?": foundInCloud ? "YES ✅" : "NO ❌",
                            "API Connectivity": apiOk ? "Connected ✅" : "Failed ❌",
                            "--- CLOUD INVENTORY ---": "---",
                            "Cloud Batch IDs": cloudBatches.map(b => b.id).join(", "),
                            "Cloud Student's BatchID": cloudStudent ? cloudStudent.batchId : "N/A",
                            "Browser Online": navigator.onLine,
                            "App Version": "v19.0.19"
                        };
                        console.table(diag);
                        const msg = "--- STUDENT DIAGNOSTICS (v19.0.13) ---\n\n" +
                            Object.entries(diag).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join("\n") +
                            "\n\nActions:\n1. If Target Batch Found is NO -> Admin must Save it.\n2. If Cloud Student ID is different -> Mismatch!";
                        if (confirm(msg)) {
                            if (statusText) statusText.innerText = "Force Syncing...";
                            await window.Utils.downloadFromCloud(false);
                            location.reload();
                        }
                    }} className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
                        <Icons.TriangleAlert className="w-4 h-4 text-orange-500" /> Troubleshoot
                    </button>
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                    <div onClick={() => startExam('Theory')} className="bg-white p-8 rounded shadow cursor-pointer hover:shadow-lg border-l-4 border-indigo-600">
                        <h3 className="text-xl font-bold text-indigo-900">Theory Exam</h3>
                        <p className="text-gray-500">Multiple choice questions</p>
                        <button className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded">Start</button>
                    </div>
                    <div onClick={() => startExam('Practical')} className="bg-white p-8 rounded shadow cursor-pointer hover:shadow-lg border-l-4 border-purple-600">
                        <h3 className="text-xl font-bold text-purple-900">Practical Exam</h3>
                        <p className="text-gray-500">Coding challenges</p>
                        <button className="mt-4 bg-purple-600 text-white px-4 py-2 rounded">Start</button>
                    </div>

                    <div onClick={() => setExamMode('VivaWait')} className="bg-white p-8 rounded shadow cursor-pointer hover:shadow-lg border-l-4 border-green-500">
                        <h3 className="text-xl font-bold text-green-700">Live Viva</h3>
                        <p className="text-gray-500">Join the live video assessment</p>
                        <button className="mt-4 bg-green-600 text-white px-4 py-2 rounded flex items-center gap-2"><Icons.Video className="w-4 h-4" /> Join Session</button>
                    </div>
                </div>
            </div>
        );
        };

        // ASSESSOR PORTAL
