# Frontend Deployment Guide - AI Playwright Smart Recorder

## Quick Start (3 Commands)

```powershell
cd E:\ai-playwright-smart-recorder\frontend
npm install
npm run deploy
```

That's it! Your bookmarklet will be deployed to GitHub Pages.

---

## What Happens

1. `npm install` - Installs all dependencies including `gh-pages`
2. `npm run build` - Builds React app with Vite → creates `dist/` folder
3. `npm run deploy` - Deploys `dist/` to `gh-pages` branch on GitHub
4. GitHub Pages automatically publishes the `gh-pages` branch

---

## Deployment URL

After deployment, your site will be available at:

```
https://shivamgul1649.github.io/Recorder_inspector/
```

Replace `shivamgul1649` with your GitHub username if needed.

---

## File Structure

```
frontend/
├── src/
│   ├── App.tsx              # Main React component (bookmarklet generator)
│   ├── App.css              # Styling
│   ├── main.tsx             # React entry point
│   └── index.css            # Global styles
├── public/
│   ├── smart-recorder.js    # Core bookmarklet script (injected into target page)
│   ├── favicon.svg
│   └── icons.svg
├── package.json             # Dependencies (corrected)
├── vite.config.ts          # Vite build config
├── tsconfig.json           # TypeScript config
├── tsconfig.app.json       # App TypeScript config
├── tsconfig.node.json      # Build tools TypeScript config
├── index.html              # HTML entry point
└── .gitignore              # Git ignore rules
```

---

## Key Features

✅ **Zero Backend**
- No API calls
- No server
- No database
- Runs entirely in browser

✅ **GitHub Pages Deployment**
- Free hosting
- HTTPS included
- No configuration needed
- Updated automatically

✅ **Bookmarklet System**
- Injects `smart-recorder.js` into target website
- Floating UI panel
- Element picking & inspection
- Recording & script generation
- Copy-paste workflow

---

## Local Development

```powershell
cd E:\ai-playwright-smart-recorder\frontend

# Start dev server (auto-opens in browser)
npm run dev

# Browser will open at http://localhost:5173

# Make changes to src/App.tsx or src/App.css
# Changes auto-reload in browser

# Stop dev server: Press Ctrl+C
```

---

## Build Process

```powershell
cd E:\ai-playwright-smart-recorder\frontend

# TypeScript compilation + Vite bundling
npm run build

# Output: dist/ folder with:
# - index.html (compiled React app)
# - smart-recorder.js (copied from public/)
# - [other assets]

# Preview production build locally
npm run preview
```

---

## Deployment Troubleshooting

### Problem: "gh-pages is not installed"

```powershell
npm install --save-dev gh-pages
npm run deploy
```

### Problem: "fatal: could not read Username"

You need to configure GitHub credentials:

```powershell
# Method 1: Use GitHub CLI (recommended)
gh auth login

# Method 2: Use personal access token
# 1. Go to: https://github.com/settings/tokens
# 2. Create new token with 'repo' scope
# 3. Copy token
# 4. When prompted for password, paste token
```

### Problem: Deployment hangs or times out

```powershell
# Try deployment with verbose output
$env:DEBUG='gh-pages'; npm run deploy
```

### Problem: Site is not updating after deployment

1. Wait 2-5 minutes for GitHub Pages to rebuild
2. Hard refresh browser: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
3. Check gh-pages branch: https://github.com/ShivamGUL1649/Recorder_inspector/branches

---

## GitHub Pages Configuration

1. Go to: https://github.com/ShivamGUL1649/Recorder_inspector/settings/pages
2. Under "Build and deployment":
   - Source: "Deploy from a branch"
   - Branch: "gh-pages"
   - Folder: "/ (root)"
3. Click Save

Wait 1-2 minutes for GitHub to build and publish.

---

## Package.json Scripts

| Script | What It Does |
|--------|-------------|
| `npm run dev` | Start local dev server (http://localhost:5173) |
| `npm run build` | Build for production (creates dist/) |
| `npm run preview` | Preview production build locally |
| `npm run deploy` | Build + deploy to GitHub Pages |

---

## Environment Configuration

### Vite Config (vite.config.ts)
```typescript
export default defineConfig({
  plugins: [react()],
  base: "./",              // Relative paths for GitHub Pages
  server: {
    port: 5173,
    open: true             // Auto-open browser
  },
  build: {
    outDir: "dist",        // Output directory
    sourcemap: false       // No sourcemaps in production
  }
});
```

### TypeScript Config (tsconfig.json)
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",    // New React 17+ JSX transform
    "strict": true,        // Strict type checking
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

---

## What Gets Deployed

When you run `npm run deploy`, these files go to GitHub Pages:

```
dist/
├── index.html                  # React app landing page
├── smart-recorder.js           # Bookmarklet script
├── assets/
│   ├── index-[hash].js        # React components (bundled)
│   ├── index-[hash].css       # Styles (bundled)
│   └── [other assets]
└── [other files]
```

The `dist/` folder is deployed to the `gh-pages` branch.

---

## Verifying Deployment

1. **Check dist folder**:
   ```powershell
   ls E:\ai-playwright-smart-recorder\frontend\dist
   ```

2. **Visit GitHub Pages**:
   ```
   https://shivamgul1649.github.io/Recorder_inspector/
   ```

3. **Verify smart-recorder.js is accessible**:
   ```
   https://shivamgul1649.github.io/Recorder_inspector/smart-recorder.js
   ```

4. **Check gh-pages branch on GitHub**:
   ```
   https://github.com/ShivamGUL1649/Recorder_inspector/branches
   ```

---

## Next Steps After Deployment

1. **Copy Bookmarklet Code**:
   - Visit: https://shivamgul1649.github.io/Recorder_inspector/
   - Click "Copy Bookmarklet Code"

2. **Create Browser Bookmark**:
   - Name: `AI Recorder`
   - URL: Paste the bookmarklet code

3. **Test the Bookmarklet**:
   - Open: https://www.saucedemo.com/
   - Click "AI Recorder" bookmark
   - Verify floating panel appears

---

## Production Checklist

- [ ] `npm install` completes without errors
- [ ] `npm run build` creates `dist/` folder
- [ ] `npm run deploy` succeeds (look for "Published" message)
- [ ] GitHub Pages URL is accessible
- [ ] smart-recorder.js loads without errors (F12 DevTools)
- [ ] Bookmarklet code appears on landing page
- [ ] Bookmarklet injects script successfully on target site
- [ ] Floating recorder panel appears
- [ ] Element picking works
- [ ] Recording captures actions
- [ ] Script generation works
- [ ] Copy to clipboard works

---

## Continuous Deployment

To automatically deploy after every commit:

1. **Set up GitHub Actions** (optional):
   - Create `.github/workflows/deploy.yml`
   - Commit and push to GitHub
   - GitHub automatically runs deployment on each push to main

2. **Manual deployment**:
   - Make code changes
   - Commit to git
   - Run `npm run deploy`

---

## Support & Debugging

**Enable debug mode**:
```powershell
$env:DEBUG='gh-pages'; npm run deploy
```

**Check GitHub Pages status**:
- Visit: https://github.com/ShivamGUL1649/Recorder_inspector/settings/pages
- Look for "Your site is published at..."

**Clear GitHub Pages cache**:
1. Go to Settings → Pages
2. Change branch to "none"
3. Wait 1 minute
4. Change back to "gh-pages"

---

**Your bookmarklet is now production-ready!** 🚀
