import * as THREE from 'three'
import { createRng } from '../../utils/random'

const cache = new Map<string, THREE.CanvasTexture>()

export function makeTexture(key: string, size: number, draw: (g: CanvasRenderingContext2D, s: number) => void, color = true) {
  const hit = cache.get(key)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = c.height = size
  draw(c.getContext('2d')!, size)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  if (color) t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  cache.set(key, t)
  return t
}

export function speckle(g: CanvasRenderingContext2D, s: number, seed: number, colors: string[], n: number, maxR = 2) {
  const rng = createRng(seed)
  for (let i = 0; i < n; i++) {
    g.fillStyle = rng.pick(colors)
    g.globalAlpha = rng.range(0.15, 0.6)
    const r = rng.range(0.5, maxR)
    g.beginPath()
    g.arc(rng.range(0, s), rng.range(0, s), r, 0, Math.PI * 2)
    g.fill()
  }
  g.globalAlpha = 1
}

export function woodPlanks(base: string, dark: string) {
  return makeTexture(`planks-${base}`, 256, (g, s) => {
    const rng = createRng(11)
    const n = 4
    for (let i = 0; i < n; i++) {
      const c = new THREE.Color(base).offsetHSL(0, 0, rng.range(-0.06, 0.05))
      g.fillStyle = '#' + c.getHexString()
      g.fillRect(0, (i * s) / n, s, s / n)
      g.strokeStyle = dark
      g.globalAlpha = 0.25
      for (let k = 0; k < 7; k++) {
        g.lineWidth = rng.range(0.5, 2)
        g.beginPath()
        const y = (i * s) / n + rng.range(4, s / n - 4)
        g.moveTo(0, y)
        g.bezierCurveTo(s * 0.3, y + rng.range(-4, 4), s * 0.6, y + rng.range(-4, 4), s, y)
        g.stroke()
      }
      g.globalAlpha = 0.9
      g.fillStyle = dark
      g.fillRect(0, (i * s) / n, s, 3)
      g.fillRect(rng.range(40, s - 40), (i * s) / n, 3, s / n)
      g.globalAlpha = 1
    }
  })
}

export function strata(colors: string[], seed = 3) {
  return makeTexture(`strata-${colors.join()}`, 256, (g, s) => {
    const rng = createRng(seed)
    let y = 0
    while (y < s) {
      const h = rng.range(6, 26)
      g.fillStyle = rng.pick(colors)
      g.fillRect(0, y, s, h + 1)
      y += h
    }
    speckle(g, s, seed + 1, ['#000', '#fff'], 900, 1.6)
  })
}

export function sand(base: string) {
  return makeTexture(`sand-${base}`, 256, (g, s) => {
    g.fillStyle = base
    g.fillRect(0, 0, s, s)
    speckle(g, s, 5, ['#7a3d1d', '#f3c99a', '#c4703c'], 2400, 1.8)
  })
}

export function metalPlate(base: string, line: string, glow?: string) {
  return makeTexture(`metal-${base}-${glow}`, 256, (g, s) => {
    g.fillStyle = base
    g.fillRect(0, 0, s, s)
    speckle(g, s, 9, ['#ffffff', '#000000'], 1200, 1)
    g.strokeStyle = line
    g.lineWidth = 3
    g.strokeRect(1.5, 1.5, s - 3, s - 3)
    if (glow) {
      g.strokeStyle = glow
      g.shadowColor = glow
      g.shadowBlur = 8
      g.lineWidth = 2
      g.beginPath()
      g.moveTo(s / 2, 0)
      g.lineTo(s / 2, s)
      g.stroke()
    }
  })
}

export function gridTexture(line: string, bg: string) {
  return makeTexture(`grid-${line}-${bg}`, 256, (g, s) => {
    g.fillStyle = bg
    g.fillRect(0, 0, s, s)
    g.strokeStyle = line
    g.shadowColor = line
    g.shadowBlur = 10
    g.lineWidth = 3
    g.strokeRect(0, 0, s, s)
  })
}

export function checker() {
  return makeTexture('checker', 128, (g, s) => {
    const n = 8
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        g.fillStyle = (x + y) % 2 ? '#111' : '#f5f5f5'
        g.fillRect((x * s) / n, (y * s) / n, s / n, s / n)
      }
  })
}

/** Vertical sky gradient for scene.background. */
export function skyGradient(stops: [number, string][]) {
  const c = document.createElement('canvas')
  c.width = 4
  c.height = 512
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 0, 512)
  for (const [o, col] of stops) grad.addColorStop(o, col)
  g.fillStyle = grad
  g.fillRect(0, 0, 4, 512)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.mapping = THREE.EquirectangularReflectionMapping
  return t
}
