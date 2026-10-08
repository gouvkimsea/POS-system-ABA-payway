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
  CUSTOMERS_VIEW: 'customers.view',
  CUSTOMERS_MANAGE: 'customers.manage',
  STORES_VIEW: 'stores.view',
  STORES_MANAGE: 'stores.manage',
  TRANSFERS_VIEW: 'transfers.view',
  TRANSFERS_MANAGE: 'transfers.manage',
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
  authorizedStoreIds?: string[] | null;
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
  authorizedStoreIds?: string[] | null;
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
  nameKhmer?: string | null;
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
  variants?: Array<{
    id: string;
    name: string;
    sku: string;
    barcode?: string | null;
    priceUSD: number;
    stockQuantity: number;
  }>;
}

export interface PosCustomer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address?: string | null;
  notes?: string | null;
  isWalkIn?: boolean;
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
  'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED' | 'VOIDED' | 'CANCELLED';

export type PaymentMethodType =
  'CASH' | 'DIGITAL_QR' | 'CARD' | 'BANK_TRANSFER' | 'CUSTOMER_CREDIT' | 'OTHER';

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
  'PRINTER' | 'SCANNER' | 'CASH_DRAWER' | 'CUSTOMER_DISPLAY' | 'BRIDGE';

export type HardwareConnectionStatus =
  'CONNECTED' | 'DISCONNECTED' | 'CONNECTING' | 'ERROR' | 'STANDALONE_FALLBACK';

export type PrinterDriverType =
  'LOCAL_BRIDGE' | 'NETWORK_TCP' | 'WEB_SERIAL' | 'WEB_USB' | 'BROWSER_FALLBACK';

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

export type ScannerInputMode = 'KEYBOARD_WEDGE' | 'CAMERA' | 'LOCAL_BRIDGE' | 'WEB_SERIAL';

export interface ScannerConfig {
  mode: ScannerInputMode;
  interKeyTimeoutMs: number;
  minBarcodeLength: number;
  soundBeepOnScan: boolean;
  vibrateOnScan: boolean;
  prefix?: string;
  suffix?: string;
}

export type CashDrawerDriverType = 'PRINTER_KICK' | 'LOCAL_BRIDGE_DIRECT' | 'MANUAL_FALLBACK';

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

export type CustomerDisplayDriverType = 'SECONDARY_WINDOW' | 'LOCAL_BRIDGE_VFD' | 'DISABLED';

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

// ------------------------------------------------------------------------------
// OFFLINE CAPABILITY & SYNCHRONIZATION TYPES
// ------------------------------------------------------------------------------

export type SyncItemStatus = 'pending' | 'syncing' | 'synchronized' | 'failed' | 'conflict';

export type ConflictReasonCode =
  | 'PRODUCT_NOT_FOUND'
  | 'PRODUCT_INACTIVE'
  | 'PRICE_MISMATCH'
  | 'INVENTORY_NEGATIVE'
  | 'CUSTOMER_NOT_FOUND'
  | 'DUPLICATE_KEY'
  | 'VALIDATION_FAILED'
  | 'INTERNAL_ERROR';

