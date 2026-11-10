import { useMemo } from 'react'
import type { Competitor, MarbleAppearance } from '../../types'
import { marbleThumb } from '../../game/rendering/previews'
import { marbleCss } from '../../game/marbles/skins'

/** Real 3D-rendered marble thumbnail (cached). */
export function MarbleImg({ app, number = 0, size = 64, alt = '' }: { app: MarbleAppearance; number?: number; size?: number; alt?: string }) {
  const src = useMemo(() => marbleThumb(app, number, size * 2), [app, number, size])
  return <img src={src} width={size} height={size} alt={alt} draggable={false} />
}

export function CompetitorImg({ c, size = 64 }: { c: Competitor; size?: number }) {
  return <MarbleImg app={c.appearance} number={c.number} size={size} alt={c.name} />
}

/** Cheap CSS dot for dense lists. */
export function MarbleDot({ app, size = 14 }: { app: MarbleAppearance; size?: number }) {
  return <span className="dot" style={{ background: marbleCss(app), width: size, height: size }} aria-hidden />
}
