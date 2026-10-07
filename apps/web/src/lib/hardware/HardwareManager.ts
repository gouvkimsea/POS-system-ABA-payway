import {
  BridgeStatus,
  HardwareSettingsProfile,
  HardwareConnectionStatus,
} from '@pos/types';

const STORAGE_KEY = 'pos_hardware_profile';

export const DEFAULT_HARDWARE_PROFILE: HardwareSettingsProfile = {
  terminalId: 'TERM-01',
  storeId: 'store-central',
  bridge: {
    enabled: true,
    bridgeUrl: 'http://127.0.0.1:9123',
    pollIntervalMs: 5000,
  },
  printer: {
    driver: 'LOCAL_BRIDGE',
    name: 'POS-80 ESC/POS Thermal Printer',
    paperSize: '80mm',
    networkIp: '192.168.1.200',
    networkPort: 9100,
    autoCut: true,
    autoOpenDrawer: true,
    copies: 1,
    headerText: 'Angkor Fresh Mart - Monivong Central',
    footerText: 'Thank you for shopping with us! Please come again.',
  },
  scanner: {
    mode: 'KEYBOARD_WEDGE',
    interKeyTimeoutMs: 50,
    minBarcodeLength: 4,
    soundBeepOnScan: true,
    vibrateOnScan: true,
    prefix: '',
    suffix: '\n',
  },
  cashDrawer: {
    driver: 'PRINTER_KICK',
    kickPin: 2,
    pulseOnMs: 50,
    autoOpenOnCashPayment: true,
    soundChirp: true,
  },
  customerDisplay: {
    driver: 'SECONDARY_WINDOW',
    idleLine1: 'Welcome to Angkor Fresh Mart!',
    idleLine2: 'Scan items to begin checkout',
    polePort: 'COM3',
    poleBaudRate: 9600,
  },
  lastSavedAt: new Date().toISOString(),
};

type StatusListener = (status: HardwareStatusReport) => void;

export interface HardwareStatusReport {
  bridgeStatus: HardwareConnectionStatus;
  printerStatus: HardwareConnectionStatus;
  scannerStatus: HardwareConnectionStatus;
  cashDrawerStatus: HardwareConnectionStatus;
  customerDisplayStatus: HardwareConnectionStatus;
  bridgeDetails?: BridgeStatus | null;
  lastCheckedAt: string;
}

export class HardwareManager {
  private static instance: HardwareManager;
  private profile: HardwareSettingsProfile;
  private bridgeDetails: BridgeStatus | null = null;
  private isCheckingBridge = false;
  private pollIntervalTimer: any = null;
  private listeners: Set<StatusListener> = new Set();

  private constructor() {
    this.profile = this.loadStoredProfile();
    if (typeof window !== 'undefined') {
      this.checkBridgeHealth();
      this.startHealthPolling();
    }
  }

  public static getInstance(): HardwareManager {
    if (!HardwareManager.instance) {
      HardwareManager.instance = new HardwareManager();
    }
    return HardwareManager.instance;
  }

  public getProfile(): HardwareSettingsProfile {
    return { ...this.profile };
  }

