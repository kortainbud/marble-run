import * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import { TRACK } from '../physics/constants'
import { frameFromForward, rightOf, worldBoxGeometry, type Frame } from './geometry'

type R = typeof RAPIER

/** Visual + physical surface set supplied by an environment. */
export interface TrackTheme {
  floor: THREE.Material
  wall: THREE.Material
  landing: THREE.Material
  pillar: THREE.Material
  trim?: THREE.Material
  friction: number
  restitution: number
  wallRestitution: number
  /** world units per texture repeat */
  uvScale: number
  groundY: number
  pillars: boolean
}

export interface PathPoint {
  p: THREE.Vector3
  /** cumulative distance from start along the centreline */
  s: number
}

/** A straight piece of track, exposed so obstacles can be placed in its local frame. */
export interface Chute extends Frame {
  start: THREE.Vector3
  end: THREE.Vector3
  length: number
  width: number
  /** world point at u (0..1 along), v (-1..1 across, +v = traveller's left), h above floor */
  at(u: number, v: number, h?: number): THREE.Vector3
}

export interface BoxOpts {
  physics?: boolean
  friction?: number
  restitution?: number
  cast?: boolean
  receive?: boolean
}

export class TrackBuilder {
  readonly group = new THREE.Group()
  readonly path: PathPoint[] = []
  readonly chutes: Chute[] = []
  readonly bounds = new THREE.Box3()
  cursor = new THREE.Vector3()
  heading = new THREE.Vector3(0, 0, 1)
  width = TRACK.width

  /** start pen info */
  penChute: Chute | null = null
  gatePose: { pos: THREE.Vector3; quat: THREE.Quaternion; half: THREE.Vector3 } | null = null
  finishS = 0
  /** centreline ranges (ramps + air gaps) where a marble must never be respawned */
  readonly noRespawn: { from: number; to: number }[] = []
  finishPose: { pos: THREE.Vector3; heading: THREE.Vector3 } | null = null

  private fixedBody: RAPIER.RigidBody | null = null

  constructor(
    readonly theme: TrackTheme,
    readonly rapier: R | null,
    readonly world: RAPIER.World | null,
  ) {
    if (world && rapier) this.fixedBody = world.createRigidBody(rapier.RigidBodyDesc.fixed())
  }

  // ---------------------------------------------------------------- primitives

  box(center: THREE.Vector3, half: THREE.Vector3, quat: THREE.Quaternion, mat: THREE.Material, o: BoxOpts = {}) {
    const mesh = new THREE.Mesh(worldBoxGeometry(half.x * 2, half.y * 2, half.z * 2, this.theme.uvScale), mat)
    mesh.position.copy(center)
    mesh.quaternion.copy(quat)
    mesh.castShadow = o.cast ?? true
    mesh.receiveShadow = o.receive ?? true
    this.group.add(mesh)
    this.expand(mesh)
    if ((o.physics ?? true) && this.rapier && this.world && this.fixedBody) {
      const desc = this.rapier.ColliderDesc.cuboid(half.x, half.y, half.z)
        .setTranslation(center.x, center.y, center.z)
        .setRotation(quat)
        .setFriction(o.friction ?? this.theme.friction)
        .setRestitution(o.restitution ?? this.theme.restitution)
      this.world.createCollider(desc, this.fixedBody)
    }
    return mesh
  }

  /** Static collider of any shape, positioned in world space. */
  staticCollider(desc: RAPIER.ColliderDesc | null) {
    if (desc && this.world && this.fixedBody) return this.world.createCollider(desc, this.fixedBody)
    return null
  }

  private expand(o: THREE.Object3D) {
    o.updateMatrixWorld()
    this.bounds.expandByObject(o)
  }

  private pushPath(p: THREE.Vector3) {
    const last = this.path[this.path.length - 1]
    if (last && last.p.distanceTo(p) < 1e-3) return
    this.path.push({ p: p.clone(), s: last ? last.s + last.p.distanceTo(p) : 0 })
  }

  private makeChute(start: THREE.Vector3, end: THREE.Vector3, width: number): Chute {
    const f = frameFromForward(end.clone().sub(start))
    const length = start.distanceTo(end)
    const chute: Chute = {
      ...f,
      start: start.clone(),
      end: end.clone(),
      length,
      width,
      at: (u, v, h = 0) =>
        start.clone()
          .addScaledVector(f.fwd, u * length)
          .addScaledVector(f.side, (v * width) / 2)
          .addScaledVector(f.up, h),
    }
    return chute
  }

