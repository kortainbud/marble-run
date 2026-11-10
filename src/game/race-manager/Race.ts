import * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import type { Competitor, RaceConfig, RacePhase, Standing } from '../../types'
import type { BuiltEnvironment } from '../../environments/types'
import { getEnv } from '../../environments/registry'
import { GRAVITY, MARBLE, PHYSICS_DT, RECORD_EVERY } from '../physics/constants'
import type { GameEvent, MarbleRef, TrackedBody } from '../obstacles/types'
import { PathTracker, type Location } from '../tracks/PathTracker'
import { createMarbleVisual } from '../marbles/skins'
import { createRng } from '../../utils/random'
import { Recorder } from './Recorder'

export const COUNTDOWN_SECONDS = 3
const HARD_TIMEOUT = 120
const AFTER_FIRST_TIMEOUT = 25
const STUCK_NUDGE = 3.5
const STUCK_RESPAWN = 8

export interface MarbleEntity extends MarbleRef {
  competitor: Competitor
  object: THREE.Object3D
  loc: Location
  best: number
  bestAt: number
  lastNudge: number
  finished: boolean
  finishTime: number | null
  dnf: boolean
  respawns: number
  prevVel: THREE.Vector3
}

export type RaceEvent =
  | GameEvent
  | { type: 'collide'; strength: number; pos: THREE.Vector3 }
  | { type: 'gate' }
  | { type: 'respawn'; id: string }
  | { type: 'finish-cross'; id: string; place: number; pos: THREE.Vector3 }

export interface RaceOutcome {
  order: string[]
  times: Record<string, number | null>
  duration: number
}

export interface RaceHooks {
  onEvent(e: RaceEvent): void
  onPhase(p: RacePhase): void
  onCountdown(n: number): void
  onEnd(o: RaceOutcome): void
}

/**
 * One race: owns the Rapier world, the environment, the marbles and the rules
 * (countdown → gate → racing → finish). Advanced only in fixed PHYSICS_DT steps.
 */
export class Race {
  readonly scene = new THREE.Scene()
  readonly world: RAPIER.World
  readonly env: BuiltEnvironment
  readonly tracker: PathTracker
  readonly marbles: MarbleEntity[] = []
  readonly tracked: TrackedBody[] = []
  readonly recorder: Recorder
  phase: RacePhase = 'COUNTDOWN'
  simTime = 0
  steps = 0
  readonly gateOpenAt = COUNTDOWN_SECONDS + 0.4
  finishOrder: string[] = []
  firstFinishTime: number | null = null
  endTime: number | null = null
  /** transforms at the previous and current step, for render interpolation */
  prev: Float32Array
  curr: Float32Array

  private gateBody: RAPIER.RigidBody | null = null
  private gateBase = new THREE.Vector3()
  private gateUp = new THREE.Vector3()
  private gateOpened = false
  private lastCount = -1
  private rng
  private tmpV = new THREE.Vector3()

  constructor(
    readonly rapier: typeof RAPIER,
    readonly config: RaceConfig,
    readonly competitors: Competitor[],
    private hooks: RaceHooks,
  ) {
    this.rng = createRng(config.seed)
    this.world = new rapier.World({ x: 0, y: GRAVITY, z: 0 })
    this.world.timestep = PHYSICS_DT
    this.world.numSolverIterations = 6

    const def = getEnv(config.environment)
    this.env = def.build!({
      scene: this.scene,
      rapier,
      world: this.world,
      emit: (e) => this.hooks.onEvent(e),
      track: (t) => this.tracked.push(t),
    })
    this.tracker = new PathTracker(this.env.builder.path)
    this.buildGate()
    this.spawnMarbles()
    // marbles first in the tracked list, so replay index i == marble i
    const obstacleTracked = this.tracked.splice(0)
    this.tracked.push(...this.marbles.map((m) => ({ body: m.body, object: m.object })), ...obstacleTracked)
    this.prev = new Float32Array(this.tracked.length * 7)
    this.curr = new Float32Array(this.tracked.length * 7)
    this.snapshot(this.curr)
    this.prev.set(this.curr)
    this.recorder = new Recorder(this.tracked.length, PHYSICS_DT * RECORD_EVERY)
  }

