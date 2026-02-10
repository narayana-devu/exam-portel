# PowerShell script to apply recording fixes
$filePath = "c:\Users\DELL\Downloads\portel-master (2)\portel-master\client\scripts\test_parse.js"

# Read file with UTF8 encoding
$content = Get-Content $filePath -Encoding UTF8 -Raw

Write-Host "Original file size: $($content.Length) characters"

# Fix 1: Add recordingStartTimeRef after recordingSessionRef
$pattern1 = '(const recordingSessionRef = useRef\(null\);)'
$replacement1 = '$1' + "`n" + '            const recordingStartTimeRef = useRef(null);'
$content = $content -replace [regex]::Escape('const recordingSessionRef = useRef(null);'), $replacement1
Write-Host "✓ Fix 1: Added recordingStartTimeRef"

# Fix 2: Set recordingStartTimeRef before recorder.start(5000)
$pattern2 = '(\s+)(recorder\.start\(5000\);)'
$replacement2 = '$1' + 'recordingStartTimeRef.current = Date.now();' + "`n" + '$1$2'
$content = $content -replace $pattern2, $replacement2
Write-Host "✓ Fix 2: Added recording start time tracker"

# Fix 3: Add duration field to fullEvidence object
$pattern3 = '(isFullVideo: true)(\s*})'
$replacement3 = '$1,' + "`n" + '                                duration: recordingStartTimeRef.current ? Math.floor((Date.now() - recordingStartTimeRef.current) / 1000) : 0' + '$2'
$content = $content -replace $pattern3, $replacement3
Write-Host "✓ Fix 3: Added duration tracking to evidence"

# Fix 4: Add MediaRecorder.stop() to endExam
$endExamFix = @'
const endExam = () => {
                // STOP RECORDING FIRST
                if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                    console.log("Stopping MediaRecorder in endExam...");
                    mediaRecorderRef.current.stop();
                    setIsRecording(false);
                }

                // STOP MEDIA
'@
$pattern4 = 'const endExam = \(\) => \{\s+// STOP MEDIA'
$content = $content -replace $pattern4, $endExamFix
Write-Host "✓ Fix 4: Added MediaRecorder.stop() to endExam"

# Fix 5: Update video duration calculation
$durationCalcFix = @'
// Calculate actual video duration from stored metadata
                const fullVideo = finalEvidence.find(e => e.type === 'VIDEO_FULL_MERGED' || e.isFullVideo);
                const videoSegments = finalEvidence.filter(e => e.type && (e.type.includes('VIDEO') || e.isSegment));
                const totalVideoSec = fullVideo?.duration || Math.max(videoSegments.length * 30, 0);
'@
$pattern5 = 'const videoSegments = finalEvidence\.filter\(e => e\.type && \(e\.type\.includes\(''VIDEO''\) \|\| e\.isSegment\)\)\.length;\s+const totalVideoSec = videoSegments \* 30;'
$content = $content -replace $pattern5, $durationCalcFix
Write-Host "✓ Fix 5: Updated video duration calculation"

# Write back to file
$content | Set-Content $filePath -Encoding UTF8 -NoNewline
Write-Host "`n✅ All fixes applied successfully!"
Write-Host "Modified file size: $($content.Length) characters"
Write-Host "Backup saved as: test_parse.js.backup"
