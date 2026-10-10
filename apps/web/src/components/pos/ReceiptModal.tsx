'use client';

import React, { useState } from 'react';
import { CheckoutResult, PaperSize } from '@pos/types';
import { X, Printer, CheckCircle, ArrowRight, Copy, Coins, Check } from 'lucide-react';
import { printerService } from '../../lib/hardware/PrinterService';
import { cashDrawerService } from '../../lib/hardware/CashDrawerService';
import { hardwareManager } from '../../lib/hardware/HardwareManager';
import { useSettings } from '../../lib/settings-context';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiptData: CheckoutResult | null;
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  receiptData,
  storeName,
  storeAddress,
  storePhone,
}) => {
  const { settings, formatCurrency, formatDateTime } = useSettings();
  const [printStatus, setPrintStatus] = useState<string>('');
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [isReprint, setIsReprint] = useState<boolean>(false);
  const [previewPaperSize, setPreviewPaperSize] = useState<PaperSize>(
    (settings.store?.receipt?.paperSize as PaperSize) ||
      (settings.pos?.receiptSize as PaperSize) ||
      hardwareManager.getProfile().printer.paperSize ||
      '80mm',
  );

  if (!isOpen || !receiptData) return null;

  const handlePrint = async (reprint: boolean = false) => {
    setIsPrinting(true);
    setIsReprint(reprint);
    setPrintStatus(reprint ? 'Printing duplicate receipt...' : 'Printing receipt...');

    try {
      const res = await printerService.printReceipt(receiptData, {
        reprint,
        paperSizeOverride: previewPaperSize,
      });

      if (res.success) {
        setPrintStatus(
          res.driverUsed === 'BROWSER_FALLBACK' || res.fallbackUsed
            ? '✓ Printed via Browser Fallback'
            : `✓ Printed on ${res.target || 'Thermal Printer'} (${previewPaperSize})`,
        );
      } else {
        setPrintStatus(`Print notice: ${res.message || 'Used browser fallback'}`);
      }
    } catch (e: any) {
      setPrintStatus(`Print fallback: ${e.message}`);
    } finally {
      setIsPrinting(false);
      setTimeout(() => setPrintStatus(''), 4000);
    }
  };

  const handleKickDrawer = async () => {
    try {
      const res = await cashDrawerService.openDrawer('Manual test');
      setPrintStatus(res.message || 'Cash drawer opened.');
      setTimeout(() => setPrintStatus(''), 3000);
    } catch {
      setPrintStatus('Failed to open drawer.');
    }
  };

  const isOffline = receiptData.orderNumber?.startsWith('OFF-ORD-');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 sm:p-4">
      <div className="bg-white rounded-lg max-w-md w-full shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Success Header */}
        <div
          className={`p-4 flex items-center justify-between shrink-0 text-white ${
            isOffline ? 'bg-amber-600' : 'bg-emerald-600'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-white" />
            <div>
              <h3 className="font-bold text-sm leading-none">
                {isOffline ? 'Offline Payment Saved' : 'Payment Complete'}
              </h3>
              <p className="text-[11px] text-white/90 mt-0.5">
                {isOffline
                  ? 'Saved locally • Syncs automatically'
                  : 'Sale completed'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-black/20 hover:bg-black/30 text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Paper Size Selector & Status */}
        <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Format:</span>
            <div className="inline-flex rounded-lg bg-white border border-slate-300 p-0.5">
              <button
                type="button"
                onClick={() => setPreviewPaperSize('58mm')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
                  previewPaperSize === '58mm'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                58mm
              </button>
              <button
                type="button"
                onClick={() => setPreviewPaperSize('80mm')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
                  previewPaperSize === '80mm'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                80mm
              </button>
            </div>
          </div>

          <button
            onClick={handleKickDrawer}
            className="flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 px-2 py-1 rounded-lg transition-colors"
            title="Open cash drawer"
          >
            <Coins className="w-3.5 h-3.5" />
            Open Drawer
          </button>
        </div>

        {/* Feedback Alert Bar */}
        {printStatus && (
          <div className="bg-slate-900 text-emerald-300 text-xs px-4 py-1.5 text-center font-mono font-medium flex items-center justify-center gap-1.5 shrink-0 border-b border-slate-800">
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            {printStatus}
          </div>
        )}

        {/* Thermal Receipt Preview Paper */}
        <div className="p-4 flex-1 overflow-y-auto bg-slate-50">
          <div
            id="pos-thermal-receipt"
            className={`bg-white p-4 rounded-lg border border-slate-200 shadow-xs font-mono text-xs text-slate-800 space-y-3 mx-auto transition-all ${
              previewPaperSize === '58mm' ? 'max-w-[280px]' : 'max-w-[360px]'
            }`}
          >
            {/* Offline Notice Banner */}
            {isOffline && (
              <div className="text-center font-bold text-amber-900 bg-amber-50 border-2 border-dashed border-amber-400 py-1 rounded px-2">
                *** OFFLINE TRANSACTION ***
                <div className="text-[10px] font-normal text-amber-700 mt-0.5">
                  Temporary receipt • Queued for sync
                </div>
              </div>
            )}

            {/* Reprint Banner */}
            {isReprint && (
              <div className="text-center font-bold text-rose-600 border-2 border-dashed border-rose-300 py-1 rounded">
                *** DUPLICATE / REPRINT ***
              </div>
            )}

            {/* Store Header */}
            <div className="text-center space-y-0.5 border-b border-dashed border-slate-300 pb-3">
              {settings.store.receipt.showLogo && (
                <div className="flex justify-center mb-1">
                  {settings.business.logoUrl ? (
                    <img
                      src={settings.business.logoUrl}
                      alt={settings.business.name}
                      className="w-10 h-10 object-contain mx-auto"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs mx-auto">
                      {(settings.business.name || 'P')[0]}
                    </div>
                  )}
                </div>
              )}
              <h4 className="font-bold text-sm uppercase tracking-wider">
                {storeName || settings.store.storeName || settings.business.name}
              </h4>
              <p className="text-[10px] text-slate-500">
                {storeAddress || settings.business.address}
              </p>
              <p className="text-[10px] text-slate-500">
                Tel: {storePhone || settings.business.phone}
              </p>
            </div>

            {/* Receipt & Order Metadata */}
            <div className="text-[11px] space-y-1 border-b border-dashed border-slate-300 pb-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Receipt No:</span>
                <span className="font-bold">{receiptData.receiptNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Order Ref:</span>
                <span>{receiptData.orderNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Date & Time:</span>
                <span>{formatDateTime(receiptData.createdAt)}</span>
              </div>
              {receiptData.customer && (
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>Customer:</span>
                  <span>{receiptData.customer.name}</span>
                </div>
              )}
            </div>

            {/* Line Items */}
            <div className="space-y-1.5 border-b border-dashed border-slate-300 pb-2 text-[11px]">
              <div className="flex justify-between text-slate-400 font-bold uppercase text-[10px] pb-1">
                <span>Item</span>
                <span>Qty x Price</span>
                <span>Total</span>
              </div>
              {receiptData.items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-start">
                  <div className="truncate max-w-[150px]">
                    <span className="font-semibold">{item.productName}</span>
                    {item.discountUSD > 0 && (
                      <span className="text-[10px] text-rose-600 block">
                        (Disc -{formatCurrency(item.discountUSD, 'USD')})
                      </span>
                    )}
                  </div>
                  <span className="text-slate-500">
                    {item.quantity} x {formatCurrency(item.unitPriceUSD, 'USD')}
                  </span>
                  <span className="font-bold text-slate-800">
                    {formatCurrency(item.totalUSD, 'USD')}
                  </span>
                </div>
              ))}
            </div>

            {/* Financial Calculations Breakdown */}
            <div className="space-y-1 border-b border-dashed border-slate-300 pb-2 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-500">Subtotal:</span>
                <span>{formatCurrency(receiptData.subtotalUSD, 'USD')}</span>
              </div>
              {receiptData.discountUSD > 0 && (
                <div className="flex justify-between text-rose-600 font-medium">
                  <span>Discount:</span>
                  <span>-{formatCurrency(receiptData.discountUSD, 'USD')}</span>
                </div>
              )}
              {settings.store.receipt.showTaxBreakdown && receiptData.taxUSD > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>VAT / Tax ({settings.store.tax.defaultTaxRate}%):</span>
                  <span>{formatCurrency(receiptData.taxUSD, 'USD')}</span>
                </div>
              )}
            </div>

            {/* Grand Totals */}
            <div className="space-y-1 border-b border-dashed border-slate-300 pb-2">
              <div className="flex justify-between text-sm font-bold text-slate-900">
                <span>TOTAL USD:</span>
                <span>{formatCurrency(receiptData.totalUSD, 'USD')}</span>
              </div>
              <div className="flex justify-between text-xs font-semibold text-amber-700">
                <span>TOTAL KHR:</span>
                <span>{formatCurrency(receiptData.totalKHR, 'KHR')}</span>
              </div>
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>Exchange Rate:</span>
                <span>1 USD = {(receiptData.exchangeRateKHR || 4100).toLocaleString()} KHR</span>
              </div>
            </div>

            {/* Payment & Change */}
            <div className="space-y-1 border-b border-dashed border-slate-300 pb-2 text-[11px]">
              <div className="flex justify-between text-slate-600">
                <span>Payment Method:</span>
                <span className="font-semibold uppercase">
                  {receiptData.payments
                    .map((p) => p.paymentMethodName || p.paymentMethodCode)
                    .join(', ') || 'CASH'}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Tendered:</span>
                <span className="font-semibold">
                  {formatCurrency(receiptData.paidUSD + receiptData.changeUSD, 'USD')}
                </span>
              </div>
              <div className="flex justify-between font-bold text-emerald-700">
                <span>CHANGE (USD):</span>
                <span>{formatCurrency(receiptData.changeUSD, 'USD')}</span>
              </div>
              <div className="flex justify-between font-bold text-emerald-700">
                <span>CHANGE (KHR):</span>
                <span>{formatCurrency(receiptData.changeKHR, 'KHR')}</span>
              </div>
            </div>

            {/* Footer Notice */}
            <div className="text-center text-[10px] text-slate-500 pt-1">
              <p>
                {settings.store.receipt.customHeader ||
                  receiptData.receipt.headerText ||
                  settings.business.name}
              </p>
              <p className="mt-1 font-semibold">
                {settings.store.receipt.customFooter ||
                  receiptData.receipt.footerText ||
                  'Thank you! Please visit us again.'}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-3.5 bg-white border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
          <button
            onClick={() => handlePrint(false)}
            disabled={isPrinting}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-colors disabled:opacity-50"
            title="Print receipt"
          >
            <Printer className="w-4 h-4 text-slate-700" />
            <span>Print ({previewPaperSize})</span>
          </button>

          <button
            onClick={() => handlePrint(true)}
            disabled={isPrinting}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors disabled:opacity-50"
            title="Reprint receipt"
          >
            <Copy className="w-3.5 h-3.5 text-slate-500" />
            <span>Reprint</span>
          </button>

          <button
            autoFocus
            onClick={onClose}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs transition-colors"
          >
            <span>Next Sale</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
