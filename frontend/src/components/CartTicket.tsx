'use client';

import React from 'react';
import { Trash2, Plus, Minus, ShoppingCart, Tag, ArrowRight } from 'lucide-react';
import { CartItem, Currency } from '../lib/types';

interface CartTicketProps {
  items: CartItem[];
  onUpdateQuantity: (productId: string, delta: number) => void;
  onRemoveItem: (productId: string) => void;
  onClearCart: () => void;
  discountType: 'NONE' | 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue: number;
  onSetDiscount: (type: 'NONE' | 'PERCENTAGE' | 'FIXED_AMOUNT', value: number) => void;
  currency: Currency;
  exchangeRateKHR: number;
  onOpenCheckout: () => void;
}

export const CartTicket: React.FC<CartTicketProps> = ({
  items,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  discountType,
  discountValue,
  onSetDiscount,
  exchangeRateKHR,
  onOpenCheckout,
}) => {
  // Calculations
  const subtotalUSD = items.reduce((acc, item) => acc + item.product.sellingPriceUSD * item.quantity, 0);

  let discountUSD = 0;
  if (discountType === 'PERCENTAGE') {
    discountUSD = (subtotalUSD * discountValue) / 100;
  } else if (discountType === 'FIXED_AMOUNT') {
    discountUSD = Math.min(subtotalUSD, discountValue);
  }

  const taxableAmount = Math.max(0, subtotalUSD - discountUSD);
  const taxUSD = taxableAmount * 0.10; // 10% tax
  const totalUSD = taxableAmount + taxUSD;
  const totalKHR = Math.round((totalUSD * exchangeRateKHR) / 100) * 100;

  const totalItemsCount = items.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <div className="w-full md:w-[380px] lg:w-[420px] bg-white border-l border-slate-200 flex flex-col h-full shadow-lg shrink-0 select-none">
      {/* Ticket Header */}
      <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <ShoppingCart className="w-5 h-5 text-blue-400" />
          <h2 className="font-bold text-sm tracking-wide">Current Order</h2>
          <span className="bg-blue-600 text-white font-mono text-xs px-2 py-0.5 rounded-full font-bold">
            {totalItemsCount}
          </span>
        </div>
        {items.length > 0 && (
          <button
            onClick={onClearCart}
            className="text-xs text-red-400 hover:text-red-300 font-medium transition flex items-center space-x-1"
            title="Clear all items in cart"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        )}
      </div>

      {/* Cart Items List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-3">
              <ShoppingCart className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-sm font-semibold text-slate-600">Cart is empty</p>
            <p className="text-xs text-slate-400 mt-1 max-w-[200px]">
              Scan barcode or tap products from catalog to start sale
            </p>
          </div>
        ) : (
          items.map((item) => {
            const itemTotalUSD = item.product.sellingPriceUSD * item.quantity;
            const itemTotalKHR = Math.round((itemTotalUSD * exchangeRateKHR) / 100) * 100;

            return (
              <div
                key={item.product.id}
                className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col justify-between hover:border-slate-300 transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-semibold text-xs text-slate-800 line-clamp-1">
                      {item.product.name}
                    </h4>
                    <p className="text-[11px] text-slate-500 font-mono">
                      ${item.product.sellingPriceUSD.toFixed(2)} each
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-bold text-slate-900 text-sm font-mono block">
                      ${itemTotalUSD.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono block">
                      {itemTotalKHR.toLocaleString()} ៛
                    </span>
                  </div>
                </div>

                {/* Quantity Controls */}
                <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-200/60">
                  <button
                    onClick={() => onRemoveItem(item.product.id)}
                    className="text-slate-400 hover:text-red-500 p-1 transition"
                    title="Remove item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  <div className="flex items-center space-x-1 bg-white border border-slate-300 rounded-lg p-0.5 shadow-sm">
                    <button
                      onClick={() => onUpdateQuantity(item.product.id, -1)}
                      className="w-7 h-7 flex items-center justify-center rounded bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 transition"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-8 text-center font-bold text-xs font-mono text-slate-900">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => onUpdateQuantity(item.product.id, 1)}
                      className="w-7 h-7 flex items-center justify-center rounded bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Ticket Footer Financial Totals & Checkout Button */}
      <div className="p-3.5 bg-slate-50 border-t border-slate-200 shrink-0 space-y-2.5">
        {/* Quick Discount Controls */}
        <div className="flex items-center justify-between text-xs pb-1 border-b border-slate-200">
          <span className="text-slate-500 font-medium flex items-center">
            <Tag className="w-3.5 h-3.5 mr-1 text-slate-400" />
            Discount:
          </span>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => onSetDiscount('NONE', 0)}
              className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                discountType === 'NONE'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              0%
            </button>
            <button
              onClick={() => onSetDiscount('PERCENTAGE', 5)}
              className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                discountType === 'PERCENTAGE' && discountValue === 5
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              5%
            </button>
            <button
              onClick={() => onSetDiscount('PERCENTAGE', 10)}
              className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                discountType === 'PERCENTAGE' && discountValue === 10
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              10%
            </button>
          </div>
        </div>

        {/* Calculation summary */}
        <div className="space-y-1 text-xs">
          <div className="flex justify-between text-slate-500">
            <span>Subtotal</span>
            <span className="font-mono text-slate-700">${subtotalUSD.toFixed(2)}</span>
          </div>

          {discountUSD > 0 && (
            <div className="flex justify-between text-emerald-600 font-medium">
              <span>Discount</span>
              <span className="font-mono">-${discountUSD.toFixed(2)}</span>
            </div>
          )}

          <div className="flex justify-between text-slate-500">
            <span>Tax (10% VAT)</span>
            <span className="font-mono text-slate-700">${taxUSD.toFixed(2)}</span>
          </div>
        </div>

        {/* Grand Total Display */}
        <div className="bg-slate-900 text-white p-3 rounded-xl flex items-center justify-between shadow-md">
          <div>
            <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Total Due</div>
            <div className="text-2xl font-black font-mono text-white tracking-tight">
              ${totalUSD.toFixed(2)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider font-mono">KHR</div>
            <div className="text-lg font-bold font-mono text-amber-400">
              {totalKHR.toLocaleString()} ៛
            </div>
          </div>
        </div>

        {/* Checkout Button */}
        <button
          onClick={onOpenCheckout}
          disabled={items.length === 0}
          className={`w-full py-3.5 rounded-xl font-bold text-base transition flex items-center justify-center space-x-2 shadow-md active:scale-[0.98] ${
            items.length === 0
              ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
          }`}
          title="Proceed to payment (F9)"
        >
          <span>Charge ${totalUSD.toFixed(2)}</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
