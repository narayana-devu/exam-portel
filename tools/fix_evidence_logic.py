import os

file_path = 'client/index.html'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. FIX PHOTO LOGIC (Disable old one)
old_photo_logic = """                        // PERIODIC SNAPSHOT (Every ~1 minute = 20 ticks of 3000ms)
                        if (tick % 20 === 0) {
                            const c = document.createElement('canvas'); c.width = 300; c.height = 200;
                            c.getContext('2d').drawImage(video, 0, 0, 300, 200);
                            window.Utils.saveResponse({
                                studentId: user.id, examType: examMode,
                                evidence: [{ img: c.toDataURL(), time: new Date().toISOString(), type: 'AUTO_SNAPSHOT' }]
                            });
                        }"""

new_photo_logic_comment = """                        // PERIODIC SNAPSHOT REMOVED (Moved to independent loop)"""

if old_photo_logic in content:
    content = content.replace(old_photo_logic, new_photo_logic_comment)
    print("Disabled old photo logic.")
else:
    print("WARNING: Could not find old photo logic block exactly. Trying loose match...")
    # Fallback: try to find just the if statement line if exact block fails
    if "if (tick % 20 === 0) {" in content:
        # This is risky without full block, but let's try to replace the inner part
        pass 

# 2. INSERT NEW PHOTO LOGIC
# Find a good insertion point. After the detectionInterval useEffect closes.
insertion_marker = "}, [examMode, webcamActive, isLocked, proctoringModel, warnings]);"
new_photo_effect = """            }, [examMode, webcamActive, isLocked, proctoringModel, warnings]);

            // INDEPENDENT PHOTO CAPTURE LOOP (Decoupled from AI Model)
            useEffect(() => {
                if (!examMode || isLocked || !webcamActive || examMode === 'VivaLive' || examMode === 'VivaWait') return;

                const capturePhoto = () => {
                    const video = document.getElementById('student-cam');
                    if (video && video.readyState === 4) {
                        const c = document.createElement('canvas'); c.width = 300; c.height = 200;
                        c.getContext('2d').drawImage(video, 0, 0, 300, 200);
                        console.log("Auto-Snapshot Taken (Independent Loop)");
                        window.Utils.saveResponse({
                            studentId: user.id, examType: examMode,
                            evidence: [{ img: c.toDataURL(), time: new Date().toISOString(), type: 'AUTO_SNAPSHOT' }]
                        });
                    }
                };

                const interval = setInterval(capturePhoto, 60000); // Every 60 Seconds
                return () => clearInterval(interval);
            }, [examMode, webcamActive, isLocked]);"""

if insertion_marker in content:
    # Only insert if not already there
    if "INDEPENDENT PHOTO CAPTURE LOOP" not in content:
        content = content.replace(insertion_marker, new_photo_effect)
        print("Inserted new photo logic.")
    else:
        print("New photo logic already present.")
else:
    print("ERROR: Could not find insertion marker for new photo logic.")

# 3. FIX VIDEO SAVE LOGIC
old_video_logic = """                // STOP RECORDING EXPLICITLY & WAIT
                if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                    mediaRecorderRef.current.stop();
                    setIsRecording(false);
                    // Critical: Wait for onstop data to hit localStorage (Extended for 30s chunks)
                    await new Promise(r => setTimeout(r, 4000));
                }"""

new_video_logic = """                // STOP RECORDING EXPLICITLY & WAIT
                if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                    console.log("Stopping Recorder for Submission...");
                    const stopPromise = new Promise(resolve => { mediaRecorderRef.current.onstop = resolve; });
                    mediaRecorderRef.current.stop();
                    setIsRecording(false);
                    await stopPromise;
                    await new Promise(r => setTimeout(r, 2000));
                }"""

if old_video_logic in content:
    content = content.replace(old_video_logic, new_video_logic)
    print("Updated video save logic.")
else:
    print("WARNING: Could not find old video logic block. Checking for partial...")
    # Try to match without the comment line if needed
    pass

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
