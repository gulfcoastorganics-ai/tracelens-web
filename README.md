# TraceLens

TraceLens is a camera-first browser tool for aligning a reference image with a live camera view. It is implemented as a static JavaScript web application with PWA metadata and an accessible control surface.

## What it includes

- Live camera preview with front/rear camera switching
- Reference-image import and adjustable overlay controls
- Opacity, scale, rotation, position, blend modes, guides, and alignment workflows
- Perspective alignment, trace-assist modes, comparison views, session/workspace state, and diagnostic surfaces

## Requirements

- Node.js 20+ for local development/testing
- A modern browser with camera/media support
- HTTPS or localhost when using live camera access

## Run locally

The project has no runtime dependencies. Start the included zero-dependency static server:

```bash
npm run dev
```

The default URL is `http://127.0.0.1:8080`. Override `HOST` or `PORT` through the process environment when needed.

## Testing

```bash
npm test
```

The test command runs the behavior-focused `tests/*.test.mjs` suite with Node's built-in test runner. GitHub Actions runs the same command for pushes and pull requests targeting `main`.

## Deployment

Pushes to `main` are tested, staged as a static site, and deployed through `.github/workflows/deploy-pages.yml`. The manifest uses relative start/scope/icon URLs so the PWA metadata remains valid when hosted from a project subpath.

## Architecture

- `index.html`: application shell and accessible UI landmarks
- `app.js`: camera lifecycle, overlay interaction, workspace state, and feature orchestration
- focused root modules: camera, comparison, diagnostics, calibration, overlay, state, and workflow behavior
- `tests/`: Node-based behavior and integration tests
- `manifest.webmanifest`: installable PWA metadata
- `scripts/serve.mjs`: local static development server

## Release status

The repository is configured for continuous static deployment. Automated behavior is CI-gated. Camera permissions, device switching, install behavior, and visual overlay alignment remain target-device acceptance checks because they depend on real browser hardware rather than the repository build.
