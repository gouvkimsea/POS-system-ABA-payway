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
  RegisterSessionSummary,
  CashMovementRecord,
  DenominationBreakdown,
} from '@pos/types';
import { PosHeader } from '../../components/pos/PosHeader';
import { CategoryNav } from '../../components/pos/CategoryNav';
import { ProductSearchBarcode } from '../../components/pos/ProductSearchBarcode';
import { ProductGrid } from '../../components/pos/ProductGrid';
import { CartArea } from '../../components/pos/CartArea';
import { MobileCartDrawer } from '../../components/pos/MobileCartDrawer';
import dynamic from 'next/dynamic';

const CustomerModal = dynamic(
  () => import('../../components/pos/CustomerModal').then((m) => m.CustomerModal),
  { ssr: false },
);
const HeldOrdersModal = dynamic(
  () => import('../../components/pos/HeldOrdersModal').then((m) => m.HeldOrdersModal),
  { ssr: false },
);
const PaymentModal = dynamic(
  () => import('../../components/pos/PaymentModal').then((m) => m.PaymentModal),
  { ssr: false },
);
const ReceiptModal = dynamic(
  () => import('../../components/pos/ReceiptModal').then((m) => m.ReceiptModal),
  { ssr: false },
);
const ShortcutsModal = dynamic(
  () => import('../../components/pos/ShortcutsModal').then((m) => m.ShortcutsModal),
  { ssr: false },
);
const CameraScannerModal = dynamic(
  () => import('../../components/pos/CameraScannerModal').then((m) => m.CameraScannerModal),
  { ssr: false },
);
const OpenRegisterModal = dynamic(
  () => import('../../components/pos/OpenRegisterModal').then((m) => m.OpenRegisterModal),
  { ssr: false },
);
const RegisterManagementModal = dynamic(
  () =>
    import('../../components/pos/RegisterManagementModal').then((m) => m.RegisterManagementModal),
  { ssr: false },
);
const ShiftReportModal = dynamic(
  () => import('../../components/pos/ShiftReportModal').then((m) => m.ShiftReportModal),
  { ssr: false },
);
const ReturnRefundModal = dynamic(
  () => import('../../components/pos/ReturnRefundModal').then((m) => m.ReturnRefundModal),
  { ssr: false },
);
import { posSounds } from '../../components/pos/SoundEffects';
import { scannerService } from '../../lib/hardware/ScannerService';
import { customerDisplayService } from '../../lib/hardware/CustomerDisplayService';
import { cashDrawerService } from '../../lib/hardware/CashDrawerService';
import { OfflineDb } from '../../lib/offline/OfflineDb';
import { LocalCheckoutEngine } from '../../lib/offline/LocalCheckoutEngine';
import { syncManager } from '../../lib/offline/SyncManager';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { WifiOff } from 'lucide-react';
import { useSettings } from '../../lib/settings-context';

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
  const { settings, formatCurrency } = useSettings();
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
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>('');
  const [barcodeQuery, setBarcodeQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Debounce search query to keep typing fluid on large 10,000+ item catalogs
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchQuery]);

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
  const [isReturnRefundModalOpen, setIsReturnRefundModalOpen] = useState<boolean>(false);

  // Register Session Management State
  const [currentSession, setCurrentSession] = useState<RegisterSessionSummary | null>(null);
  const [sessionMovements, setSessionMovements] = useState<CashMovementRecord[]>([]);
  const [isOpenRegisterModalOpen, setIsOpenRegisterModalOpen] = useState<boolean>(false);
  const [isRegisterManagementModalOpen, setIsRegisterManagementModalOpen] =
    useState<boolean>(false);
  const [isShiftReportModalOpen, setIsShiftReportModalOpen] = useState<boolean>(false);
  const [lastClosedSession, setLastClosedSession] = useState<RegisterSessionSummary | null>(null);

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
      if (!syncManager.getIsOnline()) {
        throw new Error('Offline mode active');
      }

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
        // Persist to IndexedDB offline database & localStorage
        OfflineDb.saveCatalog(data.data).catch((e) =>
          console.warn('[OfflineDb] Catalog cache save error:', e),
        );
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
      console.warn('[POS] API request failed, attempting IndexedDB / local cache fallback:', err);
      // Attempt cache recovery from IndexedDB first
      try {
        const cachedProducts = await OfflineDb.getCachedProducts();
        if (cachedProducts.length > 0) {
          const { store, business } = await OfflineDb.getCachedStoreConfig();
          const cachedCategories = await OfflineDb.getCachedCategories();
          const cachedCustomers = await OfflineDb.getCachedCustomers();

          setInitData({
            business: business || {
              id: user?.businessId || 'bus-01',
              name: 'Angkor Fresh Mart',
              code: 'AFM-01',
              defaultCurrency: 'USD',
            },
            store: store || {
              id: user?.storeId || 'store-01',
              name: 'Monivong Central Branch',
              code: 'STORE-01',
              address: null,
              phone: null,
              receiptHeader: null,
              receiptFooter: null,
            },
            register: { id: 'REG-01', name: 'Counter 01 Main POS', code: 'REG-01' },
            products: cachedProducts,
            categories: cachedCategories,
            customers: cachedCustomers,
            paymentMethods: [
              { id: 'pm-1', name: 'Cash', code: 'CASH', type: 'CASH', isDefault: true },
              { id: 'pm-2', name: 'Card', code: 'CARD', type: 'CARD', isDefault: false },
              { id: 'pm-3', name: 'ABA KHQR', code: 'QR_CODE', type: 'QR_CODE', isDefault: false },
            ],
            discounts: [],
            exchangeRateKHR: store?.baseExchangeRate || 4100,
            taxRate: store?.taxRate || 0.1,
          });
          setIsOnline(false);
          showNotification('Operating in Offline Mode (Loaded from IndexedDB)', 'warn');
          return;
        }
      } catch (idbErr) {
        console.warn('[POS] IndexedDB recovery error:', idbErr);
      }

      // Fallback to localStorage cache
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        setInitData(JSON.parse(cached));
        setIsOnline(false);
        showNotification('Operating in Offline Cache mode (localStorage)', 'warn');
        const cachedHeld = localStorage.getItem(HELD_CACHE_KEY);
        if (cachedHeld) setHeldOrders(JSON.parse(cachedHeld));
      } else {
        setIsError(true);
        setErrorMessage(err.message || 'Unable to connect to POS database server');
      }
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl, token, user, showNotification]);

  // Fetch Current Register Session
  const fetchCurrentSession = useCallback(async () => {
    try {
      if (!token) return;
      const res = await fetch(`${apiUrl}/register/current`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setCurrentSession(json.data.session);
          setSessionMovements(json.data.movements || []);
        } else {
          setCurrentSession(null);
          setSessionMovements([]);
        }
      } else if (res.status === 404) {
        setCurrentSession(null);
        setSessionMovements([]);
      }
    } catch (err) {
      console.warn('[POS] Failed to fetch current register session:', err);
    }
  }, [apiUrl, token]);

  useEffect(() => {
    loadTerminalData();
    fetchCurrentSession();
  }, [loadTerminalData, fetchCurrentSession]);

  // Online / Offline & Sync listener
  useEffect(() => {
    const unsub = syncManager.subscribe((_stats, online) => {
      setIsOnline(online);
    });
    return () => unsub();
  }, []);

  // 2. Add to Cart Logic
  const handleAddToCart = useCallback(
    (product: PosProduct, quantityToAdd: number = 1) => {
      if (product.trackInventory && product.stockQuantity <= 0) {
        if (!settings.store?.inventory?.allowNegativeStock) {
          posSounds.playWarningBuzz();
          showNotification(`${product.name} is out of stock!`, 'warn');
          return;
        }
      }

      if (settings.pos?.barcodeBehavior?.beepOnScan !== false) {
        posSounds.playBeep();
      }

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

  // Memoized O(1) Barcode & SKU lookup maps for immediate scanning on large catalogs
  const { barcodeMap, skuMap } = React.useMemo(() => {
    const bMap = new Map<string, PosProduct>();
    const sMap = new Map<string, PosProduct>();
    if (!initData?.products) return { barcodeMap: bMap, skuMap: sMap };

    for (const p of initData.products) {
      if (p.barcode) {
        bMap.set(p.barcode.trim(), p);
      }
      if (p.sku) {
        sMap.set(p.sku.trim().toLowerCase(), p);
      }
    }
    return { barcodeMap: bMap, skuMap: sMap };
  }, [initData?.products]);

  // 3. Barcode Scanner Handler
  const handleBarcodeSubmit = useCallback(
    async (barcode: string) => {
      if (!initData) return;
      const cleanBarcode = barcode.trim();
      if (!cleanBarcode) return;

      // Instant O(1) lookup in memory
      let matched = barcodeMap.get(cleanBarcode) || skuMap.get(cleanBarcode.toLowerCase());

      // IndexedDB fallback for offline lookup
      if (!matched) {
        try {
          const idbProduct = await OfflineDb.findProductByBarcode(cleanBarcode);
          if (idbProduct) matched = idbProduct;
        } catch {
          // ignore
        }
      }

      if (matched) {
        if (settings.pos?.barcodeBehavior?.autoAddToCart !== false) {
          handleAddToCart(matched, 1);
        }
        setBarcodeQuery('');
        showNotification(`Added: ${matched.name}`, 'success');
      } else {
        if (settings.pos?.sound?.playWarning !== false) {
          posSounds.playWarningBuzz();
        }
        showNotification(`Barcode not found: ${cleanBarcode}`, 'warn');
        setBarcodeQuery('');
      }
    },
    [
      initData,
      barcodeMap,
      skuMap,
      handleAddToCart,
      showNotification,
      settings.pos?.barcodeBehavior?.autoAddToCart,
      settings.pos?.sound?.playWarning,
    ],
  );

  // Subscribe to hardware barcode scanner (USB, Bluetooth, Camera)
  useEffect(() => {
    const unsub = scannerService.onBarcode(handleBarcodeSubmit);
    return () => unsub();
  }, [handleBarcodeSubmit]);

  // Barcode Auto-focus behavior from POS settings
  useEffect(() => {
    if (settings.pos?.barcodeBehavior?.focusInputByDefault && barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, [settings.pos?.barcodeBehavior?.focusInputByDefault]);

  // Synchronize live cart state with Customer Facing Display
  useEffect(() => {
    if (settings.pos?.customerDisplay?.enabled === false) return;
    const itemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = cart.reduce((sum, item) => sum + item.subtotalUSD, 0);
    const taxRate = (settings.store?.tax?.defaultTaxRate ?? 10) / 100;
    const tax = Number((subtotal * taxRate).toFixed(2));
    const totalUSD = Math.max(0, Number((subtotal + tax - discountUSD).toFixed(2)));
    const totalKHR = Math.round(totalUSD * (initData?.exchangeRateKHR || 4100));

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
  }, [
    cart,
    discountUSD,
    settings.pos?.customerDisplay?.enabled,
    settings.store?.tax?.defaultTaxRate,
    initData?.exchangeRateKHR,
  ]);

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

      let checkoutResult: CheckoutResult;
      const isOfflineMode = !syncManager.getIsOnline();

      if (isOfflineMode) {
        const offlineExec = await LocalCheckoutEngine.executeOfflineCheckout(payload, {
          userId: user?.id || 'cashier-offline',
          userName: user?.fullName || user?.username || 'Offline Cashier',
          storeId: initData?.store.id || user?.storeId || 'store-01',
          registerId: initData?.register.id,
          customer: selectedCustomer,
          productsLookup: initData?.products,
        });
        checkoutResult = offlineExec.result;
        showNotification(
          `Offline checkout saved (#${checkoutResult.orderNumber}) • Queued for sync`,
          'info',
        );
      } else {
        try {
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
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error?.message || `Checkout failed with status ${res.status}`);
          }

          const result = await res.json();
          checkoutResult = result.data;
        } catch (netErr: any) {
          console.warn('[POS] Online checkout network error, falling back to local queue:', netErr);
          const offlineExec = await LocalCheckoutEngine.executeOfflineCheckout(payload, {
            userId: user?.id || 'cashier-offline',
            userName: user?.fullName || user?.username || 'Offline Cashier',
            storeId: initData?.store.id || user?.storeId || 'store-01',
            registerId: initData?.register.id,
            customer: selectedCustomer,
            productsLookup: initData?.products,
          });
          checkoutResult = offlineExec.result;
          showNotification(
            `Network unavailable. Saved locally (#${checkoutResult.orderNumber}) • Queued for sync`,
            'warn',
          );
        }
      }

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

      // Hardware: Auto-open cash drawer if Cash was tendered and openOnCashSale is enabled
      if (
        (settings.pos?.cashDrawer?.openOnCashSale ?? true) &&
        payments.some((p) => p.paymentMethodCode === 'CASH')
      ) {
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

      // Refresh active register session financials in background
      fetchCurrentSession().catch(() => {});
    } catch (err: any) {
      posSounds.playWarningBuzz();
      showNotification(err.message || 'Payment processing failed', 'warn');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Register Session Action Handlers
  const handleOpenRegister = async (data: {
    openingFloatUSD: number;
    openingFloatKHR: number;
    notes?: string;
  }) => {
    const res = await fetch(`${apiUrl}/register/open`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        registerId: initData?.register?.id || 'REG-01',
        storeId: initData?.store?.id || user?.storeId || 'store-01',
        openingFloatUSD: data.openingFloatUSD,
        openingFloatKHR: data.openingFloatKHR,
        notes: data.notes,
      }),
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error?.message || 'Failed to open register session');
    }

    setCurrentSession(json.data);
    setSessionMovements([]);
    setIsOpenRegisterModalOpen(false);
    posSounds.playSuccessChime();
    showNotification(
      `Register session #${json.data.id.slice(-6).toUpperCase()} opened successfully!`,
      'success',
    );
  };

  const handleRecordCashMovement = async (data: {
    type: 'CASH_IN' | 'CASH_OUT' | 'EXPENSE';
    amountUSD: number;
    amountKHR: number;
    reason: string;
    referenceNumber?: string;
    category?: string;
  }) => {
    if (!currentSession) {
      throw new Error('No active register session to record cash movement.');
    }

    const res = await fetch(`${apiUrl}/register/cash-movement`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        sessionId: currentSession.id,
        type: data.type,
        amountUSD: data.amountUSD,
        amountKHR: data.amountKHR,
        reason: data.reason,
        referenceNumber: data.referenceNumber,
        category: data.category,
      }),
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error?.message || 'Failed to record cash movement');
    }

    posSounds.playCashDrawer();
    showNotification(
      `Cash movement recorded: ${data.type} ($${data.amountUSD.toFixed(2)})`,
      'success',
    );
    await fetchCurrentSession();
  };

  const handleCloseRegister = async (data: {
    actualCashUSD: number;
    actualCashKHR: number;
    denominationBreakdown?: DenominationBreakdown;
    closingNotes?: string;
  }) => {
    if (!currentSession) {
      throw new Error('No active register session to close.');
    }

    const res = await fetch(`${apiUrl}/register/close`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        sessionId: currentSession.id,
        actualCashUSD: data.actualCashUSD,
        actualCashKHR: data.actualCashKHR,
        denominationBreakdown: data.denominationBreakdown,
        closingNotes: data.closingNotes,
      }),
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error?.message || 'Failed to close register session');
    }

    const closed = json.data;
    setLastClosedSession(closed);
    setCurrentSession(null);
    setSessionMovements([]);
    setIsRegisterManagementModalOpen(false);
    setIsShiftReportModalOpen(true);
    posSounds.playSuccessChime();
    showNotification(
      `Session #${closed.id.slice(-6).toUpperCase()} closed successfully. Shift report generated.`,
      'success',
    );
  };

  const handleOpenPayment = () => {
    if (!currentSession) {
      posSounds.playWarningBuzz();
      showNotification('Please open a register session first before checkout.', 'warn');
      setIsOpenRegisterModalOpen(true);
      return;
    }
    setIsPaymentModalOpen(true);
  };

  // 13. Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in form inputs (unless function keys)
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';

      if (settings.pos?.keyboardShortcuts?.enabled !== false) {
        const sc = settings.pos?.keyboardShortcuts?.customBindings || {
          search: 'F1',
          barcode: 'F2',
          payment: 'F8',
          customer: 'F4',
          hold: 'F6',
        };

        if (e.key === (sc.search || 'F1')) {
          e.preventDefault();
          searchInputRef.current?.focus();
          return;
        }
        if (e.key === (sc.barcode || 'F2')) {
          e.preventDefault();
          barcodeInputRef.current?.focus();
          return;
        }
        if (e.key === (sc.customer || 'F4')) {
          e.preventDefault();
          setIsCustomerModalOpen((prev) => !prev);
          return;
        }
        if (e.key === (sc.payment || 'F8')) {
          e.preventDefault();
          if (cart.length > 0) {
            handleOpenPayment();
          }
          return;
        }
        if (e.key === (sc.hold || 'F6')) {
          e.preventDefault();
          if (cart.length > 0) {
            handleHoldSale();
          }
          return;
        }
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
  }, [cart, selectedItemId, handleRemoveItem, settings.pos?.keyboardShortcuts]);

  // 14. Filtered Products (Memoized with debounced search)
  const filteredProducts = React.useMemo(() => {
    if (!initData?.products) return [];
    const products = initData.products;
    const cleanQuery = debouncedSearchQuery.trim().toLowerCase();

    if (selectedCategoryId === 'all' && !cleanQuery) {
      return products;
    }

    return products.filter((product) => {
      // Category filter
      if (selectedCategoryId !== 'all' && product.categoryId !== selectedCategoryId) {
        return false;
      }
      // Search query
      if (cleanQuery) {
        const matchName = product.name.toLowerCase().includes(cleanQuery);
        const matchSku = product.sku.toLowerCase().includes(cleanQuery);
        const matchBarcode = product.barcode ? product.barcode.includes(cleanQuery) : false;
        return matchName || matchSku || matchBarcode;
      }
      return true;
    });
  }, [initData?.products, selectedCategoryId, debouncedSearchQuery]);

  // Memoized Cart Totals
  const { cartTotalUSD, cartTotalKHR } = React.useMemo(() => {
    const sub = cart.reduce((sum, item) => sum + item.totalUSD, 0) - discountUSD;
    const totalUSD = Math.max(0, Number(sub.toFixed(2)));
    const totalKHR = Math.round(totalUSD * (initData?.exchangeRateKHR || 4100));
    return { cartTotalUSD: totalUSD, cartTotalKHR: totalKHR };
  }, [cart, discountUSD, initData?.exchangeRateKHR]);

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
        currentSession={currentSession}
        onOpenRegisterModal={() => setIsOpenRegisterModalOpen(true)}
        onOpenRegisterManagement={() => setIsRegisterManagementModalOpen(true)}
        onOpenReturnModal={() => setIsReturnRefundModalOpen(true)}
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

      {/* Offline Status Warning Strip */}
      {!isOnline && (
        <div className="bg-amber-500 text-slate-950 px-3 sm:px-4 py-1.5 flex items-center justify-between text-xs font-medium border-b border-amber-600 shadow-sm shrink-0 z-20">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-slate-950 shrink-0" />
            <span>
              <strong>Offline Mode Active:</strong> Operating without network connection. Product
              lookup, barcode scanning, cart, and checkout are active locally. Sales will
              automatically sync when connection returns.
            </span>
          </div>
          <Link
            href="/settings/sync"
            className="px-2.5 py-0.5 rounded bg-slate-900 text-amber-300 hover:bg-slate-800 text-[11px] font-bold tracking-wide uppercase shrink-0 ml-3 transition-colors"
          >
            Sync Monitor
          </Link>
        </div>
      )}

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
            onOpenPaymentModal={handleOpenPayment}
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
        onOpenPaymentModal={handleOpenPayment}
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

      {/* 7. Open Register Modal */}
      <OpenRegisterModal
        isOpen={isOpenRegisterModalOpen}
        onClose={() => setIsOpenRegisterModalOpen(false)}
        registerCode={initData?.register.code}
        registerName={initData?.register.name}
        storeName={initData?.store.name}
        cashierName={user?.fullName || user?.username}
        onConfirmOpen={handleOpenRegister}
      />

      {/* 8. Register Session Management Modal */}
      <RegisterManagementModal
        isOpen={isRegisterManagementModalOpen}
        onClose={() => setIsRegisterManagementModalOpen(false)}
        session={currentSession}
        movements={sessionMovements}
        onRefresh={fetchCurrentSession}
        onRecordCashMovement={handleRecordCashMovement}
        onCloseRegister={handleCloseRegister}
      />

      {/* 9. Shift Z-Report Modal */}
      <ShiftReportModal
        isOpen={isShiftReportModalOpen}
        onClose={() => setIsShiftReportModalOpen(false)}
        session={lastClosedSession || currentSession}
      />

      {/* 10. Return & Refund Modal */}
      <ReturnRefundModal
        isOpen={isReturnRefundModalOpen}
        onClose={() => setIsReturnRefundModalOpen(false)}
        userPermissions={user?.permissions || []}
        userRoles={user?.roles || []}
        activeSessionId={currentSession?.id}
        onRefundCompleted={() => {
          loadTerminalData();
          fetchCurrentSession();
          setNotification({
            message: 'Return & refund completed successfully. Inventory and cash drawer updated.',
            type: 'success',
          });
        }}
      />
    </div>
  );
}
