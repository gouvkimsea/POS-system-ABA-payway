'use client';

import React, { useState } from 'react';
import { PosCartItem, PosCustomer } from '@pos/types';
import { ShoppingBag, ArrowUp, X } from 'lucide-react';
import { CartArea } from './CartArea';

interface MobileCartDrawerProps {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
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

export const MobileCartDrawer: React.FC<MobileCartDrawerProps> = ({
  isOpen,
  onOpen,
  onClose,
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
  const totalUSD = cart.reduce((sum, item) => sum + item.totalUSD, 0) - discountUSD;
  const totalItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Touch Swipe Gesture State
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchDelta, setTouchDelta] = useState<number>(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientY);
    setTouchDelta(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const currentY = e.targetTouches[0].clientY;
    const diff = currentY - touchStart;
    if (diff > 0) {
      setTouchDelta(diff);
    }
  };

  const handleTouchEnd = () => {
    if (touchDelta > 70) {
      onClose();
    }
    setTouchStart(null);
    setTouchDelta(0);
  };

  return (
    <>
      {/* 1. Sticky Floating Bar on Mobile (Positioned right above BottomNav bar) */}
      <div className="lg:hidden fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] inset-x-0 p-2.5 z-30 pointer-events-none">
        <button
          onClick={onOpen}
          className="pointer-events-auto w-full max-w-lg mx-auto py-2.5 px-4 bg-slate-900 text-white rounded-lg flex items-center justify-between border border-slate-800 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="w-8 h-8 rounded-lg bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <ShoppingBag className="w-4 h-4" />
              </div>
              {totalItemsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-emerald-600 text-white font-bold text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                  {totalItemsCount}
                </span>
              )}
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-200">
              {cart.length === 0 ? 'View Cart' : `Order (${totalItemsCount})`}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="font-bold text-sm sm:text-base text-emerald-400 font-mono">
              ${Math.max(0, totalUSD).toFixed(2)}
            </span>
            <div className="flex items-center gap-1 text-xs bg-emerald-600 text-white px-2.5 py-1 rounded-lg font-semibold">
              <span>Checkout</span>
              <ArrowUp className="w-3.5 h-3.5" />
            </div>
          </div>
        </button>
      </div>

      {/* 2. Slide-up Modal Drawer for Mobile with Touch Gesture */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/70"
          onClick={onClose}
        >
          <div
            className="bg-slate-900 rounded-t-xl max-h-[92dvh] h-[92dvh] flex flex-col overflow-hidden border-t border-slate-700"
            style={{ transform: touchDelta > 0 ? `translateY(${touchDelta}px)` : undefined }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Swipe Handle & Header */}
            <div
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              className="pt-2 pb-3 px-4 border-b border-slate-800 bg-slate-950 shrink-0 cursor-grab active:cursor-grabbing select-none"
            >
              {/* Visual Pull Handle */}
              <div className="w-12 h-1.5 rounded-full bg-slate-700 mx-auto mb-2" />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                    POS
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-100 leading-none">
                      Active Cart
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {cart.length} item(s) &bull; {totalItemsCount} units
                    </p>
                  </div>
                </div>

                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors min-h-[36px] min-w-[36px]"
                  aria-label="Close cart drawer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Cart Area Content */}
            <div className="flex-1 overflow-hidden">
              <CartArea
                cart={cart}
                customer={customer}
                onOpenCustomerModal={onOpenCustomerModal}
                onUpdateQuantity={onUpdateQuantity}
                onRemoveItem={onRemoveItem}
                onApplyLineDiscount={onApplyLineDiscount}
                onClearCart={onClearCart}
                onHoldSale={onHoldSale}
                onOpenPaymentModal={() => {
                  onClose();
                  onOpenPaymentModal();
                }}
                selectedItemId={selectedItemId}
                onSelectItem={onSelectItem}
                discountUSD={discountUSD}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
