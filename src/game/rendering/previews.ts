import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import type { EnvironmentId, MarbleAppearance } from '../../types'
import { getEnv } from '../../environments/registry'
import { createMarbleVisual } from '../marbles/skins'

/**
 * One shared offscreen renderer that produces still images: environment
 * preview cards and marble thumbnails. Results are cached as data URLs.
 */
let renderer: THREE.WebGLRenderer | null = null
let envTex: THREE.Texture | null = null
const cache = new Map<string, string>()

function getRenderer() {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    const pm = new THREE.PMREMGenerator(renderer)
    envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture
    pm.dispose()
  }
  return renderer
}

function disposeScene(scene: THREE.Scene) {
  scene.traverse((o) => {
    const m = o as THREE.Mesh
    m.geometry?.dispose()
    const mat = m.material as THREE.Material | THREE.Material[] | undefined
    if (mat) (Array.isArray(mat) ? mat : [mat]).forEach((x) => x.dispose())
  })
}

export function environmentPreview(id: EnvironmentId, w = 640, h = 380): string | null {
  const key = `env-${id}-${w}x${h}`
  const hit = cache.get(key)
  if (hit) return hit
  const def = getEnv(id)
  if (!def.build) return null
  const r = getRenderer()
  r.setPixelRatio(1)
  r.setSize(w, h, false)
  const scene = new THREE.Scene()
  scene.environment = envTex
  scene.environmentIntensity = id === 'neon' ? 0.45 : 0.7
  const built = def.build({ scene, rapier: null, world: null, emit: () => {}, track: () => {} })
  for (const o of built.obstacles) o.preStep?.(1.3, 0)
  for (const o of built.obstacles) o.frame?.(1.3, 0)
  r.toneMappingExposure = built.exposure
  const b = built.builder
  const center = b.bounds.getCenter(new THREE.Vector3())
  const size = b.bounds.getSize(new THREE.Vector3())
  const cam = new THREE.PerspectiveCamera(42, w / h, 0.5, 800)
  const radius = Math.max(size.x, size.z) * 0.55 + 8
  cam.position.set(center.x + radius * 0.75, center.y + radius * 0.62, center.z - radius * 0.9)
  cam.lookAt(center.x, center.y - 2, center.z)
  r.render(scene, cam)
  const url = r.domElement.toDataURL('image/jpeg', 0.86)
  disposeScene(scene)
  cache.set(key, url)
  return url
}

export function marbleThumb(app: MarbleAppearance, number: number, size = 160): string {
  const key = `m-${app.skin}-${app.color}-${app.accent}-${number}-${size}`
  const hit = cache.get(key)
  if (hit) return hit
  const r = getRenderer()
  r.setPixelRatio(1)
  r.setSize(size, size, false)
  r.toneMappingExposure = 1.1
  const scene = new THREE.Scene()
  scene.environment = envTex
  scene.environmentIntensity = 0.9
  scene.add(new THREE.HemisphereLight('#ffffff', '#445', 1.2))
  const key1 = new THREE.DirectionalLight('#ffffff', 2.4)
  key1.position.set(-2, 3, 3)
  scene.add(key1)
  const vis = createMarbleVisual(app, number)
  vis.object.rotation.set(0.35, -0.6, 0)
  scene.add(vis.object)
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 10)
  cam.position.set(0, 0, 1.18)
  r.setClearColor(0x000000, 0)
  r.render(scene, cam)
  const url = r.domElement.toDataURL('image/png')
  for (const m of vis.materials) m.dispose()
  cache.set(key, url)
  return url
}
