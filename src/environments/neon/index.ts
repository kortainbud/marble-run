import * as THREE from 'three'
import type { BuildArgs, BuiltEnvironment, EnvironmentDef } from '../types'
import { TrackBuilder } from '../../game/tracks/TrackBuilder'
import { finishArch, scatterAround } from '../../game/tracks/props'
import { gridTexture, makeTexture, metalPlate, skyGradient } from '../../game/rendering/textures'
import { addSun } from '../../game/rendering/lighting'
import type { Obstacle, ObstacleContext } from '../../game/obstacles/types'
import { bumpers, pegField } from '../../game/obstacles/static'
import { pusher, spinner } from '../../game/obstacles/kinematic'
import { boostPad, energyGate, launchPad, magnetZone } from '../../game/obstacles/zones'
import { createRng } from '../../utils/random'

function windowTexture() {
  return makeTexture('neon-windows', 128, (g, s) => {
    g.fillStyle = '#05050b'
    g.fillRect(0, 0, s, s)
    const rng = createRng(4)
    for (let y = 4; y < s; y += 10)
      for (let x = 4; x < s; x += 8) {
        if (rng.next() < 0.55) continue
        g.fillStyle = rng.pick(['#3cf2ff', '#ff2bd6', '#8b5cff', '#ffffff'])
        g.globalAlpha = rng.range(0.3, 1)
        g.fillRect(x, y, 4, 5)
      }
    g.globalAlpha = 1
  })
}

