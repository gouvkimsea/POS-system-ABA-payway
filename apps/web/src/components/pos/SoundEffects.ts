/**
 * Native Browser Web Audio API sound feedback for commercial POS terminal
 * No external audio files needed; generated dynamically with native oscillators.
 */

export interface SoundSettingsConfig {
  enabled?: boolean;
  volume?: number;
  playBeep?: boolean;
  playCashDrawer?: boolean;
  playWarning?: boolean;
  playSuccess?: boolean;
}

class PosSoundManager {
  private ctx: AudioContext | null = null;
  private settings: SoundSettingsConfig = {
    enabled: true,
    volume: 0.7,
    playBeep: true,
    playCashDrawer: true,
    playWarning: true,
    playSuccess: true,
  };

  /**
   * Dynamically configure sound effects from database settings
   */
  configure(config?: SoundSettingsConfig) {
    if (!config) return;
    this.settings = { ...this.settings, ...config };
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Crisp 1700Hz scanner barcode beep (50ms)
   */
  playBeep() {
    if (this.settings.enabled === false || this.settings.playBeep === false) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const vol = (this.settings.volume ?? 0.7) * 0.2;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1760, ctx.currentTime); // A6 note

      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch {
      // Audio autoplay policy fallback
    }
  }

  /**
   * Harmonious 2-tone cash register success chime (Payment completed)
   */
  playSuccessChime() {
    if (this.settings.enabled === false || this.settings.playSuccess === false) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const vol = (this.settings.volume ?? 0.7) * 0.18;

      // Note 1: E6 (1318 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(1318.51, now);
      gain1.gain.setValueAtTime(vol * 0.8, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.15);

      // Note 2: B6 (1975 Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1975.53, now + 0.1);
      gain2.gain.setValueAtTime(vol, now + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.1);
      osc2.stop(now + 0.35);
    } catch {
      // Audio autoplay policy fallback
    }
  }

  /**
   * Low warning buzz (out of stock, invalid barcode)
   */
  playWarningBuzz() {
    if (this.settings.enabled === false || this.settings.playWarning === false) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const vol = (this.settings.volume ?? 0.7) * 0.15;

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime); // A3

      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      // Audio policy fallback
    }
  }

  /**
   * Cash drawer latch audio feedback
   */
  playCashDrawer() {
    if (this.settings.enabled === false || this.settings.playCashDrawer === false) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const vol = (this.settings.volume ?? 0.7) * 0.15;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.12);

      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.2);
    } catch {
      // Audio policy fallback
    }
  }
}

export const posSounds = new PosSoundManager();
