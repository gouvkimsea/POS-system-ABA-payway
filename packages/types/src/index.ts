/**
 * Shared Type Definitions for Enterprise POS System
 */

export type CurrencyCode = 'USD' | 'KHR' | string;
export type LocaleCode = 'en' | 'km';

export interface CurrencyConfig {
  code: CurrencyCode;
  symbol: string;
  decimals: number;
  rateToUSD: number;
}

export type DatabaseStatus = 'connected' | 'disconnected' | 'error';
export type RedisStatus = 'connected' | 'in-memory-fallback' | 'disconnected';

export interface SystemHealthCheck {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  uptimeSeconds: number;
  environment: string;
  services: {
    database: {
      status: DatabaseStatus;
      latencyMs?: number;
      error?: string;
    };
    redis: {
      status: RedisStatus;
      latencyMs?: number;
      error?: string;
    };
  };
  version: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
}

export interface BusinessSummary {
  id: string;
  name: string;
  code: string;
  defaultCurrency: CurrencyCode;
  timezone: string;
}

export interface StoreSummary {
  id: string;
  businessId: string;
  name: string;
  code: string;
}

export interface SystemSettings {
  defaultCurrency: CurrencyCode;
  exchangeRateKHR: number;
  timezone: string;
  supportedCurrencies: CurrencyCode[];
  supportedLocales: LocaleCode[];
}

// ------------------------------------------------------------------------------
// AUTHENTICATION & AUTHORIZATION (RBAC) CONTRACTS
// ------------------------------------------------------------------------------

export const PERMISSIONS = {
  PRODUCTS_VIEW: 'products.view',
  PRODUCTS_CREATE: 'products.create',
  PRODUCTS_UPDATE: 'products.update',
  PRODUCTS_DELETE: 'products.delete',
  INVENTORY_VIEW: 'inventory.view',
  INVENTORY_ADJUST: 'inventory.adjust',
  SALES_CREATE: 'sales.create',
  SALES_REFUND: 'sales.refund',
  SALES_VOID: 'sales.void',
  REPORTS_VIEW: 'reports.view',
  USERS_MANAGE: 'users.manage',
  SETTINGS_MANAGE: 'settings.manage',
  REGISTER_OPEN: 'register.open',
  REGISTER_CLOSE: 'register.close',
  CASH_MANAGE: 'cash.manage',
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS] | string;

export type RoleCode = 'ADMIN' | 'MANAGER' | 'CASHIER' | string;

export interface AuthUser {
  id: string;
  username: string;
  email: string | null;
  fullName: string;
  phone: string | null;
  businessId: string;
  storeId?: string | null;
  roles: RoleCode[];
  permissions: PermissionCode[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}

export interface LoginResult {
  user: AuthUser;
  tokens: AuthTokens;
}

export interface TokenPayload {
  userId: string;
  username: string;
  businessId: string;
  storeId?: string | null;
  roles: RoleCode[];
  permissions: PermissionCode[];
}

// ------------------------------------------------------------------------------
// POS INTERFACE & CHECKOUT CONTRACTS
// ------------------------------------------------------------------------------

export interface PosCategory {
  id: string;
  name: string;
  code: string | null;
  color: string | null;
  icon: string | null;
  sortOrder: number;
  productCount: number;
}

export interface PosProduct {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  description: string | null;
  costPriceUSD: number;
  sellingPriceUSD: number;
  sellingPriceKHR: number;
  taxRate: number;
  isTaxInclusive: boolean;
  trackInventory: boolean;
  alertLowStock: number;
  unit: string;
  imageUrl: string | null;
  stockQuantity: number;
  categoryId: string | null;
  categoryName?: string;
  categoryColor?: string;
}

export interface PosCustomer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  loyaltyPoints: number;
  creditBalanceUSD: number;
}

export interface PosPaymentMethod {
  id: string;
  name: string;
  code: string;
  type: string;
  isDefault: boolean;
}

export interface PosDiscount {
  id: string;
  name: string;
  code: string | null;
  type: string;
  value: number;
}