  get raceTime() {
    return Math.max(0, this.simTime - this.gateOpenAt)
  }

  get finishS() {
    return this.env.builder.finishS
  }

  // ------------------------------------------------------------------ setup

  private buildGate() {
    const g = this.env.builder.gatePose!
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(g.half.x * 2, g.half.y * 2, g.half.z * 2),
      new THREE.MeshStandardMaterial({ color: '#f5f5f5', emissive: '#ffcc33', emissiveIntensity: 0.35, metalness: 0.3, roughness: 0.4 }),
    )
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(g.half.x * 2 + 0.01, 0.12, g.half.z * 2 + 0.01),
      new THREE.MeshBasicMaterial({ color: '#ff3b3b', toneMapped: false }),
    )
    stripe.position.y = g.half.y * 0.4
    mesh.add(stripe)
    mesh.castShadow = true
    mesh.position.copy(g.pos)
    mesh.quaternion.copy(g.quat)
    this.scene.add(mesh)
    this.gateBase.copy(g.pos)
    this.gateUp.set(0, 1, 0).applyQuaternion(g.quat)
    this.gateBody = this.world.createRigidBody(
      this.rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(g.pos.x, g.pos.y, g.pos.z).setRotation(g.quat),
    )
    this.world.createCollider(this.rapier.ColliderDesc.cuboid(g.half.x, g.half.y, g.half.z).setFriction(0.1), this.gateBody)
    this.tracked.push({ body: this.gateBody, object: mesh })
  }

  private spawnMarbles() {
    const pen = this.env.builder.penChute!
    const n = this.competitors.length
    const perRow = Math.min(5, n)
    const spacing = MARBLE.radius * 2 + 0.08
    const order = this.rng.shuffle(this.competitors.map((_, i) => i))
    order.forEach((ci, slot) => {
      const c = this.competitors[ci]
      const row = Math.floor(slot / perRow)
      const inRow = Math.min(perRow, n - row * perRow)
      const col = slot % perRow
      const lateral = (col - (inRow - 1) / 2) * spacing + this.rng.range(-0.03, 0.03)
      const back = 0.42 + row * spacing + this.rng.range(-0.02, 0.02)
      const p = pen.at(1 - back / pen.length, lateral / (pen.width / 2), MARBLE.radius + 0.03)
      const body = this.world.createRigidBody(
        this.rapier.RigidBodyDesc.dynamic()
          .setTranslation(p.x, p.y, p.z)
          .setCcdEnabled(true)
          .setLinearDamping(MARBLE.linearDamping)
          .setAngularDamping(MARBLE.angularDamping)
          .setCanSleep(false),
      )
      this.world.createCollider(
        this.rapier.ColliderDesc.ball(MARBLE.radius).setDensity(MARBLE.density).setFriction(MARBLE.friction).setRestitution(MARBLE.restitution),
        body,
      )
      const vis = createMarbleVisual(c.appearance, c.number)
      vis.object.position.copy(p)
      this.scene.add(vis.object)
      this.marbles[ci] = {
        idx: ci,
        competitor: c,
        body,
        object: vis.object,
        pos: p.clone(),
        vel: new THREE.Vector3(),
        prevVel: new THREE.Vector3(),
        cooldown: {},
        loc: { seg: 0, s: 0, dist: 0, dy: 0 },
        best: 0,
        bestAt: 0,
        lastNudge: 0,
        finished: false,
        finishTime: null,
        dnf: false,
        respawns: 0,
      }
    })
    for (const m of this.marbles) this.tracker.locate(m.pos, 0, m.loc)
  }

  // ------------------------------------------------------------------ stepping

  step() {
    const dt = PHYSICS_DT
    const t = this.simTime
    this.updateGate(t)
    for (const o of this.env.obstacles) o.preStep?.(t, dt)
    this.prev.set(this.curr)
    this.world.step()
    this.simTime += dt
    this.steps++

    for (const m of this.marbles) {
      const p = m.body.translation()
      const v = m.body.linvel()
      m.pos.set(p.x, p.y, p.z)
      m.prevVel.copy(m.vel)
      m.vel.set(v.x, v.y, v.z)
    }
    for (const o of this.env.obstacles) o.postStep?.(this.simTime, dt, this.marbles)

    for (const m of this.marbles) {
      // impact detection for audio: velocity change beyond what gravity explains
      this.tmpV.copy(m.vel).sub(m.prevVel)
      this.tmpV.y -= GRAVITY * dt
      const dv = this.tmpV.length()
      if (dv > 1.1) this.hooks.onEvent({ type: 'collide', strength: Math.min(1, dv / 8), pos: m.pos })
      const sp = m.vel.length()
      if (sp > MARBLE.maxSpeed) {
        m.vel.multiplyScalar(MARBLE.maxSpeed / sp)
        m.body.setLinvel(m.vel, true)
      }
    }

    if (this.phase === 'RACING' || this.phase === 'FINISHED') this.updateRules()
    this.snapshot(this.curr)
    if (this.steps % RECORD_EVERY === 0 && (this.endTime == null || this.simTime < this.endTime + 3)) {
      this.recorder.push(this.simTime, this.curr)
    }
  }

  private updateGate(t: number) {
    if (this.phase === 'COUNTDOWN') {
      const remaining = Math.ceil(this.gateOpenAt - t)
      if (t >= 0.4 && remaining !== this.lastCount && remaining >= 0) {
        this.lastCount = remaining
        this.hooks.onCountdown(remaining)
      }
    }
    if (!this.gateBody) return
    const k = Math.min(1, Math.max(0, (t - this.gateOpenAt) / 0.3))
    if (k > 0 && !this.gateOpened) {
      this.gateOpened = true
      this.phase = 'RACING'
      this.hooks.onPhase('RACING')
      this.hooks.onEvent({ type: 'gate' })
    }
    const p = this.gateBase.clone().addScaledVector(this.gateUp, -1.15 * k * k * (3 - 2 * k))
    this.gateBody.setNextKinematicTranslation(p)
  }

  private updateRules() {
    const t = this.simTime
    const rt = this.raceTime
    const noResp = this.env.builder.noRespawn
    for (const m of this.marbles) {
      if (m.finished || m.dnf) continue
      this.tracker.locate(m.pos, m.loc.seg, m.loc)
      if (m.loc.s > m.best + 0.25) {
        m.best = m.loc.s
        m.bestAt = t
      }
      if (m.loc.s >= this.finishS && m.loc.dist < 3) {
        m.finished = true
        m.finishTime = rt
        this.finishOrder.push(m.competitor.id)
        if (this.firstFinishTime == null) this.firstFinishTime = rt
        this.hooks.onEvent({ type: 'finish-cross', id: m.competitor.id, place: this.finishOrder.length, pos: m.pos.clone() })
        continue
      }
      const off = m.loc.dist > 3.4 || m.loc.dy < -2.2 || m.pos.y < -5
      const inAir = noResp.some((r) => m.loc.s >= r.from && m.loc.s <= r.to)
      if (off) {
        this.respawn(m, m.best - 0.6)
      } else if (t - m.bestAt > STUCK_RESPAWN) {
        this.respawn(m, m.best + 2)
      } else if (t - m.bestAt > STUCK_NUDGE && t - m.lastNudge > 1.5 && !inAir) {
        m.lastNudge = t
        const tan = this.tracker.tangentAt(m.loc.s)
        const mass = m.body.mass()
        m.body.applyImpulse({ x: tan.x * 2.2 * mass + this.rng.range(-0.6, 0.6) * mass, y: 1.6 * mass, z: tan.z * 2.2 * mass + this.rng.range(-0.6, 0.6) * mass }, true)
      }
    }

    if (this.phase === 'RACING') {
      const allDone = this.marbles.every((m) => m.finished)
      const timeout = rt > HARD_TIMEOUT || (this.firstFinishTime != null && rt > this.firstFinishTime + AFTER_FIRST_TIMEOUT)
      if (allDone || timeout) this.end()
    }
  }

  private respawn(m: MarbleEntity, s: number) {
    for (const r of this.env.builder.noRespawn) {
      if (s >= r.from - 1 && s <= r.to) s = s > (r.from + r.to) / 2 && m.best > r.to ? r.to + 0.5 : r.from - 5
    }
    s = Math.max(0.5, Math.min(this.finishS - 0.5, s))
    const p = this.tracker.pointAt(s)
    const tan = this.tracker.tangentAt(s)
    const side = new THREE.Vector3(-tan.z, 0, tan.x).normalize()
    p.addScaledVector(side, this.rng.range(-0.9, 0.9)).add(new THREE.Vector3(0, MARBLE.radius + 0.35, 0))
    m.body.setTranslation(p, true)
    m.body.setLinvel({ x: tan.x * 2.5, y: 0, z: tan.z * 2.5 }, true)
    m.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
    m.pos.copy(p)
    m.vel.set(tan.x * 2.5, 0, tan.z * 2.5)
    m.prevVel.copy(m.vel)
    m.loc.seg = this.tracker.segmentAt(s)
    this.tracker.locate(p, m.loc.seg, m.loc)
    m.best = Math.max(m.best, m.loc.s)
    m.bestAt = this.simTime
    m.respawns++
    this.hooks.onEvent({ type: 'respawn', id: m.competitor.id })
  }

  private end() {
    this.phase = 'FINISHED'
    this.endTime = this.simTime
    const rest = this.marbles
      .filter((m) => !m.finished)
      .sort((a, b) => b.best - a.best)
    for (const m of rest) m.dnf = true
    const order = [...this.finishOrder, ...rest.map((m) => m.competitor.id)]
    const times: Record<string, number | null> = {}
    for (const m of this.marbles) times[m.competitor.id] = m.finishTime
    this.hooks.onPhase('FINISHED')
    this.hooks.onEnd({ order, times, duration: this.raceTime })
  }

  /** Abort early (e.g. "skip to results"): resolve standings as they are now. */
  forceEnd() {
    if (this.phase === 'RACING') this.end()
  }

  standings(): Standing[] {
    const total = this.finishS
    const list = this.marbles.map<Standing>((m) => ({
      id: m.competitor.id,
      progress: m.finished ? 1 : Math.min(0.999, Math.max(0, m.best / total)),
      finished: m.finished,
      finishTime: m.finishTime,
      dnf: m.dnf,
    }))
    const place = new Map(this.finishOrder.map((id, i) => [id, i]))
    return list.sort((a, b) => {
      const pa = place.get(a.id)
      const pb = place.get(b.id)
      if (pa != null && pb != null) return pa - pb
      if (pa != null) return -1
      if (pb != null) return 1
      return b.progress - a.progress
    })
  }

  private snapshot(out: Float32Array) {
    for (let i = 0; i < this.tracked.length; i++) {
      const b = this.tracked[i].body
      const p = b.translation()
      const q = b.rotation()
      out[i * 7] = p.x
      out[i * 7 + 1] = p.y
      out[i * 7 + 2] = p.z
      out[i * 7 + 3] = q.x
      out[i * 7 + 4] = q.y
      out[i * 7 + 5] = q.z
      out[i * 7 + 6] = q.w
    }
  }

  dispose() {
    for (const o of this.env.obstacles) o.dispose?.()
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (mesh.geometry) mesh.geometry.dispose()
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined
      if (mat) (Array.isArray(mat) ? mat : [mat]).forEach((m) => m.dispose())
    })
    this.world.free()
  }
}
