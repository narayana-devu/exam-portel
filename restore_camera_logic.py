#!/usr/bin/env python3
"""Script to restore missing camera logic"""

path = 'client/index.html'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

if "const startCameraManual" not in content:
    print("⚠️ startCameraManual is MISSING. Restoring...")
    
    insert_marker = "const [isRecording, setIsRecording] = useState(false); // UI Indicator"
    
    code_to_insert = """
            const [streamActive, setStreamActive] = useState(false);

            const startCameraManual = async () => {
                try {
                    console.log("Requesting Camera...");
                    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                    const video = document.getElementById('student-cam');
                    if (video) {
                        video.srcObject = stream;
                        video.play().catch(e => console.error("Play Error", e));
                        setStreamActive(true);
                        setWebcamActive(true);
                        console.log("Camera Started Successfully");
                    } else {
                        alert("Error: Video element not found. Please refresh.");
                    }
                } catch (err) {
                    console.error("Camera Error", err);
                    alert("Camera Failed: " + err.message + "\\nPlease check permissions and try again.");
                }
            };

            useEffect(() => {
                if (examMode && !streamActive) {
                    setTimeout(startCameraManual, 1000);
                }
            }, [examMode]);
"""
    
    if insert_marker in content:
        content = content.replace(insert_marker, insert_marker + "\n" + code_to_insert)
        print("✅ Restored code after isRecording")
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
    else:
        print("❌ Could not find insertion point")
else:
    print("✅ startCameraManual already exists")
