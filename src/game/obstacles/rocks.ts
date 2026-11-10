import * as THREE from 'three'
import type { Chute } from '../tracks/TrackBuilder'
import type { Obstacle, ObstacleContext } from './types'

/**
 * Falling rocks: dynamic boulders drop onto a chute section at intervals and
 * tumble down it, colliding with marbles. Bodies are pooled and recycled.
 */
export function fallingRocks(
  ctx: ObstacleContext,
  c: Chute,
  o: { u0: number; u1: number; count?: number; interval?: number; life?: number; mat: THREE.Material },
): Obstacle {
  const count = o.count ?? 3
  const interval = o.interval ?? 1.6
  const life = o.life ?? 3.2
  const radius = 0.34
  const geo = new THREE.DodecahedronGeometry(radius, 0)
  const HIDDEN = new THREE.Vector3(0, -500, 0)
  let seed = 99
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647

  const pool = Array.from({ length: count }, (_, i) => {
    const mesh = new THREE.Mesh(geo, o.mat)
    mesh.castShadow = true
    mesh.position.copy(HIDDEN)
    ctx.scene.add(mesh)
    const hidden = HIDDEN.clone().setX(i * 6)
    let body = null
    if (ctx.rapier && ctx.world) {
      body = ctx.world.createRigidBody(
        ctx.rapier.RigidBodyDesc.dynamic().setTranslation(hidden.x, hidden.y, hidden.z).setGravityScale(0).setCcdEnabled(true).setLinearDamping(0.2),
      )
      ctx.world.createCollider(ctx.rapier.ColliderDesc.ball(radius).setDensity(4).setRestitution(0.2).setFriction(0.8), body)
      body.sleep()
      ctx.track({ body, object: mesh })
    }
    return { mesh, body, hidden, born: -Infinity, active: false }
  })

  let next = 0.5
  let cursor = 0
  return {
    kind: 'rocks',
    preStep(t) {
      for (const r of pool) {
        if (r.active && t - r.born > life && r.body) {
          r.active = false
          r.body.setGravityScale(0, false)
          r.body.setTranslation(r.hidden, false)
          r.body.setLinvel({ x: 0, y: 0, z: 0 }, false)
          r.body.sleep()
        }
      }
      if (t < next) return
      next = t + interval * (0.7 + rnd() * 0.6)
      const r = pool[cursor++ % pool.length]
      if (!r.body || r.active) return
      const u = o.u0 + (o.u1 - o.u0) * rnd()
      const p = c.at(u, (rnd() - 0.5) * 1.4, 3.2)
      r.body.setTranslation(p, true)
      r.body.setLinvel({ x: c.side.x * (rnd() - 0.5) * 2, y: -2, z: c.side.z * (rnd() - 0.5) * 2 }, true)
      r.body.setAngvel({ x: rnd() * 4, y: rnd() * 4, z: rnd() * 4 }, true)
      r.body.setGravityScale(1, true)
      r.born = t
      r.active = true
      ctx.emit({ type: 'rock', pos: p })
    },
  }
}
