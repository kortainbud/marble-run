import type { Competitor, MarbleAppearance, SkinId } from '../../types'
import type { Rng } from '../../utils/random'

export interface SkinInfo {
  id: SkinId
  name: string
  blurb: string
}

export const SKINS: SkinInfo[] = [
  { id: 'classic', name: 'Classic', blurb: 'Glossy solid colour with a race number.' },
  { id: 'glass', name: 'Glass', blurb: 'Clear shell, swirling cat’s-eye core.' },
  { id: 'galaxy', name: 'Galaxy', blurb: 'A pocket nebula full of stars.' },
  { id: 'lava', name: 'Lava', blurb: 'Cooled rock with molten, glowing cracks.' },
  { id: 'chrome', name: 'Chrome', blurb: 'Mirror-polished metal.' },
  { id: 'neon', name: 'Neon', blurb: 'Dark core wrapped in glowing bands.' },
  { id: 'crystal', name: 'Crystal', blurb: 'Faceted and iridescent.' },
  { id: 'gradient', name: 'Gradient', blurb: 'Two colours blended pole to pole.' },
]

export const COLOR_SWATCHES = [
  '#ff3b3b', '#ff8a1f', '#ffd21f', '#4ade3a', '#19c7a0', '#22b8ff',
  '#3b5bff', '#8b5cff', '#ff4fc3', '#f5f5f5', '#2a2a33', '#c9a36b',
]

const a = (skin: SkinId, color: string, accent: string): MarbleAppearance => ({ skin, color, accent })

/** The house field of AI competitors. Skins are cosmetic only. */
export const ROSTER: Omit<Competitor, 'isPlayer'>[] = [
  { id: 'r1', name: 'Crimson Comet', number: 1, appearance: a('classic', '#ff3b3b', '#ffffff') },
  { id: 'r2', name: 'Blue Bolt', number: 2, appearance: a('classic', '#22b8ff', '#ffffff') },
  { id: 'r3', name: 'Nebula', number: 3, appearance: a('galaxy', '#8b5cff', '#ff4fc3') },
  { id: 'r4', name: 'Magma', number: 4, appearance: a('lava', '#ff6a00', '#ffd21f') },
  { id: 'r5', name: 'Mercury', number: 5, appearance: a('chrome', '#e8edf5', '#ffffff') },
  { id: 'r6', name: 'Glowstick', number: 6, appearance: a('neon', '#4ade3a', '#19c7a0') },
  { id: 'r7', name: 'Prism', number: 7, appearance: a('crystal', '#9fe8ff', '#ff9fe0') },
  { id: 'r8', name: 'Sunset', number: 8, appearance: a('gradient', '#ff8a1f', '#ff4fc3') },
  { id: 'r9', name: 'Seaglass', number: 9, appearance: a('glass', '#19c7a0', '#22b8ff') },
  { id: 'r10', name: 'Lemon Drop', number: 10, appearance: a('classic', '#ffd21f', '#2a2a33') },
  { id: 'r11', name: 'Goldrush', number: 11, appearance: a('chrome', '#ffcf6b', '#ffffff') },
  { id: 'r12', name: 'Andromeda', number: 12, appearance: a('galaxy', '#22b8ff', '#8b5cff') },
  { id: 'r13', name: 'Ember', number: 13, appearance: a('lava', '#ff3b3b', '#ff8a1f') },
  { id: 'r14', name: 'Hotwire', number: 14, appearance: a('neon', '#ff4fc3', '#8b5cff') },
  { id: 'r15', name: 'Emerald', number: 15, appearance: a('crystal', '#4ade3a', '#19c7a0') },
  { id: 'r16', name: 'Lagoon', number: 16, appearance: a('gradient', '#19c7a0', '#3b5bff') },
  { id: 'r17', name: 'Cherry Swirl', number: 17, appearance: a('glass', '#ff3b3b', '#ffd21f') },
  { id: 'r18', name: 'Midnight', number: 18, appearance: a('classic', '#2a2a33', '#ffd21f') },
  { id: 'r19', name: 'Violet Vortex', number: 19, appearance: a('gradient', '#8b5cff', '#22b8ff') },
  { id: 'r20', name: 'Cobalt', number: 20, appearance: a('chrome', '#5b7bff', '#ffffff') },
  { id: 'r21', name: 'Tangerine', number: 21, appearance: a('glass', '#ff8a1f', '#ffffff') },
]

export const DEFAULT_PLAYER: Competitor = {
  id: 'player',
  name: 'You',
  number: 0,
  appearance: a('galaxy', '#ff4fc3', '#22b8ff'),
  isPlayer: true,
}

/** Player's marble plus (count-1) random house marbles. */
export function buildField(player: Competitor, count: number, rng: Rng): Competitor[] {
  const pool = rng.shuffle(ROSTER.filter((r) => r.number !== player.number).slice())
  const field: Competitor[] = [{ ...player, name: player.name.trim() || 'You', isPlayer: true }]
  for (const r of pool.slice(0, count - 1)) field.push({ ...r, isPlayer: false })
  return field
}
