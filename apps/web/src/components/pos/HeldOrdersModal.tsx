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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85dvh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2 text-slate-800">
            <PauseCircle className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-base">Held Orders ({heldOrders.length})</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* List of Held Orders */}
        <div className="p-5 flex-1 overflow-y-auto space-y-3">
          {heldOrders.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <ShoppingBag className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-semibold text-slate-600">No Orders on Hold</p>
              <p className="text-xs text-slate-400 mt-1">
                Use the &quot;Hold Sale&quot; button on the cart to temporarily park an order.
              </p>
            </div>
          ) : (
            heldOrders.map((order) => (
              <div
                key={order.id}
                className="bg-white rounded-xl border border-slate-200 p-4 hover:border-amber-400 transition-all shadow-xs flex flex-col gap-2.5"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono font-bold text-xs text-indigo-600">
                      {order.orderNumber}
                    </span>
                    <div className="font-semibold text-sm text-slate-800 mt-0.5">
                      {order.customerName ? order.customerName : 'Walk-in Customer'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-extrabold text-base text-slate-900">
                      ${order.totalUSD.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium">
                      {order.totalKHR.toLocaleString()} ៛
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
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
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Discard Held Order"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onRecall(order)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs transition-colors shadow-xs"
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
