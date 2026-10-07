'use client';

import React from 'react';
import { X, Keyboard } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'F1', desc: 'Focus Product Search input' },
    { key: 'F2', desc: 'Focus Barcode Scanner input' },
    { key: 'F4', desc: 'Open Customer Selector dialog' },
    { key: 'F8', desc: 'Open Payment & Checkout dialog' },
    { key: 'ESC', desc: 'Close any open modal or cancel input' },
    { key: 'DEL', desc: 'Remove currently selected item from cart' },
    { key: 'Enter', desc: 'Submit barcode scan / Complete cash payment' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2 text-slate-800">
            <Keyboard className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-base">POS Keyboard Shortcuts</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-2.5">
          <p className="text-xs text-slate-500 mb-3">
            Designed for high-speed cashier throughput without touching the mouse.
          </p>

          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
            {shortcuts.map((sc) => (
              <div
                key={sc.key}
                className="flex items-center justify-between px-3.5 py-2.5 text-xs bg-white hover:bg-slate-50"
              >
                <span className="text-slate-700 font-medium">{sc.desc}</span>
                <kbd className="px-2.5 py-1 bg-slate-100 border border-slate-300 rounded font-mono font-bold text-slate-800 text-[11px] shadow-xs">
                  {sc.key}
                </kbd>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs"
            >
              Got it (ESC)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
