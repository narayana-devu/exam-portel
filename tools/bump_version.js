const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'client', 'index.html');

try {
    let content = fs.readFileSync(filePath, 'utf8');

    // Regex to find version strings like "v35" (integer versioning)
    const versionRegex = /v(\d+)/g;

    let currentVersion = null;
    let newVersion = null;

    // Find the current version
    const match = versionRegex.exec(content);
    if (match) {
        currentVersion = match[0];
        const versionNumber = parseInt(match[1]);

        // Increment version by 1
        newVersion = `v${versionNumber + 1}`;
    }

    if (currentVersion && newVersion) {
        console.log(`Bumping version from ${currentVersion} to ${newVersion}`);

        // Replace all occurrences
        const newContent = content.replace(new RegExp(currentVersion, 'g'), newVersion);
        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log(`✅ Version updated successfully to ${newVersion} in client/index.html`);
    } else {
        console.error('Could not find a valid version string (e.g., v35) in client/index.html');
        process.exit(1);
    }

} catch (err) {
    console.error('Error updating version:', err);
    process.exit(1);
}
