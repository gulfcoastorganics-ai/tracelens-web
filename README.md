# TraceLens

TraceLens is a camera-first browser tool for aligning a reference image with a live camera view. It is implemented as a static JavaScript web application with PWA metadata and an accessible control surface.

## What it includes

- Live camera preview with front/rear camera switching
- Reference-image import and adjustable overlay controls
- Opacity, scale, rotation, position, blend modes, guides, and alignment workflows
- Perspective alignment, trace-assist modes, comparison views, session/workspace persistence, and diagnostic surfaces

## Run locally

This repository is a static web app. Serve the repository root with a local HTTP server, then open the printed URL in a browser. Camera access requires a secure context such as HTTPS or localhost.

No package manager or build script is currently documented in the repository. Add a reproducible setup command before presenting this project as a packaged application.

## Testing

The repository includes a `tests/` directory. The current repository does not document a single test command or CI status; add those details when the test workflow is standardized.

## Architecture

- `index.html`: application shell and accessible UI landmarks
- `app.js`: camera lifecycle, overlay interaction, workspace state, and feature orchestration
- `tests/`: behavior-focused test assets
- `manifest.webmanifest`: installable PWA metadata

## Demo and screenshots

No verified live demo or screenshot assets are currently linked here. Add a public demo URL and a small set of current screenshots when available.
