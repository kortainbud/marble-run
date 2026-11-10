export type SkinId =
  | 'classic'
  | 'glass'
  | 'galaxy'
  | 'lava'
  | 'chrome'
  | 'neon'
  | 'crystal'
  | 'gradient'

export type EnvironmentId = 'canyon' | 'neon' | 'jungle' | 'frozen' | 'candy'

/** Visual identity of a marble. Purely cosmetic — never touches physics. */
export interface MarbleAppearance {
  skin: SkinId
  color: string
  /** Secondary colour, used by gradient / glass core / galaxy tint. */
  accent: string
}

export interface Competitor {
  id: string
  name: string
  number: number
  appearance: MarbleAppearance
  isPlayer: boolean
}

export type CameraMode = 'auto' | 'leader' | 'follow' | 'overview'

export type RacePhase = 'IDLE' | 'SETUP' | 'COUNTDOWN' | 'RACING' | 'FINISHED' | 'PAUSED' | 'ERROR'

export interface RaceConfig {
  environment: EnvironmentId
  count: 4 | 8 | 12 | 20
  /** competitor id predicted to win (locked at race start) */
  predictionId: string | null
  seed: number
}

export interface Standing {
  id: string
  /** 0..1 along the track */
  progress: number
  finished: boolean
  finishTime: number | null
  dnf: boolean
}

export interface RaceResult {
  id: string
  date: number
  environment: EnvironmentId
  count: number
  /** competitor ids in finishing order */
  order: string[]
  times: Record<string, number | null>
  competitors: Competitor[]
  predictionId: string | null
  predictionCorrect: boolean | null
  duration: number
}