function build({ scene, rapier, world, emit, track }: BuildArgs): BuiltEnvironment {
  scene.background = skyGradient([[0, '#020210'], [0.42, '#120a33'], [0.5, '#3b0f5c'], [0.56, '#12082a'], [1, '#02020a']])
  scene.fog = new THREE.Fog('#150a33', 40, 150)
  scene.add(new THREE.HemisphereLight('#6a5cff', '#0a0418', 0.9))

  const floorTex = metalPlate('#1b1d2b', '#2c3048', '#3cf2ff')
  const floor = new THREE.MeshStandardMaterial({ map: floorTex, metalness: 0.75, roughness: 0.32, emissiveMap: floorTex, emissive: '#ffffff', emissiveIntensity: 0.12 })
  const wall = new THREE.MeshStandardMaterial({ color: '#2a2f48', metalness: 0.6, roughness: 0.3, transparent: true, opacity: 0.85 })
  const landing = new THREE.MeshStandardMaterial({ map: metalPlate('#23203a', '#3a2f63', '#ff2bd6'), metalness: 0.7, roughness: 0.3 })
  const trim = new THREE.MeshBasicMaterial({ color: '#1fb8c4', toneMapped: false })
  const pillar = new THREE.MeshStandardMaterial({ color: '#141626', metalness: 0.8, roughness: 0.35, emissive: '#3b1d7a', emissiveIntensity: 0.4 })
  const block = new THREE.MeshStandardMaterial({ color: '#16182a', metalness: 0.6, roughness: 0.25, emissive: '#ff2bd6', emissiveIntensity: 0.6 })
  const pinMat = new THREE.MeshStandardMaterial({ color: '#0d0f1c', emissive: '#3cf2ff', emissiveIntensity: 1.2 })

  const b = new TrackBuilder(
    { floor, wall, landing, pillar, trim, friction: 0.35, restitution: 0.35, wallRestitution: 0.45, uvScale: 3.4, groundY: 0, pillars: true },
    rapier,
    world,
  )
  scene.add(b.group)
  const ctx: ObstacleContext = { builder: b, rapier, world, scene: b.group, emit, track }
  const obs: Obstacle[] = []

  // ---- layout: Neon Circuit
  b.begin(new THREE.Vector3(0, 29, 0), new THREE.Vector3(0, 0, 1))
  b.pen()
  const s1 = b.straight(14, 3.0)
  obs.push(boostPad(ctx, s1, { u0: 0.12, u1: 0.32 }))
  obs.push(pegField(ctx, s1, { u0: 0.5, u1: 0.85, rows: 5, radius: 0.13, height: 0.5, a: [-0.85, 0.85], b: [-1.55, 0, 1.55], mat: pinMat }))
  b.turn('left')
  const s2 = b.straight(13, 2.4)
  obs.push(energyGate(ctx, s2, { u: 0.3, period: 1.8 }))
  obs.push(energyGate(ctx, s2, { u: 0.72, period: 1.8, phase: 0.5, color: '#3cf2ff' }))
  b.turn('left')
  const s3 = b.straight(14, 2.7)
  obs.push(bumpers(ctx, s3, {
    // staggered so every gap stays wider than a marble
    spots: [{ u: 0.18, v: 0 }, { u: 0.33, v: 0.38 }, { u: 0.48, v: -0.38 }, { u: 0.63, v: 0.38 }, { u: 0.78, v: -0.38 }],
    radius: 0.32,
    mat: new THREE.MeshStandardMaterial({ color: '#1a1030', emissive: '#ff2bd6', emissiveIntensity: 0.7, metalness: 0.5, roughness: 0.3 }),
    ringMat: new THREE.MeshBasicMaterial({ color: '#ff9cf0', toneMapped: false }),
    kick: 4.2,
  }))
  b.turn('right')
  const runup = b.straight(6, 1.4)
  obs.push(boostPad(ctx, runup, { u0: 0.2, u1: 0.7, color: '#ffe23c' }))
  const kicker = b.straight(2.4, -0.7)
  obs.push(launchPad(ctx, kicker, { u0: 0.4, u1: 1, speed: 9.2, color: '#3cf2ff' }))
  b.gap(3.6, 1.8)
  b.straight(10, 1.6)
  b.turn('right')
  const s6 = b.straight(12, 2.4)
  obs.push(spinner(ctx, s6, { u: 0.3, speed: -2.1, arms: 3, armLength: 1.35, mat: block }))
  obs.push(pusher(ctx, s6, { u: 0.72, period: 1.9, mat: block }))
  b.turn('left')
  const s7 = b.straight(14, 3.0)
  obs.push(magnetZone(ctx, s7, { u: 0.28, v: 0.45, radius: 1.5, strength: 14 }))
  obs.push(magnetZone(ctx, s7, { u: 0.55, v: -0.45, radius: 1.5, strength: 14, period: 1.9 }))
  obs.push(boostPad(ctx, s7, { u0: 0.75, u1: 0.95 }))
  b.finish(9)
  finishArch(b, pillar, '#0b0b16')

  // ---- dressing
  const gridTex = gridTexture('#7b3cff', '#05040d')
  gridTex.repeat.set(120, 120)
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(600, 600),
    new THREE.MeshStandardMaterial({ map: gridTex, emissiveMap: gridTex, emissive: '#ffffff', emissiveIntensity: 0.35, metalness: 0.4, roughness: 0.7 }),
  )
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  scene.add(ground)

  const rng = createRng(77)
  const win = windowTexture()
  const towers: THREE.Mesh[] = []
  scatterAround(b, 34, rng.next, 14, 60, (x, z, _i, d) => {
    const w = Math.min(rng.range(3, 8), d - 9)
    if (w < 2) return
    const h = rng.range(10, 55)
    const t = win.clone()
    t.needsUpdate = true
    t.repeat.set(Math.max(1, Math.round(w / 6)), Math.max(1, Math.round(h / 9)))
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, w),
      new THREE.MeshStandardMaterial({ color: '#0b0c16', map: t, emissiveMap: t, emissive: '#ffffff', emissiveIntensity: 0.8, metalness: 0.5, roughness: 0.4 }),
    )
    m.position.set(x, h / 2, z)
    scene.add(m)
    towers.push(m)
    const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 0.25, w + 0.2), new THREE.MeshBasicMaterial({ color: rng.pick(['#3cf2ff', '#ff2bd6', '#8b5cff']), toneMapped: false }))
    cap.position.set(x, h, z)
    scene.add(cap)
  })

  const rings: THREE.Mesh[] = []
  const ringGeo = new THREE.TorusGeometry(3, 0.08, 8, 64)
  scatterAround(b, 10, rng.next, 8, 20, (x, z) => {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: rng.pick(['#3cf2ff', '#ff2bd6', '#ffe23c']), toneMapped: false }))
    m.position.set(x, rng.range(14, 34), z)
    m.rotation.set(rng.next() * 3, rng.next() * 3, 0)
    scene.add(m)
    rings.push(m)
  })

  const starGeo = new THREE.BufferGeometry()
  const starPos = new Float32Array(1500 * 3)
  for (let i = 0; i < 1500; i++) {
    const th = rng.next() * Math.PI * 2
    const ph = rng.range(0.05, 1.4)
    const r = 260
    starPos.set([Math.cos(th) * Math.cos(ph) * r, Math.sin(ph) * r, Math.sin(th) * Math.cos(ph) * r], i * 3)
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#ffffff', size: 1.4, sizeAttenuation: false, fog: false }))
  stars.position.copy(b.bounds.getCenter(new THREE.Vector3()))
  scene.add(stars)

  addSun(scene, b.bounds, new THREE.Vector3(0.5, 1, -0.3), '#b9a8ff', 1.6)
  const fill = new THREE.PointLight('#ff2bd6', 60, 40, 1.6)
  fill.position.copy(b.bounds.getCenter(new THREE.Vector3())).add(new THREE.Vector3(0, 6, 0))
  scene.add(fill)

  return {
    builder: b,
    obstacles: obs,
    bloom: { strength: 0.6, radius: 0.4, threshold: 0.72 },
    exposure: 1.0,
    confetti: ['#3cf2ff', '#ff2bd6', '#ffe23c', '#8b5cff', '#ffffff'],
    frame(t) {
      rings.forEach((r, i) => {
        r.rotation.y = t * (0.2 + i * 0.03)
        r.rotation.x += 0.002
      })
      trim.color.setHSL(0.52 + Math.sin(t * 0.6) * 0.04, 1, 0.42)
    },
  }
}

export const neon: EnvironmentDef = {
  id: 'neon',
  name: 'Neon Circuit',
  tagline: 'Boosters, force fields & a cyber jump',
  description: 'A glowing sci-fi circuit with speed boosters, pin fields, pulsing energy gates, a pinball bumper grid, a launch pad jump, a tri-blade spinner and magnetic fields.',
  playable: true,
  obstacles: ['Speed boosters', 'Pin field', 'Energy gates', 'Pinball bumpers', 'Launch pad', 'Tri-blade spinner', 'Moving platform', 'Magnetic fields'],
  ui: { from: '#7b3cff', to: '#140a3a', accent: '#3cf2ff' },
  build,
}