  /** Floor slab + optional side walls between two floor-top centre points. */
  private slab(
    start: THREE.Vector3,
    end: THREE.Vector3,
    width: number,
    opts: { walls?: [boolean, boolean]; wallHeight?: number; mat?: THREE.Material; overlap?: number } = {},
  ) {
    const c = this.makeChute(start, end, width)
    const T = TRACK.floorThickness
    const ov = opts.overlap ?? 0.12
    const mid = start.clone().add(end).multiplyScalar(0.5)
    this.box(
      mid.clone().addScaledVector(c.up, -T / 2),
      new THREE.Vector3(width / 2, T / 2, c.length / 2 + ov),
      c.quat,
      opts.mat ?? this.theme.floor,
      { cast: false },
    )
    const [wl, wr] = opts.walls ?? [true, true]
    const H = opts.wallHeight ?? TRACK.wallHeight
    const wt = TRACK.wallThickness
    for (const [on, sgn] of [[wl, 1], [wr, -1]] as const) {
      if (!on) continue
      const center = mid.clone()
        .addScaledVector(c.side, sgn * (width / 2 + wt / 2))
        .addScaledVector(c.up, H / 2 - T)
      const half = new THREE.Vector3(wt / 2, H / 2 + T / 2, c.length / 2 + ov)
      this.box(center, half, c.quat, this.theme.wall, { restitution: this.theme.wallRestitution })
      if (this.theme.trim) {
        const tc = center.clone().addScaledVector(c.up, H / 2 + T / 2 + 0.03)
        this.box(tc, new THREE.Vector3(wt / 2 + 0.02, 0.03, c.length / 2 + ov), c.quat, this.theme.trim, { physics: false, cast: false })
      }
    }
    return c
  }

