#!/usr/bin/env python3
"""Script to robustly restore camera logic in StudentPortal"""

path = 'client/index.html'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

portal_idx = content.find("const StudentPortal =")
# Check if startCameraManual exists AFTER StudentPortal start
manual_idx = content.find("const startCameraManual =", portal_idx)

if manual_idx == -1:
    print("⚠️ startCameraManual is MISSING in StudentPortal. Restoring...")
    
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
    
    # Find the insert marker AFTER the portal start
    insert_idx = content.find(insert_marker, portal_idx)
    
    if insert_idx != -1:
        # Insert after the marker line
        # Find end of line
        eol = content.find("\n", insert_idx)
        content = content[:eol] + "\n" + code_to_insert + content[eol:]
        print("✅ Restored code after isRecording inside StudentPortal")
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
    else:
        print("❌ Could not find insertion point inside StudentPortal")
else:
    print("✅ startCameraManual already exists in StudentPortal")
