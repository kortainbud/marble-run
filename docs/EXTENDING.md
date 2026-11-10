# Extending Marble Run

## Add an environment

1. Create `src/environments/<id>/index.ts` that exports an `EnvironmentDef` (see `canyon/index.ts`).
2. In `build()`:
   - set `scene.background`, `scene.fog` and lights;
   - create a `TrackBuilder` with a `TrackTheme` (materials, friction, restitution, ground height);
   - lay out the course with the builder's piece API:
     ```ts
     b.begin(startPos, heading)   // heading: a cardinal unit vector
     b.pen()                      // start pen + gate (required)
     const c = b.straight(len, drop)  // negative drop = uphill kicker
     b.turn('left' | 'right')     // 90° landing corner
     b.uturn('left')              // two corners = reverse direction
     b.gap(len, drop)             // air gap (marked as no-respawn)
     b.finish()                   // finish basin (required)
     ```
   - attach obstacles to the returned `Chute`s, positioned with `u` (0..1 along the chute) and `v` (-1..1 across it);
   - return `{ builder, obstacles, bloom, exposure, confetti }`.
3. Add it to `ENVIRONMENTS` in `src/environments/registry.ts` with `playable: true`. Add `'<id>'` to `EnvironmentId` in `src/types` if it is new.

The Setup and Home screens render a 3D preview card automatically, by building the environment once with physics turned off (`rapier: null`). Any code that touches Rapier must allow for that.

**Spacing rule:** every gap a marble has to pass through should be wider than about 0.65 units (marble diameter 0.56). Moving parts should leave at least that much clearance from walls, so marbles are never crushed between a kinematic body and the track.

## Add a marble skin

1. Add the id to `SkinId` in `src/types/index.ts`.
2. Add a `case` in `createMarbleVisual()` (`src/game/marbles/skins.ts`), plus a CSS approximation in `marbleCss()` for the small UI dots.
3. Add an entry to `SKINS` in `src/game/marbles/roster.ts` (optionally also some roster marbles).

Skins are visual only. Do not touch `MARBLE` in `game/physics/constants.ts`. Every marble shares the same radius, density, friction, restitution and damping.

## Add an obstacle

An obstacle is a factory `(ctx, chute, options) => Obstacle` in `src/game/obstacles/`:

| Hook | Use |
|---|---|
| `preStep(t, dt)` | Drive kinematic bodies (`setNextKinematicTranslation/Rotation`) before each physics step |
| `postStep(t, dt, marbles)` | Apply forces or impulses after the step (zones, boosts). `marbles[i].pos/vel` are already cached |
| `frame(t, dt)` | Cosmetic animation once per rendered frame |

Register any moving body with `ctx.track({ body, object })` so it is interpolated, rendered and recorded for replays. Use `ctx.builder.staticCollider()` for fixed colliders, `ctx.emit()` for sound and FX events, and `toLocal(chute, pos)` to get a marble's `(u, v, h)` on the chute.
