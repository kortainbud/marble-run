import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { CameraMode, Competitor, EnvironmentId, RacePhase, RaceResult, Standing } from '../types'
import { DEFAULT_PLAYER, buildField } from '../game/marbles/roster'
import { createRng, randomSeed } from '../utils/random'
import { PLAYABLE } from '../environments/registry'
import { sound } from '../game/audio/Sound'

export type Screen = 'home' | 'setup' | 'garage' | 'race'
export type Count = 4 | 8 | 12 | 20

export interface Stats {
  points: number
  races: number
  predictions: number
  streak: number
  bestStreak: number
}

interface Persisted {
  player: Competitor
  environment: EnvironmentId
  count: Count
  cameraMode: CameraMode
  muted: boolean
  stats: Stats
  recent: RaceResult[]
}

interface Live {
  phase: RacePhase
  countdown: number | null
  raceTime: number
  standings: Standing[]
  firstFinishId: string | null
  result: RaceResult | null
  replaying: boolean
  replayProgress: number
}

interface State extends Persisted, Live {
  screen: Screen
  /** where the garage returns to */
  garageReturn: Screen
  field: Competitor[]
  fieldSeed: number
  predictionId: string | null
  raceSeed: number
  /** bump to (re)start a race on the race screen */
  raceNonce: number

  go(s: Screen): void
  openGarage(from: Screen): void
  setPlayer(p: Partial<Competitor>): void
  setEnvironment(e: EnvironmentId): void
  setCount(c: Count): void
  shuffleField(): void
  setPrediction(id: string | null): void
  setCameraMode(m: CameraMode): void
  toggleMute(): void
  startRace(): void
  quickRace(): void
  raceAgain(): void

  setLive(l: Partial<Live>): void
  recordResult(r: Omit<RaceResult, 'predictionCorrect'>): RaceResult
  clearHistory(): void
}

const initialLive: Live = {
  phase: 'IDLE',
  countdown: null,
  raceTime: 0,
  standings: [],
  firstFinishId: null,
  result: null,
  replaying: false,
  replayProgress: 0,
}

const safeStorage = createJSONStorage(() => {
  try {
    const k = '__mr_probe'
    localStorage.setItem(k, '1')
    localStorage.removeItem(k)
    return localStorage
  } catch {
    const mem = new Map<string, string>()
    return {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
    }
  }
})

const makeField = (player: Competitor, count: number, seed: number) => buildField(player, count, createRng(seed))

export const useGame = create<State>()(
  persist(
    (set, get) => {
      const seed = randomSeed()
      return {
        player: DEFAULT_PLAYER,
        environment: 'canyon',
        count: 8,
        cameraMode: 'auto',
        muted: false,
        stats: { points: 0, races: 0, predictions: 0, streak: 0, bestStreak: 0 },
        recent: [],
        ...initialLive,
        screen: 'home',
        garageReturn: 'home',
        fieldSeed: seed,
        field: makeField(DEFAULT_PLAYER, 8, seed),
        predictionId: 'player',
        raceSeed: seed,
        raceNonce: 0,

        go: (screen) => {
          sound.unlock()
          if (screen !== 'race') set({ ...initialLive })
          set({ screen })
        },
        openGarage: (from) => set({ screen: 'garage', garageReturn: from }),
        setPlayer: (p) => {
          const player = { ...get().player, ...p, appearance: { ...get().player.appearance, ...(p.appearance ?? {}) } }
          set({ player, field: makeField(player, get().count, get().fieldSeed) })
        },
        setEnvironment: (environment) => set({ environment }),
        setCount: (count) => {
          const { player, fieldSeed, predictionId } = get()
          const field = makeField(player, count, fieldSeed)
          set({ count, field, predictionId: field.some((c) => c.id === predictionId) ? predictionId : 'player' })
        },
        shuffleField: () => {
          const fieldSeed = randomSeed()
          const { player, count, predictionId } = get()
          const field = makeField(player, count, fieldSeed)
          set({ fieldSeed, field, predictionId: field.some((c) => c.id === predictionId) ? predictionId : 'player' })
        },
        setPrediction: (predictionId) => set({ predictionId }),
        setCameraMode: (cameraMode) => set({ cameraMode }),
        toggleMute: () => {
          const muted = !get().muted
          sound.setMuted(muted)
          set({ muted })
        },
        startRace: () => {
          sound.unlock()
          const { player, count, fieldSeed } = get()
          set({ ...initialLive, field: makeField(player, count, fieldSeed), screen: 'race', raceSeed: randomSeed(), raceNonce: get().raceNonce + 1 })
        },
        quickRace: () => {
          sound.unlock()
          const rng = createRng(randomSeed())
          const environment = rng.pick(PLAYABLE).id
          const count = rng.pick([8, 12, 20] as const)
          const fieldSeed = randomSeed()
          const field = makeField(get().player, count, fieldSeed)
          set({
            ...initialLive, environment, count, fieldSeed, field, predictionId: 'player',
            screen: 'race', raceSeed: randomSeed(), raceNonce: get().raceNonce + 1,
          })
        },
        raceAgain: () => {
          sound.unlock()
          set({ ...initialLive, raceSeed: randomSeed(), raceNonce: get().raceNonce + 1 })
        },

        setLive: (l) => set(l),
        recordResult: (r) => {
          const correct = r.predictionId ? r.order[0] === r.predictionId : null
          const result: RaceResult = { ...r, predictionCorrect: correct }
          const s = { ...get().stats }
          s.races++
          if (correct != null) {
            s.predictions++
            if (correct) {
              s.points++
              s.streak++
              s.bestStreak = Math.max(s.bestStreak, s.streak)
            } else s.streak = 0
          }
          set({ stats: s, result, recent: [result, ...get().recent].slice(0, 12) })
          return result
        },
        clearHistory: () => set({ recent: [], stats: { points: 0, races: 0, predictions: 0, streak: 0, bestStreak: 0 } }),
      }
    },
    {
      name: 'marble-run',
      version: 1,
      storage: safeStorage,
      partialize: (s): Persisted => ({
        player: s.player, environment: s.environment, count: s.count, cameraMode: s.cameraMode,
        muted: s.muted, stats: s.stats, recent: s.recent,
      }),
      merge: (persisted, current) => {
        const merged = { ...current, ...(persisted as Partial<Persisted>) }
        merged.field = makeField(merged.player, merged.count, merged.fieldSeed)
        sound.setMuted(merged.muted)
        return merged
      },
    },
  ),
)
