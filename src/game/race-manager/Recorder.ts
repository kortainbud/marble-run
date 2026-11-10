import * as THREE from 'three'

/**
 * Records body transforms at a fixed interval so a finished race can be
 * replayed exactly (positions are recorded, not re-simulated, so the replay is
 * always identical to what happened).
 */
export class Recorder {
  readonly frames: Float32Array[] = []
  t0 = 0
  constructor(readonly bodies: number, readonly interval: number) {}

  push(t: number, data: Float32Array) {
    if (this.frames.length === 0) this.t0 = t
    this.frames.push(data.slice())
  }

  get duration() {
    return Math.max(0, (this.frames.length - 1) * this.interval)
  }

  /** Writes interpolated transforms at time t (relative to t0) onto objects. */
  apply(t: number, objects: THREE.Object3D[]) {
    if (this.frames.length === 0) return
    const f = Math.max(0, Math.min(this.frames.length - 1, (t - this.t0) / this.interval))
    const i = Math.min(this.frames.length - 2, Math.floor(f))
    if (i < 0) return
    const a = this.frames[i]
    const b = this.frames[i + 1] ?? a
    const k = Math.min(1, f - i)
    for (let n = 0; n < objects.length; n++) {
      const o = objects[n]
      const j = n * 7
      applyInterpolated(o, a, b, j, k)
    }
  }
}

const q: number[] = [0, 0, 0, 0]
/** Interpolates one 7-float transform (pos + quat) at offset j between a and b. */
export function applyInterpolated(o: THREE.Object3D, a: ArrayLike<number>, b: ArrayLike<number>, j: number, k: number) {
  o.position.set(a[j] + (b[j] - a[j]) * k, a[j + 1] + (b[j + 1] - a[j + 1]) * k, a[j + 2] + (b[j + 2] - a[j + 2]) * k)
  THREE.Quaternion.slerpFlat(q, 0, a as number[], j + 3, b as number[], j + 3, k)
  o.quaternion.set(q[0], q[1], q[2], q[3])
}
