'use client';

import React from 'react';
import { HeldOrderSummary } from '@pos/types';
import { X, PauseCircle, Clock, Trash2, ArrowUpRight, ShoppingBag } from 'lucide-react';

interface HeldOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  heldOrders: HeldOrderSummary[];
  onRecall: (heldOrder: HeldOrderSummary) => void;
  onDelete: (heldOrderId: string) => void;
}

export const HeldOrdersModal: React.FC<HeldOrdersModalProps> = ({
  isOpen,
  onClose,
  heldOrders,
  onRecall,
  onDelete,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 sm:p-4">
      <div className="bg-slate-900 rounded-lg max-w-lg w-full shadow-2xl border border-slate-800 overflow-hidden flex flex-col max-h-[85dvh] text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2 text-white">
            <PauseCircle className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-base">Held Orders ({heldOrders.length})</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* List of Held Orders */}
        <div className="p-5 flex-1 overflow-y-auto space-y-3">
          {heldOrders.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <div className="w-12 h-12 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center mx-auto mb-3 text-slate-500">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-200">No orders on hold</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                Press Hold in the cart during a sale to park an order for later checkout.
              </p>
            </div>
          ) : (
            heldOrders.map((order) => (
              <div
                key={order.id}
                className="bg-slate-950/80 rounded-lg border border-slate-800 p-4 hover:border-amber-500/50 hover:bg-slate-950 transition-colors flex flex-col gap-2.5"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono font-bold text-xs text-amber-400">
                      {order.orderNumber}
                    </span>
                    <div className="font-semibold text-sm text-slate-200 mt-0.5">
                      {order.customerName ? order.customerName : 'Walk-in Customer'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold font-mono text-base text-emerald-400">
                      ${order.totalUSD.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {order.totalKHR.toLocaleString()} ៛
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/80">
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <Clock className="w-3.5 h-3.5" />
                    <span>
                      {new Date(order.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span>&bull; {order.itemCount} items</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onDelete(order.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors"
                      title="Delete order"
                      aria-label="Delete order"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onRecall(order)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs transition-colors shadow-xs"
                    >
                      <span>Recall</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
