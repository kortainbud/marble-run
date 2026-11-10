import * as THREE from 'three'
import RAPIER from '@dimforge/rapier3d-compat'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import type { CameraMode, Competitor, RaceConfig, RacePhase, Standing } from '../../types'
import { MAX_STEPS_PER_FRAME, PHYSICS_DT } from '../physics/constants'
import { Race, type RaceOutcome } from '../race-manager/Race'
import { applyInterpolated } from '../race-manager/Recorder'
import { CameraDirector, type DirectorInput } from '../camera/CameraDirector'
import { Confetti } from '../rendering/Confetti'
import { sound } from '../audio/Sound'

let rapierInit: Promise<void> | null = null
export function initPhysics() {
  rapierInit ??= RAPIER.init()
  return rapierInit
}

export interface EngineCallbacks {
  onCountdown(n: number): void
  onPhase(p: RacePhase): void
  onSnapshot(s: { raceTime: number; standings: Standing[] }): void
  onFirstFinish(id: string): void
  onEnd(o: RaceOutcome): void
  onReplayProgress(t: number, duration: number): void
  onReplayEnd(): void
}

interface ReplayState {
  time: number
  speed: number
  duration: number
  objects: THREE.Object3D[]
  hints: number[]
  s: number[]
  celebrated: boolean
  ended: boolean
}

export interface Tags {
  player?: HTMLElement | null
  focus?: HTMLElement | null
}

const isMobile = () => window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 720

/**
 * Owns the WebGL renderer and the main loop. Physics advances in fixed steps;
 * rendering interpolates between the last two physics states.
 */
export class GameEngine {
  readonly renderer: THREE.WebGLRenderer
  readonly camera = new THREE.PerspectiveCamera(55, 1, 0.1, 600)
  private composer: EffectComposer
  private renderPass: RenderPass
  private bloom: UnrealBloomPass
  private envMap: THREE.Texture
  private race: Race | null = null
  private director: CameraDirector | null = null
  private confetti: Confetti | null = null
  private replay: ReplayState | null = null
  private raf = 0
  private last = 0
  private acc = 0
  private lastSnap = 0
  private paused = false
  private cameraMode: CameraMode = 'auto'
  private followId: string | null = null
  private outcome: RaceOutcome | null = null
  private resizeObs: ResizeObserver
  private tags: Tags = {}
  private positions: THREE.Vector3[] = []
  private sArr: number[] = []
  private order: number[] = []
  private disposed = false

  constructor(
    private canvas: HTMLCanvasElement,
    private cb: EngineCallbacks,
  ) {
    const mobile = isMobile()
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.5 : 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    const pmrem = new THREE.PMREMGenerator(this.renderer)
    this.envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    pmrem.dispose()

    this.composer = new EffectComposer(this.renderer)
    this.renderPass = new RenderPass(new THREE.Scene(), this.camera)
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.4, 0.85)
    this.composer.addPass(this.renderPass)
    this.composer.addPass(this.bloom)
    this.composer.addPass(new OutputPass())

