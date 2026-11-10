import * as THREE from 'three'

const COUNT = 260

/** Instanced confetti burst used for the winner celebration. */
export class Confetti {
  readonly mesh: THREE.InstancedMesh
  private vel = new Float32Array(COUNT * 3)
  private pos = new Float32Array(COUNT * 3)
  private rot = new Float32Array(COUNT * 3)
  private age = Infinity
  private dummy = new THREE.Object3D()

  constructor(colors: string[]) {
    const geo = new THREE.PlaneGeometry(0.12, 0.2)
    const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false })
    this.mesh = new THREE.InstancedMesh(geo, mat, COUNT)
    this.mesh.frustumCulled = false
    const c = new THREE.Color()
    for (let i = 0; i < COUNT; i++) this.mesh.setColorAt(i, c.set(colors[i % colors.length]))
    this.mesh.visible = false
  }

  burst(at: THREE.Vector3, up = new THREE.Vector3(0, 1, 0)) {
    this.age = 0
    this.mesh.visible = true
    for (let i = 0; i < COUNT; i++) {
      const a = Math.random() * Math.PI * 2
      const sp = 2 + Math.random() * 5
      this.pos.set([at.x, at.y + 0.5, at.z], i * 3)
      this.vel.set([Math.cos(a) * sp * 0.6 + up.x, 5 + Math.random() * 6, Math.sin(a) * sp * 0.6 + up.z], i * 3)
      this.rot.set([Math.random() * 6, Math.random() * 6, Math.random() * 6], i * 3)
    }
  }

  update(dt: number) {
    if (!this.mesh.visible) return
    this.age += dt
    if (this.age > 5) {
      this.mesh.visible = false
      return
    }
    for (let i = 0; i < COUNT; i++) {
      const j = i * 3
      this.vel[j + 1] -= 9 * dt
      // flutter drag
      this.vel[j] *= 0.985
      this.vel[j + 2] *= 0.985
      if (this.vel[j + 1] < -1.6) this.vel[j + 1] = -1.6
      this.pos[j] += this.vel[j] * dt
      this.pos[j + 1] += this.vel[j + 1] * dt
      this.pos[j + 2] += this.vel[j + 2] * dt
      this.rot[j] += dt * 5
      this.rot[j + 1] += dt * 3
      this.dummy.position.set(this.pos[j], this.pos[j + 1], this.pos[j + 2])
      this.dummy.rotation.set(this.rot[j], this.rot[j + 1], this.rot[j + 2])
      this.dummy.scale.setScalar(this.age > 4 ? Math.max(0.01, 5 - this.age) : 1)
      this.dummy.updateMatrix()
      this.mesh.setMatrixAt(i, this.dummy.matrix)
    }
    this.mesh.instanceMatrix.needsUpdate = true
  }
}
