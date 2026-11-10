import { Lock, Play, Shuffle, Sparkles, Check, X } from 'lucide-react'
import { useGame } from '../../store/useGameStore'
import { ENVIRONMENTS, getEnv } from '../../environments/registry'
import { ROSTER } from '../../game/marbles/roster'
import { TopBar } from '../navigation/TopBar'
import { CompetitorImg, MarbleDot, MarbleImg } from '../ui/MarbleImg'
import { EnvImage } from '../ui/EnvImage'
import { formatTime } from '../../utils/random'

const HERO_MARBLES = [ROSTER[0], ROSTER[3], ROSTER[2], ROSTER[4], ROSTER[7], ROSTER[5], ROSTER[8]]

export function HomeScreen() {
  const { go, quickRace, setEnvironment, player, stats, recent, openGarage } = useGame()
  return (
    <div className="page">
      <div className="page-bg" />
      <div className="wrap">
        <TopBar />

        <section className="hero">
          <div>
            <h1>
              Set up the race.<br />
              <span className="l2">Drop the marbles.</span><br />
              <span className="l3">Let physics decide.</span>
            </h1>
            <p>Pick a track, line up to 20 marbles, call your winner and watch real physics play out — every race is different.</p>
            <div className="hero-ctas">
              <button className="btn btn-primary" onClick={() => go('setup')}>
                <Play size={22} fill="currentColor" /> START RACING
              </button>
              <button className="btn btn-pink" onClick={quickRace}>
                <Shuffle size={20} /> QUICK RACE
              </button>
            </div>
          </div>
          <div className="hero-art">
            <EnvImage id="neon" className="bg" />
            <span className="chip hero-badge"><Sparkles size={14} color="var(--cyan)" /> Real-time 3D physics</span>
            <div className="hero-marbles">
              {HERO_MARBLES.map((m, i) => (
                <span key={m.id} style={{ animationDelay: `${i * 0.18}s` }}>
                  <MarbleImg app={m.appearance} number={m.number} size={64} alt={m.name} />
                </span>
              ))}
            </div>
          </div>
        </section>

        <h2 className="section-title">Environments</h2>
        <div className="env-row">
          {ENVIRONMENTS.map((e) => (
            <button
              key={e.id}
              className={`env-card ${e.playable ? '' : 'locked'}`}
              disabled={!e.playable}
              onClick={() => {
                setEnvironment(e.id)
                go('setup')
              }}
              aria-label={e.playable ? `Race on ${e.name}` : `${e.name} — coming soon`}
            >
              {e.playable ? (
                <EnvImage id={e.id} />
              ) : (
                <div className="art" style={{ background: `radial-gradient(circle at 30% 20%, ${e.ui.accent}55, transparent 50%), linear-gradient(160deg, ${e.ui.from}, ${e.ui.to})` }} />
              )}
              <div className="shade" />
              <span className="chip tag">
                {e.playable ? <><Play size={12} fill="currentColor" /> Playable</> : <><Lock size={12} /> Coming soon</>}
              </span>
              <div className="body">
                <h3>{e.name}</h3>
                <p>{e.tagline}</p>
              </div>
            </button>
          ))}
        </div>

        <div className="home-grid">
          <div className="panel card">
            <h2 className="section-title">Your marble</h2>
            <div className="me">
              <CompetitorImg c={player} size={96} />
              <div>
                <h3>{player.name}</h3>
                <p>#{player.number} · {player.appearance.skin[0].toUpperCase() + player.appearance.skin.slice(1)} skin</p>
                <button className="btn btn-sm" onClick={() => openGarage('home')}>Customise</button>
              </div>
            </div>
            <div className="stat-row">
              <div className="stat"><b>{stats.points}</b><span>Points</span></div>
              <div className="stat"><b>{stats.streak}</b><span>Streak</span></div>
              <div className="stat"><b>{stats.bestStreak}</b><span>Best</span></div>
              <div className="stat"><b>{stats.races}</b><span>Races</span></div>
            </div>
          </div>

          <div className="panel card">
            <h2 className="section-title">Recent races</h2>
            {recent.length === 0 ? (
              <div className="empty">No races yet — hit <b>Quick Race</b> and you’ll be watching marbles in seconds.</div>
            ) : (
              <div className="recent">
                {recent.slice(0, 5).map((r) => {
                  const winner = r.competitors.find((c) => c.id === r.order[0])
                  const pick = r.competitors.find((c) => c.id === r.predictionId)
                  return (
                    <div className="recent-item" key={r.id}>
                      {winner && <MarbleDot app={winner.appearance} size={28} />}
                      <div>
                        <span className="who">{winner?.name ?? '—'}</span> won · {formatTime(r.times[r.order[0]])}
                        <small>{getEnv(r.environment).name} · {r.count} marbles · {new Date(r.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}{pick ? ` · picked ${pick.name}` : ''}</small>
                      </div>
                      {r.predictionCorrect == null ? null : r.predictionCorrect ? (
                        <Check className="ok" size={20} aria-label="Prediction correct" />
                      ) : (
                        <X className="miss" size={20} aria-label="Prediction missed" />
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
