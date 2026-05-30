# GitHub Pages Deployment Script for AI Playwright Smart Recorder
# Usage: .\deploy.ps1
# This script automates the frontend deployment to GitHub Pages

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "AI Playwright Smart Recorder - GitHub Pages Deployment" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Navigate to frontend directory
Set-Location "E:\ai-playwright-smart-recorder\frontend"

# Step 1: Check Node.js
Write-Host "[1/6] Checking Node.js installation..." -ForegroundColor Yellow
$nodeVersion = & node --version
$npmVersion = & npm --version
Write-Host "Node: $nodeVersion" -ForegroundColor Green
Write-Host "npm: $npmVersion" -ForegroundColor Green
Write-Host ""

# Step 2: Install dependencies
Write-Host "[2/6] Installing dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ npm install failed" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Dependencies installed" -ForegroundColor Green
Write-Host ""

# Step 3: Build frontend
Write-Host "[3/6] Building frontend..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Build failed" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Build succeeded" -ForegroundColor Green
Write-Host ""

# Step 4: Check dist folder
Write-Host "[4/6] Verifying build output..." -ForegroundColor Yellow
if (Test-Path "dist") {
    Write-Host "✓ dist/ folder created" -ForegroundColor Green
    Get-ChildItem dist | Select-Object -First 10 | Format-Table Name
} else {
    Write-Host "✗ dist/ folder not found" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 5: Deploy to GitHub Pages
Write-Host "[5/6] Deploying to GitHub Pages..." -ForegroundColor Yellow
npm run deploy
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Deployment failed" -ForegroundColor Red
    Write-Host "Check your GitHub token configuration" -ForegroundColor Yellow
    exit 1
}
Write-Host "✓ Deployment succeeded" -ForegroundColor Green
Write-Host ""

# Step 6: Show GitHub Pages URL
Write-Host "[6/6] Deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "✓ Your bookmarklet is now live!" -ForegroundColor Green
Write-Host ""
Write-Host "Visit: https://shivamgul1649.github.io/Recorder_inspector/" -ForegroundColor Magenta
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Copy the bookmarklet code from the website" -ForegroundColor White
Write-Host "2. Create a browser bookmark named 'AI Recorder'" -ForegroundColor White
Write-Host "3. Paste the bookmarklet code in the URL field" -ForegroundColor White
Write-Host "4. Visit any website and click the bookmark" -ForegroundColor White
Write-Host "============================================" -ForegroundColor Cyan
