import { CashDrawerTriggerResult } from '@pos/types';
import { hardwareManager } from './HardwareManager';

export class CashDrawerService {
  private static instance: CashDrawerService;
  private audioCtx: AudioContext | null = null;

  private constructor() {}

  public static getInstance(): CashDrawerService {
    if (!CashDrawerService.instance) {
      CashDrawerService.instance = new CashDrawerService();
    }
    return CashDrawerService.instance;
  }

  /**
   * Triggers the cash drawer to pop open
   */
  public async openDrawer(reason: string = 'Cash sale transaction'): Promise<CashDrawerTriggerResult> {
    const profile = hardwareManager.getProfile();
    const config = profile.cashDrawer;
    const timestamp = new Date().toISOString();

    // Play classic register bell chime if enabled
    if (config.soundChirp) {
      this.playCashChime();
    }

    if (config.driver === 'MANUAL_FALLBACK') {
      return {
        success: true,
        method: 'MANUAL_FALLBACK',
        timestamp,
        message: 'Manual cash drawer mode active. Key required to open.',
      };
    }

    // Attempt trigger via Local Device Bridge
    try {
      const bridgeUrl = profile.bridge.bridgeUrl.replace(/\/$/, '');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(`${bridgeUrl}/cash-drawer/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config,
          printerName: profile.printer.name,
          reason,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        return await res.json();
      }

      return {
        success: true,
        method: 'MANUAL_FALLBACK',
        timestamp,
        message: 'Bridge signal failed. Please open cash drawer manually.',
      };
    } catch {
      // Safe fallback: never crash POS
      return {
        success: true,
        method: 'MANUAL_FALLBACK',
        timestamp,
        message: 'Device bridge offline. Please open cash drawer manually with key.',
      };
    }
  }

  /**
   * Synthesizes mechanical cash register bell chime
   */
  public playCashChime(): void {
    try {
      if (typeof window === 'undefined') return;
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      if (!this.audioCtx) {
        this.audioCtx = new AudioContextClass();
      }

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;

      // Primary chime tone
      const osc1 = this.audioCtx.createOscillator();
      const gain1 = this.audioCtx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(987.77, now); // B5 note
      gain1.gain.setValueAtTime(0.2, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(this.audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      // Higher harmonic bell
      const osc2 = this.audioCtx.createOscillator();
      const gain2 = this.audioCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1975.53, now + 0.05); // B6 note
      gain2.gain.setValueAtTime(0.15, now + 0.05);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc2.connect(gain2);
      gain2.connect(this.audioCtx.destination);
      osc2.start(now + 0.05);
      osc2.stop(now + 0.4);
    } catch {
      // Ignore audio policy issues
    }
  }
}

export const cashDrawerService = CashDrawerService.getInstance();
