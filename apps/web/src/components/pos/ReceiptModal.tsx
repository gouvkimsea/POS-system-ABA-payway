'use client';

import React from 'react';
import { CheckoutResult } from '@pos/types';
import { X, Printer, CheckCircle, ArrowRight } from 'lucide-react';

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
  if (!isOpen || !receiptData) return null;

  const handlePrint = () => {
    window.print();
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
              <p className="text-[11px] text-emerald-100 mt-0.5">Sale recorded successfully</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-emerald-700/60 hover:bg-emerald-700 text-white flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Thermal Receipt Preview Paper */}
        <div className="p-5 flex-1 overflow-y-auto bg-slate-50">
          <div
            id="pos-thermal-receipt"
            className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs font-mono text-xs text-slate-800 space-y-3"
          >
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
                  </div>
                  <div className="text-slate-500 shrink-0">
                    {item.quantity} x ${item.unitPriceUSD.toFixed(2)}
                  </div>
                  <div className="font-bold shrink-0">${item.totalUSD.toFixed(2)}</div>
                </div>
              ))}
            </div>

            {/* Financial Summary */}
            <div className="space-y-1 text-[11px] border-b border-dashed border-slate-300 pb-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Subtotal:</span>
                <span>${receiptData.subtotalUSD.toFixed(2)}</span>
              </div>
              {receiptData.discountUSD > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>Discount:</span>
                  <span>-${receiptData.discountUSD.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-500">
                <span>Tax (10% VAT inc.):</span>
                <span>${receiptData.taxUSD.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-extrabold text-sm pt-1 border-t border-slate-200">
                <span>TOTAL (USD):</span>
                <span>${receiptData.totalUSD.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-xs text-indigo-700">
                <span>TOTAL (KHR):</span>
                <span>{receiptData.totalKHR.toLocaleString()} ៛</span>
              </div>
            </div>

            {/* Payment & Change */}
            <div className="space-y-1 text-[11px] border-b border-dashed border-slate-300 pb-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Tendered:</span>
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
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>Print Receipt</span>
          </button>

          <button
            autoFocus
            onClick={onClose}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-colors"
          >
            <span>Next Customer</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
