# Deployment Notes

## Web Deployment

The app is a static Vite build.

```bash
npm install
npm run build
```

Upload `dist/` to Vercel, Netlify, or GitHub Pages.

For GitHub Pages, set the repository Pages source to a static deployment workflow or publish `dist/` through an action.

## Backend Integration

Set:

```bash
VITE_API_BASE_URL=http://localhost:8000
VITE_ENABLE_MOCK=false
```

Then replace the mock runner with a real API client:

- task creation
- task start
- stage detail fetch
- Review Gate action submit
- artifact list fetch
- SSE event stream

## Desktop App Path

Recommended path:

1. Keep this React/Vite project as the shared UI.
2. Add Tauri when the team wants a desktop app shell.
3. Use the existing `surface=app` UI mode as the desktop visual foundation.
4. Let the Tauri backend call the same HTTP backend or local orchestrator.

Electron is also possible, but Tauri is lighter for a demo app.
