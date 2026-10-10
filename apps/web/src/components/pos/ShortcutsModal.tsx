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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
      <div className="bg-slate-900 rounded-lg max-w-md w-full shadow-xl border border-slate-800 overflow-hidden text-slate-100">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2 text-white">
            <Keyboard className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-base">Keyboard Shortcuts</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-2.5">
          <p className="text-xs text-slate-400 mb-3">
            Quick keys for common register actions.
          </p>

          <div className="divide-y divide-slate-800 border border-slate-800 rounded-lg overflow-hidden">
            {shortcuts.map((sc) => (
              <div
                key={sc.key}
                className="flex items-center justify-between px-3.5 py-2.5 text-xs bg-slate-900 hover:bg-slate-800"
              >
                <span className="text-slate-300 font-medium">{sc.desc}</span>
                <kbd className="px-2.5 py-1 bg-slate-950 border border-slate-700 rounded font-mono font-bold text-slate-200 text-[11px]">
                  {sc.key}
                </kbd>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-xs"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
