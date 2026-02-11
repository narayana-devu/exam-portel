#!/bin/bash

echo "================================"
echo "  Auto-Deploy with Version Bump"
echo "================================"
echo ""

# Bump version
echo "[1/4] Bumping version..."
node tools/bump_version.js
if [ $? -ne 0 ]; then
    echo "ERROR: Version bump failed!"
    exit 1
fi
echo ""

# Stage all changes
echo "[2/4] Staging changes..."
git add -A
echo ""

# Get the new version
VERSION=$(grep -oP 'v\d+' client/index.html | head -1 | sed 's/v//')

# Commit with version message
echo "[3/4] Committing changes..."
read -p "Enter commit message (or press Enter for default): " COMMIT_MSG
if [ -z "$COMMIT_MSG" ]; then
    git commit -m "v${VERSION}: Auto-deployment"
else
    git commit -m "v${VERSION}: ${COMMIT_MSG}"
fi
echo ""

# Push to GitHub
echo "[4/4] Pushing to GitHub..."
git push origin main
echo ""

echo "================================"
echo "  ✅ Deployment Complete!"
echo "  Version: v${VERSION}"
echo "  URL: https://exam-portel.vercel.app/"
echo "================================"
