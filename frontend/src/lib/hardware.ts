import { SaleReceipt } from './types';

/**
 * Web Audio API synthesized sound effects for POS feedback.
 * Zero external audio file download, instant 0ms latency.
 */
export function playBeep(type: 'scan' | 'success' | 'error') {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (type === 'scan') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1760, ctx.currentTime); // High clear A6 note
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } else if (type === 'success') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } else if (type === 'error') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.setValueAtTime(180, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch (e) {
    // Audio context may require initial user click in some browsers
  }
}

/**
 * Global Barcode Scanner event listener.
 * USB & Bluetooth barcode scanners transmit keystrokes with < 30ms inter-character latency
 * terminated with Enter ('Enter' or KeyCode 13).
 */
export function setupBarcodeScannerListener(onScan: (barcode: string) => void) {
  if (typeof window === 'undefined') return () => {};

  let buffer = '';
  let lastKeyTime = Date.now();

  const handleKeyDown = (e: KeyboardEvent) => {
    // Ignore input if user is explicitly typing into an input or textarea
    const target = e.target as HTMLElement;
    const isInputField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

    const now = Date.now();
    const timeDiff = now - lastKeyTime;
    lastKeyTime = now;

    if (e.key === 'Enter') {
      if (buffer.length >= 3 && timeDiff < 100) {
        e.preventDefault();
        const scannedCode = buffer.trim();
        buffer = '';
        playBeep('scan');
        onScan(scannedCode);
      } else {
        buffer = '';
      }
      return;
    }

    // Reset buffer if typing was slow (human typing vs hardware scanner burst)
    if (timeDiff > 80 && !isInputField) {
      buffer = '';
    }

    if (!isInputField && e.key.length === 1) {
      buffer += e.key;
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}

/**
 * Formats ESC/POS raw command buffer for standard 80mm & 58mm thermal receipt printers.
 */
export function generateEscPosCommands(receipt: SaleReceipt, width: '80mm' | '58mm' = '80mm'): Uint8Array {
  const charWidth = width === '80mm' ? 48 : 32;
  const lines: string[] = [];

  const center = (text: string) => {
    const pad = Math.max(0, Math.floor((charWidth - text.length) / 2));
    return ' '.repeat(pad) + text;
  };

  const row = (left: string, right: string) => {
    const space = Math.max(1, charWidth - left.length - right.length);
    return left + ' '.repeat(space) + right;
  };

  lines.push('\x1B\x40'); // ESC @: Initialize printer
  lines.push('\x1B\x61\x01'); // Center align
  lines.push('\x1B\x45\x01'); // Bold on
  lines.push(receipt.storeName.toUpperCase() + '\n');
  lines.push('\x1B\x45\x00'); // Bold off

  if (receipt.receiptHeader) {
    lines.push(receipt.receiptHeader + '\n');
  }

  lines.push('-'.repeat(charWidth) + '\n');
  lines.push('\x1B\x61\x00'); // Left align

  lines.push(row(`INV: ${receipt.invoiceNumber}`, new Date(receipt.createdAt).toLocaleDateString()) + '\n');
  lines.push(row(`Cashier: ${receipt.cashierName}`, new Date(receipt.createdAt).toLocaleTimeString()) + '\n');
  lines.push('-'.repeat(charWidth) + '\n');

  // Items
  for (const item of receipt.items) {
    lines.push(item.name.substring(0, charWidth) + '\n');
    lines.push(row(`  ${item.quantity} x $${item.unitPriceUSD.toFixed(2)}`, `$${item.totalUSD.toFixed(2)}`) + '\n');
  }

  lines.push('-'.repeat(charWidth) + '\n');
  lines.push(row('SUBTOTAL:', `$${receipt.subtotalUSD.toFixed(2)}`) + '\n');

  if (receipt.discountAmountUSD > 0) {
    lines.push(row('DISCOUNT:', `-$${receipt.discountAmountUSD.toFixed(2)}`) + '\n');
  }

  lines.push(row('TAX (10%):', `$${receipt.taxAmountUSD.toFixed(2)}`) + '\n');
  lines.push('\x1B\x45\x01'); // Bold
  lines.push(row('TOTAL USD:', `$${receipt.totalUSD.toFixed(2)}`) + '\n');
  lines.push(row('TOTAL KHR:', `${receipt.totalKHR.toLocaleString()} KHR`) + '\n');
  lines.push('\x1B\x45\x00'); // Bold off
  lines.push('-'.repeat(charWidth) + '\n');

  lines.push(row('TENDERED:', `$${receipt.paidUSD.toFixed(2)} / ${receipt.paidKHR.toLocaleString()} KHR`) + '\n');
  lines.push(row('CHANGE USD:', `$${receipt.changeUSD.toFixed(2)}`) + '\n');
  lines.push(row('CHANGE KHR:', `${receipt.changeKHR.toLocaleString()} KHR`) + '\n');
  lines.push(row('METHOD:', receipt.paymentMethod) + '\n');

  if (receipt.receiptFooter) {
    lines.push('\n\x1B\x61\x01'); // Center
    lines.push(receipt.receiptFooter + '\n');
  }

  lines.push('\n\n\n\x1D\x56\x42\x00'); // Paper Cut command (GS V 66 0)

  // Cash Drawer Kick pulse: ESC p 0 25 250
  lines.push('\x1B\x70\x00\x19\xFA');

  const encoder = new TextEncoder();
  return encoder.encode(lines.join(''));
}
