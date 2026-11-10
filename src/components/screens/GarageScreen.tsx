import { Info } from 'lucide-react'
import { useGame } from '../../store/useGameStore'
import { COLOR_SWATCHES, SKINS } from '../../game/marbles/roster'
import { TopBar } from '../navigation/TopBar'
import { MarbleImg } from '../ui/MarbleImg'
import { MarblePreview } from '../customisation/MarblePreview'

export function GarageScreen() {
  const { player, setPlayer, go, garageReturn } = useGame()
  const app = player.appearance
  const skin = SKINS.find((s) => s.id === app.skin)!
  return (
    <div className="page">
      <div className="page-bg" />
      <div className="wrap">
        <TopBar back={() => go(garageReturn)} />
        <div className="garage">
          <div className="preview-box">
            <MarblePreview app={app} number={player.number} />
            <div className="nameplate">
              <b>{player.name}</b>
              <span className="chip">#{player.number} · {skin.name}</span>
            </div>
          </div>

          <div>
            <h1 className="display" style={{ fontSize: 44, margin: '0 0 4px' }}>Your marble</h1>
            <p style={{ color: 'var(--muted)', margin: '0 0 24px' }}>{skin.blurb}</p>

            <h2 className="section-title">Skin</h2>
            <div className="skins" style={{ marginBottom: 24 }}>
              {SKINS.map((s) => (
                <button key={s.id} className="skin" aria-pressed={app.skin === s.id} onClick={() => setPlayer({ appearance: { ...app, skin: s.id } })}>
                  <MarbleImg app={{ ...app, skin: s.id }} number={player.number} size={64} />
                  {s.name}
                </button>
              ))}
            </div>

            <h2 className="section-title">Main colour</h2>
            <div className="swatches" style={{ marginBottom: 20 }}>
              {COLOR_SWATCHES.map((c) => (
                <button key={c} className="swatch" style={{ background: c }} aria-label={`Main colour ${c}`} aria-pressed={app.color === c} onClick={() => setPlayer({ appearance: { ...app, color: c } })} />
              ))}
            </div>
            <h2 className="section-title">Accent colour</h2>
            <div className="swatches" style={{ marginBottom: 24 }}>
              {COLOR_SWATCHES.map((c) => (
                <button key={c} className="swatch" style={{ background: c }} aria-label={`Accent colour ${c}`} aria-pressed={app.accent === c} onClick={() => setPlayer({ appearance: { ...app, accent: c } })} />
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 12, marginBottom: 20 }}>
              <div className="field">
                <label htmlFor="mname">Name</label>
                <input id="mname" className="input" maxLength={16} value={player.name} onChange={(e) => setPlayer({ name: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="mnum">Number</label>
                <input id="mnum" className="input" type="number" min={0} max={99} value={player.number}
                  onChange={(e) => setPlayer({ number: Math.max(0, Math.min(99, Number(e.target.value) || 0)) })} />
              </div>
            </div>
            <p className="fair-note"><Info size={16} style={{ flex: 'none', marginTop: 2 }} /> Skins are purely cosmetic. Every marble has the same size, mass, friction and bounce — races are decided by the track and physics alone.</p>
            <button className="btn btn-primary" style={{ marginTop: 18 }} onClick={() => go(garageReturn === 'home' ? 'setup' : garageReturn)}>
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
