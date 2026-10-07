export type Currency = 'USD' | 'KHR';

export interface Category {
  id: string;
  name: string;
  code?: string | null;
  color?: string | null;
  icon?: string | null;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode?: string | null;
  costPrice: number;
  sellingPriceUSD: number;
  sellingPriceKHR: number;
  taxRate: number;
  isTaxInclusive: boolean;
  unit: string;
  imageUrl?: string | null;
  category?: Category | null;
  stockQuantity: number;
  isLowStock: boolean;
}

export interface CartItem {
  product: Product;
  quantity: number;
  discountUSD: number;
  notes?: string;
}

export interface CashierUser {
  id: string;
  username: string;
  fullName: string;
  role: string;
  permissions: string[];
  business: {
    id: string;
    name: string;
    defaultCurrency: string;
    baseExchangeRate: number;
    timezone: string;
  };
  store: {
    id: string;
    name: string;
    code: string;
    address?: string | null;
    receiptHeader?: string | null;
    receiptFooter?: string | null;
  } | null;
}

export interface RegisterSession {
  id: string;
  registerId: string;
  registerName: string;
  registerCode: string;
  openedAt: string;
  status: 'OPEN' | 'CLOSED';
  openingFloatUSD: number;
  openingFloatKHR: number;
  expectedCashUSD: number;
  expectedCashKHR: number;
  totalSalesCount: number;
  totalSalesAmountUSD: number;
  totalSalesAmountKHR: number;
}

export interface SaleReceipt {
  id: string;
  invoiceNumber: string;
  createdAt: string;
  cashierName: string;
  storeName: string;
  storeAddress?: string;
  receiptHeader?: string;
  receiptFooter?: string;
  subtotalUSD: number;
  discountAmountUSD: number;
  taxAmountUSD: number;
  totalUSD: number;
  totalKHR: number;
  exchangeRateKHR: number;
  paidUSD: number;
  paidKHR: number;
  changeUSD: number;
  changeKHR: number;
  paymentMethod: string;
  items: Array<{
    name: string;
    sku: string;
    quantity: number;
    unitPriceUSD: number;
    totalUSD: number;
    totalKHR: number;
  }>;
}

export interface OfflineSale {
  offlineSyncId: string;
  registerId?: string | null;
  items: Array<{
    productId: string;
    quantity: number;
    discountAmountUSD: number;
  }>;
  discountType: 'NONE' | 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue: number;
  payments: Array<{
    method: 'CASH' | 'CARD' | 'KHQR';
    amountUSD: number;
    amountKHR: number;
    tenderAmountUSD: number;
    tenderAmountKHR: number;
  }>;
  clientCreatedAt: string;
  totalUSD: number;
  totalKHR: number;
}
