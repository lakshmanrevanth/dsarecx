// Tiny 8-bit synth for the 404 game, built on the Web Audio API.
// Nothing plays until the player interacts, and every sound respects mute.

class RetroAudio {
  private ctx: AudioContext | null = null;
  private muted = false;

  private init(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const Ctx =
        window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx) this.ctx = new Ctx();
    }
    if (this.ctx?.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  setMuted(muted: boolean) {
    this.muted = muted;
  }

  isMuted() {
    return this.muted;
  }

  private tone(type: OscillatorType, from: number, to: number, duration: number, volume: number, linear = false) {
    if (this.muted) return;
    const ctx = this.init();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(from, now);
      if (linear) osc.frequency.linearRampToValueAtTime(to, now + duration);
      else osc.frequency.exponentialRampToValueAtTime(to, now + duration);
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + duration);
    } catch {}
  }

  /** Laser blip. */
  shoot() {
    this.tone('square', 880, 180, 0.08, 0.08);
  }

  /** Bullet hits a 404. */
  hit() {
    this.tone('square', 440, 220, 0.04, 0.07);
  }

  /** A 404 crumbles: short burst of quantised noise. */
  explode() {
    if (this.muted) return;
    const ctx = this.init();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const size = Math.floor(ctx.sampleRate * 0.14);
      const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < size; i++) {
        if (i % 6 === 0) last = Math.random() * 2 - 1;
        data[i] = last * Math.exp(-i / (ctx.sampleRate * 0.04));
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      src.connect(gain);
      gain.connect(ctx.destination);
      src.start(now);
      src.stop(now + 0.14);
    } catch {}
  }

  /** Game over buzz. */
  gameOver() {
    this.tone('sawtooth', 150, 40, 0.35, 0.16, true);
  }
}

export const retroAudio = new RetroAudio();
