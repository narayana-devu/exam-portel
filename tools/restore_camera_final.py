#!/usr/bin/env python3
"""Script to restore startCameraManual in StudentPortal"""

path = 'client/index.html'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Check for streamActive state
state_def = "const [streamActive, setStreamActive] = useState(false);"

if state_def in content:
    print("✅ streamActive state exists")
    
    # Check if function is missing
    if "const startCameraManual =" not in content:
        print("⚠️ Function missing. Restoring...")
        
        func_code = """
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
"""
        # Insert after state definition
        content = content.replace(state_def, state_def + "\n" + func_code)
        
        # Restore button onClick
        if "onClick={() => alert('Camera Debug')}" in content:
            content = content.replace("onClick={() => alert('Camera Debug')}", "onClick={startCameraManual}")
            print("✅ Restored button onClick")
        
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print("✅ Restored function")
    else:
        print("Function already exists (maybe in GradingView?)")
        # We removed the GradingView one in previous step.
        # So if it exists, it must be in StudentPortal?
        # Let's verify location.
        idx = content.find("const startCameraManual =")
        portal_idx = content.find("const StudentPortal =")
        if idx > portal_idx:
             print("✅ Function exists inside StudentPortal")
             # Restore button if needed
             if "onClick={() => alert('Camera Debug')}" in content:
                content = content.replace("onClick={() => alert('Camera Debug')}", "onClick={startCameraManual}")
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(content)
                print("✅ Restored button onClick")
        else:
             print("❌ Function exists but OUTSIDE StudentPortal? This shouldn't happen.")

else:
    print("❌ streamActive state MISSING. Need to restore everything.")
