import { PaperSize, PrintJobData } from '@pos/types';

/**
 * Browser-Compatible ESC/POS Binary Command Encoder
 * Uses standard Web APIs (Uint8Array, TextEncoder, btoa) to construct ESC/POS streams.
 */
export class EscPosEncoder {
  private buffer: number[] = [];
  private readonly columns: number;
  private readonly textEncoder = new TextEncoder();

  constructor(public readonly paperSize: PaperSize = '80mm') {
    this.columns = paperSize === '58mm' ? 32 : 48;
    this.initialize();
  }

  public initialize(): this {
    this.buffer.push(0x1b, 0x40);
    return this;
  }

  public align(alignment: 'left' | 'center' | 'right'): this {
    const code = alignment === 'center' ? 0x01 : alignment === 'right' ? 0x02 : 0x00;
    this.buffer.push(0x1b, 0x61, code);
    return this;
  }

  public bold(enable: boolean = true): this {
    this.buffer.push(0x1b, 0x45, enable ? 0x01 : 0x00);
    return this;
  }

  public doubleSize(enable: boolean = true): this {
    this.buffer.push(0x1d, 0x21, enable ? 0x11 : 0x00);
    return this;
  }

  public underline(enable: boolean = true): this {
    this.buffer.push(0x1b, 0x2d, enable ? 0x01 : 0x00);
    return this;
  }

  public text(str: string): this {
    const bytes = this.textEncoder.encode(str);
    for (let i = 0; i < bytes.length; i++) {
      this.buffer.push(bytes[i]);
    }
    return this;
  }

  public line(str: string = ''): this {
    this.text(str);
    this.buffer.push(0x0a);
    return this;
  }

  public feed(lines: number = 1): this {
    for (let i = 0; i < lines; i++) {
      this.buffer.push(0x0a);
    }
    return this;
  }

  public divider(char: string = '-'): this {
    this.align('left');
    this.line(char.repeat(this.columns));
    return this;
  }

  public doubleDivider(): this {
    return this.divider('=');
  }

  public twoColumn(left: string, right: string): this {
    const spaceCount = this.columns - (left.length + right.length);
    if (spaceCount <= 0) {
      const maxLeft = Math.max(0, this.columns - right.length - 1);
      const truncatedLeft = left.substring(0, maxLeft);
      const padding = ' '.repeat(Math.max(1, this.columns - (truncatedLeft.length + right.length)));
      this.line(`${truncatedLeft}${padding}${right}`);
    } else {
      this.line(`${left}${' '.repeat(spaceCount)}${right}`);
    }
    return this;
  }

  public threeColumn(col1: string, col2: string, col3: string): this {
    if (this.paperSize === '58mm') {
      this.line(col1);
      return this.twoColumn(`  ${col2}`, col3);
    }

    const c1 = col1.padEnd(24).substring(0, 24);
    const c2 = col2.padStart(12).substring(0, 12);
    const c3 = col3.padStart(12).substring(0, 12);
    this.line(`${c1}${c2}${c3}`);
    return this;
  }

  public pulseDrawer(pin: 2 | 5 = 2, onMs: number = 25, offMs: number = 250): this {
    const pinByte = pin === 2 ? 0x00 : 0x01;
    this.buffer.push(0x1b, 0x70, pinByte, onMs, offMs);
    return this;
  }

  public cut(fullCut: boolean = false): this {
    this.feed(3);
    this.buffer.push(0x1d, 0x56, fullCut ? 0x00 : 0x01);
    return this;
  }

  public barcode(data: string): this {
    this.align('center');
    this.buffer.push(0x1d, 0x68, 50); // Height
    this.buffer.push(0x1d, 0x77, 2); // Width
    this.buffer.push(0x1d, 0x48, 2); // Text position below
    const rawBytes = this.textEncoder.encode(data);
    this.buffer.push(0x1d, 0x6b, 73, rawBytes.length, ...rawBytes);
    this.feed(1);
    return this;
  }

