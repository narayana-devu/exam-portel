const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'client', 'index.html');

try {
    let content = fs.readFileSync(filePath, 'utf8');

    // Regex to find version strings like "v16.0"
    // It looks for "v" followed by numbers, a dot, and numbers.
    const versionRegex = /v(\d+)\.(\d+)/g;

    let currentVersion = null;
    let newVersion = null;

    // First pass: find the current version (assuming all are the same or taking the first one)
    const match = versionRegex.exec(content);
    if (match) {
        currentVersion = match[0];
        const major = parseInt(match[1]);
        const minor = parseInt(match[2]);

        // Increment minor version
        newVersion = `v${major}.${minor + 1}`;
    }

    if (currentVersion && newVersion) {
        console.log(`Bumping version from ${currentVersion} to ${newVersion}`);

        // Replace all occurrences
        const newContent = content.replace(versionRegex, newVersion);
        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log('Version updated successfully in client/index.html');
    } else {
        console.error('Could not find a valid version string (e.g., v16.0) in client/index.html');
        process.exit(1);
    }

} catch (err) {
    console.error('Error updating version:', err);
    process.exit(1);
}
