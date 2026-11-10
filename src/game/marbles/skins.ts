import * as THREE from 'three'
import type { MarbleAppearance } from '../../types'
import { createRng } from '../../utils/random'

/**
 * Marble skins. Each skin only produces Three.js visuals — the physics body for
 * every marble is identical (see MARBLE in game/physics/constants.ts).
 */

export const MARBLE_RADIUS = 0.28

const sphereGeo = new THREE.SphereGeometry(MARBLE_RADIUS, 40, 28)
const facetGeo = new THREE.IcosahedronGeometry(MARBLE_RADIUS * 1.04, 1)
const coreGeo = new THREE.SphereGeometry(MARBLE_RADIUS * 0.55, 20, 14)
coreGeo.scale(1, 0.22, 1)

const texCache = new Map<string, THREE.Texture>()

function hash(str: string) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619)
  return h >>> 0
}

function canvasTex(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const hit = texCache.get(key)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  draw(ctx)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  texCache.set(key, t)
  return t
}

function numberTex(color: string, num: number) {
  return canvasTex(`num-${color}-${num}`, 512, 256, (ctx) => {
    ctx.fillStyle = color
    ctx.fillRect(0, 0, 512, 256)
    for (const cx of [128, 384]) {
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.ellipse(cx, 128, 46, 66, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#111'
      ctx.font = 'bold 64px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(num), cx, 132)
    }
  })
}

function galaxyTex(color: string, accent: string) {
  return canvasTex(`gal-${color}-${accent}`, 512, 256, (ctx) => {
    const rng = createRng(hash(color + accent))
    ctx.fillStyle = '#05030f'
    ctx.fillRect(0, 0, 512, 256)
    ctx.globalCompositeOperation = 'lighter'
    for (let i = 0; i < 26; i++) {
      const x = rng.range(0, 512)
      const y = rng.range(30, 226)
      const r = rng.range(30, 110)
      const g = ctx.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0, (i % 2 ? color : accent) + '55')
      g.addColorStop(1, '#00000000')
      ctx.fillStyle = g
      ctx.fillRect(x - r, y - r, r * 2, r * 2)
    }
    for (let i = 0; i < 260; i++) {
      const s = rng.next() < 0.08 ? 2.2 : 1
      ctx.fillStyle = `rgba(255,255,255,${rng.range(0.4, 1)})`
      ctx.fillRect(rng.range(0, 512), rng.range(0, 256), s, s)
    }
  })
}

function lavaTex(color: string, accent: string, emissive: boolean) {
  return canvasTex(`lava-${color}-${accent}-${emissive}`, 512, 256, (ctx) => {
    const rng = createRng(hash(color + accent))
    ctx.fillStyle = emissive ? '#000' : '#1d1310'
    ctx.fillRect(0, 0, 512, 256)
    // Voronoi-ish crack network: random walk polylines
    ctx.lineCap = 'round'
    for (let i = 0; i < 46; i++) {
      let x = rng.range(0, 512)
      let y = rng.range(0, 256)
      let ang = rng.range(0, Math.PI * 2)
      ctx.beginPath()
      ctx.moveTo(x, y)
      const steps = rng.int(4, 9)
      for (let s = 0; s < steps; s++) {
        ang += rng.range(-0.9, 0.9)
        x += Math.cos(ang) * 18
        y += Math.sin(ang) * 18
        ctx.lineTo(x, y)
      }
      ctx.strokeStyle = emissive ? accent : color
      ctx.lineWidth = rng.range(2, 6)
      ctx.shadowColor = color
      ctx.shadowBlur = emissive ? 14 : 4
      ctx.stroke()
    }
  })
}

function neonTex(color: string, accent: string) {
  return canvasTex(`neon-${color}-${accent}`, 256, 256, (ctx) => {
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, 256, 256)
    const bands: [number, string, number][] = [
      [128, color, 22],
      [70, accent, 8],
      [186, accent, 8],
    ]
    for (const [y, c, h] of bands) {
      ctx.fillStyle = c
      ctx.shadowColor = c
      ctx.shadowBlur = 16
      ctx.fillRect(0, y - h / 2, 256, h)
    }
  })
}

function gradientTex(color: string, accent: string) {
  return canvasTex(`grad-${color}-${accent}`, 8, 256, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 256)
    g.addColorStop(0, color)
    g.addColorStop(0.5, mix(color, accent))
    g.addColorStop(1, accent)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 8, 256)
  })
}

function mix(a: string, b: string) {
  const ca = new THREE.Color(a)
  return '#' + ca.lerp(new THREE.Color(b), 0.5).getHexString()
}

