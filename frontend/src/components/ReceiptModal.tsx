'use client';

import React, { useState } from 'react';
import { X, Printer, Check, Copy } from 'lucide-react';
import { SaleReceipt } from '../lib/types';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receipt: SaleReceipt | null;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ isOpen, onClose, receipt }) => {
  const [paperWidth, setPaperWidth] = useState<'80mm' | '58mm'>('80mm');
  const [copied, setCopied] = useState(false);

  if (!isOpen || !receipt) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleCopyText = () => {
    const lines = [
      receipt.storeName,
      receipt.receiptHeader || '',
      `Invoice: ${receipt.invoiceNumber}`,
      `Date: ${new Date(receipt.createdAt).toLocaleString()}`,
      `Cashier: ${receipt.cashierName}`,
      '--------------------------------',
      ...receipt.items.map((i) => `${i.quantity}x ${i.name} - $${i.totalUSD.toFixed(2)}`),
      '--------------------------------',
      `Subtotal: $${receipt.subtotalUSD.toFixed(2)}`,
      `Tax: $${receipt.taxAmountUSD.toFixed(2)}`,
      `Total: $${receipt.totalUSD.toFixed(2)} / ${receipt.totalKHR.toLocaleString()} KHR`,
      `Tendered: $${receipt.paidUSD.toFixed(2)} / ${receipt.paidKHR.toLocaleString()} KHR`,
      `Change: $${receipt.changeUSD.toFixed(2)} / ${receipt.changeKHR.toLocaleString()} KHR`,
      receipt.receiptFooter || '',
    ];

    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[95vh] animate-in fade-in duration-150">
        {/* Modal Header */}
        <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Printer className="w-5 h-5 text-blue-400" />
            <h3 className="font-bold text-sm">Receipt & Thermal Print</h3>
          </div>
          <div className="flex items-center space-x-2">
            <div className="flex bg-slate-800 rounded p-0.5 text-xs">
              <button
                onClick={() => setPaperWidth('80mm')}
                className={`px-2 py-0.5 rounded font-mono ${paperWidth === '80mm' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400'}`}
              >
                80mm
              </button>
              <button
                onClick={() => setPaperWidth('58mm')}
                className={`px-2 py-0.5 rounded font-mono ${paperWidth === '58mm' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400'}`}
              >
                58mm
              </button>
            </div>
            <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Thermal Receipt Visual Preview (Matches ESC/POS layout) */}
        <div className="p-4 overflow-y-auto bg-slate-100 flex justify-center">
          <div
            id="thermal-receipt"
            className={`bg-white shadow-md p-4 font-mono text-xs text-black border border-slate-200 transition-all ${
              paperWidth === '80mm' ? 'w-[300px]' : 'w-[230px]'
            }`}
          >
            {/* Header */}
            <div className="text-center space-y-1 mb-2">
              <h2 className="font-bold text-sm uppercase tracking-wider">{receipt.storeName}</h2>
              {receipt.receiptHeader && (
                <div className="whitespace-pre-line text-[11px] text-gray-700">{receipt.receiptHeader}</div>
              )}
            </div>

            <div className="border-b border-dashed border-gray-400 my-2"></div>

            {/* Meta */}
            <div className="text-[11px] space-y-0.5 text-gray-700">
              <div className="flex justify-between">
                <span>Invoice:</span>
                <span className="font-bold">{receipt.invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>Date:</span>
                <span>{new Date(receipt.createdAt).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Cashier:</span>
                <span>{receipt.cashierName}</span>
              </div>
            </div>

            <div className="border-b border-dashed border-gray-400 my-2"></div>

            {/* Item List */}
            <div className="space-y-1 my-2">
              {receipt.items.map((item, idx) => (
                <div key={idx} className="text-[11px]">
                  <div className="font-medium truncate">{item.name}</div>
                  <div className="flex justify-between text-gray-600">
                    <span>
                      {item.quantity} x ${item.unitPriceUSD.toFixed(2)}
                    </span>
                    <span className="font-bold text-black">${item.totalUSD.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-b border-dashed border-gray-400 my-2"></div>

            {/* Totals */}
            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>${receipt.subtotalUSD.toFixed(2)}</span>
              </div>
              {receipt.discountAmountUSD > 0 && (
                <div className="flex justify-between text-gray-700">
                  <span>Discount:</span>
                  <span>-${receipt.discountAmountUSD.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Tax (10% VAT):</span>
                <span>${receipt.taxAmountUSD.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-xs pt-1 border-t border-gray-300">
                <span>TOTAL USD:</span>
                <span>${receipt.totalUSD.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-xs text-amber-900">
                <span>TOTAL KHR:</span>
                <span>{receipt.totalKHR.toLocaleString()} ៛</span>
              </div>
            </div>

            <div className="border-b border-dashed border-gray-400 my-2"></div>

            {/* Payment & Change */}
            <div className="space-y-0.5 text-[11px] text-gray-700">
              <div className="flex justify-between">
                <span>Paid USD:</span>
                <span>${receipt.paidUSD.toFixed(2)}</span>
              </div>
              {receipt.paidKHR > 0 && (
                <div className="flex justify-between">
                  <span>Paid KHR:</span>
                  <span>{receipt.paidKHR.toLocaleString()} ៛</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-black">
                <span>Change USD:</span>
                <span>${receipt.changeUSD.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-amber-900">
                <span>Change KHR:</span>
                <span>{receipt.changeKHR.toLocaleString()} ៛</span>
              </div>
              <div className="flex justify-between text-[10px] text-gray-500 pt-0.5">
                <span>Method:</span>
                <span>{receipt.paymentMethod}</span>
              </div>
            </div>

            {/* Footer */}
            {receipt.receiptFooter && (
              <div className="text-center mt-3 pt-2 border-t border-dashed border-gray-400 text-[10px] text-gray-600 whitespace-pre-line">
                {receipt.receiptFooter}
              </div>
            )}
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex space-x-2">
          <button
            onClick={handleCopyText}
            className="px-3 py-2.5 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition flex items-center space-x-1"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 shadow-sm"
          >
            <Printer className="w-4 h-4" />
            <span>Print Receipt</span>
          </button>

          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center"
          >
            New Sale
          </button>
        </div>
      </div>
    </div>
  );
};
