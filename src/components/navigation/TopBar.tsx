import { ArrowLeft, Flame, Trophy, Volume2, VolumeX } from 'lucide-react'
import { useGame } from '../../store/useGameStore'

export function TopBar({ back }: { back?: () => void }) {
  const { stats, muted, toggleMute, go } = useGame()
  return (
    <header className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {back && (
          <button className="icon-btn" onClick={back} aria-label="Back">
            <ArrowLeft size={20} />
          </button>
        )}
        <button className="logo" onClick={() => go('home')} aria-label="Marble Run home">
          <span className="logo-mark" />
          <span className="logo-text">MARBLE RUN</span>
        </button>
      </div>
      <div className="topbar-right">
        <span className="chip" title="Prediction points">
          <Trophy size={14} color="var(--yellow)" /> <b>{stats.points}</b> pts
        </span>
        <span className="chip" title="Current prediction streak">
          <Flame size={14} color="var(--orange)" /> <b>{stats.streak}</b>
        </span>
        <button className="icon-btn" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'} aria-pressed={muted}>
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      </div>
    </header>
  )
}
