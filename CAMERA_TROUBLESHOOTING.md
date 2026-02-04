# Camera Troubleshooting Guide

## Quick Diagnostic Steps

### Step 1: Check if Button Appears
1. Login as a student
2. Click "Start" on Theory or Practical exam
3. Look at the RIGHT sidebar
4. Do you see a black box with "Camera Off" and a blue "Start Camera" button?

### Step 2: Click the Button
1. Click the "Start Camera" button
2. What happens?
   - [ ] Browser asks for camera permission
   - [ ] Alert/error message appears
   - [ ] Nothing happens
   - [ ] Camera starts working

### Step 3: Check Browser Console
1. Press F12 to open Developer Tools
2. Click the "Console" tab
3. Click "Start Camera" button again
4. Look for error messages (red text)
5. Share any errors you see

## Common Issues & Solutions

### Issue 1: Permission Denied
**Symptoms**: Alert says "Camera Failed: Permission denied"
**Solution**:
1. Click the camera icon in browser address bar
2. Select "Always allow"
3. Reload the page
4. Try again

### Issue 2: Camera Not Found
**Symptoms**: Alert says "Camera Failed: Requested device not found"
**Solution**:
- Check if your camera is connected
- Try a different browser
- Check if another app is using the camera

### Issue 3: HTTPS Required
**Symptoms**: Alert says "Only secure origins are allowed"
**Solution**:
- Camera only works on HTTPS (your site uses HTTPS, so this should be fine)
- Make sure you're using https://exam-portal-2004.web.app (not http://)

### Issue 4: Button Doesn't Appear
**Symptoms**: No "Start Camera" button visible
**Solution**:
- Make sure you started an exam (Theory or Practical)
- Check if you're in the exam interface (not the dashboard)
- Try refreshing the page

## What to Share
Please tell me:
1. Which issue matches your problem?
2. Any error messages from the console (F12)
3. What browser you're using (Chrome, Firefox, Edge, etc.)
