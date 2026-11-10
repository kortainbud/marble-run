import type * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import type { Chute, TrackBuilder } from '../tracks/TrackBuilder'

export interface MarbleRef {
  idx: number
  body: RAPIER.RigidBody
  /** world position cached once per physics step */
  pos: THREE.Vector3
  vel: THREE.Vector3
  cooldown: Record<string, number>
}

/** A physics body whose transform should be interpolated, rendered and recorded for replay. */
export interface TrackedBody {
  body: RAPIER.RigidBody
  object: THREE.Object3D
}

export type GameEvent = { type: 'boost' | 'bump' | 'launch' | 'rock'; pos: THREE.Vector3 }

export interface ObstacleContext {
  builder: TrackBuilder
  rapier: typeof RAPIER | null
  world: RAPIER.World | null
  scene: THREE.Group
  emit: (e: GameEvent) => void
  track: (t: TrackedBody) => void
}

export interface Obstacle {
  readonly kind: string
  /** before each physics step: drive kinematic bodies (t = simulation time) */
  preStep?(t: number, dt: number): void
  /** after each physics step: apply zone forces / impulses */
  postStep?(t: number, dt: number, marbles: MarbleRef[]): void
  /** per rendered frame: cosmetic animation */
  frame?(t: number, dt: number): void
  /** called when a replay starts so purely visual state can reset */
  dispose?(): void
}

export function toLocal(c: Chute, p: THREE.Vector3) {
  const dx = p.x - c.start.x
  const dy = p.y - c.start.y
  const dz = p.z - c.start.z
  return {
    u: (dx * c.fwd.x + dy * c.fwd.y + dz * c.fwd.z) / c.length,
    v: (dx * c.side.x + dy * c.side.y + dz * c.side.z) / (c.width / 2),
    h: dx * c.up.x + dy * c.up.y + dz * c.up.z,
  }
}
