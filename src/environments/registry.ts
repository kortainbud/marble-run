import type { EnvironmentId } from '../types'
import type { EnvironmentDef } from './types'
import { canyon } from './canyon'
import { neon } from './neon'

/** Planned environments that are not playable yet (shown as "coming soon"). */
const planned: EnvironmentDef[] = [
  {
    id: 'jungle', name: 'Jungle Rush', tagline: 'Vines, waterfalls & swinging logs', playable: false,
    description: 'Wooden tracks through dense jungle with water currents and swinging logs.',
    obstacles: ['Swinging logs', 'Water currents', 'Collapsing bridges'],
    ui: { from: '#2fbf71', to: '#0d3b24', accent: '#c6ff6b' },
  },
  {
    id: 'frozen', name: 'Frozen Peak', tagline: 'Ice ramps & rolling snowballs', playable: false,
    description: 'Slippery ice chutes, frozen tunnels and rolling snowballs.',
    obstacles: ['Slippery slopes', 'Snowballs', 'Ice ramps'],
    ui: { from: '#9fe3ff', to: '#2a5f8f', accent: '#ffffff' },
  },
  {
    id: 'candy', name: 'Candyland', tagline: 'Gummy bounces & candy wheels', playable: false,
    description: 'Trampolines, gummy platforms and rotating candy wheels.',
    obstacles: ['Trampolines', 'Candy wheels', 'Spring platforms'],
    ui: { from: '#ff8ad8', to: '#8a3fd1', accent: '#fff3a0' },
  },
]

export const ENVIRONMENTS: EnvironmentDef[] = [canyon, neon, ...planned]
export const PLAYABLE = ENVIRONMENTS.filter((e) => e.playable)
export const getEnv = (id: EnvironmentId) => ENVIRONMENTS.find((e) => e.id === id) ?? canyon
