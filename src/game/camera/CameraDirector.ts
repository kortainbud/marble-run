import * as THREE from 'three'
import type { CameraMode } from '../../types'
import type { PathTracker } from '../tracks/PathTracker'

export interface DirectorInput {
  positions: THREE.Vector3[]
  /** progress along the centreline for each marble */
  s: number[]
  /** marble indices in race order (leader first) */
  order: number[]
  followIdx: number
  phase: 'countdown' | 'racing' | 'finished'
  finishS: number
  finishPos: THREE.Vector3
  finishHeading: THREE.Vector3
  bounds: THREE.Box3
  /** index of the winner once known */
  winnerIdx: number | null
}

type Shot = 'start' | 'chase' | 'pack' | 'side' | 'high' | 'finish' | 'winner' | 'overview'

const AUTO_ROTATION: { shot: Shot; dur: number }[] = [
  { shot: 'chase', dur: 6 },
  { shot: 'pack', dur: 5 },
  { shot: 'side', dur: 4 },
  { shot: 'chase', dur: 5 },
  { shot: 'high', dur: 4.5 },
]

/**
 * Broadcast-style camera. Every shot produces a desired eye + look-at; the
 * actual camera eases toward them so cuts become smooth glides.
 */
export class CameraDirector {
  mode: CameraMode = 'auto'
  shot: Shot = 'start'
  private shotTime = 0
  private rotIdx = 0
  private eye = new THREE.Vector3()
  private look = new THREE.Vector3()
  private desiredEye = new THREE.Vector3()
  private desiredLook = new THREE.Vector3()
  private tan = new THREE.Vector3()
  private side = new THREE.Vector3()
  private tmp = new THREE.Vector3()
  private orbit = 0
  private initialised = false

  constructor(
    readonly camera: THREE.PerspectiveCamera,
    readonly tracker: PathTracker,
  ) {}

  /** Instantly place the camera (no easing), e.g. when a race loads. */
  snap(input: DirectorInput) {
    this.initialised = false
    this.update(input, 0)
  }

  setMode(m: CameraMode) {
    this.mode = m
  }

  resetShots() {
    this.shot = 'start'
    this.shotTime = 0
    this.rotIdx = 0
  }

  update(input: DirectorInput, dt: number) {
    this.shotTime += dt
    this.orbit += dt
    const shot = this.chooseShot(input)
    if (shot !== this.shot) {
      this.shot = shot
      this.shotTime = 0
    }
    this.compute(shot, input)

    if (!this.initialised) {
      this.eye.copy(this.desiredEye)
      this.look.copy(this.desiredLook)
      this.initialised = true
    } else {
      const ke = 1 - Math.exp(-dt * (shot === 'chase' || shot === 'side' ? 3.2 : 1.8))
      const kl = 1 - Math.exp(-dt * 6)
      this.eye.lerp(this.desiredEye, ke)
      this.look.lerp(this.desiredLook, kl)
    }
    this.camera.position.copy(this.eye)
    this.camera.lookAt(this.look)
  }

  private chooseShot(i: DirectorInput): Shot {
    if (this.mode === 'overview') return 'overview'
    if (i.phase === 'countdown') return 'start'
    if (i.phase === 'finished') return this.mode === 'auto' ? 'winner' : 'chase'
    if (this.mode === 'follow' || this.mode === 'leader') return 'chase'
    // auto director
    const leaderS = i.s[i.order[0]] ?? 0
    if (i.winnerIdx == null && leaderS > i.finishS - 11) return 'finish'
    if (i.winnerIdx != null) return this.shot === 'finish' && this.shotTime < 3 ? 'finish' : 'pack'
    if (this.shot === 'start') {
      if (this.shotTime < 1.6) return 'start'
      this.rotIdx = 0
      return AUTO_ROTATION[0].shot
    }
    const cur = AUTO_ROTATION[this.rotIdx % AUTO_ROTATION.length]
    if (this.shotTime > cur.dur) {
      this.rotIdx++
      this.shotTime = 0
      return AUTO_ROTATION[this.rotIdx % AUTO_ROTATION.length].shot
    }
    return cur.shot
  }

  private target(i: DirectorInput) {
    if (i.phase === 'finished' && i.winnerIdx != null && this.mode === 'auto') return i.winnerIdx
    if (this.mode === 'follow') return i.followIdx
    return i.order[0] ?? 0
  }

