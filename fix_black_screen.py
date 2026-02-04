#!/usr/bin/env python3
"""Script to add Manual Camera Start Button"""

path = 'client/index.html'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add streamActive state and startCamera function
# Find start of StudentPortal
portal_start = "const StudentPortal = ({ user }) => {"
new_code = """
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
                    // Try auto-start after small delay to ensure DOM is ready
                    setTimeout(startCameraManual, 1000);
                }
            }, [examMode]);
"""

if portal_start in content and "startCameraManual" not in content:
    content = content.replace(portal_start, portal_start + new_code)
    print("✅ Added startCameraManual function")

# 2. Update Video UI
# Find the video element container
# I'll look for the REC indicator I added earlier to be sure
rec_indicator = '<div className="w-2 h-2 bg-white rounded-full"></div> REC'

# I'll replace the whole relative div block
# It starts with <div className="relative"> and ends with </div> (after REC)
# This is hard to match exactly with regex due to nesting.
# I'll match the video tag line and wrap it.

video_line = '<video id="student-cam" autoPlay muted playsInline className="w-full bg-black rounded mb-2 transform scale-x-[-1]"></video>'

new_video_ui = """<div className="relative bg-black rounded mb-2 h-48 flex items-center justify-center overflow-hidden">
                                <video id="student-cam" autoPlay muted playsInline className={`w-full h-full object-cover transform scale-x-[-1] ${streamActive ? 'block' : 'hidden'}`}></video>
                                {!streamActive && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
                                        <p className="text-white text-xs mb-2">Camera Off</p>
                                        <button onClick={startCameraManual} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-full font-bold shadow text-sm">
                                            Start Camera
                                        </button>
                                    </div>
                                )}"""

if video_line in content:
    content = content.replace(video_line, new_video_ui)
    print("✅ Updated Video UI with Manual Button")
else:
    print("❌ Could not find video line")
    # Debug
    print("Searching for:", video_line)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
