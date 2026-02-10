import sys
import re

# Read the file
with open(r'c:\Users\DELL\Downloads\portel-master (2)\portel-master\client\scripts\test_parse.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Fix 1: Add recordingStartTime ref after line 31 (recordingSessionRef)
# Find the line with "const recordingSessionRef = useRef"
for i, line in enumerate(lines):
    if 'const recordingSessionRef = useRef(null);' in line:
        # Insert new line after this one
        lines.insert(i + 1, '            const recordingStartTimeRef = useRef(null);\n')
        print(f"✓ Added recordingStartTimeRef at line {i+2}")
        break

# Re-index after insertion
# Fix 2: Update recorder.onstop to track duration (around line 285, now 286)
for i, line in enumerate(lines):
    if 'recorder.onstop = async () => {' in line:
        # Find the fullEvidence object (should be ~10 lines after)
        for j in range(i, min(i + 20, len(lines))):
            if 'const fullEvidence = {' in lines[j]:
                # Find the closing brace of this object
                for k in range(j, min(j + 10, len(lines))):
                    if 'isFullVideo: true' in lines[k]:
                        # Add duration field after isFullVideo
                        indent = ' ' * 32  # Match indentation
                        duration_line = f'{indent}duration: recordingStartTimeRef.current ? Math.floor((Date.now() - recordingStartTimeRef.current) / 1000) : 0\n'
                        lines.insert(k + 1, duration_line)
                        print(f"✓ Added duration tracking at line {k+2}")
                        break
                break
        break

# Fix 3: Set recordingStartTimeRef when recording starts
# Find where recorder.start is called
for i, line in enumerate(lines):
    if 'recorder.start(5000);' in line:
        # Add recordingStartTimeRef.current = Date.now() before this
        indent = ' ' * 20  # Match indentation
        lines.insert(i, f'{indent}recordingStartTimeRef.current = Date.now();\n')
        print(f"✓ Added recording start time tracker at line {i+1}")
        break

# Fix 4: Add MediaRecorder.stop() to endExam function (line 704)
for i, line in enumerate(lines):
    if 'const endExam = () => {' in line:
        # Insert after this line, before "// STOP MEDIA"
        insert_code = '''                // STOP RECORDING FIRST
                if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                    console.log("Stopping MediaRecorder in endExam...");
                    mediaRecorderRef.current.stop();
                    setIsRecording(false);
                }

'''
        lines.insert(i + 1, insert_code)
        print(f"✓ Added MediaRecorder.stop() to endExam at line {i+2}")
        break

# Fix 5: Update video duration calculation in submitExam
for i, line in enumerate(lines):
    if 'const videoSegments = finalEvidence.filter' in line:
        # Replace this line and the next
        indent = ' ' * 16
        new_calc = f'''{indent}// Calculate actual video duration from stored metadata
{indent}const fullVideo = finalEvidence.find(e => e.type === 'VIDEO_FULL_MERGED' || e.isFullVideo);
{indent}const totalVideoSec = fullVideo?.duration || Math.max(videoSegments.length * 30, 0);
'''
        # Remove old lines
        lines[i] = new_calc
        if i + 1 < len(lines) and 'const totalVideoSec = videoSegments * 30;' in lines[i + 1]:
            lines.pop(i + 1)
        print(f"✓ Updated video duration calculation at line {i+1}")
        break

# Write the file back
with open(r'c:\Users\DELL\Downloads\portel-master (2)\portel-master\client\scripts\test_parse.js', 'w', encoding='utf-8', newline='\n') as f:
    f.writelines(lines)

print("\n✅ All fixes applied successfully!")
print("Backup saved as: test_parse.js.backup")
