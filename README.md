# Marble Run

Browser-based 3D marble racing. **Set up the race. Drop the marbles. Let physics decide the winner.**

React + TypeScript + Vite for the UI, Three.js for rendering, Rapier (`@dimforge/rapier3d-compat`) for physics, Zustand for state. No backend: settings, prediction stats and recent races are kept in `localStorage`.

```bash
npm install
npm run dev        # http://localhost:5230
npm run build      # type-check + production bundle in dist/
```

## What's in the MVP

| Area | Status |
|---|---|
| Screens | Home, Race setup, Marble garage, Race (countdown → HUD → results) |
| Competitors | 4 / 8 / 12 / 20; your marble is always on the grid, the rest come from a 21-marble house roster |
| Skins | 8 cosmetic skins: Classic, Glass, Galaxy, Lava, Chrome, Neon, Crystal, Gradient |
| Environments | **Canyon Run** and **Neon Circuit** are playable. Jungle Rush, Frozen Peak and Candyland are listed as coming soon |
| Obstacles | 10 types: peg/boulder field, narrow-passage dividers, pinball bumpers, spinner / rotating bridge, sliding block (moving platform), speed booster, launch pad + gap jump, magnetic field, energy gate, falling rocks |
| Camera | Director (automatic broadcast cuts), Leader, Follow (any marble; tap a name in the standings), Overview |
| Race rules | Gate release, finish-line detection, positions, off-track recovery, stuck-marble nudges and respawns, timeout (120 s, or 25 s after the winner) with DNFs |
| Prediction | Pick a winner before the race; it locks at the gate. Points, streak and best streak |
| Replay | Exact replay of the recorded race at 0.5× / 1× / 2×, plus Race Again with a new seed |
| Audio | Synthesised with the Web Audio API (no asset files), with a mute toggle (key `M`) |

Keyboard: `Space`/`Esc` pause, `C` cycle camera, `M` mute.

## Architecture

```
src/
  components/      React UI (screens/, race/ HUD + results, customisation/, navigation/, ui/)
  store/           Zustand store (persisted settings and stats, plus live race state)
  environments/    One folder per environment; registry.ts lists them all
  game/
    engine/        GameEngine: renderer, post-processing, fixed-step loop, interpolation, replay playback
    race-manager/  Race (world, rules, state machine), Recorder (replay frames)
    physics/       Shared physics constants (marble properties are identical for everyone)
    tracks/        TrackBuilder (meshes + colliders from track pieces), PathTracker (progress), props
    obstacles/     Obstacle implementations (static, kinematic, zones, rocks)
    camera/        CameraDirector
    marbles/       Skins (visual only) and roster
    rendering/     Procedural textures, lighting, confetti, offscreen previews
    audio/         Synth sound kit
```

**Physics loop:** Rapier steps at a fixed 1/120 s (`PHYSICS_DT`). Each rendered frame runs as many steps as have accumulated (capped at 8), then interpolates every tracked body between its last two physics states. Marbles move only through the simulation; nothing is animated along a path.

**Race state machine:** `COUNTDOWN → RACING → FINISHED` (plus `PAUSED` in the UI). Marbles settle against a kinematic gate during the countdown, and the gate drops at GO.

**Progress and finish:** `PathTracker` projects each marble onto the track centreline. The search is limited to nearby segments, so a marble is never matched to a different level of the track. Crossing `finishS` records the finish time.

**Replay:** transforms of all moving bodies are recorded every 3 steps and played back with interpolation, so a replay always matches what actually happened.

See [`docs/EXTENDING.md`](docs/EXTENDING.md) for adding environments, skins and obstacles.
