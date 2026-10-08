import { CheckoutResult, PrintJob, PrintJobData, PrintResult } from '@pos/types';
import { hardwareManager } from './HardwareManager';
import { EscPosEncoder } from './EscPosEncoder';

export interface PrintReceiptOptions {
  reprint?: boolean;
  paperSizeOverride?: '58mm' | '80mm';
}

export class PrinterService {
  private static instance: PrinterService;

  private constructor() {}

  public static getInstance(): PrinterService {
    if (!PrinterService.instance) {
      PrinterService.instance = new PrinterService();
    }
    return PrinterService.instance;
  }

  /**
   * Dispatches a commercial receipt to the configured printer
   */
  public async printReceipt(
    receipt: CheckoutResult,
    options?: PrintReceiptOptions,
  ): Promise<PrintResult> {
    const profile = hardwareManager.getProfile();
    const printerConfig = {
      ...profile.printer,
      paperSize: options?.paperSizeOverride || profile.printer.paperSize,
    };

    const printData = this.formatReceiptData(receipt, options?.reprint);

    // If driver is explicitly browser fallback, trigger browser print
    if (printerConfig.driver === 'BROWSER_FALLBACK') {
      return this.triggerBrowserPrint('Browser Print Fallback executed');
    }

    // Attempt printing via Local Device Bridge
    try {
      const bridgeUrl = profile.bridge.bridgeUrl.replace(/\/$/, '');
      const job: PrintJob = {
        jobId: `PRINT-${Date.now()}`,
        type: options?.reprint ? 'REPRINT' : 'RECEIPT',
        printer: printerConfig,
        data: printData,
        timestamp: new Date().toISOString(),
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(`${bridgeUrl}/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(job),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const result: PrintResult = await res.json();
        return result;
      }

      // If bridge returned non-200, degrade to browser print
      console.warn('[PrinterService] Bridge rejected print job, falling back to browser print');
      return this.triggerBrowserPrint(
        `Local bridge print failed (HTTP ${res.status}). Used browser print.`,
      );
    } catch (err: any) {
      // Bridge unreachable / network error: Safe graceful fallback!
      console.warn('[PrinterService] Local bridge unreachable, falling back to browser print', err);
      return this.triggerBrowserPrint(
        'Hardware bridge offline. Switched to browser print fallback.',
      );
    }
  }

  /**
   * Reprints a finalized order with DUPLICATE notice
   */
  public async reprintReceipt(receipt: CheckoutResult): Promise<PrintResult> {
    return this.printReceipt(receipt, { reprint: true });
  }

  /**
   * Runs a hardware test print to calibrate paper size, alignment, and fonts
   */
  public async printTestSlip(): Promise<PrintResult> {
    const profile = hardwareManager.getProfile();
    const printerConfig = profile.printer;

    if (printerConfig.driver === 'BROWSER_FALLBACK') {
      return this.triggerBrowserPrint('Test print executed via browser preview.');
    }

    try {
      const bridgeUrl = profile.bridge.bridgeUrl.replace(/\/$/, '');
      const job: PrintJob = {
        jobId: `TEST-${Date.now()}`,
        type: 'TEST',
        printer: printerConfig,
        timestamp: new Date().toISOString(),
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(`${bridgeUrl}/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(job),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        return await res.json();
      }
      return this.triggerBrowserPrint(`Bridge error (${res.status}). Opened browser print dialog.`);
    } catch (err: any) {
      return this.triggerBrowserPrint('Hardware bridge unreachable. Opened browser print dialog.');
    }
  }

  /**
   * Generates formatted ESC/POS base64 buffer directly in browser
   */
  public generateEscPosBase64(receipt: CheckoutResult, isReprint: boolean = false): string {
    const profile = hardwareManager.getProfile();
    const printData = this.formatReceiptData(receipt, isReprint);
    const encoder = EscPosEncoder.buildReceipt(printData, profile.printer.paperSize, {
      reprintNotice: isReprint,
      autoCut: profile.printer.autoCut,
      kickDrawer: profile.printer.autoOpenDrawer,
    });
    return encoder.toBase64();
  }

  /**
   * Fallback: Executes browser standard print dialog
   */
  private triggerBrowserPrint(message: string): PrintResult {
    if (typeof window !== 'undefined') {
      window.print();
    }
    return {
      success: true,
      jobId: `BROWSER-${Date.now()}`,
      driverUsed: 'BROWSER_FALLBACK',
      target: 'Browser Print Dialog',
      message,
      fallbackUsed: true,
    };
  }

  private formatReceiptData(receipt: CheckoutResult, isReprint: boolean = false): PrintJobData {
    const profile = hardwareManager.getProfile();
    return {
      storeName: 'Angkor Fresh Mart - Monivong Central',
      storeAddress: '#128, Preah Monivong Blvd, Phnom Penh',
      storePhone: '+855 23 888 991',
      receiptNumber: receipt.receiptNumber,
      orderNumber: receipt.orderNumber,
      cashierName: 'Cashier Staff',
      customerName: receipt.customer?.name,
      createdAt: receipt.createdAt,
      items: receipt.items.map((item) => ({
        name: item.productName,
        quantity: item.quantity,
        unitPriceUSD: item.unitPriceUSD,
        totalUSD: item.totalUSD,
        discountUSD: item.discountUSD,
      })),
      subtotalUSD: receipt.subtotalUSD,
      discountUSD: receipt.discountUSD,
      taxUSD: receipt.taxUSD,
      totalUSD: receipt.totalUSD,
      totalKHR: receipt.totalKHR,
      exchangeRateKHR: receipt.exchangeRateKHR || 4100,
      payments: receipt.payments.map((p) => ({
        method: p.paymentMethodName || p.paymentMethodCode,
        amountUSD: p.amountUSD,
        amountKHR: p.amountKHR,
        tenderUSD: p.tenderAmountUSD,
        tenderKHR: p.tenderAmountKHR,
      })),
      changeUSD: receipt.changeUSD,
      changeKHR: receipt.changeKHR,
      qrPayload: `https://verify.angkor-mart.com/receipt/${receipt.receiptNumber}`,
      reprintNotice: isReprint,
      headerText: profile.printer.headerText,
      footerText: profile.printer.footerText,
    };
  }
}

export const printerService = PrinterService.getInstance();