export interface PosInitData {
  business: {
    id: string;
    name: string;
    code: string;
    defaultCurrency: string;
  };
  store: {
    id: string;
    name: string;
    code: string;
    address: string | null;
    phone: string | null;
    receiptHeader: string | null;
    receiptFooter: string | null;
  };
  register: {
    id: string;
    name: string;
    code: string;
  };
  categories: PosCategory[];
  products: PosProduct[];
  customers: PosCustomer[];
  paymentMethods: PosPaymentMethod[];
  discounts: PosDiscount[];
  exchangeRateKHR: number;
  taxRate: number;
}

export interface PosCartItem {
  product: PosProduct;
  quantity: number;
  unitPriceUSD: number;
  unitPriceKHR: number;
  discountUSD: number; // line discount
  subtotalUSD: number;
  totalUSD: number;
  totalKHR: number;
  notes?: string;
}

export type OrderStatus =
  | 'PENDING'
  | 'PAID'
  | 'PARTIALLY_PAID'
  | 'COMPLETED'
  | 'PARTIALLY_REFUNDED'
  | 'REFUNDED'
  | 'VOIDED'
  | 'CANCELLED';

export type PaymentStatus =
  | 'PENDING'
  | 'COMPLETED'
  | 'FAILED'
  | 'REFUNDED'
  | 'VOIDED'
  | 'CANCELLED';

export type PaymentMethodType =
  | 'CASH'
  | 'DIGITAL_QR'
  | 'CARD'
  | 'BANK_TRANSFER'
  | 'CUSTOMER_CREDIT'
  | 'OTHER';

export interface CheckoutItemInput {
  productId: string;
  variantId?: string | null;
  quantity: number;
  unitPriceUSD?: number; // Optional on input; validated/enforced by server from catalog
  discountUSD?: number;
  notes?: string;
}

export interface CheckoutPaymentInput {
  paymentMethodCode: string;
  amountUSD: number;
  amountKHR?: number;
  tenderAmountUSD?: number;
  tenderAmountKHR?: number;
  transactionRef?: string;
  metadata?: Record<string, any>;
}

export interface CheckoutInput {
  storeId?: string;
  registerId?: string;
  customerId?: string | null;
  items: CheckoutItemInput[];
  discountCode?: string;
  discountUSD?: number;
  payments: CheckoutPaymentInput[];
  notes?: string;
  idempotencyKey?: string;
  allowPartialPayment?: boolean;
}

export interface CheckoutResult {
  orderId: string;
  orderNumber: string;
  receiptNumber: string;
  status: OrderStatus;
  subtotalUSD: number;
  discountUSD: number;
  taxUSD: number;
  taxRate: number;
  totalUSD: number;
  totalKHR: number;
  exchangeRateKHR?: number;
  paidUSD: number;
  paidKHR: number;
  remainingUSD: number;
  remainingKHR: number;
  changeUSD: number;
  changeKHR: number;
  createdAt: string;
  idempotencyKey?: string | null;
  customer?: PosCustomer | null;
  items: {
    productId: string;
    variantId?: string | null;
    productName: string;
    sku: string;
    barcode?: string | null;
    quantity: number;
    unitPriceUSD: number;
    discountUSD: number;
    subtotalUSD: number;
    totalUSD: number;
    totalKHR: number;
  }[];
  payments: {
    id: string;
    paymentMethodCode: string;
    paymentMethodName: string;
    amountUSD: number;
    amountKHR: number;
    tenderAmountUSD: number;
    tenderAmountKHR: number;
    changeUSD: number;
    changeKHR: number;
    transactionRef?: string | null;
    status: PaymentStatus;
  }[];
  receipt: {
    id: string;
    receiptNumber: string;
    headerText: string | null;
    footerText: string | null;
    qrCodeData?: string | null;
  };
}

export interface OrderCalculationItemInput {
  productId: string;
  variantId?: string | null;
  quantity: number;
  discountUSD?: number;
}

