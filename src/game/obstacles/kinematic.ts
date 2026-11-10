import * as THREE from 'three'
import type { Chute } from '../tracks/TrackBuilder'
import type { Obstacle, ObstacleContext } from './types'

const Y = new THREE.Vector3(0, 1, 0)

function kinematicBody(ctx: ObstacleContext, pos: THREE.Vector3, quat: THREE.Quaternion) {
  if (!ctx.rapier || !ctx.world) return null
  return ctx.world.createRigidBody(
    ctx.rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(pos.x, pos.y, pos.z).setRotation(quat),
  )
}

/**
 * Rotating sweeper / rotating bridge: arms spinning around the chute normal.
 * Physically driven (kinematic) so marbles are batted around by real contacts.
 */
export function spinner(
  ctx: ObstacleContext,
  c: Chute,
  o: { u: number; v?: number; arms?: number; armLength?: number; speed: number; phase?: number; mat: THREE.Material; hubMat?: THREE.Material },
): Obstacle {
  const arms = o.arms ?? 2
  const L = o.armLength ?? c.width * 0.42
  const pos = c.at(o.u, o.v ?? 0, 0.24)
  const group = new THREE.Group()
  group.position.copy(pos)
  group.quaternion.copy(c.quat)
  const armGeo = new THREE.BoxGeometry(L * 2, 0.32, 0.16)
  for (let i = 0; i < arms; i++) {
    const m = new THREE.Mesh(armGeo, o.mat)
    m.rotation.y = (i * Math.PI) / arms
    m.castShadow = true
    group.add(m)
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.7, 16), o.hubMat ?? o.mat)
  hub.position.y = 0.12
  hub.castShadow = true
  group.add(hub)
  ctx.scene.add(group)

  const body = kinematicBody(ctx, pos, c.quat)
  if (body && ctx.rapier && ctx.world) {
    for (let i = 0; i < arms; i++) {
      const q = new THREE.Quaternion().setFromAxisAngle(Y, (i * Math.PI) / arms)
      ctx.world.createCollider(ctx.rapier.ColliderDesc.cuboid(L, 0.16, 0.08).setRotation(q).setRestitution(0.5).setFriction(0.2), body)
    }
    ctx.world.createCollider(ctx.rapier.ColliderDesc.cylinder(0.35, 0.2).setTranslation(0, 0.12, 0), body)
    ctx.track({ body, object: group })
  }
  const spin = new THREE.Quaternion()
  const q = new THREE.Quaternion()
  return {
    kind: 'spinner',
    preStep(t) {
      spin.setFromAxisAngle(Y, (o.phase ?? 0) + t * o.speed)
      q.copy(c.quat).multiply(spin)
      if (body) body.setNextKinematicRotation(q)
      else group.quaternion.copy(q)
    },
  }
}

/** Moving platform / sliding block that sweeps across the chute. */
export function pusher(
  ctx: ObstacleContext,
  c: Chute,
  o: { u: number; period: number; phase?: number; size?: [number, number, number]; travel?: number; mat: THREE.Material },
): Obstacle {
  const [sx, sy, sz] = o.size ?? [1.2, 0.5, 0.7]
  // keeps >0.6 clearance to the wall at full travel so marbles are never crushed
  const travel = o.travel ?? 0.28
  const base = c.at(o.u, 0, sy / 2 + 0.01)
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), o.mat)
  mesh.position.copy(base)
  mesh.quaternion.copy(c.quat)
  mesh.castShadow = true
  mesh.receiveShadow = true
  ctx.scene.add(mesh)
  const body = kinematicBody(ctx, base, c.quat)
  if (body && ctx.rapier && ctx.world) {
    ctx.world.createCollider(ctx.rapier.ColliderDesc.roundCuboid(sx / 2 - 0.08, sy / 2 - 0.08, sz / 2 - 0.08, 0.08).setRestitution(0.35), body)
    ctx.track({ body, object: mesh })
  }
  const p = new THREE.Vector3()
  return {
    kind: 'pusher',
    preStep(t) {
      const v = Math.sin((t / o.period) * Math.PI * 2 + (o.phase ?? 0)) * travel
      p.copy(base).addScaledVector(c.side, (v * c.width) / 2)
      if (body) body.setNextKinematicTranslation(p)
      else mesh.position.copy(p)
    },
  }
}
