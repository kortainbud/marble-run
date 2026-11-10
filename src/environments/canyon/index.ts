import * as THREE from 'three'
import type { BuildArgs, BuiltEnvironment, EnvironmentDef } from '../types'
import { TrackBuilder } from '../../game/tracks/TrackBuilder'
import { finishArch, scatterAround } from '../../game/tracks/props'
import { sand, skyGradient, strata, woodPlanks } from '../../game/rendering/textures'
import { addSun } from '../../game/rendering/lighting'
import type { Obstacle, ObstacleContext } from '../../game/obstacles/types'
import { bumpers, dividers, pegField } from '../../game/obstacles/static'
import { pusher, spinner } from '../../game/obstacles/kinematic'
import { launchPad } from '../../game/obstacles/zones'
import { fallingRocks } from '../../game/obstacles/rocks'
import { createRng } from '../../utils/random'

function build({ scene, rapier, world, emit, track }: BuildArgs): BuiltEnvironment {
  // ---- atmosphere
  scene.background = skyGradient([[0, '#3d7fc4'], [0.38, '#8fc1e6'], [0.5, '#f7d2a0'], [1, '#c7744a']])
  scene.fog = new THREE.Fog('#f0c497', 55, 170)
  scene.add(new THREE.HemisphereLight('#ffe2b8', '#9b4a26', 1.1))

  // ---- materials
  const rockTex = strata(['#c8693a', '#d98450', '#b3552d', '#e6a06a', '#a84a26'], 4)
  const wallTex = strata(['#9c4a26', '#b65c33', '#8a3f20', '#c06a3c'], 8)
  const plank = woodPlanks('#a8733f', '#3f2512')
  const floor = new THREE.MeshStandardMaterial({ map: rockTex, roughness: 0.92 })
  const wall = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.95 })
  const landing = new THREE.MeshStandardMaterial({ map: plank, roughness: 0.8 })
  const wood = new THREE.MeshStandardMaterial({ map: plank, roughness: 0.75, color: '#d9a46b' })
  const boulder = new THREE.MeshStandardMaterial({ color: '#9b5634', roughness: 1, flatShading: true })
  const pillar = new THREE.MeshStandardMaterial({ color: '#6b4024', roughness: 0.9, map: plank })

  const b = new TrackBuilder(
    { floor, wall, landing, pillar, friction: 0.55, restitution: 0.25, wallRestitution: 0.3, uvScale: 2, groundY: 0, pillars: true },
    rapier,
    world,
  )
  scene.add(b.group)
  const ctx: ObstacleContext = { builder: b, rapier, world, scene: b.group, emit, track }
  const obs: Obstacle[] = []

  // ---- layout: Canyon Run
  b.begin(new THREE.Vector3(0, 27, 0), new THREE.Vector3(0, 0, 1))
  b.pen()
  const drop1 = b.straight(13, 3.3)
  obs.push(pegField(ctx, drop1, { u0: 0.32, u1: 0.82, rows: 6, radius: 0.24, height: 0.6, a: [-0.75, 0.75], b: [0], mat: boulder, geo: new THREE.DodecahedronGeometry(0.3, 0), jitter: 1 }))
  b.turn('right')
  const narrows = b.straight(12, 2.4)
  obs.push(dividers(ctx, narrows, { u0: 0.22, u1: 0.72, lanes: 3, mat: wall }))
  b.turn('right')
  const bridge = b.straight(14, 2.8, { mat: wood })
  obs.push(fallingRocks(ctx, bridge, { u0: 0.12, u1: 0.42, count: 4, interval: 1.4, mat: boulder }))
  obs.push(spinner(ctx, bridge, { u: 0.74, speed: 1.7, arms: 2, mat: wood, hubMat: boulder }))
  b.turn('left')
  b.straight(7, 1.6)
  const kicker = b.straight(2.2, -0.55, { mat: wood })
  obs.push(launchPad(ctx, kicker, { u0: 0.45, u1: 1, speed: 8.6, color: '#ffb02e' }))
  b.gap(3.2, 1.6)
  b.straight(10, 1.8)
  b.turn('left')
  const slider = b.straight(12, 2.6)
  obs.push(pusher(ctx, slider, { u: 0.33, period: 2.3, mat: boulder }))
  obs.push(pusher(ctx, slider, { u: 0.68, period: 2.3, phase: Math.PI, mat: boulder }))
  b.turn('right')
  const final = b.straight(16, 3.4)
  obs.push(bumpers(ctx, final, {
    spots: [{ u: 0.3, v: 0.3 }, { u: 0.52, v: -0.3 }, { u: 0.74, v: 0.3 }],
    mat: new THREE.MeshStandardMaterial({ color: '#e0b25a', emissive: '#ff7a1a', emissiveIntensity: 0.15, roughness: 0.4, metalness: 0.3 }),
    kick: 3.5,
  }))
  b.finish(9)
  finishArch(b, wood, '#2a160b')

  // ---- world dressing
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), new THREE.MeshStandardMaterial({ map: sand('#d79a63'), roughness: 1 }))
  ;(ground.material as THREE.MeshStandardMaterial).map!.repeat.set(60, 60)
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  scene.add(ground)

  const rng = createRng(21)
  const mesaMat = new THREE.MeshStandardMaterial({ map: rockTex, roughness: 1, flatShading: true })
  // keep mesas well clear of the track so they never block the race camera
  scatterAround(b, 22, rng.next, 18, 50, (x, z, _i, d) => {
    const r = Math.min(rng.range(4, 12), d - 11)
    if (r < 2.5) return
    const h = rng.range(8, 34)
    const g = new THREE.CylinderGeometry(r * rng.range(0.7, 0.95), r, h, 12, 6)
    const pos = g.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i)
      const pz = pos.getZ(i)
      const k = 1 + (Math.sin(px * 1.7 + pos.getY(i) * 0.6) + Math.cos(pz * 1.3)) * 0.07
      pos.setX(i, px * k)
      pos.setZ(i, pz * k)
    }
    g.computeVertexNormals()
    const m = new THREE.Mesh(g, mesaMat)
    m.position.set(x, h / 2 - 0.5, z)
    m.castShadow = d < 30
    m.receiveShadow = true
    scene.add(m)
  })
  const smallRock = new THREE.DodecahedronGeometry(1, 0)
  scatterAround(b, 60, rng.next, 5, 30, (x, z) => {
    const m = new THREE.Mesh(smallRock, boulder)
    const s = rng.range(0.3, 1.4)
    m.scale.set(s, s * rng.range(0.6, 1), s)
    m.position.set(x, s * 0.3, z)
    m.rotation.set(rng.next() * 3, rng.next() * 3, 0)
    m.castShadow = true
    scene.add(m)
  })
  const cactusMat = new THREE.MeshStandardMaterial({ color: '#4f7a3a', roughness: 0.8 })
  scatterAround(b, 14, rng.next, 4, 25, (x, z) => {
    const g = new THREE.Group()
    const h = rng.range(1.6, 3.2)
    const trunk = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, h, 4, 8), cactusMat)
    trunk.position.y = h / 2
    g.add(trunk)
    for (const s of [-1, 1]) {
      if (rng.next() < 0.3) continue
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.8, 4, 8), cactusMat)
      arm.position.set(s * 0.45, h * rng.range(0.45, 0.7), 0)
      g.add(arm)
    }
    g.traverse((o) => (o.castShadow = true))
    g.position.set(x, 0, z)
    g.rotation.y = rng.next() * 6
    scene.add(g)
  })

  addSun(scene, b.bounds, new THREE.Vector3(-0.6, 1, 0.45), '#fff0d6', 2.6)

  return {
    builder: b,
    obstacles: obs,
    bloom: { strength: 0.18, radius: 0.35, threshold: 0.95 },
    exposure: 0.92,
    confetti: ['#ff8a1f', '#ffd21f', '#ff3b3b', '#ffffff', '#22b8ff'],
  }
}

export const canyon: EnvironmentDef = {
  id: 'canyon',
  name: 'Canyon Run',
  tagline: 'Sandstone drops & rickety bridges',
  description: 'Steep sandstone chutes, a boulder field, three-lane narrows, falling rocks, a spinning bridge, a canyon jump and sliding boulders.',
  playable: true,
  obstacles: ['Boulder field', 'Narrow passages', 'Falling rocks', 'Rotating bridge', 'Canyon jump', 'Sliding boulders', 'Bumpers'],
  ui: { from: '#ff9a4a', to: '#a2361c', accent: '#ffd38a' },
  build,
}
