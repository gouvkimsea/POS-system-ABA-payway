import { hardwareManager } from './HardwareManager';

type BarcodeCallback = (barcode: string) => void;

export class ScannerService {
  private static instance: ScannerService;
  private buffer: string = '';
  private lastKeyTime: number = 0;
  private listeners: Set<BarcodeCallback> = new Set();
  private audioCtx: AudioContext | null = null;
  private isListening = false;

  private constructor() {
    if (typeof window !== 'undefined') {
      this.attachGlobalKeyboardListener();
    }
  }

  public static getInstance(): ScannerService {
    if (!ScannerService.instance) {
      ScannerService.instance = new ScannerService();
    }
    return ScannerService.instance;
  }

  /**
   * Registers a subscriber for scanned barcode events
   */
  public onBarcode(callback: BarcodeCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Manually feeds a barcode (from camera or manual trigger)
   */
  public handleBarcode(barcode: string): void {
    const trimmed = barcode.trim();
    if (!trimmed) return;

    const profile = hardwareManager.getProfile();
    if (trimmed.length < profile.scanner.minBarcodeLength) return;

    // Audio & Haptic feedback
    if (profile.scanner.soundBeepOnScan) {
      this.playBeepSound();
    }
    if (profile.scanner.vibrateOnScan && typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(60);
      } catch (e) {
        // Safe fallback
      }
    }

    // Notify all active listeners
    this.listeners.forEach((callback) => {
      try {
        callback(trimmed);
      } catch (err) {
        console.error('[ScannerService] Listener error', err);
      }
    });
  }

  /**
   * Attaches low-level global keydown listener to capture USB/Bluetooth scanner bursts
   */
  private attachGlobalKeyboardListener(): void {
    if (this.isListening) return;
    this.isListening = true;

    window.addEventListener(
      'keydown',
      (e: KeyboardEvent) => {
        const profile = hardwareManager.getProfile();
        if (profile.scanner.mode !== 'KEYBOARD_WEDGE') return;

        const now = Date.now();
        const diff = now - this.lastKeyTime;
        this.lastKeyTime = now;

        const target = e.target as HTMLElement | null;
        const isEditable =
          target &&
          (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

        // Enter key signifies barcode termination in standard scanners
        if (e.key === 'Enter') {
          // If rapid burst ended with Enter, intercept it
          if (this.buffer.length >= profile.scanner.minBarcodeLength) {
            e.preventDefault();
            e.stopPropagation();
            const barcode = this.buffer;
            this.buffer = '';
            this.handleBarcode(barcode);
            return;
          }
          this.buffer = '';
          return;
        }

        // If time between keystrokes was too long, reset buffer (human typing)
        if (diff > profile.scanner.interKeyTimeoutMs && this.buffer.length > 0) {
          this.buffer = '';
        }

        // Only buffer printable characters
        if (e.key.length === 1) {
          // If user is typing inside an input field slowly, don't capture as scanner burst
          if (isEditable && diff > profile.scanner.interKeyTimeoutMs) {
            this.buffer = '';
            return;
          }

          this.buffer += e.key;

          // If fast burst detected on non-editable area, prevent unwanted browser shortcuts
          if (!isEditable && this.buffer.length > 2) {
            e.stopPropagation();
          }
        }
      },
      true, // Capture phase to catch scanner bursts before any component
    );
  }

  /**
   * Synthesizes crisp 1800Hz POS barcode beep using Web Audio API
   */
  public playBeepSound(): void {
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

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1850, this.audioCtx.currentTime); // Standard POS beep pitch
      gain.gain.setValueAtTime(0.15, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.08);
    } catch {
      // Audio not supported or blocked by browser gesture policy
    }
  }
}

export const scannerService = ScannerService.getInstance();