  public updateProfile(patch: Partial<HardwareSettingsProfile>): HardwareSettingsProfile {
    this.profile = {
      ...this.profile,
      ...patch,
      lastSavedAt: new Date().toISOString(),
    };
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.profile));
      } catch (e) {
        console.warn('[HardwareManager] Failed to persist profile to localStorage', e);
      }
    }
    this.notifyListeners();
    return { ...this.profile };
  }

  public resetToDefaults(): HardwareSettingsProfile {
    this.profile = { ...DEFAULT_HARDWARE_PROFILE, lastSavedAt: new Date().toISOString() };
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.profile));
      } catch (e) {
        console.warn('[HardwareManager] Failed to reset localStorage profile', e);
      }
    }
    this.checkBridgeHealth();
    this.notifyListeners();
    return { ...this.profile };
  }

  public async checkBridgeHealth(): Promise<BridgeStatus | null> {
    if (!this.profile.bridge.enabled || typeof window === 'undefined') {
      this.bridgeDetails = null;
      this.notifyListeners();
      return null;
    }

    if (this.isCheckingBridge) return this.bridgeDetails;
    this.isCheckingBridge = true;

    const start = Date.now();
    try {
      const url = `${this.profile.bridge.bridgeUrl.replace(/\/$/, '')}/status`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const res = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        this.bridgeDetails = {
          ...data,
          latencyMs: Date.now() - start,
          lastCheckedAt: new Date().toISOString(),
        };
      } else {
        this.bridgeDetails = {
          connected: false,
          error: `HTTP ${res.status}: ${res.statusText}`,
          discoveredPrinters: [],
          discoveredPorts: [],
          lastCheckedAt: new Date().toISOString(),
        };
      }
    } catch (err: any) {
      this.bridgeDetails = {
        connected: false,
        error: err.name === 'AbortError' ? 'Bridge connection timed out' : 'Companion service not reachable',
        discoveredPrinters: [],
        discoveredPorts: [],
        lastCheckedAt: new Date().toISOString(),
      };
    } finally {
      this.isCheckingBridge = false;
      this.notifyListeners();
    }

    return this.bridgeDetails;
  }

  public getStatusReport(): HardwareStatusReport {
    const isBridgeLive = Boolean(this.bridgeDetails?.connected);
    const bridgeStatus: HardwareConnectionStatus = !this.profile.bridge.enabled
      ? 'STANDALONE_FALLBACK'
      : isBridgeLive
      ? 'CONNECTED'
      : 'STANDALONE_FALLBACK';

    // Printer status
    let printerStatus: HardwareConnectionStatus = 'CONNECTED';
    if (this.profile.printer.driver === 'BROWSER_FALLBACK') {
      printerStatus = 'STANDALONE_FALLBACK';
    } else if (this.profile.printer.driver === 'LOCAL_BRIDGE' && !isBridgeLive) {
      printerStatus = 'STANDALONE_FALLBACK';
    }

    // Scanner status
    const scannerStatus: HardwareConnectionStatus = 'CONNECTED';

    // Cash drawer status
    let cashDrawerStatus: HardwareConnectionStatus = 'CONNECTED';
    if (this.profile.cashDrawer.driver === 'MANUAL_FALLBACK') {
      cashDrawerStatus = 'STANDALONE_FALLBACK';
    } else if (!isBridgeLive && this.profile.printer.driver !== 'BROWSER_FALLBACK') {
      cashDrawerStatus = 'STANDALONE_FALLBACK';
    }

    // Customer display status
    const customerDisplayStatus: HardwareConnectionStatus =
      this.profile.customerDisplay.driver === 'DISABLED'
        ? 'DISCONNECTED'
        : 'CONNECTED';

    return {
      bridgeStatus,
      printerStatus,
      scannerStatus,
      cashDrawerStatus,
      customerDisplayStatus,
      bridgeDetails: this.bridgeDetails,
      lastCheckedAt: this.bridgeDetails?.lastCheckedAt || new Date().toISOString(),
    };
  }

  public subscribe(listener: StatusListener): () => void {
    this.listeners.add(listener);
    listener(this.getStatusReport());
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const report = this.getStatusReport();
    this.listeners.forEach((listener) => {
      try {
        listener(report);
      } catch (err) {
        console.error('[HardwareManager] Listener notification error', err);
      }
    });
  }

  private startHealthPolling(): void {
    if (this.pollIntervalTimer) clearInterval(this.pollIntervalTimer);
    const interval = Math.max(3000, this.profile.bridge.pollIntervalMs);
    this.pollIntervalTimer = setInterval(() => {
      this.checkBridgeHealth();
    }, interval);
  }

  private loadStoredProfile(): HardwareSettingsProfile {
    if (typeof window === 'undefined') return { ...DEFAULT_HARDWARE_PROFILE };
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          ...DEFAULT_HARDWARE_PROFILE,
          ...parsed,
          bridge: { ...DEFAULT_HARDWARE_PROFILE.bridge, ...parsed.bridge },
          printer: { ...DEFAULT_HARDWARE_PROFILE.printer, ...parsed.printer },
          scanner: { ...DEFAULT_HARDWARE_PROFILE.scanner, ...parsed.scanner },
          cashDrawer: { ...DEFAULT_HARDWARE_PROFILE.cashDrawer, ...parsed.cashDrawer },
          customerDisplay: { ...DEFAULT_HARDWARE_PROFILE.customerDisplay, ...parsed.customerDisplay },
        };
      }
    } catch (e) {
      console.warn('[HardwareManager] Error reading saved profile from localStorage', e);
    }
    return { ...DEFAULT_HARDWARE_PROFILE };
  }
}

export const hardwareManager = HardwareManager.getInstance();
