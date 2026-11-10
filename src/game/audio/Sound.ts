/**
 * Tiny synthesized sound kit (Web Audio API) — no audio files to load.
 * All sounds are rate-limited so 20 marbles never turn into noise.
 */
class SoundKit {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private rumble: { osc: AudioBufferSourceNode; gain: GainNode; filter: BiquadFilterNode } | null = null
  private lastClick = 0
  private clicksThisWindow = 0
  muted = false

  private ensure() {
    if (this.ctx) return this.ctx
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    this.ctx = new AC()
    this.master = this.ctx.createGain()
    this.master.gain.value = this.muted ? 0 : 0.7
    this.master.connect(this.ctx.destination)
    return this.ctx
  }

  /** Must be called from a user gesture at least once (autoplay policy). */
  unlock() {
    const ctx = this.ensure()
    if (ctx && ctx.state === 'suspended') void ctx.resume()
  }

  setMuted(m: boolean) {
    this.muted = m
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.7, this.ctx.currentTime, 0.02)
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number) {
    const ctx = this.ensure()
    if (!ctx || !this.master || this.muted) return
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, t)
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g).connect(this.master)
    o.start(t)
    o.stop(t + dur + 0.02)
  }

  private noise(dur: number, vol: number, freq: number, q = 1) {
    const ctx = this.ensure()
    if (!ctx || !this.master || this.muted) return
    const len = Math.floor(ctx.sampleRate * dur)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2
    const src = ctx.createBufferSource()
    src.buffer = buf
    const f = ctx.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.value = freq
    f.Q.value = q
    const g = ctx.createGain()
    g.gain.value = vol
    src.connect(f).connect(g).connect(this.master)
    src.start()
  }

  countdown(n: number) {
    if (n > 0) this.tone(660, 0.18, 'square', 0.12)
    else this.tone(1320, 0.45, 'square', 0.14)
  }

  gate() {
    this.noise(0.25, 0.5, 300, 0.8)
    this.tone(120, 0.25, 'triangle', 0.25, 60)
  }

  /** marble clack; strength 0..1 */
  click(strength: number) {
    const ctx = this.ensure()
    if (!ctx) return
    const now = performance.now()
    if (now - this.lastClick > 60) this.clicksThisWindow = 0
    if (this.clicksThisWindow > 2) return
    this.clicksThisWindow++
    this.lastClick = now
    this.tone(1800 + Math.random() * 1600, 0.04 + strength * 0.03, 'sine', 0.03 + strength * 0.12)
  }

  boost() {
    this.tone(300, 0.3, 'sawtooth', 0.05, 1200)
  }
  bump() {
    this.tone(520, 0.12, 'square', 0.07, 900)
  }
  launch() {
    this.tone(200, 0.5, 'sawtooth', 0.07, 900)
    this.noise(0.4, 0.15, 1500, 0.5)
  }
  rock() {
    this.noise(0.35, 0.35, 180, 0.7)
  }
  finish(place: number) {
    if (place === 1) {
      ;[523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 0.35, 'triangle', 0.16), i * 110))
      setTimeout(() => this.noise(1.2, 0.18, 2500, 0.4), 300)
    } else if (place <= 3) {
      this.tone(784 - place * 60, 0.25, 'triangle', 0.1)
    } else {
      this.tone(600, 0.08, 'sine', 0.04)
    }
  }

  /** continuous rolling rumble whose level follows average pack speed */
  setRolling(level: number) {
    const ctx = this.ensure()
    if (!ctx || !this.master) return
    if (!this.rumble) {
      const len = ctx.sampleRate * 2
      const buf = ctx.createBuffer(1, len, ctx.sampleRate)
      const d = buf.getChannelData(0)
      let last = 0
      for (let i = 0; i < len; i++) {
        last = (last + 0.04 * (Math.random() * 2 - 1)) / 1.04
        d[i] = last * 3
      }
      const osc = ctx.createBufferSource()
      osc.buffer = buf
      osc.loop = true
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 400
      const gain = ctx.createGain()
      gain.gain.value = 0
      osc.connect(filter).connect(gain).connect(this.master)
      osc.start()
      this.rumble = { osc, gain, filter }
    }
    const v = Math.max(0, Math.min(1, level))
    this.rumble.gain.gain.setTargetAtTime(v * 0.35, ctx.currentTime, 0.1)
    this.rumble.filter.frequency.setTargetAtTime(250 + v * 700, ctx.currentTime, 0.1)
  }
}

export const sound = new SoundKit()
