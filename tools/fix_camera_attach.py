#!/usr/bin/env python3
"""Script to ensure camera stream is attached to video element"""

path = 'client/index.html'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# I'll insert the new useEffect after the recording logic I just added.
# I can find the end of the recording logic by looking for the end marker I used before.
end_marker = "}, [examMode, isLocked, webcamActive, user.id]);"

new_effect = """
            // Ensure Camera Stream is Attached to Video Element
            useEffect(() => {
                if (webcamActive && examMode && examMode !== 'VivaLive') {
                    const video = document.getElementById('student-cam');
                    if (video && !video.srcObject) {
                        navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
                            video.srcObject = stream;
                        }).catch(e => console.error("Camera Error", e));
                    }
                }
            }, [webcamActive, examMode]);"""

if end_marker in content:
    content = content.replace(end_marker, end_marker + new_effect)
    print("✅ Added Camera Attachment Logic")
else:
    print("❌ Could not find recording logic end marker")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
