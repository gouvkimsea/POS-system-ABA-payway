'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './auth-context';
import {
  BusinessSettings,
  StoreSettingsUnified,
  PosOperationalSettings,
  LocalizationSettings,
  PaymentMethodConfig,
  UnifiedSettingsPayload,
} from '@pos/types';
import { posSounds } from '../components/pos/SoundEffects';

export interface SettingsContextValue {
  business: BusinessSettings;
  store: StoreSettingsUnified;
  pos: PosOperationalSettings;
  localization: LocalizationSettings;
  paymentMethods: PaymentMethodConfig[];
  storesList: Array<{ id: string; name: string; code: string }>;
  selectedStoreId: string;
  setSelectedStoreId: (storeId: string) => void;
  isLoading: boolean;
  error: string | null;

  // Unified namespace accessor for cleaner component code
  settings: {
    business: BusinessSettings;
    store: StoreSettingsUnified;
    pos: PosOperationalSettings;
    localization: LocalizationSettings;
    payments: PaymentMethodConfig[];
  };

  // Mutation actions
  updateBusiness: (data: Partial<BusinessSettings>) => Promise<void>;
  updateStoreSettings: (storeId: string, data: any) => Promise<void>;
  updatePosSettings: (data: Partial<PosOperationalSettings>) => Promise<void>;
  updateLocalizationSettings: (data: Partial<LocalizationSettings>) => Promise<void>;
  refreshSettings: () => Promise<void>;

  // Dynamic formatting utilities (Not hard-coded)
  formatCurrency: (amountUSD: number, targetCurrency?: 'USD' | 'KHR') => string;
  formatDate: (date: Date | string) => string;
  formatTime: (date: Date | string) => string;
  formatDateTime: (date: Date | string) => string;
}

const DEFAULT_BUSINESS: BusinessSettings = {
  id: '',
  name: 'Angkor Fresh Mart',
  code: 'AFM-01',
  logoUrl: null,
  address: 'Monivong Blvd, Phnom Penh, Cambodia',
  phone: '+855 23 888 999',
  email: 'contact@angkorfresh.com',
  taxNumber: 'K001-90023412',
  defaultCurrency: 'USD',
  baseExchangeRate: 4100,
  timezone: 'Asia/Phnom_Penh',
};

const DEFAULT_STORE: StoreSettingsUnified = {
  id: '',
  storeId: '',
  storeName: 'Monivong Central Branch',
  receipt: {
    showLogo: true,
    showTaxBreakdown: true,
    showCashierName: true,
    showCustomerInfo: true,
    paperSize: '80mm',
    customHeader: 'Welcome to Angkor Fresh Mart',
    customFooter: 'Thank you for shopping with us! Please come again.',
  },
  tax: {
    defaultTaxRate: 0.1,
    isTaxInclusive: false,
    enableTax: true,
    taxNumber: 'VAT-855-001',
  },
  inventory: {
    allowNegativeStock: false,
    defaultLowStockAlert: 5,
    trackBatches: false,
    enableStockTransfers: true,
  },
};

const DEFAULT_POS: PosOperationalSettings = {
  receiptSize: '80mm',
  barcodeBehavior: {
    autoAddToCart: true,
    beepOnScan: true,
    focusInputByDefault: true,
    minLength: 3,
  },
  sound: {
    enabled: true,
    volume: 0.7,
    playBeep: true,
    playCashDrawer: true,
    playWarning: true,
    playSuccess: true,
  },
  keyboardShortcuts: {
    enabled: true,
    customBindings: {
      search: 'F1',
      barcode: 'F2',
      customer: 'F4',
      payment: 'F8',
      clear: 'Delete',
      shortcuts: '?',
    },
  },
  customerDisplay: {
    enabled: false,
    port: 'COM3',
    baudRate: 9600,
    lineLength: 20,
    welcomeMessage: 'Welcome to Angkor Mart!',
    idleMessage: 'Thank You for Shopping!',
  },
  printer: {
    enabled: true,
    type: 'network',
    ip: '192.168.1.200',
    port: 9100,
    charactersPerLine: 48,
    autoCut: true,
  },
  cashDrawer: {
    enabled: true,
    driver: 'printer_kick',
    pulsePin: 0,
    openOnCashSale: true,
  },
};

