/** Small seeded PRNG (mulberry32) so race setups are reproducible from a seed. */
export function createRng(seed: number) {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    range: (min: number, max: number) => min + (max - min) * next(),
    int: (min: number, max: number) => Math.floor(min + (max - min + 1) * next()),
    pick: <T,>(arr: readonly T[]): T => arr[Math.floor(next() * arr.length)],
    shuffle: <T,>(arr: T[]): T[] => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1))
        ;[arr[i], arr[j]] = [arr[j], arr[i]]
      }
      return arr
    },
  }
}
export type Rng = ReturnType<typeof createRng>

export const randomSeed = () => Math.floor(Math.random() * 2 ** 31)

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

export function formatTime(s: number | null | undefined) {
  if (s == null || !isFinite(s)) return '—'
  const m = Math.floor(s / 60)
  const sec = s - m * 60
  return m > 0 ? `${m}:${sec.toFixed(2).padStart(5, '0')}` : `${sec.toFixed(2)}s`
}
