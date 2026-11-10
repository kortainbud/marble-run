import { useCallback, useEffect, useRef, useState } from 'react'
import { Pause, Play, RotateCcw, Volume2, VolumeX, X, FastForward } from 'lucide-react'
import { useGame } from '../../store/useGameStore'
import { GameEngine } from '../../game/engine/GameEngine'
import { getEnv } from '../../environments/registry'
import { CAMERA_MODES } from '../screens/SetupScreen'
import { Standings } from './Standings'
import { ProgressBar } from './ProgressBar'
import { Results } from './Results'
import { formatTime } from '../../utils/random'

export function RaceScreen() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const playerTag = useRef<HTMLDivElement>(null)
  const focusTag = useRef<HTMLDivElement>(null)
  const engineRef = useRef<GameEngine | null>(null)
  const [paused, setPaused] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [loading, setLoading] = useState(true)
  const [replaySpeed, setReplaySpeed] = useState(1)
  const [followId, setFollowId] = useState<string | null>(null)

  const g = useGame()
  const env = getEnv(g.environment)

  // engine lifetime
  useEffect(() => {
    const engine = new GameEngine(canvasRef.current!, {
      onCountdown: (n) => useGame.getState().setLive({ countdown: n }),
      onPhase: (p) => {
        useGame.getState().setLive({ phase: p })
        if (p === 'COUNTDOWN') setLoading(false)
      },
      onSnapshot: ({ raceTime, standings }) => useGame.getState().setLive({ raceTime, standings }),
      onFirstFinish: (id) => useGame.getState().setLive({ firstFinishId: id }),
      onEnd: (o) => {
        const st = useGame.getState()
        st.recordResult({
          id: `${Date.now()}`,
          date: Date.now(),
          environment: st.environment,
          count: st.field.length,
          order: o.order,
          times: o.times,
          competitors: st.field,
          predictionId: st.predictionId,
          duration: o.duration,
        })
        window.setTimeout(() => setShowResults(true), 1400)
      },
      onReplayProgress: (t, d) => useGame.getState().setLive({ replayProgress: d > 0 ? t / d : 0 }),
      onReplayEnd: () => {
        window.setTimeout(() => {
          engineRef.current?.stopReplay()
          useGame.getState().setLive({ replaying: false })
          setShowResults(true)
        }, 1500)
      },
    })
    engine.setTags({ player: playerTag.current, focus: focusTag.current })
    engineRef.current = engine
    return () => {
      engine.dispose()
      engineRef.current = null
    }
  }, [])

  // (re)start whenever a new race is requested
  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return
    const st = useGame.getState()
    setShowResults(false)
    setPaused(false)
    setLoading(true)
    setFollowId(null)
    engine.setCameraMode(st.cameraMode)
    engine.setFollow(st.predictionId ?? 'player')
    void engine.startRace(
      { environment: st.environment, count: st.count, predictionId: st.predictionId, seed: st.raceSeed },
      st.field,
    )
  }, [g.raceNonce])

  useEffect(() => {
    engineRef.current?.setCameraMode(g.cameraMode)
  }, [g.cameraMode])

  useEffect(() => {
    engineRef.current?.setFollow(followId ?? g.predictionId ?? 'player')
  }, [followId, g.predictionId])

  useEffect(() => {
    engineRef.current?.setPaused(paused)
  }, [paused])

  // countdown "GO" auto-clears
  useEffect(() => {
    if (g.countdown !== 0) return
    const h = window.setTimeout(() => useGame.getState().setLive({ countdown: null }), 900)
    return () => window.clearTimeout(h)
  }, [g.countdown])

  const cycleCamera = useCallback(() => {
    const i = CAMERA_MODES.findIndex((m) => m.id === useGame.getState().cameraMode)
    useGame.getState().setCameraMode(CAMERA_MODES[(i + 1) % CAMERA_MODES.length].id)
  }, [])

  const startReplay = () => {
    setShowResults(false)
    useGame.getState().setLive({ replaying: true, replayProgress: 0, firstFinishId: null })
    engineRef.current?.startReplay(replaySpeed)
  }
  const exitReplay = () => {
    engineRef.current?.stopReplay()
    useGame.getState().setLive({ replaying: false })
    setShowResults(true)
  }

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      const st = useGame.getState()
      if ((e.key === ' ' || e.key === 'Escape') && st.phase !== 'FINISHED' && !st.replaying) {
        e.preventDefault()
        setPaused((p) => !p)
      } else if (e.key === 'c' || e.key === 'C') cycleCamera()
      else if (e.key === 'm' || e.key === 'M') st.toggleMute()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cycleCamera])

  const focusMarble = (id: string) => {
    setFollowId(id)
    g.setCameraMode('follow')
  }

  const winner = g.field.find((c) => c.id === g.firstFinishId)
  const racing = g.phase === 'RACING'

  return (
    <div className="race">
      <canvas ref={canvasRef} />
      <div ref={playerTag} className="tag player" />
      <div ref={focusTag} className="tag" />

      {loading && (
        <div className="loading">
          <div>
            <div className="spin" />
            Building {env.name}…
          </div>
        </div>
      )}

      <div className="hud-top">
        <div className="timer">
          <span className="t">{formatTime(g.raceTime).replace('s', '')}</span>
          <div className="meta">
            <b>{env.name}</b>
            {g.field.length} marbles{g.replaying ? ' · replay' : ''}
          </div>
        </div>
        <div className="hud-buttons">
          <div className="cam-seg" role="group" aria-label="Camera">
            {CAMERA_MODES.map((m) => (
              <button key={m.id} aria-pressed={g.cameraMode === m.id} onClick={() => g.setCameraMode(m.id)} title={`${m.label} camera (C)`}>
                <m.icon size={15} /> <span>{m.label}</span>
              </button>
            ))}
          </div>
          {!g.replaying && g.phase !== 'FINISHED' && (
            <button className="icon-btn" onClick={() => setPaused((p) => !p)} aria-label={paused ? 'Resume' : 'Pause'} title="Pause (Space)">
              {paused ? <Play size={18} /> : <Pause size={18} />}
            </button>
          )}
          <button className="icon-btn" onClick={g.raceAgain} aria-label="Restart race" title="Restart">
            <RotateCcw size={18} />
          </button>
          <button className="icon-btn" onClick={g.toggleMute} aria-label={g.muted ? 'Unmute' : 'Mute'} aria-pressed={g.muted} title="Mute (M)">
            {g.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <button className="icon-btn" onClick={() => g.go('setup')} aria-label="Exit race" title="Exit">
            <X size={18} />
          </button>
        </div>
      </div>

      {!loading && <Standings onPick={focusMarble} focusId={g.cameraMode === 'follow' ? (followId ?? g.predictionId) : null} />}

      {g.replaying ? (
        <div className="replay-bar">
          <span className="rec">REPLAY</span>
          <div className="track"><i style={{ width: `${g.replayProgress * 100}%` }} /></div>
          {[0.5, 1, 2].map((s) => (
            <button key={s} className="btn btn-sm" style={replaySpeed === s ? { background: 'var(--text)', color: 'var(--bg)' } : undefined}
              onClick={() => { setReplaySpeed(s); engineRef.current?.setReplaySpeed(s) }}>
              {s}×
            </button>
          ))}
          <button className="btn btn-sm" onClick={exitReplay}>Exit</button>
        </div>
      ) : (
        !loading && !showResults && <ProgressBar />
      )}

      {g.countdown != null && (
        <div className="countdown" aria-live="assertive">
          <span key={g.countdown} className={g.countdown === 0 ? 'go' : ''}>{g.countdown === 0 ? 'GO!' : g.countdown}</span>
        </div>
      )}

      {g.phase === 'COUNTDOWN' && !loading && g.predictionId && (
        <div className="prestart">
          <span className="chip">Your pick: <b>{g.field.find((c) => c.id === g.predictionId)?.name}</b> 🔒</span>
        </div>
      )}

      {winner && !showResults && (
        <div className="banner" key={`${winner.id}-${g.replaying}`}>
          <small>WINNER</small>
          <b>{winner.name}</b>
        </div>
      )}

      {racing && g.firstFinishId && !g.replaying && (
        <button className="btn btn-sm" style={{ position: 'absolute', right: 14, bottom: 100, zIndex: 4 }} onClick={() => engineRef.current?.skipToResults()}>
          <FastForward size={15} /> Skip to results
        </button>
      )}

      {paused && (
        <div className="paused">
          <div className="panel">
            <h2>Paused</h2>
            <div className="col">
              <button className="btn btn-primary" onClick={() => setPaused(false)}><Play size={20} fill="currentColor" /> RESUME</button>
              <button className="btn" onClick={g.raceAgain}><RotateCcw size={18} /> Restart race</button>
              <button className="btn btn-ghost" onClick={() => g.go('setup')}>Change setup</button>
            </div>
          </div>
        </div>
      )}

      {showResults && g.result && <Results onReplay={startReplay} />}
    </div>
  )
}
