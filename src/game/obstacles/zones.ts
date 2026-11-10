import * as THREE from 'three'
import type { Chute } from '../tracks/TrackBuilder'
import { toLocal, type Obstacle, type ObstacleContext } from './types'

function chevronTexture(color: string) {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 128
  const g = c.getContext('2d')!
  g.fillStyle = '#000'
  g.fillRect(0, 0, 128, 128)
  g.strokeStyle = color
  g.lineWidth = 16
  g.lineJoin = 'round'
  g.shadowColor = color
  g.shadowBlur = 12
  g.beginPath()
  g.moveTo(20, 40)
  g.lineTo(64, 88)
  g.lineTo(108, 40)
  g.stroke()
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function floorDecal(ctx: ObstacleContext, c: Chute, u0: number, u1: number, mat: THREE.Material, widthFrac = 0.92) {
  const len = (u1 - u0) * c.length
  const m = new THREE.Mesh(new THREE.PlaneGeometry(c.width * widthFrac, len), mat)
  m.position.copy(c.at((u0 + u1) / 2, 0, 0.012))
  m.quaternion.copy(c.quat).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2))
  m.receiveShadow = true
  ctx.scene.add(m)
  return m
}

/** Speed booster: accelerates marbles along the chute while they roll over it. */
export function boostPad(ctx: ObstacleContext, c: Chute, o: { u0: number; u1: number; accel?: number; color?: string }): Obstacle {
  const accel = o.accel ?? 22
  const tex = chevronTexture(o.color ?? '#3cf2ff')
  tex.repeat.set(1, ((o.u1 - o.u0) * c.length) / 1.2)
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
  floorDecal(ctx, c, o.u0, o.u1, mat, 0.8)
  return {
    kind: 'boost',
    postStep(t, dt, marbles) {
      for (const m of marbles) {
        const l = toLocal(c, m.pos)
        if (l.u < o.u0 || l.u > o.u1 || Math.abs(l.v) > 1 || l.h > 0.8) continue
        const mass = m.body.mass()
        m.body.applyImpulse({ x: c.fwd.x * accel * mass * dt, y: c.fwd.y * accel * mass * dt, z: c.fwd.z * accel * mass * dt }, true)
        if ((m.cooldown.boost ?? -1) < t) {
          m.cooldown.boost = t + 0.6
          ctx.emit({ type: 'boost', pos: m.pos })
        }
      }
    },
    frame(t) {
      tex.offset.y = -t * 1.6
    },
  }
}

/**
 * Launch pad at the lip of a kicker ramp: guarantees a minimum launch speed so
 * every marble can clear the gap, while the jump itself is pure physics.
 */
export function launchPad(ctx: ObstacleContext, c: Chute, o: { u0: number; u1: number; speed: number; color?: string }): Obstacle {
  const mat = new THREE.MeshBasicMaterial({ color: o.color ?? '#ffb02e', transparent: true, opacity: 0.85, toneMapped: false })
  const decal = floorDecal(ctx, c, o.u0, o.u1, mat, 0.9)
  const v = new THREE.Vector3()
  let glow = 0
  return {
    kind: 'launch',
    postStep(t, _dt, marbles) {
      for (const m of marbles) {
        const l = toLocal(c, m.pos)
        if (l.u < o.u0 || l.u > o.u1 || Math.abs(l.v) > 1.05 || l.h > 0.9) continue
        const lv = m.body.linvel()
        v.set(lv.x, lv.y, lv.z)
        const along = v.dot(c.fwd)
        // clamp launch speed into a window so every jump lands on the catch chute
        const target = Math.min(Math.max(along, o.speed), o.speed + 1.2)
        if (target !== along) {
          v.addScaledVector(c.fwd, target - along)
          m.body.setLinvel(v, true)
        }
        if ((m.cooldown.launch ?? -1) < t) {
          m.cooldown.launch = t + 1
          glow = 1
          ctx.emit({ type: 'launch', pos: m.pos })
        }
      }
    },
    frame(t, dt) {
      glow = Math.max(0, glow - dt * 3)
      mat.opacity = 0.55 + 0.3 * Math.sin(t * 6) * 0.5 + glow * 0.4
      decal.scale.x = 1 + glow * 0.06
    },
  }
}

/**
 * Magnetic field: pulls (or, when its polarity flips, pushes) marbles toward a
 * point on the chute. Polarity alternates every `period` seconds.
 */
