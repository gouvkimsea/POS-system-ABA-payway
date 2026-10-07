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
  const [editingDiscountId, setEditingDiscountId] = useState<string | null>(null);
  const [discountVal, setDiscountVal] = useState<string>('');

  // Calculations
  const subtotalUSD = cart.reduce((sum, item) => sum + item.totalUSD, 0);
  const finalTotalUSD = Math.max(0, Number((subtotalUSD - discountUSD).toFixed(2)));
  const finalTotalKHR = Math.round(finalTotalUSD * 4100);
  const totalItemUnits = cart.reduce((sum, item) => sum + item.quantity, 0);
  const taxUSD = Number((finalTotalUSD * 0.1).toFixed(2)); // 10% VAT

  const handleSaveDiscount = (productId: string) => {
    const val = parseFloat(discountVal) || 0;
    onApplyLineDiscount(productId, val);
    setEditingDiscountId(null);
    setDiscountVal('');
  };

  return (
    <div className="flex flex-col h-full bg-white border-l border-slate-200 select-none overflow-hidden">
      {/* 1. Customer Selection Bar (F4) */}
      <div className="p-2.5 sm:p-3 border-b border-slate-200 bg-slate-50/80 shrink-0">
        <button
          onClick={onOpenCustomerModal}
          className="w-full p-2 bg-white hover:bg-slate-50 border border-slate-200 hover:border-indigo-300 rounded-xl flex items-center justify-between text-left transition-all shadow-2xs group"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <User className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider leading-none">
                Customer (F4)
              </div>
              <div className="text-xs sm:text-sm font-bold text-slate-900 truncate mt-0.5">
                {customer ? customer.name : 'Walk-in Customer'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-400 group-hover:text-indigo-600 font-semibold shrink-0">
            {customer && customer.loyaltyPoints > 0 && (
              <span className="text-[11px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                {customer.loyaltyPoints} pts
              </span>
            )}
            <ChevronRight className="w-4 h-4" />
          </div>
        </button>
      </div>

      {/* 2. Cart Controls Header */}
      <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500 shrink-0 bg-white">
        <span className="font-bold text-slate-700">
          Current Cart ({cart.length} items &bull; {totalItemUnits} units)
        </span>
        <div className="flex items-center gap-1">
          <button
            disabled={cart.length === 0}
            onClick={onHoldSale}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40 font-semibold text-[11px] transition-colors"
            title="Park / Hold Sale"
          >
            <PauseCircle className="w-3.5 h-3.5 text-amber-500" />
            <span>Hold</span>
          </button>
          <button
            disabled={cart.length === 0}
            onClick={onClearCart}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-slate-600 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-40 font-semibold text-[11px] transition-colors"
            title="Clear Cart"
          >
            <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-rose-600" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* 3. Cart Items List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-400">
            <div className="w-14 h-14 rounded-full bg-slate-50 text-slate-300 flex items-center justify-center mb-3">
              <ShoppingBag className="w-7 h-7" />
            </div>
            <h4 className="font-bold text-slate-700 text-sm mb-1">Cart is Empty</h4>
            <p className="text-xs text-slate-400 max-w-[200px] mb-4">
              Scan a barcode or tap products from the catalog to ring up items.
            </p>
            <div className="p-3 bg-slate-50 rounded-xl text-[11px] text-slate-500 space-y-1 border border-slate-100 font-mono text-left w-full max-w-[220px]">
              <div>
                <strong className="text-slate-700">F1</strong> : Search products
              </div>
              <div>
                <strong className="text-slate-700">F2</strong> : Barcode scanner
              </div>
              <div>
                <strong className="text-slate-700">F4</strong> : Select customer
              </div>
              <div>
                <strong className="text-slate-700">F8</strong> : Quick checkout
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
                className={`p-2.5 rounded-xl transition-all flex flex-col gap-2 ${
                  isSelected
                    ? 'bg-indigo-50/70 border border-indigo-200 ring-2 ring-indigo-500/10'
                    : 'bg-white hover:bg-slate-50 border border-transparent'
                }`}
              >
                {/* Item Details Line */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h5 className="font-bold text-xs sm:text-[13px] text-slate-800 line-clamp-1 leading-snug">
                      {item.product.name}
                    </h5>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono mt-0.5">
                      <span>${item.unitPriceUSD.toFixed(2)}</span>
                      <span>&bull;</span>
                      <span>{item.product.sellingPriceKHR.toLocaleString()} ៛</span>
                      {item.discountUSD > 0 && (
                        <span className="text-rose-600 font-semibold font-sans">
                          (-${item.discountUSD.toFixed(2)})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Line Total */}
                  <div className="text-right shrink-0">
                    <div className="font-extrabold text-xs sm:text-sm text-slate-900">
                      ${item.totalUSD.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium">
                      {item.totalKHR.toLocaleString()} ៛
                    </div>
                  </div>
                </div>

                {/* Controls Line: Quantity Stepper, Discount, Remove */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                  {/* Quantity Stepper */}
                  <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateQuantity(item.product.id, item.quantity - 1);
                      }}
                      className="w-7 h-7 rounded-md bg-white hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs transition-colors shadow-2xs"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-9 text-center font-bold text-xs text-slate-800">
                      {item.quantity}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateQuantity(item.product.id, item.quantity + 1);
                      }}
                      className="w-7 h-7 rounded-md bg-white hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs transition-colors shadow-2xs"
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
                          className="w-16 px-1.5 py-1 bg-white border border-indigo-400 rounded text-xs text-slate-800"
                        />
                        <button
                          onClick={() => handleSaveDiscount(item.product.id)}
                          className="px-2 py-1 bg-indigo-600 text-white rounded text-[10px] font-bold"
                        >
                          OK
                        </button>
                        <button
                          onClick={() => setEditingDiscountId(null)}
                          className="text-slate-400 hover:text-slate-600 text-xs px-1"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingDiscountId(item.product.id);
                          setDiscountVal(item.discountUSD ? String(item.discountUSD) : '');
                        }}
                        className={`text-[11px] font-medium px-2 py-1 rounded flex items-center gap-1 transition-colors ${
                          item.discountUSD > 0
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                        }`}
                        title="Add Item Discount"
                      >
                        <Percent className="w-3 h-3" />
                        <span>{item.discountUSD > 0 ? `-$${item.discountUSD}` : 'Discount'}</span>
                      </button>
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveItem(item.product.id);
                      }}
                      className="w-7 h-7 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors"
                      title="Remove Item (Delete)"
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
      <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 shrink-0 space-y-3">
        {/* Breakdown */}
        <div className="space-y-1 text-xs">
          <div className="flex justify-between text-slate-500">
            <span>Subtotal</span>
            <span className="font-medium text-slate-800">${subtotalUSD.toFixed(2)}</span>
          </div>
          {discountUSD > 0 && (
            <div className="flex justify-between text-rose-600 font-medium">
              <span>Order Discount</span>
              <span>-${discountUSD.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-slate-400 text-[11px]">
            <span>Tax (10% VAT inc.)</span>
            <span>${taxUSD.toFixed(2)}</span>
          </div>

          {/* Grand Total */}
          <div className="pt-2 border-t border-slate-200 flex items-baseline justify-between">
            <span className="font-extrabold text-sm sm:text-base text-slate-900 uppercase tracking-tight">
              Total Due
            </span>
            <div className="text-right">
              <div className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight leading-none">
                ${finalTotalUSD.toFixed(2)}
              </div>
              <div className="text-xs font-bold text-indigo-700 mt-0.5">
                {finalTotalKHR.toLocaleString()} ៛
              </div>
            </div>
          </div>
        </div>

        {/* Big Touch Pay Button (F8) */}
        <button
          disabled={cart.length === 0}
          onClick={onOpenPaymentModal}
          className="w-full py-3.5 sm:py-4 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-black text-sm sm:text-base rounded-2xl shadow-md hover:shadow-lg transition-all flex items-center justify-between cursor-pointer disabled:cursor-not-allowed active:scale-[0.99]"
        >
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-emerald-100" />
            <span>PAY NOW (F8)</span>
          </div>
          <div className="text-right font-mono text-sm sm:text-base">
            ${finalTotalUSD.toFixed(2)}
          </div>
        </button>
      </div>
    </div>
  );
};
