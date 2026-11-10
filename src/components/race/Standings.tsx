import { Star } from 'lucide-react'
import { useGame } from '../../store/useGameStore'
import { MarbleDot } from '../ui/MarbleImg'
import { formatTime } from '../../utils/random'

export function Standings({ onPick, focusId }: { onPick: (id: string) => void; focusId: string | null }) {
  const standings = useGame((s) => s.standings)
  const field = useGame((s) => s.field)
  const predictionId = useGame((s) => s.predictionId)
  const byId = new Map(field.map((c) => [c.id, c]))
  const rows = standings.length ? standings : field.map((c) => ({ id: c.id, progress: 0, finished: false, finishTime: null, dnf: false }))
  const lead = rows[0]
  return (
    <div className="standings" aria-label="Live standings">
      <div className="hdr"><span>Standings</span><span>tap to follow</span></div>
      <ol>
        {rows.map((r, i) => {
          const c = byId.get(r.id)
          if (!c) return null
          const pct = lead && !r.finished ? Math.round((lead.progress - r.progress) * 100) : 0
          const gap = pct >= 1 ? `-${pct}%` : ''
          return (
            <li key={r.id} className={`${c.isPlayer ? 'me' : ''} ${predictionId === r.id ? 'pred' : ''}`} style={focusId === r.id ? { outline: '1px solid var(--cyan)' } : undefined}>
              <span className="pos">{i + 1}</span>
              <MarbleDot app={c.appearance} size={16} />
              <button className="nm" onClick={() => onPick(r.id)} title={`Follow ${c.name}`}>
                {c.name}
                {predictionId === r.id && <Star size={11} fill="var(--yellow)" color="var(--yellow)" style={{ marginLeft: 5, verticalAlign: -1 }} />}
              </button>
              <span className="tm">{r.finished ? formatTime(r.finishTime) : r.dnf ? 'DNF' : i === 0 ? '' : gap}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