export interface MarbleVisual {
  object: THREE.Object3D
  /** materials that can be disposed (textures are cached and shared) */
  materials: THREE.Material[]
}

/** Builds the visual mesh for a marble appearance. */
export function createMarbleVisual(app: MarbleAppearance, number = 0): MarbleVisual {
  const { skin, color, accent } = app
  const group = new THREE.Group()
  const mats: THREE.Material[] = []
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material) => {
    const m = new THREE.Mesh(geo, mat)
    m.castShadow = true
    mats.push(mat)
    group.add(m)
    return m
  }

  switch (skin) {
    case 'classic':
      add(sphereGeo, new THREE.MeshPhysicalMaterial({
        map: numberTex(color, number), roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08,
      }))
      break
    case 'glass': {
      add(coreGeo, new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.25, roughness: 0.4 }))
      const core2 = add(coreGeo, new THREE.MeshStandardMaterial({ color, roughness: 0.4 }))
      core2.rotation.set(Math.PI / 2, 0, Math.PI / 3)
      const shell = add(sphereGeo, new THREE.MeshPhysicalMaterial({
        color, transparent: true, opacity: 0.32, roughness: 0.02, metalness: 0,
        clearcoat: 1, specularIntensity: 1, depthWrite: false,
      }))
      shell.castShadow = false
      shell.renderOrder = 2
      break
    }
    case 'galaxy': {
      const t = galaxyTex(color, accent)
      add(sphereGeo, new THREE.MeshPhysicalMaterial({
        map: t, emissiveMap: t, emissive: '#ffffff', emissiveIntensity: 0.55, roughness: 0.15, clearcoat: 1,
      }))
      break
    }
    case 'lava':
      add(sphereGeo, new THREE.MeshStandardMaterial({
        map: lavaTex(color, accent, false), emissiveMap: lavaTex(color, accent, true),
        emissive: '#ffffff', emissiveIntensity: 2.2, roughness: 0.85,
      }))
      break
    case 'chrome':
      add(sphereGeo, new THREE.MeshStandardMaterial({ color, metalness: 1, roughness: 0.06 }))
      break
    case 'neon': {
      const t = neonTex(color, accent)
      add(sphereGeo, new THREE.MeshStandardMaterial({
        color: '#15151c', emissiveMap: t, emissive: '#ffffff', emissiveIntensity: 2.4, roughness: 0.3, metalness: 0.4,
      }))
      break
    }
    case 'crystal':
      add(facetGeo, new THREE.MeshPhysicalMaterial({
        color, flatShading: true, roughness: 0.02, metalness: 0.15, transparent: true, opacity: 0.82,
        iridescence: 1, iridescenceIOR: 1.6, clearcoat: 1, emissive: color, emissiveIntensity: 0.12,
      }))
      break
    case 'gradient':
      add(sphereGeo, new THREE.MeshPhysicalMaterial({ map: gradientTex(color, accent), roughness: 0.22, clearcoat: 1 }))
      break
  }
  return { object: group, materials: mats }
}

/** CSS approximation of a marble, for small UI chips. */
export function marbleCss(app: MarbleAppearance): string {
  const { skin, color, accent } = app
  switch (skin) {
    case 'chrome':
      return `radial-gradient(circle at 32% 28%, #fff 0 8%, ${color} 30%, #333 75%, ${color} 100%)`
    case 'gradient':
      return `radial-gradient(circle at 32% 28%, #ffffffcc 0 6%, transparent 20%), linear-gradient(180deg, ${color}, ${accent})`
    case 'galaxy':
      return `radial-gradient(circle at 32% 28%, #ffffffaa 0 6%, transparent 20%), radial-gradient(circle at 60% 60%, ${color}aa, transparent 50%), radial-gradient(circle at 35% 65%, ${accent}99, transparent 45%), #0a0620`
    case 'lava':
      return `radial-gradient(circle at 32% 28%, #ffffff66 0 5%, transparent 18%), radial-gradient(circle at 50% 50%, ${accent} 0 10%, ${color} 30%, #2a120a 70%)`
    case 'neon':
      return `radial-gradient(circle at 32% 28%, #ffffff88 0 5%, transparent 18%), linear-gradient(180deg, #111 38%, ${color} 45% 55%, #111 62%)`
    case 'glass':
    case 'crystal':
      return `radial-gradient(circle at 32% 28%, #fff 0 7%, transparent 22%), radial-gradient(ellipse 40% 12% at 50% 50%, ${accent}, transparent), ${color}88`
    default:
      return `radial-gradient(circle at 32% 28%, #ffffffcc 0 7%, ${color} 26%, ${color} 60%, #00000066 100%)`
  }
}
