#!/bin/bash
# GitHub Pages Deployment Script for AI Playwright Smart Recorder
# Usage: ./deploy.sh
# This script automates the frontend deployment to GitHub Pages

echo "============================================"
echo "AI Playwright Smart Recorder - GitHub Pages Deployment"
echo "============================================"
echo ""

# Navigate to frontend directory
cd E:\ai-playwright-smart-recorder\frontend

# Step 1: Check Node.js
echo "[1/6] Checking Node.js installation..."
node --version
npm --version
echo ""

# Step 2: Install dependencies
echo "[2/6] Installing dependencies..."
npm install
echo ""

# Step 3: Build frontend
echo "[3/6] Building frontend..."
npm run build
if [ $? -eq 0 ]; then
    echo "✓ Build succeeded"
else
    echo "✗ Build failed"
    exit 1
fi
echo ""

# Step 4: Check dist folder
echo "[4/6] Verifying build output..."
if [ -d "dist" ]; then
    echo "✓ dist/ folder created"
    ls -la dist | head -10
else
    echo "✗ dist/ folder not found"
    exit 1
fi
echo ""

# Step 5: Deploy to GitHub Pages
echo "[5/6] Deploying to GitHub Pages..."
npm run deploy
if [ $? -eq 0 ]; then
    echo "✓ Deployment succeeded"
else
    echo "✗ Deployment failed"
    echo "Check your GitHub token configuration"
    exit 1
fi
echo ""

# Step 6: Show GitHub Pages URL
echo "[6/6] Deployment complete!"
echo ""
echo "============================================"
echo "✓ Your bookmarklet is now live!"
echo ""
echo "Visit: https://shivamgul1649.github.io/Recorder_inspector/"
echo ""
echo "Next steps:"
echo "1. Copy the bookmarklet code from the website"
echo "2. Create a browser bookmark named 'AI Recorder'"
echo "3. Paste the bookmarklet code in the URL field"
echo "4. Visit any website and click the bookmark"
echo "============================================"
