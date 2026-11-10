import * as THREE from 'three'

/**
 * Box geometry whose UVs are scaled to world units (1 texture repeat per
 * `scale` units) so one tiling texture can be shared by every box.
 */
export function worldBoxGeometry(w: number, h: number, d: number, scale = 1) {
  const g = new THREE.BoxGeometry(w, h, d)
  const uv = g.attributes.uv as THREE.BufferAttribute
  // face order: px, nx, py, ny, pz, nz (4 verts each)
  const dims: [number, number][] = [
    [d, h], [d, h], [w, d], [w, d], [w, h], [w, h],
  ]
  for (let f = 0; f < 6; f++) {
    const [su, sv] = dims[f]
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v
      uv.setXY(i, (uv.getX(i) * su) / scale, (uv.getY(i) * sv) / scale)
    }
  }
  uv.needsUpdate = true
  return g
}

/**
 * Right-handed frame for a direction of travel: local Z = forward,
 * local Y = surface normal, local X = `side` (the traveller's left).
 */
export function frameFromForward(fwd: THREE.Vector3) {
  const f = fwd.clone().normalize()
  const side = new THREE.Vector3().crossVectors(UP_REF, f).normalize()
  const up = new THREE.Vector3().crossVectors(f, side).normalize()
  const quat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, up, f))
  return { fwd: f, side, up, quat }
}
export type Frame = ReturnType<typeof frameFromForward>
const UP_REF = new THREE.Vector3(0, 1, 0)

export const UP = new THREE.Vector3(0, 1, 0)

export function rightOf(heading: THREE.Vector3) {
  return new THREE.Vector3(-heading.z, 0, heading.x)
}
