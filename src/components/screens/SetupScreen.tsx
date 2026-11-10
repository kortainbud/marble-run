import { Dices, Lock, Play, Video, Crown, Crosshair, Map } from 'lucide-react'
import { useGame, type Count } from '../../store/useGameStore'
import { ENVIRONMENTS, PLAYABLE, getEnv } from '../../environments/registry'
import { TopBar } from '../navigation/TopBar'
import { CompetitorImg } from '../ui/MarbleImg'
import { EnvImage } from '../ui/EnvImage'
import type { CameraMode } from '../../types'

const COUNTS: Count[] = [4, 8, 12, 20]
export const CAMERA_MODES: { id: CameraMode; label: string; icon: typeof Video }[] = [
  { id: 'auto', label: 'Director', icon: Video },
  { id: 'leader', label: 'Leader', icon: Crown },
  { id: 'follow', label: 'Follow pick', icon: Crosshair },
  { id: 'overview', label: 'Overview', icon: Map },
]

export function SetupScreen() {
  const s = useGame()
  const env = getEnv(s.environment)
  const pick = s.field.find((c) => c.id === s.predictionId)
  return (
    <div className="page">
      <div className="page-bg" />
      <div className="wrap">
        <TopBar back={() => s.go('home')} />
        <div className="setup">
          <div>
            <h1>Race setup</h1>
            <p className="sub">Choose a track, size the field and call your winner.</p>

            <div className="setup-block">
              <h2 className="section-title">Environment</h2>
              <div className="env-pick">
                {PLAYABLE.map((e) => (
                  <button key={e.id} className="env-card" aria-pressed={s.environment === e.id} onClick={() => s.setEnvironment(e.id)}>
                    <EnvImage id={e.id} />
                    <div className="shade" />
                    <div className="body">
                      <h3>{e.name}</h3>
                      <p>{e.tagline}</p>
                      <div className="obs">{e.obstacles.slice(0, 5).map((o) => <span key={o}>{o}</span>)}</div>
                    </div>
                  </button>
                ))}
              </div>
              <div className="env-soon">
                {ENVIRONMENTS.filter((e) => !e.playable).map((e) => (
                  <div key={e.id}><b><Lock size={12} /> {e.name}</b>Coming soon</div>
                ))}
              </div>
            </div>

            <div className="setup-block">
              <h2 className="section-title">Competitors</h2>
              <div className="seg" role="group" aria-label="Number of marbles">
                {COUNTS.map((c) => (
                  <button key={c} aria-pressed={s.count === c} onClick={() => s.setCount(c)}>{c}</button>
                ))}
              </div>
            </div>

            <div className="setup-block">
              <h2 className="section-title">Your marble</h2>
              <div className="me">
                <CompetitorImg c={s.player} size={72} />
                <div>
                  <h3 style={{ margin: 0, fontFamily: 'var(--display)', fontWeight: 400, fontSize: 22 }}>{s.player.name}</h3>
                  <p style={{ margin: '2px 0 10px', color: 'var(--muted)', fontSize: 14 }}>Always on the grid. Skins are cosmetic — every marble has identical physics.</p>
                  <button className="btn btn-sm" onClick={() => s.openGarage('setup')}>Customise</button>
                </div>
              </div>
            </div>

            <div className="setup-block">
              <h2 className="section-title">Camera</h2>
              <div className="seg" role="group" aria-label="Camera mode">
                {CAMERA_MODES.map((m) => (
                  <button key={m.id} aria-pressed={s.cameraMode === m.id} onClick={() => s.setCameraMode(m.id)} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <m.icon size={15} /> {m.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <aside className="panel side">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 className="section-title" style={{ margin: 0 }}>Predict the winner</h2>
              <button className="btn btn-sm btn-ghost" onClick={s.shuffleField} title="Draw a different field of opponents">
                <Dices size={15} /> New field
              </button>
            </div>
            <div className="predict-grid" role="radiogroup" aria-label="Predicted winner">
              {s.field.map((c) => (
                <button key={c.id} className="pick" role="radio" aria-checked={s.predictionId === c.id} aria-pressed={s.predictionId === c.id} onClick={() => s.setPrediction(c.id)}>
                  {c.isPlayer && <span className="you">YOU</span>}
                  <CompetitorImg c={c} size={54} />
                  <span>{c.name}</span>
                </button>
              ))}
            </div>
            <p className="fair-note" style={{ marginTop: 14 }}>
              Correct pick = 1 point. Consecutive hits build your streak. Your pick locks when the gate drops.
            </p>
          </aside>
        </div>
      </div>

      <div className="startbar">
        <div className="wrap">
          <div className="summary">
            <b>{env.name}</b> · {s.count} marbles · picking <b>{pick?.name ?? 'nobody'}</b>
          </div>
          <button className="btn btn-primary" onClick={s.startRace}>
            <Play size={22} fill="currentColor" /> START RACE
          </button>
        </div>
      </div>
    </div>
  )
}
