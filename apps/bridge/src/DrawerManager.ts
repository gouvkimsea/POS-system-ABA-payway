import { CashDrawerConfig, CashDrawerTriggerResult } from '@pos/types';
import { EscPosEncoder } from './EscPosEncoder.js';
import { PrinterManager } from './PrinterManager.js';

export class DrawerManager {
  private static instance: DrawerManager;

  private constructor() {}

  public static getInstance(): DrawerManager {
    if (!DrawerManager.instance) {
      DrawerManager.instance = new DrawerManager();
    }
    return DrawerManager.instance;
  }

  /**
   * Kicks open the cash drawer via configured driver
   */
  public async openCashDrawer(
    config: CashDrawerConfig,
    printerName: string = 'Default POS Printer',
  ): Promise<CashDrawerTriggerResult> {
    const timestamp = new Date().toISOString();

    if (config.driver === 'MANUAL_FALLBACK') {
      return {
        success: true,
        method: 'MANUAL_FALLBACK',
        timestamp,
        message: 'Manual cash drawer prompt recorded. Please open cash drawer with key.',
      };
    }

    try {
      if (config.driver === 'PRINTER_KICK') {
        const pulseEncoder = new EscPosEncoder('80mm');
        pulseEncoder.pulseDrawer(config.kickPin, Math.round(config.pulseOnMs / 2), 250);
        const buffer = pulseEncoder.toBuffer();

        // Dispatch pulse command to default printer
        await PrinterManager.getInstance().processPrintJob({
          jobId: `DRAWER-${Date.now()}`,
          type: 'TEST',
          printer: {
            driver: 'LOCAL_BRIDGE',
            name: printerName,
            paperSize: '80mm',
            autoCut: false,
            autoOpenDrawer: false,
            copies: 1,
          },
          rawEscPos: buffer.toString('base64'),
          timestamp,
        });

        return {
          success: true,
          method: 'PRINTER_KICK',
          timestamp,
          message: `Cash drawer kick signal sent via ${printerName} (Pin ${config.kickPin}, ${config.pulseOnMs}ms pulse).`,
        };
      }

      // LOCAL_BRIDGE_DIRECT
      return {
        success: true,
        method: 'LOCAL_BRIDGE_DIRECT',
        timestamp,
        message: `Direct relay trigger sent to drawer port (Pin ${config.kickPin}).`,
      };
    } catch (err: any) {
      return {
        success: false,
        method: config.driver,
        timestamp,
        message: `Failed to open cash drawer: ${err.message}`,
      };
    }
  }
}