  private compute(shot: Shot, i: DirectorInput) {
    const idx = this.target(i)
    const p = i.positions[idx]
    const s = i.s[idx] ?? 0
    this.tracker.tangentAt(s, this.tan, 3)
    this.side.set(-this.tan.z, 0, this.tan.x).normalize()

    switch (shot) {
      case 'start': {
        // in front of the gate, looking back up at the grid
        const c = this.centroid(i, i.order.length)
        this.tracker.tangentAt(1, this.tan, 2)
        this.side.set(-this.tan.z, 0, this.tan.x).normalize()
        this.desiredLook.copy(c).addScaledVector(this.tan, 0.5)
        this.desiredEye.copy(c).addScaledVector(this.tan, 5.5).addScaledVector(this.side, 2.2).add(this.tmp.set(0, 2.6, 0))
        break
      }
      case 'chase': {
        this.desiredLook.copy(p).addScaledVector(this.tan, 2)
        this.desiredEye.copy(p).addScaledVector(this.tan, -5.2).addScaledVector(this.side, 1.1).add(this.tmp.set(0, 2.9, 0))
        break
      }
      case 'side': {
        // reverse angle: ahead of the marble, looking back at it and the chasing pack
        this.desiredLook.copy(p).addScaledVector(this.tan, -1.5)
        this.desiredEye.copy(p).addScaledVector(this.tan, 6).addScaledVector(this.side, 0.8).add(this.tmp.set(0, 2.6, 0))
        break
      }
      case 'pack': {
        const n = Math.min(6, i.order.length)
        const c = this.centroid(i, n)
        const spread = this.spread(i, n, c)
        const leadS = i.s[i.order[0]] ?? 0
        this.tracker.tangentAt(Math.min(leadS, i.finishS), this.tan, 4)
        this.side.set(-this.tan.z, 0, this.tan.x).normalize()
        const dist = 6 + Math.min(10, spread * 0.9)
        this.desiredLook.copy(c).addScaledVector(this.tan, 1.5)
        this.desiredEye.copy(c).addScaledVector(this.tan, -dist * 0.75).addScaledVector(this.side, -dist * 0.35).add(this.tmp.set(0, dist * 0.65, 0))
        break
      }
      case 'high': {
        this.desiredLook.copy(p)
        this.desiredEye.copy(p).addScaledVector(this.tan, 2).addScaledVector(this.side, -2.5).add(this.tmp.set(0, 9, 0))
        break
      }
      case 'finish': {
        // planted just past the line, looking back up the final straight
        this.desiredEye.copy(i.finishPos).addScaledVector(i.finishHeading, 4.5).add(this.tmp.set(0, 2.2, 0))
          .addScaledVector(this.side.set(-i.finishHeading.z, 0, i.finishHeading.x), 1.6)
        this.desiredLook.copy(p).lerp(i.finishPos, 0.35)
        break
      }
      case 'winner': {
        const a = this.orbit * 0.35
        this.desiredLook.copy(p)
        this.desiredEye.copy(p).add(this.tmp.set(Math.cos(a) * 4.2, 3.4, Math.sin(a) * 4.2))
        break
      }
      case 'overview': {
        const c = i.bounds.getCenter(this.tmp.clone())
        const size = i.bounds.getSize(new THREE.Vector3())
        const r = Math.max(size.x, size.z) * 0.62 + 10
        const a = this.orbit * 0.05 + 0.8
        const pack = this.centroid(i, Math.min(5, i.order.length))
        this.desiredLook.copy(c).lerp(pack, 0.35)
        this.desiredEye.set(c.x + Math.cos(a) * r, c.y + r * 0.55, c.z + Math.sin(a) * r)
        break
      }
    }
  }

  private centroid(i: DirectorInput, n: number) {
    const c = new THREE.Vector3()
    const k = Math.max(1, Math.min(n, i.order.length))
    for (let j = 0; j < k; j++) c.add(i.positions[i.order[j]])
    return c.multiplyScalar(1 / k)
  }

  private spread(i: DirectorInput, n: number, c: THREE.Vector3) {
    let m = 0
    for (let j = 0; j < Math.min(n, i.order.length); j++) m = Math.max(m, i.positions[i.order[j]].distanceTo(c))
    return m
  }
}