export interface OfflineConflictInfo {
  reason: ConflictReasonCode;
  message: string;
  details?: Record<string, any>;
  occurredAt: string;
  localVersion?: Record<string, any>;
  serverVersion?: Record<string, any>;
  resolutionAction?: 'OVERRIDE_ACCEPT' | 'RETRY' | 'DISCARD';
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface OfflineSyncQueueItem {
  id: string; // Temporary local ID (e.g. OFF-TX-...)
  clientSyncId: string; // Unique idempotency / sync key
  offlineOrderNumber: string; // e.g. OFF-ORD-YYYYMMDD-XXXX
  offlineReceiptNumber: string; // e.g. OFF-RCP-YYYYMMDD-XXXX
  storeId: string;
  registerId?: string;
  cashierId: string;
  cashierName: string;
  status: SyncItemStatus;
  createdAt: string;
  lastAttemptAt?: string | null;
  syncedAt?: string | null;
  attempts: number;
  errorMessage?: string | null;
  conflict?: OfflineConflictInfo | null;
  payload: CheckoutInput & {
    offlineMetadata?: {
      deviceIdentifier?: string;
      offlineCreatedAt?: string;
      subtotalUSD: number;
      totalUSD: number;
      totalKHR: number;
      itemsDetail: Array<{
        productId: string;
        productName: string;
        sku: string;
        barcode?: string | null;
        quantity: number;
        unitPriceUSD: number;
        discountUSD: number;
      }>;
    };
  };
  serverOrderId?: string | null;
  serverOrderNumber?: string | null;
}

export interface SyncBatchRequest {
  deviceId?: string;
  deviceIdentifier?: string;
  storeId?: string;
  items: OfflineSyncQueueItem[];
}

export interface SyncBatchItemResult {
  clientSyncId: string;
  status: SyncItemStatus;
  serverOrderId?: string;
  serverOrderNumber?: string;
  receiptNumber?: string;
  conflict?: OfflineConflictInfo;
  errorMessage?: string;
  alreadySynced?: boolean;
  inventoryReconciled?: boolean;
}

export interface SyncBatchResponse {
  success: boolean;
  total: number;
  syncedCount: number;
  conflictCount: number;
  failedCount: number;
  results: SyncBatchItemResult[];
  timestamp: string;
}

export interface SyncMonitorStats {
  totalQueued: number;
  pendingCount: number;
  syncingCount: number;
  synchronizedCount: number;
  conflictCount: number;
  failedCount: number;
  lastSyncTimestamp?: string | null;
  isOnline: boolean;
}

export interface SyncQueueRecord {
  id: string;
  clientSyncId: string;
  storeId: string;
  storeName?: string;
  deviceId: string;
  deviceName?: string;
  status: 'PENDING' | 'PROCESSED' | 'CONFLICT' | 'FAILED';
  errorMessage?: string | null;
  conflictDetails?: any;
  orderId?: string | null;
  orderNumber?: string | null;
  payload: any;
  receivedAt: string;
  processedAt?: string | null;
}

export interface CatalogSnapshot {
  store: {
    id: string;
    name: string;
    code: string;
    taxRate: number;
    baseExchangeRate: number;
    currency: string;
    address?: string | null;
    phone?: string | null;
  };
  business: {
    id: string;
    name: string;
    taxNumber?: string | null;
  };
  products: PosProduct[];
  categories: Array<{ id: string; name: string; code: string; color?: string | null }>;
  customers: PosCustomer[];
  taxConfig: {
    vatRate: number;
    taxNumber?: string | null;
  };
  cachedAt: string;
  version: string;
}

// ------------------------------------------------------------------------------
// 12. REGISTER SESSION & CASH MANAGEMENT CONTRACTS
// ------------------------------------------------------------------------------

export type CashMovementTypeEnum = 'CASH_IN' | 'CASH_OUT' | 'FLOAT_ADD' | 'PAY_OUT' | 'EXPENSE';

export type SessionStatusEnum = 'OPEN' | 'CLOSED';

export interface DenominationBreakdown {
  usd?: {
    100?: number;
    50?: number;
    20?: number;
    10?: number;
    5?: number;
    1?: number;
    coins?: number;
  };
  khr?: {
    100000?: number;
    50000?: number;
    20000?: number;
    15000?: number;
    10000?: number;
    5000?: number;
    2000?: number;
    1000?: number;
    500?: number;
    100?: number;
  };
}

export interface RegisterSessionSummary {
  id: string;
  registerId: string;
  registerName: string;
  registerCode: string;
  storeId: string;
  storeName: string;
  cashierId: string;
  cashierName: string;
  openedAt: string;
  closedAt: string | null;
  status: SessionStatusEnum;
  openingFloatUSD: number;
  openingFloatKHR: number;
  cashSalesUSD: number;
  cashSalesKHR: number;
  cashRefundsUSD: number;
  cashRefundsKHR: number;
  cashInUSD: number;
  cashInKHR: number;
  cashOutUSD: number;
  cashOutKHR: number;
  expensesUSD: number;
  expensesKHR: number;
  expectedCashUSD: number;
  expectedCashKHR: number;
  actualCashUSD: number | null;
  actualCashKHR: number | null;
  differenceUSD: number | null;
  differenceKHR: number | null;
  totalSalesCount: number;
  totalSalesUSD: number;
  totalSalesKHR: number;
  closingNotes: string | null;
  denominationBreakdown?: DenominationBreakdown | null;
  closedById: string | null;
  closedByName: string | null;
}

export interface CashMovementRecord {
  id: string;
  sessionId: string;
  type: CashMovementTypeEnum;
  amountUSD: number;
  amountKHR: number;
  reason: string;
  referenceNumber: string | null;
  createdAt: string;
  cashierId: string;
  cashierName: string;
  registerId: string;
  registerCode: string;
  storeId: string;
  storeName: string;
  auditLogId?: string | null;
}

export interface OpenRegisterInput {
  registerId: string;
  openingFloatUSD: number;
  openingFloatKHR: number;
  notes?: string;
}

export interface CashMovementInput {
  sessionId?: string;
  registerId?: string;
  type: CashMovementTypeEnum;
  amountUSD: number;
  amountKHR: number;
  reason: string;
  referenceNumber?: string;
  category?: string; // For store expense categorization
}

export interface CloseRegisterInput {
  sessionId: string;
  actualCashUSD: number;
  actualCashKHR: number;
  denominationBreakdown?: DenominationBreakdown;
  closingNotes?: string;
}

export interface RegisterReportFilters {
  storeId?: string;
  registerId?: string;
  cashierId?: string;
  status?: SessionStatusEnum;
  startDate?: string;
  endDate?: string;
}

export interface RegisterReportSummary {
  totalSessions: number;
  openSessions: number;
  closedSessions: number;
  totalSalesCount: number;
  totalSalesUSD: number;
  totalCashSalesUSD: number;
  totalCashInUSD: number;
  totalCashOutUSD: number;
  totalExpensesUSD: number;
  totalExpectedCashUSD: number;
  totalActualCashUSD: number;
  totalDifferenceUSD: number;
}

// ------------------------------------------------------------------------------
// CUSTOMER MANAGEMENT & PROFILES
// ------------------------------------------------------------------------------

export interface CustomerProfile {
  id: string;
  businessId: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  isWalkIn: boolean;
  taxNumber: string | null;
  loyaltyPoints: number;
  creditBalanceUSD: number;
  totalOrdersCount: number;
  totalSpentUSD: number;
  lastOrderDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerPurchaseHistoryItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPriceUSD: number;
  unitPriceKHR: number;
  totalUSD: number;
  refundedQuantity: number;
}

export interface CustomerPurchaseHistoryOrder {
  id: string;
  orderNumber: string;
  createdAt: string;
  status: OrderStatus;
  totalUSD: number;
  totalKHR: number;
  paidUSD: number;
  changeUSD: number;
  refundedAmountUSD: number;
  storeName: string;
  cashierName: string;
  itemsCount: number;
  items: CustomerPurchaseHistoryItem[];
  returns?: Array<{
    id: string;
    returnNumber: string;
    totalUSD: number;
    createdAt: string;
  }>;
}

export interface CustomerHistoryResponse {
  customer: CustomerProfile;
  orders: CustomerPurchaseHistoryOrder[];
  summary: {
    totalSpentUSD: number;
    totalOrders: number;
    averageOrderValueUSD: number;
    lastVisitDate: string | null;
  };
}

export interface CreateCustomerInput {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  taxNumber?: string | null;
  isWalkIn?: boolean;
}

export interface UpdateCustomerInput {
  name?: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  taxNumber?: string | null;
  isWalkIn?: boolean;
  loyaltyPoints?: number;
  creditBalanceUSD?: number;
}

// ------------------------------------------------------------------------------
// RETURNS & REFUNDS CONTRACTS
// ------------------------------------------------------------------------------

export type ReturnReason =
  'DEFECTIVE' | 'WRONG_ITEM' | 'CUSTOMER_CHANGED_MIND' | 'DAMAGED' | 'EXPIRED' | 'OTHER';

export type ReturnStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED';
export type RefundStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

export interface ReturnItemInput {
  orderItemId: string;
  quantity: number;
  restockInventory?: boolean;
  condition?: 'RESELLABLE' | 'DAMAGED' | 'DEFECTIVE';
  notes?: string;
}

export interface ProcessReturnRefundInput {
  orderId: string;
  reason: ReturnReason;
  reasonNotes?: string;
  items: ReturnItemInput[];
  refundMethodCode: string; // 'CASH', 'CUSTOMER_CREDIT', 'CARD', etc.
  sessionId?: string;
  notes?: string;
}

export interface ReturnItemRecord {
  id: string;
  returnId: string;
  orderItemId: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPriceUSD: number;
  unitPriceKHR: number;
  taxAmountUSD: number;
  totalUSD: number;
  totalKHR: number;
  restockInventory: boolean;
  condition: string | null;
  notes: string | null;
  createdAt: string;
}

export interface RefundRecord {
  id: string;
  refundNumber: string;
  orderId: string;
  returnId: string | null;
  paymentMethodCode: string;
  paymentMethodName: string;
  amountUSD: number;
  amountKHR: number;
  reason: string | null;
  transactionRef: string | null;
  status: RefundStatus;
  processedById: string;
  processedByName: string;
  sessionId: string | null;
  createdAt: string;
}

export interface ReturnRecord {
  id: string;
  returnNumber: string;
  orderId: string;
  orderNumber: string;
  customerId: string | null;
  customerName: string | null;
  processedById: string;
  processedByName: string;
  status: ReturnStatus;
  reason: ReturnReason;
  reasonNotes: string | null;
  subtotalUSD: number;
  taxAmountUSD: number;
  totalUSD: number;
  totalKHR: number;
  items: ReturnItemRecord[];
  refunds: RefundRecord[];
  createdAt: string;
}

export interface OrderRefundEligibilityItem {
  orderItemId: string;
  productId: string;
  productName: string;
  sku: string;
  purchasedQuantity: number;
  alreadyRefundedQuantity: number;
  maxReturnableQuantity: number;
  unitPriceUSD: number;
  unitPriceKHR: number;
  taxAmountUSD: number;
}

export interface OrderRefundEligibility {
  orderId: string;
  orderNumber: string;
  createdAt: string;
  customerId: string | null;
  customerName: string | null;
  totalUSD: number;
  totalPaidUSD: number;
  refundedAmountUSD: number;
  maxRefundableUSD: number;
  items: OrderRefundEligibilityItem[];
}

// ------------------------------------------------------------------------------
// REPORTING & ANALYTICS DATA CONTRACTS
// ------------------------------------------------------------------------------

export interface ReportFilterParams {
  startDate?: string;
  endDate?: string;
  storeId?: string;
  storeIds?: string[] | string;
  cashierId?: string;
  paymentMethodCode?: string;
  paymentMethodId?: string;
  interval?: 'daily' | 'weekly' | 'monthly';
  format?: 'json' | 'csv' | 'excel';
}

export interface ReportingPaymentBreakdownItem {
  code: string;
  name: string;
  amountUSD: number;
  amountKHR: number;
  count: number;
  percentage: number;
}

export interface ReportingTopProductItem {
  productId: string;
  productName: string;
  sku: string;
  categoryName: string;
  quantitySold: number;
  revenueUSD: number;
  costUSD: number;
  profitUSD: number;
}

export interface ReportingLowStockItem {
  productId: string;
  productName: string;
  sku: string;
  barcode: string | null;
  storeName: string;
  currentQuantity: number;
  minStockLevel: number;
  unit: string;
}

export interface ReportingCashierPerformanceItem {
  cashierId: string;
  cashierName: string;
  ordersCount: number;
  grossSalesUSD: number;
  refundsUSD: number;
  netSalesUSD: number;
  avgOrderValueUSD: number;
}

export interface ReportingDashboardSummary {
  todaySalesUSD: number;
  todaySalesKHR: number;
  todayOrdersCount: number;
  todayAverageOrderValueUSD: number;
  grossSalesUSD: number;
  refundsUSD: number;
  netSalesUSD: number;
  discountsUSD: number;
  taxesUSD: number;
  costOfGoodsSoldUSD: number;
  profitEstimateUSD: number;
  profitMarginPercent: number;
  totalOrdersCount: number;
  paymentBreakdown: ReportingPaymentBreakdownItem[];
  topProducts: ReportingTopProductItem[];
  lowStockProducts: ReportingLowStockItem[];
  cashierPerformance: ReportingCashierPerformanceItem[];
}

export interface SalesTimeSeriesRow {
  periodKey: string;
  periodLabel: string;
  ordersCount: number;
  grossSalesUSD: number;
  discountsUSD: number;
  refundsUSD: number;
  netSalesUSD: number;
  taxesUSD: number;
  profitEstimateUSD: number;
}

export interface ProductSalesReportRow {
  productId: string;
  productName: string;
  sku: string;
  categoryName: string;
  quantitySold: number;
  unitPriceAvgUSD: number;
  grossSalesUSD: number;
  discountsUSD: number;
  netSalesUSD: number;
  cogsUSD: number;
  profitUSD: number;
  marginPercent: number;
}

export interface CategorySalesReportRow {
  categoryId: string;
  categoryName: string;
  itemsCount: number;
  quantitySold: number;
  grossSalesUSD: number;
  discountsUSD: number;
  netSalesUSD: number;
  revenueSharePercent: number;
}

export interface CashierSalesReportRow {
  cashierId: string;
  cashierName: string;
  ordersCount: number;
  grossSalesUSD: number;
  discountsUSD: number;
  refundsUSD: number;
  netSalesUSD: number;
  avgOrderValueUSD: number;
}

export interface PaymentMethodReportRow {
  paymentMethodId: string;
  code: string;
  name: string;
  transactionsCount: number;
  totalUSD: number;
  totalKHR: number;
  percentage: number;
}

export interface InventoryReportRow {
  productId: string;
  productName: string;
  sku: string;
  categoryName: string;
  storeName: string;
  locationName: string;
  currentStock: number;
  reservedStock: number;
  minStockLevel: number;
  unitCostUSD: number;
  sellingPriceUSD: number;
  totalCostValueUSD: number;
  totalRetailValueUSD: number;
  stockStatus: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
}

export interface StockMovementReportRow {
  id: string;
  createdAt: string;
  storeName: string;
  locationName: string;
  productName: string;
  sku: string;
  type: string;
  quantityChange: number;
  quantityBefore: number;
  quantityAfter: number;
  unitCostUSD: number;
  totalMovementCostUSD: number;
  referenceType: string;
  referenceId: string | null;
  createdByName: string;
  notes: string | null;
}

export interface RefundReportRow {
  id: string;
  createdAt: string;
  refundNumber: string;
  returnNumber: string | null;
  orderNumber: string;
  customerName: string | null;
  cashierName: string;
  storeName: string;
  reason: string;
  amountUSD: number;
  amountKHR: number;
  paymentMethodName: string;
  itemsSummary: string;
}

export interface ProfitEstimateReport {
  grossSalesUSD: number;
  discountsUSD: number;
  netSalesUSD: number;
  cogsUSD: number;
  grossProfitUSD: number;
  grossProfitMarginPercent: number;
  refundsUSD: number;
  netProfitEstimateUSD: number;
  netProfitMarginPercent: number;
  taxesCollectedUSD: number;
  expensesUSD: number;
  netOperatingProfitUSD: number;
}

export interface ReportDataResponse<T> {
  summary?: any;
  rows: T[];
  totalRows: number;
  filtersApplied: ReportFilterParams;
  generatedAt: string;
}

export interface RegisterSessionReportRow {
  id: string;
  storeName: string;
  registerName: string;
  registerCode: string;
  cashierName: string;
  openedAt: string;
  closedAt: string | null;
  status: string;
  openingFloatUSD: number;
  openingFloatKHR: number;
  expectedCashUSD: number;
  expectedCashKHR: number;
  actualCashUSD: number | null;
  actualCashKHR: number | null;
  differenceUSD: number | null;
  differenceKHR: number | null;
  totalSalesCount: number;
  totalSalesUSD: number;
  totalSalesKHR: number;
  closingNotes: string | null;
}

// ------------------------------------------------------------------------------
// MULTI-STORE & INVENTORY TRANSFER TYPES
// ------------------------------------------------------------------------------

export interface StoreSettings {
  defaultCurrency?: CurrencyCode;
  timezone?: string;
  receiptHeader?: string | null;
  receiptFooter?: string | null;
  taxRate?: number;
  autoPrintReceipt?: boolean;
  allowNegativeStock?: boolean;
  lowStockThreshold?: number;
}

export interface StoreDetail {
  id: string;
  businessId: string;
  name: string;
  code: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  receiptHeader: string | null;
  receiptFooter: string | null;
  settings: StoreSettings | null;
  isActive: boolean;
  registerCount?: number;
  userCount?: number;
  productCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface StoreProductOverride {
  id: string;
  storeId: string;
  productId: string;
  variantId?: string | null;
  isActive: boolean;
  customPriceUSD?: number | null;
  customPriceKHR?: number | null;
  minStockLevel?: number | null;
  maxStockLevel?: number | null;
}

export type TransferStatusType = 'REQUESTED' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED';

export interface InventoryTransferItemDto {
  id: string;
  transferId: string;
  productId: string;
  variantId?: string | null;
  productName: string;
  sku: string;
  requestedQuantity: number;
  sentQuantity: number;
  receivedQuantity: number;
  notes?: string | null;
}

export interface InventoryTransferDto {
  id: string;
  transferNumber: string;
  businessId: string;
  sourceStoreId: string;
  sourceStoreName: string;
  targetStoreId: string;
  targetStoreName: string;
  status: TransferStatusType;
  notes?: string | null;
  requestedById: string;
  requestedByName: string;
  sentById?: string | null;
  sentByName?: string | null;
  receivedById?: string | null;
  receivedByName?: string | null;
  requestedAt: string;
  sentAt?: string | null;
  receivedAt?: string | null;
  cancelledAt?: string | null;
  items: InventoryTransferItemDto[];
  createdAt: string;
  updatedAt: string;
}

export interface StoreUserAssignment {
  userId: string;
  username: string;
  fullName: string;
  email?: string | null;
  roleId: string;
  roleName: string;
  storeId?: string | null;
  storeName?: string | null;
  assignedAt: string;
}

// ------------------------------------------------------------------------------
// UNIFIED SETTINGS SYSTEM CONTRACTS
// ------------------------------------------------------------------------------

export interface BusinessSettings {
  id: string;
  name: string;
  code: string;
  logoUrl: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  taxNumber: string | null;
  defaultCurrency: string;
  baseExchangeRate: number;
  timezone: string;
}

export interface StoreReceiptSettings {
  showLogo: boolean;
  showTaxBreakdown: boolean;
  showCashierName: boolean;
  showCustomerInfo: boolean;
  paperSize: '58mm' | '80mm';
  customHeader: string | null;
  customFooter: string | null;
}

export interface StoreTaxSettings {
  defaultTaxRate: number;
  isTaxInclusive: boolean;
  enableTax: boolean;
  taxNumber: string | null;
}

export interface StoreInventorySettings {
  allowNegativeStock: boolean;
  defaultLowStockAlert: number;
  trackBatches: boolean;
  enableStockTransfers: boolean;
}

export interface StoreSettingsUnified {
  id: string;
  storeId: string;
  storeName: string;
  receipt: StoreReceiptSettings;
  tax: StoreTaxSettings;
  inventory: StoreInventorySettings;
}

export interface PosOperationalSettings {
  receiptSize: '58mm' | '80mm';
  barcodeBehavior: {
    autoAddToCart: boolean;
    beepOnScan: boolean;
    focusInputByDefault: boolean;
    minLength: number;
  };
  sound: {
    enabled: boolean;
    volume: number; // 0.0 to 1.0
    playBeep: boolean;
    playCashDrawer: boolean;
    playWarning: boolean;
    playSuccess: boolean;
  };
  keyboardShortcuts: {
    enabled: boolean;
    customBindings: Record<string, string>; // e.g. { search: 'F1', barcode: 'F2', customer: 'F4', payment: 'F8', clear: 'Delete', shortcuts: '?' }
  };
  customerDisplay: {
    enabled: boolean;
    port: string;
    baudRate: number;
    lineLength: number;
    welcomeMessage: string;
    idleMessage: string;
  };
  printer: {
    enabled: boolean;
    type: 'network' | 'usb' | 'bluetooth';
    ip: string;
    port: number;
    charactersPerLine: number;
    autoCut: boolean;
  };
  cashDrawer: {
    enabled: boolean;
    driver: 'printer_kick' | 'direct_serial';
    pulsePin: number;
    openOnCashSale: boolean;
  };
}

export interface LocalizationSettings {
  language: 'en' | 'km' | 'zh';
  defaultCurrency: 'USD' | 'KHR';
  currencyFormatting: {
    symbol: string;
    position: 'prefix' | 'suffix';
    decimalPlaces: number;
    thousandsSeparator: string;
    decimalSeparator: string;
  };
  dateTimeFormatting: {
    dateFormat: string; // e.g. "DD/MM/YYYY" or "YYYY-MM-DD"
    timeFormat: string; // e.g. "hh:mm A" or "HH:mm"
    timezone: string;
    use24Hour: boolean;
  };
}

export interface PaymentMethodConfig {
  id: string;
  businessId: string;
  name: string;
  code: string;
  type: string;
  isActive: boolean;
  isDefault: boolean;
  config: Record<string, any> | null;
}

export interface UserDetailExtended {
  id: string;
  username: string;
  email: string | null;
  fullName: string;
  phone: string | null;
  isActive: boolean;
  roles: Array<{
    roleId: string;
    roleName: string;
    storeId: string | null;
    storeName: string | null;
  }>;
  permissions: string[];
  storeAccess: Array<{
    storeId: string;
    storeName: string;
  }>;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface RoleDetailExtended {
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: Array<{
    id: string;
    code: string;
    name: string;
    category: string;
  }>;
  userCount: number;
  createdAt: string;
}

export interface UnifiedSettingsPayload {
  business: BusinessSettings;
  store: StoreSettingsUnified;
  pos: PosOperationalSettings;
  localization: LocalizationSettings;
  paymentMethods: PaymentMethodConfig[];
  storesList: Array<{ id: string; name: string; code: string }>;
}
