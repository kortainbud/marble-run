import { Clapperboard, Home, RotateCcw, Settings2, Flame, Trophy } from 'lucide-react'
import { useGame } from '../../store/useGameStore'
import { getEnv } from '../../environments/registry'
import { CompetitorImg, MarbleDot } from '../ui/MarbleImg'
import { formatTime } from '../../utils/random'

export function Results({ onReplay }: { onReplay: () => void }) {
  const { result, raceAgain, go, stats } = useGame()
  if (!result) return null
  const byId = new Map(result.competitors.map((c) => [c.id, c]))
  const podium = result.order.slice(0, 3).map((id) => byId.get(id)!)
  const pick = result.predictionId ? byId.get(result.predictionId) : null
  const pickPlace = result.predictionId ? result.order.indexOf(result.predictionId) + 1 : 0
  const finishers = result.order.filter((id) => result.times[id] != null).length

  const slot = (i: number, cls: string) => {
    const c = podium[i]
    if (!c) return <div className={`p ${cls}`} />
    return (
      <div className={`p ${cls}`}>
        <CompetitorImg c={c} size={i === 0 ? 104 : 76} />
        <div className="nm">{c.name}{c.isPlayer && c.name !== 'You' ? ' (you)' : ''}</div>
        <div className="tm">{formatTime(result.times[c.id])}</div>
        <div className="step">{i + 1}</div>
      </div>
    )
  }

  return (
    <div className="results" role="dialog" aria-label="Race results">
      <div className="panel results-card">
        <div>
          <h2>Race results</h2>
          <p className="meta">
            {getEnv(result.environment).name} · {result.count} marbles · winning time <b>{formatTime(result.times[result.order[0]])}</b>
            {finishers < result.count ? ` · ${result.count - finishers} DNF` : ''}
          </p>
          <div className="podium">
            {slot(1, 'second')}
            {slot(0, 'first')}
            {slot(2, 'third')}
          </div>
          {pick ? (
            <div className={`verdict ${result.predictionCorrect ? 'win' : 'lose'}`}>
              <span className="big">{result.predictionCorrect ? '+1' : '0'}</span>
              <div>
                {result.predictionCorrect ? `You called it — ${pick.name} won!` : `${pick.name} finished ${pickPlace ? ordinal(pickPlace) : 'out of the running'}.`}
                <small>
                  <Trophy size={12} /> {stats.points} pts · <Flame size={12} /> streak {stats.streak} · best {stats.bestStreak}
                </small>
              </div>
            </div>
          ) : (
            <div className="verdict none">No prediction this race.</div>
          )}
          <div className="results-actions">
            <button className="btn btn-primary" onClick={raceAgain}><RotateCcw size={20} /> RACE AGAIN</button>
            <button className="btn" onClick={onReplay}><Clapperboard size={18} /> Watch replay</button>
            <button className="btn btn-ghost" onClick={() => go('setup')}><Settings2 size={18} /> New race</button>
            <button className="btn btn-ghost" onClick={() => go('home')} aria-label="Home"><Home size={18} /></button>
          </div>
        </div>
        <div>
          <h3 className="section-title">Finishing order</h3>
          <div className="full-order">
            {result.order.map((id, i) => {
              const c = byId.get(id)!
              return (
                <div key={id} className={`row ${c.isPlayer ? 'me' : ''}`}>
                  <span className="pos">{i + 1}</span>
                  <MarbleDot app={c.appearance} size={18} />
                  <span>{c.name}{id === result.predictionId ? ' ★' : ''}</span>
                  <span className="tm">{result.times[id] != null ? formatTime(result.times[id]) : 'DNF'}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}
