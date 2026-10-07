'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '../components/Header';
import { ProductCatalog } from '../components/ProductCatalog';
import { CartTicket } from '../components/CartTicket';
import { CheckoutModal } from '../components/CheckoutModal';
import { ReceiptModal } from '../components/ReceiptModal';
import { CameraScannerModal } from '../components/CameraScannerModal';
import { RegisterSessionModal } from '../components/RegisterSessionModal';
import { LockScreenModal } from '../components/LockScreenModal';
import { OfflineBanner } from '../components/OfflineBanner';

import {
  Product,
  Category,
  CartItem,
  CashierUser,
  RegisterSession,
  SaleReceipt,
  Currency,
  OfflineSale,
} from '../lib/types';
import { apiRequest, setStoredToken, getStoredToken } from '../lib/api';
import { db } from '../lib/db';
import { syncOfflineSales } from '../lib/sync';
import { setupBarcodeScannerListener, playBeep, generateEscPosCommands } from '../lib/hardware';

export default function POSTerminalPage() {
  // State: Authentication & Store
  const [currentUser, setCurrentUser] = useState<CashierUser | null>(null);
  const [currentSession, setCurrentSession] = useState<RegisterSession | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [currency, setCurrency] = useState<Currency>('USD');
  const [isMuted, setIsMuted] = useState(false);

  // State: Catalog & Cart
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [discountType, setDiscountType] = useState<'NONE' | 'PERCENTAGE' | 'FIXED_AMOUNT'>('NONE');
  const [discountValue, setDiscountValue] = useState<number>(0);

  // State: Modals
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<SaleReceipt | null>(null);
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);

  // State: Offline Queue
  const [queuedSalesCount, setQueuedSalesCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // Online / Offline Detection
  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      handleSyncOfflineQueue();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Update offline queue count
  const refreshQueueCount = useCallback(async () => {
    try {
      const count = await db.offlineSalesQueue.count();
      setQueuedSalesCount(count);
    } catch (e) {}
  }, []);

  useEffect(() => {
    refreshQueueCount();
  }, [refreshQueueCount]);

  // Initial Load & Auth
  useEffect(() => {
    const initializePOS = async () => {
      let token = getStoredToken();

      // If no token, log in as default cashier for seamless POS operation
      if (!token) {
        const loginRes = await apiRequest('/auth/login', {
          method: 'POST',
          body: JSON.stringify({
            username: 'cashier1',
            password: 'Cashier123!',
          }),
        });

        if (loginRes.success && loginRes.data) {
          setStoredToken(loginRes.data.accessToken);
          setCurrentUser(loginRes.data.user);
        }
      } else {
        const meRes = await apiRequest('/auth/me');
        if (meRes.success && meRes.data) {
          setCurrentUser(meRes.data);
        } else {
          // Relogin fallback
          const loginRes = await apiRequest('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username: 'cashier1', password: 'Cashier123!' }),
          });
          if (loginRes.success && loginRes.data) {
            setStoredToken(loginRes.data.accessToken);
            setCurrentUser(loginRes.data.user);
          }
        }
      }

      // Load Catalog & Categories
      await fetchCatalog();
      await fetchActiveSession();
    };

    initializePOS();
  }, []);

  const fetchCatalog = async () => {
    // Try network first
    if (navigator.onLine) {
      const [prodsRes, catsRes] = await Promise.all([
        apiRequest('/products?limit=100'),
        apiRequest('/products/categories'),
      ]);

      if (prodsRes.success && prodsRes.data) {
        setProducts(prodsRes.data.items);
        // Cache to IndexedDB for offline access
        await db.cachedProducts.clear();
        await db.cachedProducts.bulkPut(prodsRes.data.items);
      }

      if (catsRes.success && catsRes.data) {
        setCategories(catsRes.data);
        await db.cachedCategories.clear();
        await db.cachedCategories.bulkPut(catsRes.data);
      }
    } else {
      // Offline fallback: load from IndexedDB
      const cachedP = await db.cachedProducts.toArray();
      const cachedC = await db.cachedCategories.toArray();
      setProducts(cachedP);
      setCategories(cachedC);
    }
  };

  const fetchActiveSession = async () => {
    const res = await apiRequest('/registers/current-session');
    if (res.success && res.data) {
      setCurrentSession(res.data);
    } else {
      setCurrentSession(null);
    }
  };

  // Add Product to Cart
  const handleAddToCart = useCallback((product: Product) => {
    if (product.stockQuantity <= 0) {
      playBeep('error');
      return;
    }

    if (!isMuted) playBeep('scan');

    setCartItems((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { product, quantity: 1, discountUSD: 0 }];
    });
  }, [isMuted]);

  // Barcode Scan Handler (Hardware & Camera)
  const handleBarcodeScanned = useCallback(
    async (barcode: string) => {
      // Look up in current products state first
      const found = products.find((p) => p.barcode === barcode);
      if (found) {
        handleAddToCart(found);
        return;
      }

      // If online, query backend API
      if (navigator.onLine) {
        const res = await apiRequest(`/products/barcode/${barcode}`);
        if (res.success && res.data) {
          handleAddToCart(res.data);
          return;
        }
      }

      playBeep('error');
    },
    [products, handleAddToCart]
  );

  // Setup USB / Bluetooth Hardware Barcode Scanner Listener
  useEffect(() => {
    const cleanup = setupBarcodeScannerListener(handleBarcodeScanned);
    return cleanup;
  }, [handleBarcodeScanned]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        document.getElementById('product-search-input')?.focus();
      } else if (e.key === 'F2') {
        e.preventDefault();
        document.getElementById('barcode-scan-input')?.focus();
      } else if (e.key === 'F4') {
        e.preventDefault();
        setIsLocked(true);
      } else if (e.key === 'F8') {
        e.preventDefault();
        setIsSessionModalOpen(true);
      } else if (e.key === 'F9') {
        e.preventDefault();
        if (cartItems.length > 0) {
          setIsCheckoutOpen(true);
        }
      } else if (e.key === 'Escape') {
        setIsCheckoutOpen(false);
        setIsReceiptOpen(false);
        setIsCameraScannerOpen(false);
        setIsSessionModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cartItems.length]);

  // Quantity Modifiers
  const handleUpdateQuantity = (productId: string, delta: number) => {
    setCartItems((prev) => {
      return prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const handleRemoveItem = (productId: string) => {
    setCartItems((prev) => prev.filter((i) => i.product.id !== productId));
  };

  const handleClearCart = () => {
    setCartItems([]);
    setDiscountType('NONE');
    setDiscountValue(0);
  };

  // Complete Sale (Online or Offline IndexedDB Queue)
  const handleCompleteSale = async (saleData: {
    payments: Array<{
      method: 'CASH' | 'CARD' | 'KHQR';
      amountUSD: number;
      amountKHR: number;
      tenderAmountUSD: number;
      tenderAmountKHR: number;
    }>;
    notes?: string;
  }) => {
    const exchangeRate = currentUser?.business?.baseExchangeRate || 4100;

    const subtotalUSD = cartItems.reduce(
      (acc, item) => acc + item.product.sellingPriceUSD * item.quantity,
      0
    );

    let discountUSD = 0;
    if (discountType === 'PERCENTAGE') {
      discountUSD = (subtotalUSD * discountValue) / 100;
    } else if (discountType === 'FIXED_AMOUNT') {
      discountUSD = Math.min(subtotalUSD, discountValue);
    }

    const taxableAmount = Math.max(0, subtotalUSD - discountUSD);
    const taxUSD = taxableAmount * 0.10;
    const totalUSD = Math.round((taxableAmount + taxUSD) * 100) / 100;
    const totalKHR = Math.round((totalUSD * exchangeRate) / 100) * 100;

    const offlineSyncId = crypto.randomUUID();

    const salePayload = {
      registerId: currentSession?.registerId || null,
      items: cartItems.map((i) => ({
        productId: i.product.id,
        quantity: i.quantity,
        discountAmountUSD: 0,
      })),
      discountType,
      discountValue,
      payments: saleData.payments,
      notes: saleData.notes,
      offlineSyncId,
    };

    let receiptData: SaleReceipt;

    if (navigator.onLine) {
      // Online execution
      const res = await apiRequest('/sales', {
        method: 'POST',
        body: JSON.stringify(salePayload),
      });

      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to process sale');
      }

      const sale = res.data;
      receiptData = {
        id: sale.id,
        invoiceNumber: sale.invoiceNumber,
        createdAt: sale.createdAt,
        cashierName: sale.cashier?.fullName || currentUser?.fullName || 'Cashier',
        storeName: sale.store?.name || currentUser?.store?.name || 'SmartPOS Store',
        storeAddress: sale.store?.address || currentUser?.store?.address || undefined,
        receiptHeader: sale.store?.receiptHeader || currentUser?.store?.receiptHeader || undefined,
        receiptFooter: sale.store?.receiptFooter || currentUser?.store?.receiptFooter || undefined,
        subtotalUSD: Number(sale.subtotalUSD),
        discountAmountUSD: Number(sale.discountAmountUSD),
        taxAmountUSD: Number(sale.taxAmountUSD),
        totalUSD: Number(sale.totalUSD),
        totalKHR: Number(sale.totalKHR),
        exchangeRateKHR: Number(sale.exchangeRateKHR),
        paidUSD: Number(sale.paidUSD),
        paidKHR: Number(sale.paidKHR),
        changeUSD: Number(sale.changeUSD),
        changeKHR: Number(sale.changeKHR),
        paymentMethod: sale.payments?.[0]?.method || 'CASH',
        items: sale.items.map((i: any) => ({
          name: i.productName,
          sku: i.sku,
          quantity: Number(i.quantity),
          unitPriceUSD: Number(i.unitPriceUSD),
          totalUSD: Number(i.totalUSD),
          totalKHR: Number(i.totalKHR),
        })),
      };

      await fetchCatalog();
      await fetchActiveSession();
    } else {
      // Offline fallback: Queue in Dexie IndexedDB
      const offlineSale: OfflineSale = {
        offlineSyncId,
        registerId: currentSession?.registerId || null,
        items: salePayload.items,
        discountType,
        discountValue,
        payments: saleData.payments,
        clientCreatedAt: new Date().toISOString(),
        totalUSD,
        totalKHR,
      };

      await db.offlineSalesQueue.put(offlineSale);
      await refreshQueueCount();

      // Locally decrement stock in IndexedDB cached products
      for (const cartItem of cartItems) {
        const prod = await db.cachedProducts.get(cartItem.product.id);
        if (prod) {
          prod.stockQuantity = Math.max(0, prod.stockQuantity - cartItem.quantity);
          await db.cachedProducts.put(prod);
        }
      }

      const cachedUpdated = await db.cachedProducts.toArray();
      setProducts(cachedUpdated);

      receiptData = {
        id: offlineSyncId,
        invoiceNumber: `OFFLINE-${offlineSyncId.substring(0, 8).toUpperCase()}`,
        createdAt: new Date().toISOString(),
        cashierName: currentUser?.fullName || 'Cashier',
        storeName: currentUser?.store?.name || 'SmartPOS Store',
        receiptHeader: currentUser?.store?.receiptHeader || undefined,
        receiptFooter: currentUser?.store?.receiptFooter || undefined,
        subtotalUSD,
        discountAmountUSD: discountUSD,
        taxAmountUSD: taxUSD,
        totalUSD,
        totalKHR,
        exchangeRateKHR: exchangeRate,
        paidUSD: saleData.payments[0].tenderAmountUSD,
        paidKHR: saleData.payments[0].tenderAmountKHR,
        changeUSD: Math.max(0, saleData.payments[0].tenderAmountUSD - totalUSD),
        changeKHR: Math.max(0, Math.round((saleData.payments[0].tenderAmountUSD - totalUSD) * exchangeRate / 100) * 100),
        paymentMethod: saleData.payments[0].method,
        items: cartItems.map((i) => ({
          name: i.product.name,
          sku: i.product.sku,
          quantity: i.quantity,
          unitPriceUSD: i.product.sellingPriceUSD,
          totalUSD: i.product.sellingPriceUSD * i.quantity,
          totalKHR: Math.round(i.product.sellingPriceUSD * i.quantity * exchangeRate / 100) * 100,
        })),
      };
    }

    setLastReceipt(receiptData);
    setIsReceiptOpen(true);
    handleClearCart();
  };

  // Offline Sync Trigger
  const handleSyncOfflineQueue = async () => {
    if (isSyncing || !currentUser) return;
    setIsSyncing(true);
    try {
      await syncOfflineSales(currentUser.username || 'TERM-01');
      await refreshQueueCount();
      await fetchCatalog();
      await fetchActiveSession();
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-100 font-sans">
      {/* Top POS Header */}
      <Header
        user={currentUser}
        session={currentSession}
        isOnline={isOnline}
        currency={currency}
        onToggleCurrency={() => setCurrency((c) => (c === 'USD' ? 'KHR' : 'USD'))}
        isMuted={isMuted}
        onToggleMute={() => setIsMuted((m) => !m)}
        onOpenSessionModal={() => setIsSessionModalOpen(true)}
        onOpenLockScreen={() => setIsLocked(true)}
        onOpenCameraScanner={() => setIsCameraScannerOpen(true)}
      />

      {/* Offline Alert Banner */}
      <OfflineBanner
        isOnline={isOnline}
        queuedCount={queuedSalesCount}
        isSyncing={isSyncing}
        onSyncNow={handleSyncOfflineQueue}
      />

      {/* Main Split Layout: Catalog (Left/Center) + Cart Ticket (Right) */}
      <main className="flex-1 flex overflow-hidden">
        <ProductCatalog
          products={products}
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          onAddToCart={handleAddToCart}
          currency={currency}
          onManualBarcodeScan={handleBarcodeScanned}
        />

        <CartTicket
          items={cartItems}
          onUpdateQuantity={handleUpdateQuantity}
          onRemoveItem={handleRemoveItem}
          onClearCart={handleClearCart}
          discountType={discountType}
          discountValue={discountValue}
          onSetDiscount={(type, val) => {
            setDiscountType(type);
            setDiscountValue(val);
          }}
          currency={currency}
          exchangeRateKHR={currentUser?.business?.baseExchangeRate || 4100}
          onOpenCheckout={() => setIsCheckoutOpen(true)}
        />
      </main>

      {/* Modals */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        items={cartItems}
        discountType={discountType}
        discountValue={discountValue}
        exchangeRateKHR={currentUser?.business?.baseExchangeRate || 4100}
        onCompleteSale={handleCompleteSale}
      />

      <ReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        receipt={lastReceipt}
      />

      <CameraScannerModal
        isOpen={isCameraScannerOpen}
        onClose={() => setIsCameraScannerOpen(false)}
        onScanSuccess={handleBarcodeScanned}
      />

      <RegisterSessionModal
        isOpen={isSessionModalOpen}
        onClose={() => setIsSessionModalOpen(false)}
        session={currentSession}
        onSessionUpdated={fetchActiveSession}
      />

      <LockScreenModal
        isOpen={isLocked}
        currentUser={currentUser}
        onUnlock={(user) => {
          setCurrentUser(user);
          setIsLocked(false);
        }}
      />
    </div>
  );
}
