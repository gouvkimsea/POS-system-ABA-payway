'use client';

import React, { useState } from 'react';
import { PosCartItem, PosCustomer } from '@pos/types';
import {
  User,
  Trash2,
  PauseCircle,
  Plus,
  Minus,
  X,
  CreditCard,
  ShoppingBag,
  Percent,
  ChevronRight,
} from 'lucide-react';
import { useSettings } from '../../lib/settings-context';

interface CartAreaProps {
  cart: PosCartItem[];
  customer: PosCustomer | null;
  onOpenCustomerModal: () => void;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemoveItem: (productId: string) => void;
  onApplyLineDiscount: (productId: string, discountUSD: number) => void;
  onClearCart: () => void;
  onHoldSale: () => void;
  onOpenPaymentModal: () => void;
  selectedItemId: string | null;
  onSelectItem: (productId: string) => void;
  discountUSD: number;
}

export const CartArea: React.FC<CartAreaProps> = ({
  cart,
  customer,
  onOpenCustomerModal,
  onUpdateQuantity,
  onRemoveItem,
  onApplyLineDiscount,
  onClearCart,
  onHoldSale,
  onOpenPaymentModal,
  selectedItemId,
  onSelectItem,
  discountUSD,
}) => {
  const { settings, formatCurrency } = useSettings();
  const [editingDiscountId, setEditingDiscountId] = useState<string | null>(null);
  const [discountVal, setDiscountVal] = useState<string>('');

  // Calculations
  const subtotalUSD = cart.reduce((sum, item) => sum + item.totalUSD, 0);
  const finalTotalUSD = Math.max(0, Number((subtotalUSD - discountUSD).toFixed(2)));
  const finalTotalKHR = Math.round(finalTotalUSD * 4100);
  const totalItemUnits = cart.reduce((sum, item) => sum + item.quantity, 0);
  const taxRatePercent = settings.store?.tax?.defaultTaxRate ?? 10;
  const taxUSD = Number((finalTotalUSD * (taxRatePercent / 100)).toFixed(2));

  const handleSaveDiscount = (productId: string) => {
    const val = parseFloat(discountVal) || 0;
    onApplyLineDiscount(productId, val);
    setEditingDiscountId(null);
    setDiscountVal('');
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-slate-800 text-slate-100 select-none overflow-hidden">
      {/* 1. Customer Selection Bar (F4) */}
      <div className="p-2.5 sm:p-3 border-b border-slate-800 bg-slate-950/60 shrink-0">
        <button
          onClick={onOpenCustomerModal}
          className="w-full p-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 rounded-lg flex items-center justify-between text-left transition-colors group"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-md bg-emerald-950/80 text-emerald-400 border border-emerald-800/80 flex items-center justify-center shrink-0">
              <User className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">
                Customer (F4)
              </div>
              <div className="text-xs sm:text-sm font-semibold text-slate-100 truncate mt-0.5">
                {customer ? customer.name : 'Walk-in Customer'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-400 group-hover:text-emerald-400 font-medium shrink-0">
            {customer && customer.loyaltyPoints > 0 && (
              <span className="text-[10px] bg-amber-950 text-amber-300 border border-amber-800/80 font-bold px-1.5 py-0.5 rounded-full">
                {customer.loyaltyPoints} pts
              </span>
            )}
            <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-colors" />
          </div>
        </button>
      </div>

      {/* 2. Cart Controls Header */}
      <div className="px-3 py-2 border-b border-slate-800/80 flex items-center justify-between text-xs text-slate-400 shrink-0 bg-slate-900">
        <span className="font-semibold text-slate-200">
          Current Cart ({cart.length} items &bull; {totalItemUnits} units)
        </span>
        <div className="flex items-center gap-1">
          <button
            disabled={cart.length === 0}
            onClick={onHoldSale}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-slate-400 hover:text-amber-300 hover:bg-slate-800 disabled:opacity-40 font-semibold text-[11px] transition-colors"
            title="Hold sale"
          >
            <PauseCircle className="w-3.5 h-3.5 text-amber-400" />
            <span>Hold</span>
          </button>
          <button
            disabled={cart.length === 0}
            onClick={onClearCart}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 disabled:opacity-40 font-semibold text-[11px] transition-colors"
            title="Clear cart"
          >
            <Trash2 className="w-3.5 h-3.5 text-slate-500 hover:text-rose-400" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* 3. Cart Items List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 p-2 space-y-1">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-400">
            <div className="w-12 h-12 rounded-lg bg-slate-950 border border-slate-800 text-slate-500 flex items-center justify-center mb-3">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <h4 className="font-semibold text-slate-200 text-sm mb-1">Cart is empty</h4>
            <p className="text-xs text-slate-400 max-w-[200px] mb-4">
              Scan a barcode or click products to begin checkout.
            </p>
            <div className="p-3 bg-slate-950 rounded-lg text-[11px] text-slate-400 space-y-1 border border-slate-800 font-mono text-left w-full max-w-[220px]">
              <div>
                <strong className="text-slate-200 font-sans">F1</strong> : Search catalog
              </div>
              <div>
                <strong className="text-slate-200 font-sans">F2</strong> : Barcode wedge
              </div>
              <div>
                <strong className="text-slate-200 font-sans">F4</strong> : Select customer
              </div>
              <div>
                <strong className="text-slate-200 font-sans">F8</strong> : Settle payment
              </div>
            </div>
          </div>
        ) : (
          cart.map((item) => {
            const isSelected = selectedItemId === item.product.id;
            return (
              <div
                key={item.product.id}
                onClick={() => onSelectItem(item.product.id)}
                className={`p-2.5 rounded-lg transition-colors flex flex-col gap-2 ${
                  isSelected
                    ? 'bg-slate-900 border border-emerald-500/50'
                    : 'bg-slate-950/60 hover:bg-slate-950 border border-slate-800/80'
                }`}
              >
                {/* Item Details Line */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h5 className="font-semibold text-xs sm:text-[13px] text-slate-100 line-clamp-1 leading-snug">
                      {item.product.name}
                    </h5>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono mt-0.5">
                      <span>{formatCurrency(item.unitPriceUSD, 'USD')}</span>
                      <span>&bull;</span>
                      <span>{formatCurrency(item.product.sellingPriceKHR, 'KHR')}</span>
                      {item.discountUSD > 0 && (
                        <span className="text-rose-400 font-semibold font-sans">
                          (-{formatCurrency(item.discountUSD, 'USD')})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Line Total */}
                  <div className="text-right shrink-0">
                    <div className="font-bold font-mono text-xs sm:text-sm text-emerald-400">
                      {formatCurrency(item.totalUSD, 'USD')}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {formatCurrency(item.totalKHR, 'KHR')}
                    </div>
                  </div>
                </div>

                {/* Controls Line: Quantity Stepper, Discount, Remove */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                  {/* Quantity Stepper */}
                  <div className="flex items-center bg-slate-900 rounded-md p-0.5 border border-slate-700/80">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateQuantity(item.product.id, item.quantity - 1);
                      }}
                      className="w-7 h-7 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center font-bold text-xs transition-colors"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-9 text-center font-bold font-mono text-xs text-slate-100">
                      {item.quantity}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateQuantity(item.product.id, item.quantity + 1);
                      }}
                      className="w-7 h-7 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center font-bold text-xs transition-colors"
                      aria-label="Increase quantity"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Item Discount & Remove Action */}
                  <div className="flex items-center gap-2">
                    {editingDiscountId === item.product.id ? (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="number"
                          step="0.01"
                          autoFocus
                          value={discountVal}
                          onChange={(e) => setDiscountVal(e.target.value)}
                          placeholder="$"
                          className="w-16 px-1.5 py-1 bg-slate-900 border border-emerald-500 rounded text-xs font-mono text-slate-100"
                        />
                        <button
                          onClick={() => handleSaveDiscount(item.product.id)}
                          className="px-2 py-1 bg-emerald-600 text-white rounded text-[10px] font-bold"
                        >
                          OK
                        </button>
                        <button
                          onClick={() => setEditingDiscountId(null)}
                          className="text-slate-400 hover:text-slate-200 p-0.5"
                          aria-label="Cancel discount"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingDiscountId(item.product.id);
                          setDiscountVal(item.discountUSD ? String(item.discountUSD) : '');
                        }}
                        className={`text-[11px] font-medium px-2 py-1 rounded-md flex items-center gap-1 transition-colors border ${
                          item.discountUSD > 0
                            ? 'bg-rose-950/60 text-rose-300 border-rose-800'
                            : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border-slate-800'
                        }`}
                        title="Discount"
                      >
                        <Percent className="w-3 h-3" />
                        <span>
                          {item.discountUSD > 0
                            ? `-${formatCurrency(item.discountUSD, 'USD')}`
                            : 'Discount'}
                        </span>
                      </button>
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveItem(item.product.id);
                      }}
                      className="w-7 h-7 rounded-md text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 flex items-center justify-center transition-colors"
                      title="Remove item"
                      aria-label="Remove item"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 4. Financial Summary & Checkout Action */}
      <div className="p-3 sm:p-4 bg-slate-950/80 border-t border-slate-800 shrink-0 space-y-3">
        {/* Breakdown */}
        <div className="space-y-1 text-xs">
          <div className="flex justify-between text-slate-400">
            <span>Subtotal</span>
            <span className="font-mono font-medium text-slate-200">{formatCurrency(subtotalUSD, 'USD')}</span>
          </div>
          {discountUSD > 0 && (
            <div className="flex justify-between text-rose-400 font-medium font-mono">
              <span>Order Discount</span>
              <span>-{formatCurrency(discountUSD, 'USD')}</span>
            </div>
          )}
          <div className="flex justify-between text-slate-400 text-[11px]">
            <span>
              Tax ({taxRatePercent}% VAT {settings.store?.tax?.isTaxInclusive ? 'inc.' : 'excl.'})
            </span>
            <span className="font-mono">{formatCurrency(taxUSD, 'USD')}</span>
          </div>

          {/* Grand Total */}
          <div className="pt-2 border-t border-slate-800 flex items-baseline justify-between">
            <span className="font-bold text-xs sm:text-sm text-slate-200 uppercase tracking-wider">
              Total Due
            </span>
            <div className="text-right">
              <div className="text-xl sm:text-2xl font-black text-white font-mono tracking-tight leading-none">
                {formatCurrency(finalTotalUSD, 'USD')}
              </div>
              <div className="text-xs font-bold text-amber-400 font-mono mt-0.5">
                {formatCurrency(finalTotalKHR, 'KHR')}
              </div>
            </div>
          </div>
        </div>

        {/* Big Touch Pay Button (F8) */}
        <button
          disabled={cart.length === 0}
          onClick={onOpenPaymentModal}
          className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800/80 disabled:text-slate-600 text-white font-bold text-sm sm:text-base rounded-lg shadow-sm transition-colors flex items-center justify-between cursor-pointer disabled:cursor-not-allowed"
        >
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-emerald-100" />
            <span>Pay (F8)</span>
          </div>
          <div className="text-right font-mono font-bold text-sm sm:text-base">
            {formatCurrency(finalTotalUSD, 'USD')}
          </div>
        </button>
      </div>
    </div>
  );
};
