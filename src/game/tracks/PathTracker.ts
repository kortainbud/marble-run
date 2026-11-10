import * as THREE from 'three'
import type { PathPoint } from './TrackBuilder'

export interface Location {
  seg: number
  /** distance along the centreline */
  s: number
  /** distance from the centreline */
  dist: number
  /** height above (+) / below (-) the centreline */
  dy: number
}

const tmp = new THREE.Vector3()
const ab = new THREE.Vector3()

/** Projects marbles onto the track centreline to measure race progress. */
export class PathTracker {
  readonly total: number
  constructor(readonly path: PathPoint[]) {
    this.total = path[path.length - 1].s
  }

  /**
   * Windowed search around the previous segment so marbles are never matched to
   * a different level of the track that happens to be close in 3D.
   */
  locate(p: THREE.Vector3, hint: number, out: Location): Location {
    const n = this.path.length - 1
    const lo = Math.max(0, hint - 2)
    const hi = Math.min(n - 1, hint + 4)
    let best = Infinity
    for (let i = lo; i <= hi; i++) {
      const a = this.path[i]
      const b = this.path[i + 1]
      ab.subVectors(b.p, a.p)
      const len2 = ab.lengthSq() || 1
      const t = Math.max(0, Math.min(1, tmp.subVectors(p, a.p).dot(ab) / len2))
      tmp.copy(a.p).addScaledVector(ab, t)
      const d = tmp.distanceTo(p)
      // tiny bias toward later segments so ties at joints move forward
      if (d < best - 1e-4 || (Math.abs(d - best) < 1e-4 && i > out.seg)) {
        best = d
        out.seg = i
        out.s = a.s + (b.s - a.s) * t
        out.dist = d
        out.dy = p.y - tmp.y
      }
    }
    return out
  }

  pointAt(s: number, out = new THREE.Vector3()) {
    const i = this.segmentAt(s)
    const a = this.path[i]
    const b = this.path[i + 1]
    const t = (s - a.s) / Math.max(1e-6, b.s - a.s)
    return out.copy(a.p).lerp(b.p, Math.max(0, Math.min(1, t)))
  }

  /** Smoothed direction of travel around distance s. */
  tangentAt(s: number, out = new THREE.Vector3(), smooth = 2.5) {
    const a = this.pointAt(Math.max(0, s - smooth), new THREE.Vector3())
    const b = this.pointAt(Math.min(this.total, s + smooth), new THREE.Vector3())
    out.subVectors(b, a)
    out.y *= 0.5
    return out.normalize()
  }

  segmentAt(s: number) {
    let lo = 0
    let hi = this.path.length - 2
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (this.path[mid].s <= s) lo = mid
      else hi = mid - 1
    }
    return lo
  }
}
