'use client';

import React from 'react';
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

  return (
    <>
      {/* 1. Sticky Bottom Floating Bar on Mobile */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-200 p-2.5 z-40 shadow-lg">
        <button
          onClick={onOpen}
          className="w-full py-3 px-4 bg-slate-900 text-white rounded-2xl flex items-center justify-between shadow-md active:scale-[0.99] transition-all"
        >
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <ShoppingBag className="w-5 h-5 text-indigo-400" />
              {totalItemsCount > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-indigo-600 text-white font-bold text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                  {totalItemsCount}
                </span>
              )}
            </div>
            <span className="text-xs font-bold uppercase tracking-wider">
              {cart.length === 0 ? 'Empty Cart' : `Cart (${totalItemsCount})`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-extrabold text-sm sm:text-base text-emerald-400">
              ${Math.max(0, totalUSD).toFixed(2)}
            </span>
            <div className="flex items-center gap-1 text-xs bg-slate-800 text-slate-300 px-2 py-1 rounded-lg font-bold">
              <span>View</span>
              <ArrowUp className="w-3.5 h-3.5" />
            </div>
          </div>
        </button>
      </div>

      {/* 2. Slide-up Modal Drawer for Mobile */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-t-3xl max-h-[92vh] h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200 border-t border-slate-200">
            {/* Drawer Handle & Close Header */}
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                  POS
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 leading-none">
                    Current Order
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {cart.length} items &bull; {totalItemsCount} units
                  </p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center transition-colors"
                aria-label="Close cart drawer"
              >
                <X className="w-4 h-4" />
              </button>
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
