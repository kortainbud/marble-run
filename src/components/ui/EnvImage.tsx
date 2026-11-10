import { useEffect, useState } from 'react'
import type { EnvironmentId } from '../../types'
import { environmentPreview } from '../../game/rendering/previews'
import { getEnv } from '../../environments/registry'

const ready = new Map<string, string | null>()

/** 3D-rendered environment preview, generated off the critical path. */
export function EnvImage({ id, className }: { id: EnvironmentId; className?: string }) {
  const [src, setSrc] = useState<string | null>(ready.get(id) ?? null)
  useEffect(() => {
    if (ready.has(id)) return
    const h = window.setTimeout(() => {
      const url = environmentPreview(id)
      ready.set(id, url)
      setSrc(url)
    }, 30)
    return () => window.clearTimeout(h)
  }, [id])
  const def = getEnv(id)
  if (!src) return <div className={className} style={{ position: 'absolute', inset: 0, background: `linear-gradient(160deg, ${def.ui.from}, ${def.ui.to})` }} />
  return <img className={className} src={src} alt="" draggable={false} />
}