export interface OrderCalculationInput {
  storeId?: string;
  items: OrderCalculationItemInput[];
  discountCode?: string;
  discountUSD?: number;
}

export interface OrderCalculationQuote {
  subtotalUSD: number;
  orderDiscountUSD: number;
  taxableAmountUSD: number;
  taxRate: number;
  taxUSD: number;
  totalUSD: number;
  totalKHR: number;
  exchangeRateKHR: number;
  items: {
    productId: string;
    variantId?: string | null;
    productName: string;
    sku: string;
    quantity: number;
    unitPriceUSD: number;
    lineDiscountUSD: number;
    lineTotalUSD: number;
    lineTotalKHR: number;
  }[];
}

export interface AddPaymentInput {
  payment: CheckoutPaymentInput;
  idempotencyKey?: string;
}

export interface VoidOrderInput {
  reason: string;
}

export interface RefundOrderInput {
  amountUSD: number;
  reason: string;
  returnToInventory?: boolean;
}

export interface CancelOrderInput {
  reason: string;
}

export interface HeldOrderSummary {
  id: string;
  orderNumber: string;
  customerId?: string | null;
  customerName?: string | null;
  itemCount: number;
  totalUSD: number;
  totalKHR: number;
  createdAt: string;
  notes?: string | null;
  items: PosCartItem[];
}

// ------------------------------------------------------------------------------
// CATALOG & INVENTORY MANAGEMENT CONTRACTS
// ------------------------------------------------------------------------------

export type StockMovementTypeEnum =
  | 'SALE'
  | 'REFUND'
  | 'RETURN'
  | 'PURCHASE'
  | 'ADJUSTMENT_IN'
  | 'ADJUSTMENT_OUT'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'DAMAGE'
  | 'EXPIRED';

