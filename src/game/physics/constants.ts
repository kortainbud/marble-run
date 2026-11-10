import { MARBLE_RADIUS } from '../marbles/skins'

/** Fixed simulation step. Rendering interpolates between steps. */
export const PHYSICS_DT = 1 / 120
export const MAX_STEPS_PER_FRAME = 8
export const GRAVITY = -9.81

/**
 * Identical for every marble. Skins never change any of these values.
 */
export const MARBLE = {
  radius: MARBLE_RADIUS,
  density: 2.5,
  friction: 0.45,
  restitution: 0.38,
  linearDamping: 0.12,
  angularDamping: 0.35,
  maxSpeed: 15,
}

export const TRACK = {
  width: 3.4,
  floorThickness: 0.3,
  wallThickness: 0.18,
  wallHeight: 0.9,
  landingWallHeight: 1.7,
}

/** How often (in physics steps) the replay recorder samples body transforms. */
export const RECORD_EVERY = 3
