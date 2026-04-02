# Mule-Engine

A lightweight but heavy-duty, web-based JavaScript game engine starter.

## Highlights

- Rendering with **Three.js** + **OrbitControls**
- Physics with **cannon-es**
- Audio with **howler.js**
- Animation timelines with **GSAP**
- Perf overlay with **stats.js**
- Runtime tuning with **lil-gui**
- Event bus with **mitt**
- Terrain noise with **SimplexNoise**
- Pathfinding utility integration with **pathfinding**

## Run locally

Because this uses native ESM and CDN imports, you only need a static server:

```bash
python3 -m http.server 4173
```

Then open: <http://localhost:4173>

## Controls

- `Space`: burst impulse on all active rigid bodies
- `M`: toggle ambient music
- `G`: show/hide live tuning panel
- Mouse drag/wheel: orbit camera and zoom

## Goal

This repo is intentionally small while still showing a scalable engine shell:

- Scene + camera + renderer lifecycle
- Physics sync loop
- Audio/event/gui subsystems
- Debug telemetry and simple HUD

Use it as a base to add ECS, networking, asset pipelines, editor tooling, and multiplayer.
