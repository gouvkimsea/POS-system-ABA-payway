'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../lib/auth-context';
import { AuthGuard } from '../../components/AuthGuard';
import {
  PosInitData,
  PosProduct,
  PosCartItem,
  PosCustomer,
  HeldOrderSummary,
  CheckoutResult,
} from '@pos/types';
import { PosHeader } from '../../components/pos/PosHeader';
import { CategoryNav } from '../../components/pos/CategoryNav';
import { ProductSearchBarcode } from '../../components/pos/ProductSearchBarcode';
import { ProductGrid } from '../../components/pos/ProductGrid';
import { CartArea } from '../../components/pos/CartArea';
import { MobileCartDrawer } from '../../components/pos/MobileCartDrawer';
import { CustomerModal } from '../../components/pos/CustomerModal';
import { HeldOrdersModal } from '../../components/pos/HeldOrdersModal';
import { PaymentModal } from '../../components/pos/PaymentModal';
import { ReceiptModal } from '../../components/pos/ReceiptModal';
import { ShortcutsModal } from '../../components/pos/ShortcutsModal';
import { CameraScannerModal } from '../../components/pos/CameraScannerModal';
import { posSounds } from '../../components/pos/SoundEffects';
import { scannerService } from '../../lib/hardware/ScannerService';
import { customerDisplayService } from '../../lib/hardware/CustomerDisplayService';
import { cashDrawerService } from '../../lib/hardware/CashDrawerService';
import { useRouter } from 'next/navigation';

export default function PosPage() {
  return (
    <AuthGuard requiredPermission="sales.create">
      <PosTerminalContent />
    </AuthGuard>
  );
}

const CACHE_KEY = 'pos_terminal_cache_v1';
const HELD_CACHE_KEY = 'pos_held_orders_cache_v1';