const DEFAULT_LOCALIZATION: LocalizationSettings = {
  language: 'en',
  defaultCurrency: 'USD',
  currencyFormatting: {
    symbol: '$',
    position: 'prefix',
    decimalPlaces: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.',
  },
  dateTimeFormatting: {
    dateFormat: 'DD/MM/YYYY',
    timeFormat: 'hh:mm A',
    timezone: 'Asia/Phnom_Penh',
    use24Hour: false,
  },
};

const LOCAL_STORAGE_SETTINGS_KEY = 'pos_dynamic_system_settings_v1';

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuth();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

  const [business, setBusiness] = useState<BusinessSettings>(DEFAULT_BUSINESS);
  const [store, setStore] = useState<StoreSettingsUnified>(DEFAULT_STORE);
  const [pos, setPos] = useState<PosOperationalSettings>(DEFAULT_POS);
  const [localization, setLocalization] = useState<LocalizationSettings>(DEFAULT_LOCALIZATION);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodConfig[]>([]);
  const [storesList, setStoresList] = useState<Array<{ id: string; name: string; code: string }>>(
    [],
  );
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize from LocalStorage Cache first (instant hydration)
  useEffect(() => {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_SETTINGS_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as UnifiedSettingsPayload;
        if (parsed.business) setBusiness(parsed.business);
        if (parsed.store) setStore(parsed.store);
        if (parsed.pos) {
          setPos(parsed.pos);
          posSounds.configure?.(parsed.pos.sound);
        }
        if (parsed.localization) setLocalization(parsed.localization);
        if (parsed.paymentMethods) setPaymentMethods(parsed.paymentMethods);
        if (parsed.storesList) setStoresList(parsed.storesList);
      }
    } catch {
      // Ignore cache errors
    }
  }, []);

  // Fetch Authoritative Settings from Database API
  const fetchSettings = useCallback(
    async (storeIdParam?: string) => {
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        const activeStore = storeIdParam || selectedStoreId || user?.storeId || '';
        const queryParam = activeStore ? `?storeId=${encodeURIComponent(activeStore)}` : '';

        const res = await fetch(`${apiUrl}/settings${queryParam}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          throw new Error(`Failed to load system settings (HTTP ${res.status})`);
        }

        const json = await res.json();
        if (json.success && json.data) {
          const data = json.data as UnifiedSettingsPayload;
          setBusiness(data.business);
          setStore(data.store);
          setPos(data.pos);
          setLocalization(data.localization);
          setPaymentMethods(data.paymentMethods || []);
          setStoresList(data.storesList || []);

          if (data.store?.storeId && !selectedStoreId) {
            setSelectedStoreId(data.store.storeId);
          }

          // Apply sound settings dynamically
          posSounds.configure?.(data.pos.sound);

          // Update local persistence
          try {
            localStorage.setItem(LOCAL_STORAGE_SETTINGS_KEY, JSON.stringify(data));
          } catch {
            // Ignore storage quota
          }
        }
      } catch (err: any) {
        setError(err.message || 'Error loading settings');
      } finally {
        setIsLoading(false);
      }
    },
    [apiUrl, token, selectedStoreId, user?.storeId],
  );

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Handle store change
  const handleSelectStore = useCallback(
    (newStoreId: string) => {
      setSelectedStoreId(newStoreId);
      fetchSettings(newStoreId);
    },
    [fetchSettings],
  );

  // Update Business Settings
  const updateBusiness = useCallback(
    async (data: Partial<BusinessSettings>) => {
      if (!token) return;
      const res = await fetch(`${apiUrl}/settings/business`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to update business settings');
      }

      setBusiness((prev) => ({ ...prev, ...json.data }));
      await fetchSettings();
    },
    [apiUrl, token, fetchSettings],
  );

  // Update Store Settings
  const updateStoreSettings = useCallback(
    async (targetStoreId: string, data: any) => {
      if (!token) return;
      const res = await fetch(`${apiUrl}/settings/store/${targetStoreId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to update store settings');
      }

      await fetchSettings(targetStoreId);
    },
    [apiUrl, token, fetchSettings],
  );

  // Update POS Settings
  const updatePosSettings = useCallback(
    async (data: Partial<PosOperationalSettings>) => {
      if (!token) return;
      const merged = { ...pos, ...data };
      const res = await fetch(`${apiUrl}/settings/pos`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(merged),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to update POS settings');
      }

      setPos(merged);
      posSounds.configure?.(merged.sound);
    },
    [apiUrl, token, pos],
  );

  // Update Localization Settings
  const updateLocalizationSettings = useCallback(
    async (data: Partial<LocalizationSettings>) => {
      if (!token) return;
      const merged = { ...localization, ...data };
      const res = await fetch(`${apiUrl}/settings/localization`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(merged),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to update localization settings');
      }

      setLocalization(merged);
    },
    [apiUrl, token, localization],
  );

  // Dynamic Currency Formatter (Driven by Database Settings)
  const formatCurrency = useCallback(
    (amountUSD: number, targetCurrency?: 'USD' | 'KHR'): string => {
      const activeCurrency =
        targetCurrency || localization.defaultCurrency || business.defaultCurrency || 'USD';
      const exchangeRate = business.baseExchangeRate || 4100;
      const { symbol, position, decimalPlaces, thousandsSeparator, decimalSeparator } =
        localization.currencyFormatting;

      if (activeCurrency === 'KHR') {
        const khrVal = Math.round(amountUSD * exchangeRate);
        const parts = khrVal.toString().replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSeparator);
        return `${parts} ៛`;
      }

      // Format USD
      const fixed = amountUSD.toFixed(decimalPlaces);
      const [intPart, decPart] = fixed.split('.');
      const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSeparator);
      const formattedNumber = decPart
        ? `${formattedInt}${decimalSeparator}${decPart}`
        : formattedInt;

      return position === 'prefix' ? `${symbol}${formattedNumber}` : `${formattedNumber} ${symbol}`;
    },
    [localization, business],
  );

  // Dynamic Date & Time Formatter (Driven by Database Settings)
  const formatDate = useCallback(
    (dateInput: Date | string): string => {
      const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
      if (isNaN(date.getTime())) return '';

      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = String(date.getFullYear());

      const fmt = localization.dateTimeFormatting.dateFormat || 'DD/MM/YYYY';
      return fmt.replace('DD', day).replace('MM', month).replace('YYYY', year);
    },
    [localization],
  );

  const formatTime = useCallback(
    (dateInput: Date | string): string => {
      const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
      if (isNaN(date.getTime())) return '';

      let hours = date.getHours();
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const use24 = localization.dateTimeFormatting.use24Hour;

      if (use24) {
        return `${String(hours).padStart(2, '0')}:${minutes}`;
      }

      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
    },
    [localization],
  );

  const formatDateTime = useCallback(
    (dateInput: Date | string): string => {
      return `${formatDate(dateInput)} ${formatTime(dateInput)}`;
    },
    [formatDate, formatTime],
  );

  const value = useMemo<SettingsContextValue>(
    () => ({
      business,
      store,
      pos,
      localization,
      paymentMethods,
      storesList,
      selectedStoreId,
      setSelectedStoreId: handleSelectStore,
      isLoading,
      error,
      settings: {
        business,
        store,
        pos,
        localization,
        payments: paymentMethods,
      },
      updateBusiness,
      updateStoreSettings,
      updatePosSettings,
      updateLocalizationSettings,
      refreshSettings: fetchSettings,
      formatCurrency,
      formatDate,
      formatTime,
      formatDateTime,
    }),
    [
      business,
      store,
      pos,
      localization,
      paymentMethods,
      storesList,
      selectedStoreId,
      handleSelectStore,
      isLoading,
      error,
      updateBusiness,
      updateStoreSettings,
      updatePosSettings,
      updateLocalizationSettings,
      fetchSettings,
      formatCurrency,
      formatDate,
      formatTime,
      formatDateTime,
    ],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return ctx;
}