  public qrCode(data: string): this {
    this.align('center');
    const bytes = this.textEncoder.encode(data);
    const len = bytes.length + 3;
    const pL = len % 256;
    const pH = Math.floor(len / 256);

    this.buffer.push(0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00);
    const moduleSize = this.paperSize === '58mm' ? 3 : 4;
    this.buffer.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, moduleSize);
    this.buffer.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31);
    this.buffer.push(0x1d, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30, ...bytes);
    this.buffer.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30);
    this.feed(1);
    return this;
  }

  public toUint8Array(): Uint8Array {
    return new Uint8Array(this.buffer);
  }

  public toBase64(): string {
    const uint8 = this.toUint8Array();
    let binary = '';
    const len = uint8.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(uint8[i]);
    }
    return btoa(binary);
  }

  public static buildReceipt(
    data: PrintJobData,
    paperSize: PaperSize = '80mm',
    options?: { reprintNotice?: boolean; autoCut?: boolean; kickDrawer?: boolean },
  ): EscPosEncoder {
    const encoder = new EscPosEncoder(paperSize);

    // Header & Store Info
    encoder.align('center');
    encoder.bold(true).doubleSize(true).line(data.storeName).doubleSize(false).bold(false);

    if (data.storeAddress) {
      encoder.line(data.storeAddress);
    }
    if (data.storePhone) {
      encoder.line(`Tel: ${data.storePhone}`);
    }

    if (options?.reprintNotice || data.reprintNotice) {
      encoder.feed(1);
      encoder.bold(true).line('*** DUPLICATE / REPRINT ***').bold(false);
    }

    encoder.divider('-');

    // Metadata
    encoder.align('left');
    encoder.twoColumn('Receipt No:', data.receiptNumber);
    encoder.twoColumn('Order Ref:', data.orderNumber);
    encoder.twoColumn('Date:', new Date(data.createdAt).toLocaleString());
    if (data.cashierName) {
      encoder.twoColumn('Cashier:', data.cashierName);
    }
    if (data.customerName) {
      encoder.twoColumn('Customer:', data.customerName);
    }

    encoder.divider('-');

    // Items table header
    encoder.bold(true);
    if (paperSize === '58mm') {
      encoder.twoColumn('ITEM', 'QTY x PRICE  TOTAL');
    } else {
      encoder.threeColumn('ITEM', 'QTY x PRICE', 'TOTAL (USD)');
    }
    encoder.bold(false);
    encoder.divider('-');

    // Items
    for (const item of data.items) {
      const qtyPrice = `${item.quantity} x $${item.unitPriceUSD.toFixed(2)}`;
      const totalStr = `$${item.totalUSD.toFixed(2)}`;
      encoder.threeColumn(item.name, qtyPrice, totalStr);
      if (item.discountUSD && item.discountUSD > 0) {
        encoder.twoColumn('  (Item Disc)', `-$${item.discountUSD.toFixed(2)}`);
      }
    }

    encoder.divider('-');

    // Totals
    encoder.twoColumn('Subtotal:', `$${data.subtotalUSD.toFixed(2)}`);
    if (data.discountUSD && data.discountUSD > 0) {
      encoder.twoColumn('Order Discount:', `-$${data.discountUSD.toFixed(2)}`);
    }
    if (data.taxUSD && data.taxUSD > 0) {
      encoder.twoColumn('VAT / Tax:', `$${data.taxUSD.toFixed(2)}`);
    }

    encoder.doubleDivider();
    encoder.bold(true).doubleSize(true);
    encoder.twoColumn('TOTAL USD:', `$${data.totalUSD.toFixed(2)}`);
    encoder.doubleSize(false).bold(false);

    const khrFormatted = Math.round(data.totalKHR).toLocaleString();
    encoder.bold(true);
    encoder.twoColumn('TOTAL KHR:', `${khrFormatted} Riel`);
    encoder.bold(false);
    encoder.twoColumn('Exchange Rate:', `1 USD = ${data.exchangeRateKHR.toLocaleString()} KHR`);

    encoder.divider('-');

    // Payments
    encoder.bold(true).line('PAYMENTS:').bold(false);
    for (const p of data.payments) {
      const tenderInfo = p.tenderUSD ? ` (Tender $${p.tenderUSD.toFixed(2)})` : '';
      encoder.twoColumn(`• ${p.method}${tenderInfo}`, `$${p.amountUSD.toFixed(2)}`);
    }

    if (data.changeUSD !== undefined && data.changeUSD > 0) {
      encoder.bold(true);
      encoder.twoColumn('Change Due (USD):', `$${data.changeUSD.toFixed(2)}`);
      if (data.changeKHR) {
        encoder.twoColumn(
          'Change Due (KHR):',
          `${Math.round(data.changeKHR).toLocaleString()} KHR`,
        );
      }
      encoder.bold(false);
    }

    encoder.divider('-');

    // QR Verification or Barcode
    if (data.qrPayload) {
      encoder.align('center');
      encoder.line('Scan to Verify Receipt / E-Tax');
      encoder.qrCode(data.qrPayload);
    } else {
      encoder.barcode(data.receiptNumber.replace(/[^A-Za-z0-9]/g, ''));
    }

    // Footers
    encoder.align('center');
    if (data.footerText) {
      encoder.line(data.footerText);
    } else {
      encoder.line('Thank you for shopping with us!');
      encoder.line('Goods sold are non-refundable without receipt.');
    }

    if (options?.kickDrawer) {
      encoder.pulseDrawer(2);
    }

    if (options?.autoCut !== false) {
      encoder.cut(false);
    }

    return encoder;
  }

  public static buildTestSlip(
    paperSize: PaperSize = '80mm',
    printerName: string = 'ESC/POS Thermal Printer',
  ): EscPosEncoder {
    const encoder = new EscPosEncoder(paperSize);
    const cols = paperSize === '58mm' ? 32 : 48;

    encoder.align('center');
    encoder.bold(true).doubleSize(true).line('HARDWARE TEST SLIP').doubleSize(false).bold(false);
    encoder.line(`Printer: ${printerName}`);
    encoder.line(`Paper Width: ${paperSize} (${cols} columns)`);
    encoder.line(`Test Time: ${new Date().toLocaleString()}`);
    encoder.doubleDivider();

    encoder.align('left');
    encoder.bold(true).line('1. COLUMN WIDTH CALIBRATION:').bold(false);
    let ruler = '';
    for (let i = 1; i <= cols; i++) {
      ruler += (i % 10).toString();
    }
    encoder.line(ruler);
    encoder.divider('-');

    encoder.bold(true).line('2. TEXT FORMATTING TEST:').bold(false);
    encoder.align('left').line('Left Aligned Text');
    encoder.align('center').line('Center Aligned Text');
    encoder.align('right').line('Right Aligned Text');
    encoder.align('left');
    encoder.bold(true).line('Bold Text Active').bold(false);
    encoder.underline(true).line('Underlined Text Active').underline(false);
    encoder.doubleSize(true).line('Double Height/Width').doubleSize(false);

    encoder.divider('-');
    encoder.bold(true).line('3. 1D BARCODE TEST (CODE128):').bold(false);
    encoder.barcode('TEST123456');

    encoder.divider('-');
    encoder.bold(true).line('4. 2D QR CODE TEST:').bold(false);
    encoder.qrCode('https://pos.angkor-mart.com/verify/test-slip');

    encoder.divider('-');
    encoder.align('center');
    encoder.bold(true).line('*** TEST PRINT SUCCESSFUL ***').bold(false);
    encoder.line('Hardware bridge communication operational.');

    encoder.cut(false);
    return encoder;
  }
}