function PosTerminalContent() {
  const { user, token } = useAuth();
  const router = useRouter();

  // Initialization State
  const [initData, setInitData] = useState<PosInitData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isOnline, setIsOnline] = useState<boolean>(true);

  // Catalog & Navigation State
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [barcodeQuery, setBarcodeQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Cart & Customer State
  const [cart, setCart] = useState<PosCartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<PosCustomer | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [discountUSD] = useState<number>(0);

  // Modals State
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState<boolean>(false);
  const [isHeldModalOpen, setIsHeldModalOpen] = useState<boolean>(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState<boolean>(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState<boolean>(false);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState<boolean>(false);
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState<boolean>(false);

  // Transaction State
  const [isProcessingPayment, setIsProcessingPayment] = useState<boolean>(false);
  const [lastReceipt, setLastReceipt] = useState<CheckoutResult | null>(null);
  const [heldOrders, setHeldOrders] = useState<HeldOrderSummary[]>([]);
  const [notification, setNotification] = useState<{
    message: string;
    type: 'info' | 'success' | 'warn';
  } | null>(null);

  // Refs for keyboard shortcuts focus
  const searchInputRef = useRef<HTMLInputElement>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

  const showNotification = useCallback(
    (message: string, type: 'info' | 'success' | 'warn' = 'info') => {
      setNotification({ message, type });
      setTimeout(() => {
        setNotification((curr) => (curr?.message === message ? null : curr));
      }, 3000);
    },
    [],
  );

  // 1. Fetch POS Init Data
  const loadTerminalData = useCallback(async () => {
    setIsLoading(true);
    setIsError(false);
    try {
      const res = await fetch(`${apiUrl}/pos/init`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data.success && data.data) {
        setInitData(data.data);
        setIsOnline(true);
        // Cache data for offline capability
        localStorage.setItem(CACHE_KEY, JSON.stringify(data.data));
      } else {
        throw new Error(data.error?.message || 'Failed to initialize terminal');
      }

      // Fetch active held orders
      const heldRes = await fetch(`${apiUrl}/pos/held-orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (heldRes.ok) {
        const heldData = await heldRes.json();
        if (heldData.success) {
          setHeldOrders(heldData.data);
          localStorage.setItem(HELD_CACHE_KEY, JSON.stringify(heldData.data));
        }
      }
    } catch (err: any) {
      console.warn('[POS] API request failed, attempting local cache fallback:', err);
      // Attempt cache recovery
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        setInitData(JSON.parse(cached));
        setIsOnline(false);
        showNotification('Operating in Offline Cache mode', 'warn');
        const cachedHeld = localStorage.getItem(HELD_CACHE_KEY);
        if (cachedHeld) setHeldOrders(JSON.parse(cachedHeld));
      } else {
        setIsError(true);
        setErrorMessage(err.message || 'Unable to connect to POS database server');
      }
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl, token, showNotification]);

  useEffect(() => {
    loadTerminalData();
  }, [loadTerminalData]);

  // Online / Offline listener
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 2. Add to Cart Logic
  const handleAddToCart = useCallback(
    (product: PosProduct, quantityToAdd: number = 1) => {
      if (product.trackInventory && product.stockQuantity <= 0) {
        posSounds.playWarningBuzz();
        showNotification(`${product.name} is out of stock!`, 'warn');
        return;
      }

      posSounds.playBeep();

      setCart((prevCart) => {
        const existingIdx = prevCart.findIndex((i) => i.product.id === product.id);
        if (existingIdx >= 0) {
          const updated = [...prevCart];
          const item = updated[existingIdx];
          const newQty = item.quantity + quantityToAdd;
          const subtotalUSD = Number((newQty * item.unitPriceUSD).toFixed(2));
          const totalUSD = Math.max(0, Number((subtotalUSD - item.discountUSD).toFixed(2)));
          const totalKHR = Math.round(totalUSD * 4100);

          updated[existingIdx] = {
            ...item,
            quantity: newQty,
            subtotalUSD,
            totalUSD,
            totalKHR,
          };
          return updated;
        } else {
          const subtotalUSD = Number((quantityToAdd * product.sellingPriceUSD).toFixed(2));
          const totalUSD = subtotalUSD;
          const totalKHR = Math.round(totalUSD * 4100);

          const newItem: PosCartItem = {
            product,
            quantity: quantityToAdd,
            unitPriceUSD: product.sellingPriceUSD,
            unitPriceKHR: product.sellingPriceKHR,
            discountUSD: 0,
            subtotalUSD,
            totalUSD,
            totalKHR,
          };
          return [newItem, ...prevCart];
        }
      });

      setSelectedItemId(product.id);
    },
    [showNotification],
  );

  // 3. Barcode Scanner Handler
  const handleBarcodeSubmit = useCallback(
    (barcode: string) => {
      if (!initData) return;
      const cleanBarcode = barcode.trim();
      if (!cleanBarcode) return;

      // Search product in catalog
      const matched = initData.products.find(
        (p) => p.barcode === cleanBarcode || p.sku.toLowerCase() === cleanBarcode.toLowerCase(),
      );

      if (matched) {
        handleAddToCart(matched, 1);
        setBarcodeQuery('');
        showNotification(`Added: ${matched.name}`, 'success');
      } else {
        posSounds.playWarningBuzz();
        showNotification(`Barcode not found: ${cleanBarcode}`, 'warn');
        setBarcodeQuery('');
      }
    },
    [initData, handleAddToCart, showNotification],
  );

  // Subscribe to hardware barcode scanner (USB, Bluetooth, Camera)
  useEffect(() => {
    const unsub = scannerService.onBarcode(handleBarcodeSubmit);
    return () => unsub();
  }, [handleBarcodeSubmit]);

  // Synchronize live cart state with Customer Facing Display
  useEffect(() => {
    const itemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = cart.reduce((sum, item) => sum + item.subtotalUSD, 0);
    const tax = Number((subtotal * 0.1).toFixed(2));
    const totalUSD = Math.max(0, Number((subtotal + tax - discountUSD).toFixed(2)));
    const totalKHR = Math.round(totalUSD * 4100);

    const lastItem =
      cart.length > 0
        ? {
            name: cart[0].product.name,
            quantity: cart[0].quantity,
            priceUSD: cart[0].unitPriceUSD,
            totalUSD: cart[0].totalUSD,
          }
        : undefined;

    customerDisplayService.updateCart(itemsCount, subtotal, tax, totalUSD, totalKHR, lastItem);
  }, [cart, discountUSD]);

  // 4. Quantity Stepper
  const handleUpdateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      handleRemoveItem(productId);
      return;
    }

    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item.product.id === productId) {
          const subtotalUSD = Number((quantity * item.unitPriceUSD).toFixed(2));
          const totalUSD = Math.max(0, Number((subtotalUSD - item.discountUSD).toFixed(2)));
          const totalKHR = Math.round(totalUSD * 4100);
          return {
            ...item,
            quantity,
            subtotalUSD,
            totalUSD,
            totalKHR,
          };
        }
        return item;
      }),
    );
  };

  // 5. Remove Item
  const handleRemoveItem = useCallback(
    (productId: string) => {
      setCart((prevCart) => prevCart.filter((item) => item.product.id !== productId));
      if (selectedItemId === productId) {
        setSelectedItemId(null);
      }
    },
    [selectedItemId],
  );

  // 6. Line Discount
  const handleApplyLineDiscount = (productId: string, discountUSDVal: number) => {
    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item.product.id === productId) {
          const subtotalUSD = item.subtotalUSD;
          const totalUSD = Math.max(0, Number((subtotalUSD - discountUSDVal).toFixed(2)));
          const totalKHR = Math.round(totalUSD * 4100);
          return {
            ...item,
            discountUSD: discountUSDVal,
            totalUSD,
            totalKHR,
          };
        }
        return item;
      }),
    );
  };

  // 7. Clear Cart
  const handleClearCart = () => {
    if (cart.length === 0) return;
    if (window.confirm('Clear all items from current cart?')) {
      setCart([]);
      setSelectedItemId(null);
      showNotification('Cart cleared', 'info');
    }
  };

  // 8. Hold Sale
  const handleHoldSale = async () => {
    if (cart.length === 0) return;

    try {
      const res = await fetch(`${apiUrl}/pos/hold`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          customerId: selectedCustomer?.id,
          items: cart.map((i) => ({
            productId: i.product.id,
            productName: i.product.name,
            sku: i.product.sku,
            barcode: i.product.barcode,
            quantity: i.quantity,
            unitPriceUSD: i.unitPriceUSD,
          })),
          notes: 'Held from POS terminal',
        }),
      });

      if (res.ok) {
        showNotification('Sale placed on hold', 'info');
        setCart([]);
        setSelectedCustomer(null);
        setSelectedItemId(null);
        // Refresh held orders list
        loadTerminalData();
      }
    } catch {
      showNotification('Unable to hold sale (network offline)', 'warn');
    }
  };

  // 9. Recall Held Sale
  const handleRecallOrder = async (heldOrder: HeldOrderSummary) => {
    try {
      const res = await fetch(`${apiUrl}/pos/held-orders/${heldOrder.id}/recall`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setCart(data.data.items);
        if (data.data.customer) {
          setSelectedCustomer(data.data.customer);
        }
        setIsHeldModalOpen(false);
        showNotification(`Recalled order ${heldOrder.orderNumber}`, 'success');
        loadTerminalData();
      }
    } catch {
      showNotification('Failed to recall held order', 'warn');
    }
  };

  // 10. Delete Held Order
  const handleDeleteHeldOrder = async (heldOrderId: string) => {
    if (!window.confirm('Discard this held sale?')) return;
    try {
      const res = await fetch(`${apiUrl}/pos/held-orders/${heldOrderId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setHeldOrders((prev) => prev.filter((h) => h.id !== heldOrderId));
        showNotification('Held order removed', 'info');
      }
    } catch {
      showNotification('Failed to delete held order', 'warn');
    }
  };

  // 11. Create Customer On-the-Fly
  const handleCreateCustomer = async (data: {
    name: string;
    phone?: string;
    email?: string;
  }): Promise<PosCustomer | null> => {
    const res = await fetch(`${apiUrl}/pos/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || 'Failed to create customer');
    }

    const resData = await res.json();
    const newCust = resData.data;
    if (initData) {
      setInitData({
        ...initData,
        customers: [newCust, ...initData.customers],
      });
    }
    showNotification(`Customer added: ${newCust.name}`, 'success');
    return newCust;
  };

  // 12. Complete Checkout
  const handleCompleteCheckout = async (
    payments: {
      paymentMethodCode: string;
      amountUSD: number;
      amountKHR: number;
      tenderAmountUSD: number;
      tenderAmountKHR: number;
      transactionRef?: string;
    }[],
  ) => {
    if (isProcessingPayment) return;
    setIsProcessingPayment(true);
    try {
      const idempotencyKey = `pos-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const payload = {
        storeId: initData?.store.id,
        registerId: initData?.register.id,
        customerId: selectedCustomer?.id || null,
        items: cart.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
          unitPriceUSD: item.unitPriceUSD,
          discountUSD: item.discountUSD,
        })),
        discountUSD,
        payments,
        idempotencyKey,
        notes: 'Checkout completed via POS register',
      };

      const res = await fetch(`${apiUrl}/pos/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'Checkout failed');
      }

      const result = await res.json();
      const checkoutResult: CheckoutResult = result.data;

      posSounds.playSuccessChime();
      setLastReceipt(checkoutResult);
      setIsPaymentModalOpen(false);
      setIsReceiptModalOpen(true);
      setCart([]);
      setSelectedCustomer(null);
      setSelectedItemId(null);

      // Hardware: Sync Customer Facing Display with completed transaction
      customerDisplayService.showThankYou(
        checkoutResult.receiptNumber,
        checkoutResult.changeUSD,
        checkoutResult.changeKHR,
      );

      // Hardware: Auto-open cash drawer if Cash was tendered
      if (payments.some((p) => p.paymentMethodCode === 'CASH')) {
        cashDrawerService.openDrawer('Sale complete cash settlement');
      }

      // Decrement local inventory cache
      if (initData) {
        const updatedProducts = initData.products.map((p) => {
          const itemInCart = payload.items.find((ci) => ci.productId === p.id);
          if (itemInCart) {
            return {
              ...p,
              stockQuantity: Math.max(0, p.stockQuantity - itemInCart.quantity),
            };
          }
          return p;
        });
        setInitData({ ...initData, products: updatedProducts });
      }
    } catch (err: any) {
      posSounds.playWarningBuzz();
      showNotification(err.message || 'Payment processing failed', 'warn');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // 13. Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in form inputs (unless function keys)
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';

      if (e.key === 'F1') {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      if (e.key === 'F2') {
        e.preventDefault();
        barcodeInputRef.current?.focus();
        return;
      }
      if (e.key === 'F4') {
        e.preventDefault();
        setIsCustomerModalOpen((prev) => !prev);
        return;
      }
      if (e.key === 'F8') {
        e.preventDefault();
        if (cart.length > 0) {
          setIsPaymentModalOpen(true);
        }
        return;
      }
      if (e.key === 'Escape') {
        // Close modals
        setIsCustomerModalOpen(false);
        setIsHeldModalOpen(false);
        setIsPaymentModalOpen(false);
        setIsReceiptModalOpen(false);
        setIsShortcutsModalOpen(false);
        setIsMobileCartOpen(false);
        return;
      }
      if (e.key === 'Delete' && !isInput) {
        if (selectedItemId) {
          e.preventDefault();
          handleRemoveItem(selectedItemId);
        }
        return;
      }
      if (e.key === '?' && !isInput) {
        e.preventDefault();
        setIsShortcutsModalOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, selectedItemId, handleRemoveItem]);

  // 14. Filtered Products
  const filteredProducts = (initData?.products || []).filter((product) => {
    // Category filter
    if (selectedCategoryId !== 'all' && product.categoryId !== selectedCategoryId) {
      return false;
    }
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = product.name.toLowerCase().includes(q);
      const matchSku = product.sku.toLowerCase().includes(q);
      const matchBarcode = product.barcode ? product.barcode.includes(q) : false;
      return matchName || matchSku || matchBarcode;
    }
    return true;
  });

  const cartTotalUSD = cart.reduce((sum, item) => sum + item.totalUSD, 0) - discountUSD;
  const cartTotalKHR = Math.round(cartTotalUSD * (initData?.exchangeRateKHR || 4100));

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-100 font-sans select-none">
      {/* Notification Toast */}
      {notification && (
        <div
          className={`fixed top-16 right-4 z-50 px-4 py-2.5 rounded-xl shadow-xl text-xs font-bold border animate-in slide-in-from-top duration-200 ${
            notification.type === 'success'
              ? 'bg-emerald-600 text-white border-emerald-500'
              : notification.type === 'warn'
                ? 'bg-amber-600 text-white border-amber-500'
                : 'bg-slate-900 text-white border-slate-700'
          }`}
        >
          {notification.message}
        </div>
      )}

      {/* POS Top Header Bar */}
      <PosHeader
        user={user}
        storeName={initData?.store.name}
        registerCode={initData?.register.code}
        isOnline={isOnline}
        heldCount={heldOrders.length}
        onOpenHeldModal={() => setIsHeldModalOpen(true)}
        onOpenShortcutsModal={() => setIsShortcutsModalOpen(true)}
        onExitRegister={() => {
          if (cart.length > 0) {
            if (!window.confirm('Active cart will be cleared on exit. Return to dashboard?'))
              return;
          }
          router.push('/');
        }}
      />

      {/* Main Terminal Split Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT / MAIN AREA: Products & Search (65% on Desktop) */}
        <section className="flex-1 flex flex-col min-w-0 bg-slate-100 overflow-hidden">
          {/* Search & Barcode Top Bar */}
          <ProductSearchBarcode
            searchQuery={searchQuery}
            barcodeQuery={barcodeQuery}
            onSearchChange={setSearchQuery}
            onBarcodeChange={setBarcodeQuery}
            onBarcodeSubmit={handleBarcodeSubmit}
            viewMode={viewMode}
            onToggleViewMode={setViewMode}
            searchInputRef={searchInputRef}
            barcodeInputRef={barcodeInputRef}
            onOpenCameraScanner={() => setIsCameraScannerOpen(true)}
          />

          {/* Category Navigation Pills */}
          <CategoryNav
            categories={initData?.categories || []}
            selectedCategoryId={selectedCategoryId}
            totalProductsCount={initData?.products.length || 0}
            onSelectCategory={setSelectedCategoryId}
          />

          {/* Products Grid / List */}
          <ProductGrid
            products={filteredProducts}
            isLoading={isLoading}
            isError={isError}
            errorMessage={errorMessage}
            onRetry={loadTerminalData}
            onAddToCart={handleAddToCart}
            viewMode={viewMode}
          />
        </section>

        {/* RIGHT AREA: Cart & Checkout (Desktop & Laptop view 35%) */}
        <aside className="hidden lg:flex flex-col w-96 xl:w-[420px] 2xl:w-[460px] shrink-0 h-full">
          <CartArea
            cart={cart}
            customer={selectedCustomer}
            onOpenCustomerModal={() => setIsCustomerModalOpen(true)}
            onUpdateQuantity={handleUpdateQuantity}
            onRemoveItem={handleRemoveItem}
            onApplyLineDiscount={handleApplyLineDiscount}
            onClearCart={handleClearCart}
            onHoldSale={handleHoldSale}
            onOpenPaymentModal={() => setIsPaymentModalOpen(true)}
            selectedItemId={selectedItemId}
            onSelectItem={setSelectedItemId}
            discountUSD={discountUSD}
          />
        </aside>
      </div>

      {/* MOBILE CHECKOUT DRAWER (Bottom floating bar on phone/tablet) */}
      <MobileCartDrawer
        isOpen={isMobileCartOpen}
        onOpen={() => setIsMobileCartOpen(true)}
        onClose={() => setIsMobileCartOpen(false)}
        cart={cart}
        customer={selectedCustomer}
        onOpenCustomerModal={() => setIsCustomerModalOpen(true)}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onApplyLineDiscount={handleApplyLineDiscount}
        onClearCart={handleClearCart}
        onHoldSale={handleHoldSale}
        onOpenPaymentModal={() => setIsPaymentModalOpen(true)}
        selectedItemId={selectedItemId}
        onSelectItem={setSelectedItemId}
        discountUSD={discountUSD}
      />

      {/* MODALS */}
      {/* 1. Customer Modal */}
      <CustomerModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        customers={initData?.customers || []}
        selectedCustomer={selectedCustomer}
        onSelectCustomer={setSelectedCustomer}
        onCreateCustomer={handleCreateCustomer}
      />

      {/* 2. Held Orders Modal */}
      <HeldOrdersModal
        isOpen={isHeldModalOpen}
        onClose={() => setIsHeldModalOpen(false)}
        heldOrders={heldOrders}
        onRecall={handleRecallOrder}
        onDelete={handleDeleteHeldOrder}
      />

      {/* 3. Payment Modal */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        totalUSD={Math.max(0, cartTotalUSD)}
        totalKHR={Math.max(0, cartTotalKHR)}
        customer={selectedCustomer}
        paymentMethods={initData?.paymentMethods || []}
        onCompleteCheckout={handleCompleteCheckout}
        isProcessing={isProcessingPayment}
      />

      {/* 4. Thermal Receipt Modal */}
      <ReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => {
          setIsReceiptModalOpen(false);
          customerDisplayService.resetToIdle();
        }}
        receiptData={lastReceipt}
        storeName={initData?.store.name}
        storeAddress={initData?.store.address || undefined}
        storePhone={initData?.store.phone || undefined}
      />

      {/* 5. Shortcuts Guide Modal */}
      <ShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
      />

      {/* 6. Camera Barcode Scanner Viewfinder Modal */}
      <CameraScannerModal
        isOpen={isCameraScannerOpen}
        onClose={() => setIsCameraScannerOpen(false)}
        onBarcodeDetected={handleBarcodeSubmit}
      />
    </div>
  );
}
