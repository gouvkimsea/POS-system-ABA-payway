'use client';

import React, { useState } from 'react';
import { CheckoutResult, PaperSize } from '@pos/types';
import {
  X,
  Printer,
  CheckCircle,
  ArrowRight,
  Copy,
  Coins,
  Check,
} from 'lucide-react';
import { printerService } from '../../lib/hardware/PrinterService';
import { cashDrawerService } from '../../lib/hardware/CashDrawerService';
import { hardwareManager } from '../../lib/hardware/HardwareManager';

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
  storeName = 'Angkor Fresh Mart - Monivong Central',
  storeAddress = '#128, Preah Monivong Blvd, Phnom Penh',
  storePhone = '+855 23 888 991',
}) => {
  const [printStatus, setPrintStatus] = useState<string>('');
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [isReprint, setIsReprint] = useState<boolean>(false);
  const [previewPaperSize, setPreviewPaperSize] = useState<PaperSize>(
    hardwareManager.getProfile().printer.paperSize || '80mm',
  );

  if (!isOpen || !receiptData) return null;

  const handlePrint = async (reprint: boolean = false) => {
    setIsPrinting(true);
    setIsReprint(reprint);
    setPrintStatus(reprint ? 'Reprinting duplicate slip...' : 'Sending to thermal printer...');

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
      const res = await cashDrawerService.openDrawer('Manual drawer open from receipt');
      setPrintStatus(res.message || 'Cash drawer kick signal sent.');
      setTimeout(() => setPrintStatus(''), 3000);
    } catch {
      setPrintStatus('Drawer kick failed.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Success Header */}
        <div className="bg-emerald-600 text-white p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-200" />
            <div>
              <h3 className="font-bold text-sm leading-none">Payment Complete</h3>
              <p className="text-[11px] text-emerald-100 mt-0.5">Sale recorded in PostgreSQL</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-emerald-700/60 hover:bg-emerald-700 text-white flex items-center justify-center"
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
                    ? 'bg-indigo-600 text-white shadow-xs'
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
                    ? 'bg-indigo-600 text-white shadow-xs'
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
            title="Pop cash drawer open"
          >
            <Coins className="w-3.5 h-3.5" />
            Open Drawer
          </button>
        </div>

        {/* Feedback Alert Bar */}
        {printStatus && (
          <div className="bg-indigo-900 text-indigo-100 text-xs px-4 py-1.5 text-center font-mono font-medium animate-in fade-in flex items-center justify-center gap-1.5 shrink-0">
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            {printStatus}
          </div>
        )}

        {/* Thermal Receipt Preview Paper */}
        <div className="p-4 flex-1 overflow-y-auto bg-slate-50">
          <div
            id="pos-thermal-receipt"
            className={`bg-white p-4 rounded-xl border border-slate-200 shadow-xs font-mono text-xs text-slate-800 space-y-3 mx-auto transition-all ${
              previewPaperSize === '58mm' ? 'max-w-[280px]' : 'max-w-[360px]'
            }`}
          >
            {/* Reprint Banner */}
            {isReprint && (
              <div className="text-center font-bold text-rose-600 border-2 border-dashed border-rose-300 py-1 rounded">
                *** DUPLICATE / REPRINT ***
              </div>
            )}

            {/* Store Header */}
            <div className="text-center space-y-0.5 border-b border-dashed border-slate-300 pb-3">
              <h4 className="font-bold text-sm uppercase tracking-wider">{storeName}</h4>
              <p className="text-[10px] text-slate-500">{storeAddress}</p>
              <p className="text-[10px] text-slate-500">Tel: {storePhone}</p>
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
                <span>
                  {new Date(receiptData.createdAt).toLocaleString([], {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </span>
              </div>
              {receiptData.customer && (
                <div className="flex justify-between text-indigo-700 font-semibold">
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
                        (Disc -${item.discountUSD.toFixed(2)})
                      </span>
                    )}
                  </div>
                  <span className="text-slate-500">
                    {item.quantity} x ${item.unitPriceUSD.toFixed(2)}
                  </span>
                  <span className="font-bold text-slate-800">${item.totalUSD.toFixed(2)}</span>
                </div>
              ))}
            </div>

            {/* Financial Calculations Breakdown */}
            <div className="space-y-1 border-b border-dashed border-slate-300 pb-2 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-500">Subtotal:</span>
                <span>${receiptData.subtotalUSD.toFixed(2)}</span>
              </div>
              {receiptData.discountUSD > 0 && (
                <div className="flex justify-between text-rose-600 font-medium">
                  <span>Discount:</span>
                  <span>-${receiptData.discountUSD.toFixed(2)}</span>
                </div>
              )}
              {receiptData.taxUSD > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>VAT / Tax (10%):</span>
                  <span>${receiptData.taxUSD.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Grand Totals */}
            <div className="space-y-1 border-b border-dashed border-slate-300 pb-2">
              <div className="flex justify-between text-sm font-bold text-slate-900">
                <span>TOTAL USD:</span>
                <span>${receiptData.totalUSD.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs font-semibold text-amber-700">
                <span>TOTAL KHR:</span>
                <span>{receiptData.totalKHR.toLocaleString()} ៛</span>
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
                  {receiptData.payments.map((p) => p.paymentMethodName || p.paymentMethodCode).join(', ') || 'CASH'}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Tendered:</span>
                <span className="font-semibold">
                  ${(receiptData.paidUSD + receiptData.changeUSD).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between font-bold text-emerald-700">
                <span>CHANGE (USD):</span>
                <span>${receiptData.changeUSD.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-emerald-700">
                <span>CHANGE (KHR):</span>
                <span>{receiptData.changeKHR.toLocaleString()} ៛</span>
              </div>
            </div>

            {/* Footer Notice */}
            <div className="text-center text-[10px] text-slate-500 pt-1">
              <p>{receiptData.receipt.headerText || 'Angkor Fresh Mart'}</p>
              <p className="mt-1 font-semibold">
                {receiptData.receipt.footerText || 'Thank you! Please visit us again.'}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-3.5 bg-white border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
          <button
            onClick={() => handlePrint(false)}
            disabled={isPrinting}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-colors disabled:opacity-50"
            title="Print receipt on thermal printer"
          >
            <Printer className="w-4 h-4 text-slate-700" />
            <span>Print ({previewPaperSize})</span>
          </button>

          <button
            onClick={() => handlePrint(true)}
            disabled={isPrinting}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors disabled:opacity-50"
            title="Reprint receipt with duplicate notice"
          >
            <Copy className="w-3.5 h-3.5 text-slate-500" />
            <span>Reprint</span>
          </button>

          <button
            autoFocus
            onClick={onClose}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-colors"
          >
            <span>Next Customer</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
