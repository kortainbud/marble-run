import type * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import type { EnvironmentId } from '../types'
import type { TrackBuilder } from '../game/tracks/TrackBuilder'
import type { Obstacle, ObstacleContext } from '../game/obstacles/types'

export interface BuildArgs {
  scene: THREE.Scene
  rapier: typeof RAPIER | null
  world: RAPIER.World | null
  emit: ObstacleContext['emit']
  track: ObstacleContext['track']
}

export interface BuiltEnvironment {
  builder: TrackBuilder
  obstacles: Obstacle[]
  bloom: { strength: number; radius: number; threshold: number }
  exposure: number
  /** colour of the finish celebration confetti */
  confetti: string[]
  /** cosmetic per-frame animation (sky, decor) */
  frame?: (t: number, dt: number) => void
}

export interface EnvironmentDef {
  id: EnvironmentId
  name: string
  tagline: string
  description: string
  playable: boolean
  obstacles: string[]
  ui: { from: string; to: string; accent: string }
  build?: (args: BuildArgs) => BuiltEnvironment
}
