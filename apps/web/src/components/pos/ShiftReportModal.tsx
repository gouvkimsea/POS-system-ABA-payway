'use client';

import React from 'react';
import { RegisterSessionSummary } from '@pos/types';
import { X, Printer } from 'lucide-react';

interface ShiftReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: RegisterSessionSummary | null;
}

export const ShiftReportModal: React.FC<ShiftReportModalProps> = ({ isOpen, onClose, session }) => {
  if (!isOpen || !session) return null;

  const handlePrint = () => {
    window.print();
  };

  const diffUSD = session.differenceUSD !== null ? session.differenceUSD : 0;
  const isBalanced = diffUSD === 0;
  const isOver = diffUSD > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 print:p-0 print:bg-white">
      <div className="w-full max-w-md bg-white text-slate-900 rounded-lg shadow-xl overflow-hidden flex flex-col max-h-[92dvh] border border-slate-200 print:border-none print:shadow-none print:max-w-none">
        {/* Top Header (Hidden on print) */}
        <div className="px-5 py-3.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between shrink-0 print:hidden">
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4 text-slate-600" />
            <h3 className="text-sm font-bold text-slate-800">Register Shift Report</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 font-mono text-xs space-y-4 print:p-8 print:text-sm">
          {/* Header */}
          <div className="text-center space-y-1 pb-3 border-b border-dashed border-slate-300">
            <h1 className="text-base font-black uppercase tracking-tight text-slate-950">
              Angkor Fresh Mart
            </h1>
            <p className="text-[11px] text-slate-600 font-sans">{session.storeName}</p>
            <div className="text-[11px] font-bold text-slate-800 uppercase mt-2">
              *** REGISTER SHIFT REPORT ***
            </div>
            <p className="text-[10px] text-slate-500">Session ID: {session.id.slice(0, 16)}...</p>
          </div>

          {/* Metadata */}
          <div className="space-y-1 text-[11px] pb-3 border-b border-dashed border-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-500">Register:</span>
              <span className="font-bold text-slate-800">
                {session.registerCode} - {session.registerName}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Cashier:</span>
              <span className="font-bold text-slate-800">{session.cashierName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Opened At:</span>
              <span>{new Date(session.openedAt).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Closed At:</span>
              <span>
                {session.closedAt ? new Date(session.closedAt).toLocaleString() : 'STILL OPEN'}
              </span>
            </div>
          </div>

          {/* Sales Breakdown */}
          <div className="space-y-1.5 pb-3 border-b border-dashed border-slate-300">
            <div className="font-bold uppercase text-[10px] text-slate-400 tracking-wider">
              Sales Summary
            </div>
            <div className="flex justify-between">
              <span>Total Transactions:</span>
              <span className="font-bold">{session.totalSalesCount} orders</span>
            </div>
            <div className="flex justify-between">
              <span>Gross Sales (USD):</span>
              <span className="font-bold">${session.totalSalesUSD.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Gross Sales (KHR):</span>
              <span>{session.totalSalesKHR.toLocaleString()} ៛</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Net Cash Sales (USD):</span>
              <span>${session.cashSalesUSD.toFixed(2)}</span>
            </div>
          </div>

          {/* Cash Drawer Movements */}
          <div className="space-y-1.5 pb-3 border-b border-dashed border-slate-300">
            <div className="font-bold uppercase text-[10px] text-slate-400 tracking-wider">
              Cash Drawer Activity
            </div>
            <div className="flex justify-between">
              <span>(+) Opening Float:</span>
              <span>${session.openingFloatUSD.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>(+) Cash Sales:</span>
              <span>+${session.cashSalesUSD.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>(+) Cash In:</span>
              <span>+${session.cashInUSD.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>(-) Cash Out:</span>
              <span>-${session.cashOutUSD.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>(-) Store Expenses:</span>
              <span>-${session.expensesUSD.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>(-) Cash Refunds:</span>
              <span>-${session.cashRefundsUSD.toFixed(2)}</span>
            </div>
          </div>

          {/* Closing Reconciliation */}
          <div className="space-y-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex justify-between text-xs font-bold text-slate-800">
              <span>Expected Cash:</span>
              <span>${session.expectedCashUSD.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs font-bold text-slate-900">
              <span>Counted Cash:</span>
              <span>
                {session.actualCashUSD !== null ? `$${session.actualCashUSD.toFixed(2)}` : '—'}
              </span>
            </div>
            <div className="border-t border-slate-200 pt-1.5 flex justify-between items-center text-sm font-black">
              <span>Difference:</span>
              <span
                className={`${
                  isBalanced ? 'text-emerald-700' : isOver ? 'text-blue-700' : 'text-rose-700'
                }`}
              >
                {diffUSD >= 0 ? '+' : ''}${diffUSD.toFixed(2)} (
                {isBalanced ? 'Balanced' : isOver ? 'Over' : 'Short'})
              </span>
            </div>
          </div>

          {/* Notes */}
          {session.closingNotes && (
            <div className="p-2.5 rounded bg-slate-50 border border-slate-200 text-[10px] space-y-0.5">
              <span className="font-bold text-slate-500 uppercase block">Notes:</span>
              <p className="italic text-slate-700 font-sans">{session.closingNotes}</p>
            </div>
          )}

          {/* Signatures */}
          <div className="pt-6 grid grid-cols-2 gap-4 text-center text-[10px] text-slate-500 font-sans">
            <div>
              <div className="border-b border-slate-300 h-8 mb-1" />
              <span>Cashier Signature</span>
            </div>
            <div>
              <div className="border-b border-slate-300 h-8 mb-1" />
              <span>Manager Signature</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
