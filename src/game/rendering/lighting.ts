import * as THREE from 'three'

/** Directional key light whose shadow frustum is fitted to the track bounds. */
export function addSun(scene: THREE.Scene, bounds: THREE.Box3, dir: THREE.Vector3, color: string, intensity: number, mapSize = 2048) {
  const sun = new THREE.DirectionalLight(color, intensity)
  const center = bounds.getCenter(new THREE.Vector3())
  const size = bounds.getSize(new THREE.Vector3())
  const radius = size.length() / 2 + 4
  sun.position.copy(center).addScaledVector(dir.clone().normalize(), radius * 1.5)
  sun.target.position.copy(center)
  sun.castShadow = true
  sun.shadow.mapSize.set(mapSize, mapSize)
  const cam = sun.shadow.camera
  cam.left = -radius
  cam.right = radius
  cam.top = radius
  cam.bottom = -radius
  cam.near = 1
  cam.far = radius * 3.2
  sun.shadow.bias = -0.0004
  sun.shadow.normalBias = 0.03
  scene.add(sun, sun.target)
  return sun
}
