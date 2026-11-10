import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import type { MarbleAppearance } from '../../types'
import { createMarbleVisual } from '../../game/marbles/skins'

/** Live, slowly rolling 3D preview of a marble skin. */
export function MarblePreview({ app, number }: { app: MarbleAppearance; number: number }) {
  const host = useRef<HTMLDivElement>(null)
  const api = useRef<{ set: (a: MarbleAppearance, n: number) => void } | null>(null)

  useEffect(() => {
    const el = host.current!
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio))
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.shadowMap.enabled = true
    el.appendChild(renderer.domElement)
    const scene = new THREE.Scene()
    const pm = new THREE.PMREMGenerator(renderer)
    const env = pm.fromScene(new RoomEnvironment(), 0.04).texture
    pm.dispose()
    scene.environment = env
    scene.add(new THREE.HemisphereLight('#c9c4ff', '#221a44', 1.1))
    const key = new THREE.DirectionalLight('#ffffff', 2.6)
    key.position.set(-2, 4, 3)
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    scene.add(key)
    const floor = new THREE.Mesh(new THREE.CircleGeometry(1.2, 48), new THREE.ShadowMaterial({ opacity: 0.45 }))
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -0.28
    floor.receiveShadow = true
    scene.add(floor)
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 20)
    cam.position.set(0, 0.55, 2.0)
    cam.lookAt(0, -0.02, 0)

    let current: { object: THREE.Object3D; materials: THREE.Material[] } | null = null
    const set = (a: MarbleAppearance, n: number) => {
      if (current) {
        scene.remove(current.object)
        current.materials.forEach((m) => m.dispose())
      }
      current = createMarbleVisual(a, n)
      scene.add(current.object)
    }
    api.current = { set }
    set(app, number)

    const resize = () => {
      const w = el.clientWidth
      renderer.setSize(w, w, false)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(el)
    let raf = 0
    let last = performance.now()
    const spin = new THREE.Quaternion()
    const axis = new THREE.Vector3(1, 0.15, 0).normalize()
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (current) {
        spin.setFromAxisAngle(axis, dt * 1.1)
        current.object.quaternion.premultiply(spin)
      }
      renderer.render(scene, cam)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      current?.materials.forEach((m) => m.dispose())
      env.dispose()
      renderer.dispose()
      el.removeChild(renderer.domElement)
      api.current = null
    }
    // mount once; appearance changes go through api.set
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    api.current?.set(app, number)
  }, [app, number])

  return <div ref={host} style={{ position: 'absolute', inset: 0 }} />
}