export interface ProductVariantRecord {
  id: string;
  productId: string;
  name: string;
  sku: string;
  barcode: string | null;
  costPriceUSD: number;
  sellingPriceUSD: number;
  sellingPriceKHR: number;
  size: string | null;
  color: string | null;
  weight: string | null;
  model: string | null;
  attributes?: Record<string, any> | null;
  isActive: boolean;
  stockQuantity: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductRecord {
  id: string;
  businessId: string;
  name: string;
  nameKhmer: string | null;
  sku: string;
  barcode: string | null;
  description: string | null;
  categoryId: string | null;
  categoryName?: string | null;
  brandId: string | null;
  brandName?: string | null;
  supplierId: string | null;
  supplierName?: string | null;
  costPriceUSD: number;
  sellingPriceUSD: number;
  sellingPriceKHR: number;
  taxRate: number;
  isTaxInclusive: boolean;
  trackInventory: boolean;
  alertLowStock: number;
  reorderLevel: number;
  unit: string;
  imageUrl: string | null;
  isActive: boolean;
  stockQuantity: number;
  isLowStock: boolean;
  variants: ProductVariantRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface CategoryRecord {
  id: string;
  businessId: string;
  name: string;
  code: string | null;
  parentId: string | null;
  color: string | null;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  productCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface BrandRecord {
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  productCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierRecord {
  id: string;
  businessId: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  taxId: string | null;
  isActive: boolean;
  productCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryLocationRecord {
  id: string;
  storeId: string;
  name: string;
  code: string;
  description: string | null;
  isDefault: boolean;
  isActive: boolean;
  totalItems?: number;
  totalQuantity?: number;
  createdAt: string;
  updatedAt: string;
}

export interface StockLevelRecord {
  id: string;
  storeId: string;
  storeName?: string;
  locationId: string;
  locationName: string;
  productId: string;
  productName: string;
  productNameKhmer?: string | null;
  productSku: string;
  productBarcode: string | null;
  variantId: string | null;
  variantName: string | null;
  variantSku?: string | null;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  minStockLevel: number;
  reorderLevel: number;
  maxStockLevel: number | null;
  isLowStock: boolean;
  updatedAt: string;
}

export interface StockMovementRecord {
  id: string;
  storeId: string;
  locationId: string;
  locationName: string;
  productId: string;
  productName: string;
  productSku: string;
  variantId: string | null;
  variantName: string | null;
  type: StockMovementTypeEnum;
  quantityChange: number;
  quantityBefore: number;
  quantityAfter: number;
  unitCost: number;
  referenceType: string;
  referenceId: string | null;
  notes: string;
  createdById: string;
  createdByName?: string;
  createdAt: string;
}

export interface StockAdjustmentInput {
  storeId?: string;
  locationId: string;
  productId: string;
  variantId?: string | null;
  type: 'PURCHASE' | 'RETURN' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'DAMAGE' | 'EXPIRED';
  quantityChange: number;
  unitCost?: number;
  reason: string; // Mandatory reason
  referenceType?: string;
  referenceId?: string;
}

export interface StockTransferInput {
  storeId?: string;
  fromLocationId: string;
  toLocationId: string;
  productId: string;
  variantId?: string | null;
  quantity: number;
  reason: string; // Mandatory reason
}

export interface CreateProductInput {
  name: string;
  nameKhmer?: string;
  sku: string;
  barcode?: string;
  categoryId?: string | null;
  brandId?: string | null;
  supplierId?: string | null;
  description?: string;
  costPriceUSD: number;
  sellingPriceUSD: number;
  sellingPriceKHR?: number;
  taxRate?: number;
  isTaxInclusive?: boolean;
  trackInventory?: boolean;
  alertLowStock?: number;
  reorderLevel?: number;
  unit?: string;
  imageUrl?: string;
  isActive?: boolean;
  initialStock?: number;
  initialLocationId?: string;
}

export interface CreateVariantInput {
  name: string;
  sku: string;
  barcode?: string;
  size?: string;
  color?: string;
  weight?: string;
  model?: string;
  costPriceUSD: number;
  sellingPriceUSD: number;
  sellingPriceKHR?: number;
  isActive?: boolean;
  initialStock?: number;
  initialLocationId?: string;
}

// ------------------------------------------------------------------------------
// HARDWARE INTEGRATION & DEVICE BRIDGE TYPES
// ------------------------------------------------------------------------------

export type HardwareDeviceType =
  | 'PRINTER'
  | 'SCANNER'
  | 'CASH_DRAWER'
  | 'CUSTOMER_DISPLAY'
  | 'BRIDGE';

export type HardwareConnectionStatus =
  | 'CONNECTED'
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'ERROR'
  | 'STANDALONE_FALLBACK';

export type PrinterDriverType =
  | 'LOCAL_BRIDGE'
  | 'NETWORK_TCP'
  | 'WEB_SERIAL'
  | 'WEB_USB'
  | 'BROWSER_FALLBACK';

export type PaperSize = '58mm' | '80mm';

export interface PrinterConfig {
  driver: PrinterDriverType;
  name: string;
  paperSize: PaperSize;
  networkIp?: string;
  networkPort?: number;
  autoCut: boolean;
  autoOpenDrawer: boolean;
  copies: number;
  headerText?: string;
  footerText?: string;
}

export type PrintJobType = 'TEST' | 'RECEIPT' | 'REPRINT';

export interface PrintJobItem {
  name: string;
  quantity: number;
  unitPriceUSD: number;
  totalUSD: number;
  discountUSD?: number;
}

export interface PrintJobData {
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  receiptNumber: string;
  orderNumber: string;
  cashierName?: string;
  customerName?: string;
  createdAt: string;
  items: PrintJobItem[];
  subtotalUSD: number;
  discountUSD?: number;
  taxUSD?: number;
  totalUSD: number;
  totalKHR: number;
  exchangeRateKHR: number;
  payments: Array<{
    method: string;
    amountUSD: number;
    amountKHR: number;
    tenderUSD?: number;
    tenderKHR?: number;
  }>;
  changeUSD?: number;
  changeKHR?: number;
  qrPayload?: string;
  reprintNotice?: boolean;
  headerText?: string;
  footerText?: string;
}

export interface PrintJob {
  jobId: string;
  type: PrintJobType;
  printer: PrinterConfig;
  data?: PrintJobData;
  rawEscPos?: string;
  timestamp: string;
}

export interface PrintResult {
  success: boolean;
  jobId: string;
  driverUsed: PrinterDriverType;
  target: string;
  message?: string;
  fallbackUsed?: boolean;
}

export type ScannerInputMode =
  | 'KEYBOARD_WEDGE'
  | 'CAMERA'
  | 'LOCAL_BRIDGE'
  | 'WEB_SERIAL';

export interface ScannerConfig {
  mode: ScannerInputMode;
  interKeyTimeoutMs: number;
  minBarcodeLength: number;
  soundBeepOnScan: boolean;
  vibrateOnScan: boolean;
  prefix?: string;
  suffix?: string;
}

export type CashDrawerDriverType =
  | 'PRINTER_KICK'
  | 'LOCAL_BRIDGE_DIRECT'
  | 'MANUAL_FALLBACK';

export interface CashDrawerConfig {
  driver: CashDrawerDriverType;
  kickPin: 2 | 5;
  pulseOnMs: number;
  autoOpenOnCashPayment: boolean;
  soundChirp: boolean;
}

export interface CashDrawerTriggerResult {
  success: boolean;
  method: CashDrawerDriverType;
  timestamp: string;
  message?: string;
}

export type CustomerDisplayDriverType =
  | 'SECONDARY_WINDOW'
  | 'LOCAL_BRIDGE_VFD'
  | 'DISABLED';

export interface CustomerDisplayConfig {
  driver: CustomerDisplayDriverType;
  idleLine1: string;
  idleLine2: string;
  polePort?: string;
  poleBaudRate?: number;
}

export interface CustomerDisplayState {
  status: 'IDLE' | 'SCANNING' | 'PAYMENT' | 'COMPLETED';
  cartSummary?: {
    itemsCount: number;
    subtotalUSD: number;
    taxUSD: number;
    totalUSD: number;
    totalKHR: number;
  };
  currentItem?: {
    name: string;
    quantity: number;
    priceUSD: number;
    totalUSD: number;
  };
  paymentPrompt?: {
    method: string;
    amountUSD: number;
    amountKHR: number;
    qrPayload?: string;
  };
  thankYouNotice?: {
    changeUSD: number;
    changeKHR: number;
    receiptNumber: string;
  };
  timestamp: string;
}

export interface BridgeConfig {
  enabled: boolean;
  bridgeUrl: string;
  wsUrl?: string;
  pollIntervalMs: number;
}

export interface BridgeStatus {
  connected: boolean;
  version?: string;
  platform?: string;
  hostname?: string;
  uptimeSeconds?: number;
  discoveredPrinters: Array<{
    name: string;
    type: string;
    isDefault?: boolean;
    description?: string;
  }>;
  discoveredPorts: string[];
  latencyMs?: number;
  lastCheckedAt: string;
  error?: string;
}

export interface HardwareSettingsProfile {
  terminalId: string;
  storeId: string;
  bridge: BridgeConfig;
  printer: PrinterConfig;
  scanner: ScannerConfig;
  cashDrawer: CashDrawerConfig;
  customerDisplay: CustomerDisplayConfig;
  lastSavedAt: string;
}

export interface DeviceSummary {
  id: string;
  storeId: string;
  name: string;
  deviceIdentifier: string;
  deviceType: 'TERMINAL' | 'TABLET' | 'MOBILE' | 'DESKTOP';
  hardwareConfig?: Partial<HardwareSettingsProfile> | null;
  lastSyncAt?: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface RegisterDeviceInput {
  storeId: string;
  name: string;
  deviceIdentifier: string;
  deviceType?: 'TERMINAL' | 'TABLET' | 'MOBILE' | 'DESKTOP';
  hardwareConfig?: Partial<HardwareSettingsProfile>;
}

