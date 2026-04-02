# Mule-Engine

A lightweight but heavy-duty, web-based JavaScript game engine starter that runs directly on GitHub Pages.

## Tech stack

- **three** for rendering
- **cannon-es** for physics
- **howler** for audio routing
- **gsap** for animation timelines
- **stats.js** for runtime FPS metrics
- **lil-gui** for tuning controls
- **mitt** for eventing
- **pathfinding** for grid navigation hooks

All libraries are imported as ESM modules from jsDelivr, so there is no build step.

## Local development

Serve the repo with any static HTTP server:

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

## GitHub Pages deployment

1. Push this repository to GitHub.
2. In **Settings → Pages**, set source to `Deploy from a branch`.
3. Choose your branch (for example `main`) and folder `/ (root)`.
4. Save. GitHub Pages will publish `index.html` and the `src/` files as static assets.

Because all imports are absolute HTTPS CDN URLs, this works on both custom domains and `*.github.io/<repo>` project pages.

## Controls

- `Mouse drag + wheel`: orbit and zoom camera
- `Space`: apply an impulse burst to all rigid bodies
- `M`: toggle audio
- `G`: show/hide runtime GUI