  private pillar(top: THREE.Vector3, radius = 0.22) {
    if (!this.theme.pillars) return
    const h = top.y - this.theme.groundY
    if (h < 0.5) return
    const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.25, h, 10), this.theme.pillar)
    m.position.set(top.x, this.theme.groundY + h / 2, top.z)
    m.castShadow = true
    m.receiveShadow = true
    this.group.add(m)
  }

  // ---------------------------------------------------------------- pieces

  begin(pos: THREE.Vector3, heading: THREE.Vector3) {
    this.cursor.copy(pos)
    this.heading.copy(heading).normalize()
    this.pushPath(this.cursor)
  }

  /** Starting pen with back wall and a gate at its downhill end. */
  pen(length = 3.6, drop = 0.35) {
    const start = this.cursor.clone()
    const c = this.straight(length, drop, { wallHeight: 1.1 })
    // back wall
    const T = TRACK.floorThickness
    this.box(
      start.clone().addScaledVector(c.fwd, -TRACK.wallThickness / 2).addScaledVector(c.up, 0.55 - T / 2),
      new THREE.Vector3(this.width / 2 + TRACK.wallThickness, 0.55 + T / 2, TRACK.wallThickness / 2),
      c.quat,
      this.theme.wall,
    )
    this.penChute = c
    this.gatePose = {
      pos: c.end.clone().addScaledVector(c.up, 0.5).addScaledVector(c.fwd, 0.1),
      quat: c.quat.clone(),
      half: new THREE.Vector3(this.width / 2, 0.5, 0.1),
    }
    return c
  }

  /** Straight chute. Negative `drop` makes an uphill kicker ramp. */
  straight(length: number, drop: number, opts: { walls?: [boolean, boolean]; wallHeight?: number; mat?: THREE.Material } = {}) {
    const start = this.cursor.clone()
    const end = start.clone().addScaledVector(this.heading, length)
    end.y -= drop
    const c = this.slab(start, end, this.width, opts)
    this.chutes.push(c)
    this.cursor.copy(end)
    this.pushPath(end)
    if (length > 7) this.pillar(c.at(0.5, 0, -TRACK.floorThickness))
    return c
  }

  /** 90° corner on a square landing that tilts toward the exit. */
  turn(dir: 'left' | 'right', opts: { step?: number; tilt?: number } = {}) {
    const W = this.width
    const step = opts.step ?? 0.06
    const tilt = opts.tilt ?? 0.3
    const h = this.heading.clone()
    const r = rightOf(h)
    const h2 = dir === 'right' ? r : r.clone().negate()
    const P = this.cursor.clone()
    P.y -= step
    const C = P.clone().addScaledVector(h, W / 2)
    C.y -= tilt / 2
    const entry = C.clone().addScaledVector(h2, -W / 2)
    entry.y += tilt / 2
    const exit = C.clone().addScaledVector(h2, W / 2)
    exit.y -= tilt / 2
    // floor slab crossing the square in the exit direction
    this.slab(entry, exit, W, { walls: [false, false], mat: this.theme.landing, overlap: 0.02 })

    const T = TRACK.floorThickness
    const wt = TRACK.wallThickness
    const H = TRACK.landingWallHeight
    const flat = frameFromForward(h).quat
    // far wall (blocks the incoming direction)
    this.box(
      C.clone().addScaledVector(h, W / 2 + wt / 2).add(new THREE.Vector3(0, H / 2 - T, 0)),
      new THREE.Vector3(W / 2 + wt, H / 2 + T / 2 + tilt / 2, wt / 2),
      flat,
      this.theme.wall,
      { restitution: this.theme.wallRestitution },
    )
    // outer wall (opposite the exit)
    const flat2 = frameFromForward(h2).quat
    this.box(
      C.clone().addScaledVector(h2, -(W / 2 + wt / 2)).add(new THREE.Vector3(0, H / 2 - T + tilt / 2, 0)),
      new THREE.Vector3(W / 2 + wt, H / 2 + T / 2, wt / 2),
      flat2,
      this.theme.wall,
      { restitution: this.theme.wallRestitution },
    )
    if (this.theme.trim) {
      this.box(C.clone().addScaledVector(h, W / 2 + wt / 2).add(new THREE.Vector3(0, H - T + T / 2 + 0.03, 0)),
        new THREE.Vector3(W / 2 + wt, 0.03, wt / 2 + 0.02), flat, this.theme.trim, { physics: false, cast: false })
      this.box(C.clone().addScaledVector(h2, -(W / 2 + wt / 2)).add(new THREE.Vector3(0, H - T + T / 2 + 0.03 + tilt / 2, 0)),
        new THREE.Vector3(W / 2 + wt, 0.03, wt / 2 + 0.02), flat2, this.theme.trim, { physics: false, cast: false })
    }
    this.pillar(C.clone().add(new THREE.Vector3(0, -T, 0)), 0.32)

    this.pushPath(C)
    this.cursor.copy(exit)
    this.heading.copy(h2)
    this.pushPath(exit)
  }

  /** Two corners joined by a short connector — reverses direction. */
  uturn(dir: 'left' | 'right', gap = 1.4) {
    this.turn(dir)
    this.straight(gap, 0.15)
    this.turn(dir)
  }

  /** Empty air the marbles must fly across. */
  gap(length: number, drop: number) {
    const last = this.path[this.path.length - 1].s
    const prevChute = this.chutes[this.chutes.length - 1]
    const from = last - (prevChute ? prevChute.length : 0)
    this.cursor.addScaledVector(this.heading, length)
    this.cursor.y -= drop
    this.pushPath(this.cursor)
    this.noRespawn.push({ from, to: this.path[this.path.length - 1].s + 1.5 })
  }

  /** Finish basin: finish line at its entry, gentle uphill to bleed speed. */
  finish(length = 9) {
    this.finishS = this.path[this.path.length - 1].s
    const startPt = this.cursor.clone()
    this.finishPose = { pos: startPt.clone(), heading: this.heading.clone() }
    const c = this.straight(length, -0.35, { wallHeight: 1.4, mat: this.theme.landing })
    const T = TRACK.floorThickness
    this.box(
      c.end.clone().addScaledVector(c.fwd, TRACK.wallThickness / 2).addScaledVector(c.up, 0.7 - T / 2),
      new THREE.Vector3(this.width / 2 + TRACK.wallThickness, 0.7 + T / 2, TRACK.wallThickness / 2),
      c.quat,
      this.theme.wall,
      { restitution: 0.1 },
    )
    return c
  }

  get totalLength() {
    return this.path[this.path.length - 1].s
  }
}
