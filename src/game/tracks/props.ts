import * as THREE from 'three'
import type { PathPoint, TrackBuilder } from './TrackBuilder'
import { frameFromForward } from './geometry'
import { checker } from '../rendering/textures'
import { TRACK } from '../physics/constants'

/** Checkered finish line strip + arch over the basin entry (visual only). */
export function finishArch(b: TrackBuilder, postMat: THREE.Material, bannerColor = '#111') {
  if (!b.finishPose) return
  const { pos, heading } = b.finishPose
  const f = frameFromForward(heading)
  const W = b.width + TRACK.wallThickness * 2 + 0.4
  const tex = checker().clone()
  tex.needsUpdate = true
  tex.repeat.set(W / 0.5, 1)
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.4, 0.5), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }))
  strip.position.copy(pos).add(new THREE.Vector3(0, 0.012, 0))
  strip.quaternion.copy(f.quat).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2))
  strip.receiveShadow = true
  b.group.add(strip)

  const H = 3.2
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, H, 0.22), postMat)
    post.position.copy(pos).addScaledVector(f.side, (s * W) / 2).add(new THREE.Vector3(0, H / 2 - 0.3, 0))
    post.castShadow = true
    b.group.add(post)
  }
  const bannerTex = checker().clone()
  bannerTex.needsUpdate = true
  bannerTex.repeat.set(W / 0.35, 1.5)
  const banner = new THREE.Mesh(
    new THREE.BoxGeometry(W + 0.22, 0.55, 0.12),
    [
      new THREE.MeshStandardMaterial({ color: bannerColor }),
      new THREE.MeshStandardMaterial({ color: bannerColor }),
      new THREE.MeshStandardMaterial({ color: bannerColor }),
      new THREE.MeshStandardMaterial({ color: bannerColor }),
      new THREE.MeshStandardMaterial({ map: bannerTex }),
      new THREE.MeshStandardMaterial({ map: bannerTex }),
    ],
  )
  banner.position.copy(pos).add(new THREE.Vector3(0, H - 0.5, 0))
  banner.quaternion.copy(f.quat)
  banner.castShadow = true
  b.group.add(banner)
}

/** Horizontal distance from (x,z) to the track centreline. */
export function distToPath2D(path: PathPoint[], x: number, z: number) {
  let best = Infinity
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i].p
    const b = path[i + 1].p
    const abx = b.x - a.x
    const abz = b.z - a.z
    const l2 = abx * abx + abz * abz || 1
    const t = Math.max(0, Math.min(1, ((x - a.x) * abx + (z - a.z) * abz) / l2))
    best = Math.min(best, Math.hypot(a.x + abx * t - x, a.z + abz * t - z))
  }
  return best
}

/** Scatter helper that keeps decor clear of the track. */
export function scatterAround(
  b: TrackBuilder,
  n: number,
  rng: () => number,
  minPad: number,
  spread: number,
  place: (x: number, z: number, i: number, dist: number) => void,
) {
  const c = b.bounds.getCenter(new THREE.Vector3())
  const size = b.bounds.getSize(new THREE.Vector3())
  let placed = 0
  let guard = 0
  while (placed < n && guard++ < n * 60) {
    const x = c.x + (rng() - 0.5) * (size.x + spread * 2)
    const z = c.z + (rng() - 0.5) * (size.z + spread * 2)
    const d = distToPath2D(b.path, x, z)
    if (d < minPad) continue
    place(x, z, placed++, d)
  }
}