    this.resizeObs = new ResizeObserver(() => this.resize())
    this.resizeObs.observe(canvas.parentElement ?? canvas)
    this.resize()
    this.last = performance.now()
    this.raf = requestAnimationFrame(this.frame)
  }

  // ------------------------------------------------------------------ public API

  async startRace(config: RaceConfig, competitors: Competitor[]) {
    await initPhysics()
    if (this.disposed) return
    this.clearRace()
    this.outcome = null
    this.paused = false
    this.acc = 0
    const race = new Race(RAPIER, config, competitors, {
      onEvent: (e) => {
        switch (e.type) {
          case 'collide': sound.click(e.strength); break
          case 'boost': sound.boost(); break
          case 'bump': sound.bump(); break
          case 'launch': sound.launch(); break
          case 'rock': sound.rock(); break
          case 'gate': sound.gate(); break
          case 'finish-cross':
            sound.finish(e.place)
            if (e.place === 1) {
              this.confetti?.burst(e.pos)
              this.cb.onFirstFinish(e.id)
            }
            break
        }
      },
      onPhase: (p) => this.cb.onPhase(p),
      onCountdown: (n) => {
        sound.countdown(n)
        this.cb.onCountdown(n)
      },
      onEnd: (o) => {
        this.outcome = o
        this.cb.onEnd(o)
      },
    })
    this.race = race
    race.scene.environment = this.envMap
    race.scene.environmentIntensity = config.environment === 'neon' ? 0.45 : 0.7
    this.confetti = new Confetti(race.env.confetti)
    race.scene.add(this.confetti.mesh)
    this.renderPass.scene = race.scene
    this.bloom.strength = race.env.bloom.strength
    this.bloom.radius = race.env.bloom.radius
    this.bloom.threshold = race.env.bloom.threshold
    this.renderer.toneMappingExposure = race.env.exposure
    this.positions = race.marbles.map((m) => m.object.position)
    this.sArr = race.marbles.map(() => 0)
    this.order = race.marbles.map((_, i) => i)
    this.director = new CameraDirector(this.camera, race.tracker)
    this.director.setMode(this.cameraMode)
    this.director.snap(this.directorInput(0))
    this.cb.onPhase('COUNTDOWN')
  }

  setCameraMode(m: CameraMode) {
    this.cameraMode = m
    this.director?.setMode(m)
  }

  setFollow(id: string | null) {
    this.followId = id
  }

  setPaused(p: boolean) {
    this.paused = p
  }

  setTags(t: Tags) {
    this.tags = t
  }

  skipToResults() {
    this.race?.forceEnd()
  }

  startReplay(speed = 1) {
    const race = this.race
    if (!race || race.recorder.frames.length < 2) return
    this.replay = {
      time: Math.max(0, race.gateOpenAt - 1.2 - race.recorder.t0),
      speed,
      duration: race.recorder.duration,
      objects: race.tracked.map((t) => t.object),
      hints: race.marbles.map(() => 0),
      s: race.marbles.map(() => 0),
      celebrated: false,
      ended: false,
    }
    this.director?.resetShots()
  }

  setReplaySpeed(speed: number) {
    if (this.replay) this.replay.speed = speed
  }

  stopReplay() {
    this.replay = null
  }

  get isReplaying() {
    return this.replay != null
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.resizeObs.disconnect()
    this.clearRace()
    sound.setRolling(0)
    this.composer.dispose()
    this.envMap.dispose()
    this.renderer.dispose()
  }

  // ------------------------------------------------------------------ internals

  private clearRace() {
    this.replay = null
    if (this.race) {
      this.race.dispose()
      this.race = null
    }
    this.confetti = null
  }

  private resize() {
    const el = this.canvas.parentElement ?? this.canvas
    const w = Math.max(1, el.clientWidth)
    const h = Math.max(1, el.clientHeight)
    this.renderer.setSize(w, h, false)
    this.composer.setSize(w, h)
    this.bloom.resolution.set(w / 2, h / 2)
    this.camera.aspect = w / h
    this.camera.fov = w / h < 0.8 ? 68 : 55
    this.camera.updateProjectionMatrix()
  }

  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame)
    const dt = Math.min(0.1, (now - this.last) / 1000)
    this.last = now
    const race = this.race
    if (!race || !this.director) {
      return
    }
    let visualTime = race.simTime

    if (this.replay) {
      visualTime = this.tickReplay(race, dt)
    } else if (!this.paused) {
      this.acc += dt
      let n = 0
      while (this.acc >= PHYSICS_DT && n < MAX_STEPS_PER_FRAME) {
        race.step()
        this.acc -= PHYSICS_DT
        n++
      }
      if (n === MAX_STEPS_PER_FRAME) this.acc = 0
      const alpha = this.acc / PHYSICS_DT
      for (let i = 0; i < race.tracked.length; i++) applyInterpolated(race.tracked[i].object, race.prev, race.curr, i * 7, alpha)
      for (let i = 0; i < race.marbles.length; i++) this.sArr[i] = race.marbles[i].loc.s
      this.computeOrderLive(race)
      if (now - this.lastSnap > 110) {
        this.lastSnap = now
        this.cb.onSnapshot({ raceTime: race.raceTime, standings: race.standings() })
        let sp = 0
        for (const m of race.marbles) sp += m.finished ? 0 : m.vel.length()
        sound.setRolling(race.phase === 'RACING' ? sp / race.marbles.length / 10 : 0)
      }
    } else {
      sound.setRolling(0)
    }

    const vdt = this.paused && !this.replay ? 0 : dt * (this.replay?.speed ?? 1)
    for (const o of race.env.obstacles) o.frame?.(visualTime, vdt)
    race.env.frame?.(visualTime, vdt)
    this.confetti?.update(vdt)
    this.director.update(this.directorInput(visualTime), this.paused && !this.replay ? 0 : dt)
    this.updateTags(race)
    this.composer.render()
  }

  private tickReplay(race: Race, dt: number) {
    const r = this.replay!
    if (!r.ended) r.time += dt * r.speed
    if (r.time >= r.duration && !r.ended) {
      r.time = r.duration
      r.ended = true
      this.cb.onReplayEnd()
    }
    const simT = race.recorder.t0 + r.time
    race.recorder.apply(simT, r.objects)
    for (let i = 0; i < race.marbles.length; i++) {
      const loc = race.tracker.locate(race.marbles[i].object.position, r.hints[i], { seg: r.hints[i], s: 0, dist: 0, dy: 0 })
      r.hints[i] = loc.seg
      r.s[i] = loc.s
      this.sArr[i] = r.s[i]
    }
    const raceT = simT - race.gateOpenAt
    const times = this.outcome?.times ?? {}
    const finishedAt = (i: number) => {
      const ft = times[race.marbles[i].competitor.id]
      return ft != null && raceT >= ft ? ft : null
    }
    this.order = race.marbles
      .map((_, i) => i)
      .sort((a, b) => {
        const fa = finishedAt(a)
        const fb = finishedAt(b)
        if (fa != null && fb != null) return fa - fb
        if (fa != null) return -1
        if (fb != null) return 1
        return r.s[b] - r.s[a]
      })
    const winner = this.outcome?.order[0]
    const wi = race.marbles.findIndex((m) => m.competitor.id === winner)
    if (!r.celebrated && wi >= 0 && finishedAt(wi) != null) {
      r.celebrated = true
      this.confetti?.burst(race.marbles[wi].object.position.clone())
      sound.finish(1)
    }
    this.cb.onReplayProgress(r.time, r.duration)
    const now = performance.now()
    if (now - this.lastSnap > 110) {
      this.lastSnap = now
      const total = race.finishS
      this.cb.onSnapshot({
        raceTime: Math.max(0, raceT),
        standings: this.order.map((i) => {
          const ft = finishedAt(i)
          return {
            id: race.marbles[i].competitor.id,
            progress: ft != null ? 1 : Math.min(0.999, r.s[i] / total),
            finished: ft != null,
            finishTime: ft,
            dnf: false,
          }
        }),
      })
    }
    return simT
  }

  private computeOrderLive(race: Race) {
    const place = new Map(race.finishOrder.map((id, i) => [id, i]))
    this.order.sort((a, b) => {
      const pa = place.get(race.marbles[a].competitor.id)
      const pb = place.get(race.marbles[b].competitor.id)
      if (pa != null && pb != null) return pa - pb
      if (pa != null) return -1
      if (pb != null) return 1
      return race.marbles[b].loc.s - race.marbles[a].loc.s
    })
  }

  private directorInput(visualTime: number): DirectorInput {
    const race = this.race!
    const b = race.env.builder
    let phase: DirectorInput['phase']
    let winnerIdx: number | null = null
    if (this.replay) {
      const raceT = visualTime - race.gateOpenAt
      phase = raceT < 0 ? 'countdown' : this.replay.ended ? 'finished' : 'racing'
      if (this.replay.celebrated) winnerIdx = this.order[0]
    } else {
      phase = race.phase === 'COUNTDOWN' ? 'countdown' : race.phase === 'FINISHED' ? 'finished' : 'racing'
      if (race.finishOrder.length) winnerIdx = race.marbles.findIndex((m) => m.competitor.id === race.finishOrder[0])
    }
    const followIdx = Math.max(0, race.marbles.findIndex((m) => m.competitor.id === this.followId))
    return {
      positions: this.positions,
      s: this.sArr,
      order: this.order,
      followIdx,
      phase,
      finishS: race.finishS,
      finishPos: b.finishPose!.pos,
      finishHeading: b.finishPose!.heading,
      bounds: b.bounds,
      winnerIdx,
    }
  }

  private v = new THREE.Vector3()
  private updateTags(race: Race) {
    const place = (el: HTMLElement | null | undefined, idx: number) => {
      if (!el) return
      if (idx < 0) {
        el.style.opacity = '0'
        return
      }
      const m = race.marbles[idx]
      this.v.copy(m.object.position).add({ x: 0, y: 0.55, z: 0 } as THREE.Vector3).project(this.camera)
      const visible = this.v.z < 1 && Math.abs(this.v.x) < 1.1 && Math.abs(this.v.y) < 1.1
      const w = this.renderer.domElement.clientWidth
      const h = this.renderer.domElement.clientHeight
      el.style.opacity = visible ? '1' : '0'
      el.style.transform = `translate(${((this.v.x + 1) / 2) * w}px, ${((1 - this.v.y) / 2) * h}px) translate(-50%, -100%)`
      const label = m.competitor.isPlayer && m.competitor.name !== 'You' ? `${m.competitor.name} (you)` : m.competitor.name
      if (el.dataset.label !== label) {
        el.dataset.label = label
        el.textContent = label
      }
    }
    const playerIdx = race.marbles.findIndex((m) => m.competitor.isPlayer)
    place(this.tags.player, playerIdx)
    const focusIdx =
      this.cameraMode === 'follow'
        ? race.marbles.findIndex((m) => m.competitor.id === this.followId)
        : this.cameraMode === 'overview'
          ? -1
          : this.order[0]
    place(this.tags.focus, focusIdx === playerIdx ? -1 : focusIdx)
  }
}
