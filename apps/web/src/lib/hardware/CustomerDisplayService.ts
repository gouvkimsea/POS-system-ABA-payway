import { CustomerDisplayState } from '@pos/types';
import { hardwareManager } from './HardwareManager';

const BROADCAST_CHANNEL_NAME = 'pos_customer_display';
const STORAGE_STATE_KEY = 'pos_customer_display_state';

export class CustomerDisplayService {
  private static instance: CustomerDisplayService;
  private channel: BroadcastChannel | null = null;
  private displayWindow: Window | null = null;

  private constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      } catch (e) {
        console.warn('[CustomerDisplayService] BroadcastChannel not supported', e);
      }
    }
  }

  public static getInstance(): CustomerDisplayService {
    if (!CustomerDisplayService.instance) {
      CustomerDisplayService.instance = new CustomerDisplayService();
    }
    return CustomerDisplayService.instance;
  }

  /**
   * Broadcasts updated customer display state across windows and local bridge
   */
  public broadcastState(partialState: Partial<CustomerDisplayState>): void {
    const profile = hardwareManager.getProfile();
    if (profile.customerDisplay.driver === 'DISABLED') return;

    const fullState: CustomerDisplayState = {
      status: 'IDLE',
      timestamp: new Date().toISOString(),
      ...partialState,
    };

    // 1. BroadcastChannel for instant dual-screen secondary window
    if (this.channel) {
      try {
        this.channel.postMessage(fullState);
      } catch {
        // Safe fallback
      }
    }

    // 2. LocalStorage event fallback
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_STATE_KEY, JSON.stringify(fullState));
      } catch {
        // Safe fallback
      }
    }

    // 3. Physical VFD Pole Display via Local Device Bridge
    if (profile.customerDisplay.driver === 'LOCAL_BRIDGE_VFD') {
      this.syncBridgePoleDisplay(fullState);
    }
  }

  /**
   * Updates state during item scanning
   */
  public updateCart(
    itemsCount: number,
    subtotalUSD: number,
    taxUSD: number,
    totalUSD: number,
    totalKHR: number,
    lastItem?: { name: string; quantity: number; priceUSD: number; totalUSD: number },
  ): void {
    this.broadcastState({
      status: itemsCount > 0 ? 'SCANNING' : 'IDLE',
      cartSummary: {
        itemsCount,
        subtotalUSD,
        taxUSD,
        totalUSD,
        totalKHR,
      },
      currentItem: lastItem,
    });
  }

  /**
   * Displays payment method, amount due, and ABA KHQR code
   */
  public showPaymentPrompt(
    method: string,
    amountUSD: number,
    amountKHR: number,
    qrPayload?: string,
  ): void {
    this.broadcastState({
      status: 'PAYMENT',
      paymentPrompt: {
        method,
        amountUSD,
        amountKHR,
        qrPayload,
      },
    });
  }

  /**
   * Shows celebratory completion and change returned
   */
  public showThankYou(receiptNumber: string, changeUSD: number = 0, changeKHR: number = 0): void {
    this.broadcastState({
      status: 'COMPLETED',
      thankYouNotice: {
        receiptNumber,
        changeUSD,
        changeKHR,
      },
    });
  }

  /**
   * Resets display to welcome greeting
   */
  public resetToIdle(): void {
    this.broadcastState({
      status: 'IDLE',
      cartSummary: undefined,
      currentItem: undefined,
      paymentPrompt: undefined,
      thankYouNotice: undefined,
    });
  }

  /**
   * Launches secondary customer-facing display window on external monitor
   */
  public openCustomerWindow(): Window | null {
    if (typeof window === 'undefined') return null;

    if (this.displayWindow && !this.displayWindow.closed) {
      this.displayWindow.focus();
      return this.displayWindow;
    }

    // Open clean window positioned on secondary screen if possible
    const width = 1024;
    const height = 768;
    const left = window.screen.availWidth; // Hint to position on secondary display
    const top = 0;

    this.displayWindow = window.open(
      '/customer-display',
      'POS_Customer_Display',
      `width=${width},height=${height},left=${left},top=${top},menubar=no,status=no,toolbar=no`,
    );

    return this.displayWindow;
  }

  private async syncBridgePoleDisplay(state: CustomerDisplayState): Promise<void> {
    try {
      const profile = hardwareManager.getProfile();
      const bridgeUrl = profile.bridge.bridgeUrl.replace(/\/$/, '');
      await fetch(`${bridgeUrl}/customer-display/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state),
      });
    } catch {
      // Non-blocking
    }
  }
}

export const customerDisplayService = CustomerDisplayService.getInstance();