export function magnetZone(
  ctx: ObstacleContext,
  c: Chute,
  o: { u: number; v: number; radius: number; strength: number; period?: number },
): Obstacle {
  const center = c.at(o.u, o.v, 0.15)
  const ringMat = new THREE.MeshBasicMaterial({ color: '#b04bff', transparent: true, opacity: 0.8, toneMapped: false, side: THREE.DoubleSide })
  const rings: THREE.Mesh[] = []
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.16, 40), ringMat)
    ring.position.copy(c.at(o.u, o.v, 0.02 + i * 0.002))
    ring.quaternion.copy(c.quat).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2))
    ctx.scene.add(ring)
    rings.push(ring)
  }
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 20), new THREE.MeshBasicMaterial({ color: '#e9b8ff', toneMapped: false }))
  core.position.copy(c.at(o.u, o.v, 0.04))
  core.quaternion.copy(c.quat)
  ctx.scene.add(core)
  const d = new THREE.Vector3()
  const period = o.period ?? 2.4
  let sign = 1
  return {
    kind: 'magnet',
    postStep(t, dt, marbles) {
      sign = Math.floor(t / period) % 2 === 0 ? 1 : -1
      for (const m of marbles) {
        d.subVectors(center, m.pos)
        d.addScaledVector(c.up, -d.dot(c.up))
        const dist = d.length()
        if (dist > o.radius || dist < 0.05) continue
        const falloff = 1 - dist / o.radius
        d.multiplyScalar((sign * o.strength * falloff * m.body.mass() * dt) / dist)
        m.body.applyImpulse(d, true)
      }
    },
    frame(t) {
      const attract = Math.floor(t / period) % 2 === 0
      ringMat.color.set(attract ? '#b04bff' : '#ff3d7f')
      rings.forEach((r, i) => {
        const ph = ((t * 0.8 + i / 3) % 1)
        const s = attract ? (1 - ph) : ph
        r.scale.setScalar(1 + s * o.radius * 6)
        ;(r.material as THREE.MeshBasicMaterial).opacity = 0.8
      })
      ringMat.opacity = 0.75
    },
  }
}

/**
 * Energy gate: a pulsing force field across the chute. While charged it
 * strongly brakes anything passing through, bunching the pack together.
 */
export function energyGate(ctx: ObstacleContext, c: Chute, o: { u: number; period: number; onFraction?: number; phase?: number; color?: string }): Obstacle {
  const on = o.onFraction ?? 0.45
  const depth = 0.5
  const mat = new THREE.MeshBasicMaterial({ color: o.color ?? '#ff2bd6', transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })
  const field = new THREE.Mesh(new THREE.PlaneGeometry(c.width, 0.9), mat)
  field.position.copy(c.at(o.u, 0, 0.45))
  field.quaternion.copy(c.quat)
  ctx.scene.add(field)
  const postMat = new THREE.MeshStandardMaterial({ color: '#222', emissive: o.color ?? '#ff2bd6', emissiveIntensity: 1.5 })
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.3, 0.2), postMat)
    post.position.copy(c.at(o.u, s * 1.06, 0.65))
    post.quaternion.copy(c.quat)
    ctx.scene.add(post)
  }
  const active = (t: number) => ((t / o.period + (o.phase ?? 0)) % 1 + 1) % 1 < on
  const v = new THREE.Vector3()
  const du = depth / c.length
  return {
    kind: 'energy-gate',
    postStep(t, _dt, marbles) {
      if (!active(t)) return
      for (const m of marbles) {
        const l = toLocal(c, m.pos)
        if (Math.abs(l.u - o.u) > du || Math.abs(l.v) > 1.05 || l.h > 1) continue
        const lv = m.body.linvel()
        v.set(lv.x, lv.y, lv.z)
        const along = v.dot(c.fwd)
        // bleed most forward speed, keep a crawl so nothing stops dead
        if (along > 0.6) m.body.setLinvel(v.addScaledVector(c.fwd, -(along - 0.6) * 0.22), true)
      }
    },
    frame(t) {
      const a = active(t)
      mat.opacity = a ? 0.35 + 0.2 * Math.sin(t * 40) : 0.04
      postMat.emissiveIntensity = a ? 1.1 : 0.25
    },
  }
}
