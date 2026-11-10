import { useGame } from '../../store/useGameStore'
import { marbleCss } from '../../game/marbles/skins'

/** Race progress strip: one dot per marble along start → finish. */
export function ProgressBar() {
  const standings = useGame((s) => s.standings)
  const field = useGame((s) => s.field)
  const byId = new Map(field.map((c) => [c.id, c]))
  // draw the player last so it sits on top
  const sorted = [...standings].sort((a, b) => Number(byId.get(a.id)?.isPlayer) - Number(byId.get(b.id)?.isPlayer))
  return (
    <div className="progress" aria-hidden>
      <div className="bar">
        {sorted.map((s) => {
          const c = byId.get(s.id)
          if (!c) return null
          return <span key={s.id} className={`m ${c.isPlayer ? 'me' : ''}`} style={{ left: `${s.progress * 100}%`, background: marbleCss(c.appearance) }} />
        })}
        <span className="flag">🏁</span>
      </div>
      <div className="lbl"><span>Start</span><span>Finish</span></div>
    </div>
  )
}
