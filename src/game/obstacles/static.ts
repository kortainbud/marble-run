import * as THREE from 'three'
import type { Chute } from '../tracks/TrackBuilder'
import type { Obstacle, ObstacleContext } from './types'
import { MARBLE } from '../physics/constants'

/**
 * Staggered field of pegs (rocks / pins) — splits the pack unpredictably.
 * Rows alternate between lateral offset patterns A and B (world units from the
 * centreline). Defaults keep every gap wider than a marble so nothing jams.
 */
export function pegField(
  ctx: ObstacleContext,
  c: Chute,
  o: {
    u0: number; u1: number; rows: number
    a?: number[]; b?: number[]
    radius?: number; height?: number
    mat: THREE.Material; geo?: THREE.BufferGeometry; jitter?: number
  },
): Obstacle {
  const r = o.radius ?? 0.16
  const hgt = o.height ?? 0.7
  const A = o.a ?? [-0.8, 0.8]
  const B = o.b ?? [0]
  const geo = o.geo ?? new THREE.CylinderGeometry(r, r, hgt, 14)
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5)
  const half = c.width / 2
  for (let row = 0; row < o.rows; row++) {
    const u = o.u0 + ((o.u1 - o.u0) * row) / Math.max(1, o.rows - 1)
    for (const off of row % 2 ? B : A) {
      const j = o.jitter ?? 0
      const p = c.at(u + (rnd() * j * 0.3) / c.length, (off + rnd() * j * 0.15) / half, hgt / 2)
      const m = new THREE.Mesh(geo, o.mat)
      m.position.copy(p)
      m.quaternion.copy(c.quat)
      m.rotateY(rnd() * 6)
      m.castShadow = true
      m.receiveShadow = true
      ctx.scene.add(m)
      if (ctx.rapier) {
        ctx.builder.staticCollider(
          ctx.rapier.ColliderDesc.cylinder(hgt / 2, r).setTranslation(p.x, p.y, p.z).setRotation(c.quat).setRestitution(0.45).setFriction(0.3),
        )
      }
    }
  }
  return { kind: 'pegs' }
}

/** Narrow passages: divider walls with rounded noses split the chute into lanes. */
export function dividers(ctx: ObstacleContext, c: Chute, o: { u0: number; u1: number; lanes: number; mat: THREE.Material; height?: number }): Obstacle {
  const h = o.height ?? 0.6
  const t = 0.14
  const len = (o.u1 - o.u0) * c.length
  for (let i = 1; i < o.lanes; i++) {
    const v = -1 + (2 * i) / o.lanes
    const center = c.at((o.u0 + o.u1) / 2, v, h / 2)
    ctx.builder.box(center, new THREE.Vector3(t / 2, h / 2, len / 2), c.quat, o.mat, { restitution: 0.3 })
    // rounded nose so marbles glance off instead of stalling
    const nose = c.at(o.u0, v, h / 2)
    const m = new THREE.Mesh(new THREE.CylinderGeometry(t * 0.9, t * 0.9, h, 12), o.mat)
    m.position.copy(nose)
    m.quaternion.copy(c.quat)
    m.castShadow = true
    ctx.scene.add(m)
    if (ctx.rapier) ctx.builder.staticCollider(ctx.rapier.ColliderDesc.cylinder(h / 2, t * 0.9).setTranslation(nose.x, nose.y, nose.z).setRotation(c.quat).setRestitution(0.5))
  }
  return { kind: 'dividers' }
}

/** Pinball bumpers: solid posts that actively kick marbles away on contact. */
export function bumpers(
  ctx: ObstacleContext,
  c: Chute,
  o: { spots: { u: number; v: number }[]; radius?: number; kick?: number; mat: THREE.MeshStandardMaterial; ringMat?: THREE.Material },
): Obstacle {
  const r = o.radius ?? 0.38
  const kick = o.kick ?? 4.5
  const h = 0.55
  const items = o.spots.map(({ u, v }) => {
    const p = c.at(u, v, h / 2)
    const mat = o.mat.clone()
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.08, h, 24), mat)
    m.position.copy(p)
    m.quaternion.copy(c.quat)
    m.castShadow = true
    ctx.scene.add(m)
    if (o.ringMat) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 1.02, 0.05, 8, 32), o.ringMat)
      ring.position.copy(c.at(u, v, h))
      ring.quaternion.copy(c.quat).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2))
      ctx.scene.add(ring)
    }
    if (ctx.rapier) ctx.builder.staticCollider(ctx.rapier.ColliderDesc.cylinder(h / 2, r).setTranslation(p.x, p.y, p.z).setRotation(c.quat).setRestitution(0.9))
    return { p, mat, flash: 0, base: mat.emissiveIntensity }
  })
  const reach = r + MARBLE.radius + 0.06
  const d = new THREE.Vector3()
  return {
    kind: 'bumpers',
    postStep(t, _dt, marbles) {
      for (const b of items) {
        for (const mb of marbles) {
          d.subVectors(mb.pos, b.p)
          d.addScaledVector(c.up, -d.dot(c.up))
          const dist = d.length()
          if (dist > reach || dist < 1e-4) continue
          const key = 'bump'
          if ((mb.cooldown[key] ?? -1) > t) continue
          mb.cooldown[key] = t + 0.25
          d.normalize()
          const m = mb.body.mass()
          mb.body.applyImpulse({ x: d.x * kick * m, y: 0.6 * m, z: d.z * kick * m }, true)
          b.flash = 1
          ctx.emit({ type: 'bump', pos: b.p })
        }
      }
    },
    frame(_t, dt) {
      for (const b of items) {
        b.flash = Math.max(0, b.flash - dt * 4)
        b.mat.emissiveIntensity = b.base + b.flash * 3
      }
    },
  }
}
