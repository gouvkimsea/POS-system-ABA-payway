import { z } from 'zod';

export const healthCheckResponseSchema = z.object({
  status: z.enum(['ok', 'degraded', 'error']),
  timestamp: z.string(),
  uptimeSeconds: z.number(),
  environment: z.string(),
  services: z.object({
    database: z.object({
      status: z.enum(['connected', 'disconnected', 'error']),
      latencyMs: z.number().optional(),
      error: z.string().optional(),
    }),
    redis: z.object({
      status: z.enum(['connected', 'in-memory-fallback', 'disconnected']),
      latencyMs: z.number().optional(),
      error: z.string().optional(),
    }),
  }),
  version: z.string(),
});

export const apiPingSchema = z.object({
  message: z.string().optional(),
});

// Authentication Schemas
export const loginInputSchema = z.object({
  username: z.string().min(1, 'Username or email is required').trim(),
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginInputSchema>;

export const pinLoginInputSchema = z.object({
  username: z.string().min(1, 'Username is required').trim(),
  pin: z.string().min(4, 'PIN must be at least 4 digits').max(8).trim(),
  storeId: z.string().optional(),
});

export type PinLoginInput = z.infer<typeof pinLoginInputSchema>;

export const refreshTokenInputSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export type RefreshTokenInput = z.infer<typeof refreshTokenInputSchema>;

export const forgotPasswordInputSchema = z.object({
  emailOrUsername: z.string().min(1, 'Email or username is required').trim(),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordInputSchema>;

export const resetPasswordInputSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters long'),
});

export type ResetPasswordInput = z.infer<typeof resetPasswordInputSchema>;

// ------------------------------------------------------------------------------
// POS Validation Schemas
// ------------------------------------------------------------------------------

export const checkoutItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  variantId: z.string().nullable().optional(),
  quantity: z.number().positive('Quantity must be greater than zero'),
  unitPriceUSD: z.number().min(0, 'Unit price must be non-negative').optional(),
  discountUSD: z.number().min(0).optional().default(0),
  notes: z.string().optional(),
});

export const checkoutPaymentSchema = z.object({
  paymentMethodCode: z.string().min(1, 'Payment method code is required'),
  amountUSD: z.number().min(0),
  amountKHR: z.number().min(0).optional().default(0),
  tenderAmountUSD: z.number().min(0).optional().default(0),
  tenderAmountKHR: z.number().min(0).optional().default(0),
  transactionRef: z.string().trim().optional(),
  metadata: z.record(z.any()).optional(),
});

export const checkoutInputSchema = z.object({
  storeId: z.string().optional(),
  registerId: z.string().optional(),
  customerId: z.string().nullable().optional(),
  items: z.array(checkoutItemSchema).min(1, 'At least one item is required in the cart'),
  discountCode: z.string().optional(),
  discountUSD: z.number().min(0).optional().default(0),
  payments: z.array(checkoutPaymentSchema).min(1, 'At least one payment method is required'),
  notes: z.string().optional(),
  idempotencyKey: z.string().min(1).optional(),
  allowPartialPayment: z.boolean().optional().default(false),
});

export type CheckoutInputSchemaType = z.infer<typeof checkoutInputSchema>;

export const orderCalculationItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  variantId: z.string().nullable().optional(),
  quantity: z.number().positive('Quantity must be greater than zero'),
  discountUSD: z.number().min(0).optional().default(0),
});

export const orderCalculationSchema = z.object({
  storeId: z.string().optional(),
  items: z.array(orderCalculationItemSchema).min(1, 'At least one item is required'),
  discountCode: z.string().optional(),
  discountUSD: z.number().min(0).optional().default(0),
});

export type OrderCalculationSchemaType = z.infer<typeof orderCalculationSchema>;

export const addPaymentSchema = z.object({
  payment: checkoutPaymentSchema,
  idempotencyKey: z.string().min(1).optional(),
});

export type AddPaymentSchemaType = z.infer<typeof addPaymentSchema>;

export const voidOrderSchema = z.object({
  reason: z.string().min(3, 'Void reason must be at least 3 characters').trim(),
});

export type VoidOrderSchemaType = z.infer<typeof voidOrderSchema>;

export const refundOrderSchema = z.object({
  amountUSD: z.number().positive('Refund amount must be positive'),
  reason: z.string().min(3, 'Refund reason must be at least 3 characters').trim(),
  returnToInventory: z.boolean().optional().default(true),
});

export type RefundOrderSchemaType = z.infer<typeof refundOrderSchema>;

export const cancelOrderSchema = z.object({
  reason: z.string().min(3, 'Cancellation reason must be at least 3 characters').trim(),
});

export type CancelOrderSchemaType = z.infer<typeof cancelOrderSchema>;

export const createCustomerInputSchema = z.object({
  name: z.string().min(1, 'Customer name is required').trim(),
  phone: z.string().trim().nullable().optional().or(z.literal('')),
  email: z.string().email('Invalid email address').nullable().optional().or(z.literal('')),
  address: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
  taxNumber: z.string().trim().nullable().optional(),
  isWalkIn: z.boolean().optional().default(false),
});

export type CreateCustomerInput = z.infer<typeof createCustomerInputSchema>;

export const updateCustomerInputSchema = createCustomerInputSchema.partial().extend({
  loyaltyPoints: z.number().int().min(0).optional(),
  creditBalanceUSD: z.number().min(0).optional(),
});

export type UpdateCustomerInput = z.infer<typeof updateCustomerInputSchema>;

// ------------------------------------------------------------------------------
// Catalog & Inventory Validation Schemas
// ------------------------------------------------------------------------------

export const createProductSchema = z.object({
  name: z.string().min(1, 'Product name is required').trim(),
  nameKhmer: z.string().trim().nullable().optional(),
  sku: z.string().min(1, 'SKU is required').trim(),
  barcode: z.string().trim().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  brandId: z.string().nullable().optional(),
  supplierId: z.string().nullable().optional(),
  description: z.string().trim().nullable().optional(),
  costPriceUSD: z.number().min(0, 'Cost price must be non-negative'),
  sellingPriceUSD: z.number().min(0, 'Selling price must be non-negative'),
  sellingPriceKHR: z.number().min(0).optional(),
  taxRate: z.number().min(0).max(1).optional().default(0.1),
  isTaxInclusive: z.boolean().optional().default(true),
  trackInventory: z.boolean().optional().default(true),
  alertLowStock: z.number().int().min(0).optional().default(5),
  reorderLevel: z.number().int().min(0).optional().default(5),
  unit: z.string().trim().min(1).optional().default('pcs'),
  imageUrl: z.string().url('Invalid image URL').nullable().optional().or(z.literal('')),
  isActive: z.boolean().optional().default(true),
  initialStock: z.number().min(0).optional(),
  initialLocationId: z.string().optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = createProductSchema.partial().extend({
  id: z.string().optional(),
});

export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const createVariantSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  name: z.string().min(1, 'Variant name is required').trim(),
  sku: z.string().min(1, 'Variant SKU is required').trim(),
  barcode: z.string().trim().nullable().optional(),
  size: z.string().trim().nullable().optional(),
  color: z.string().trim().nullable().optional(),
  weight: z.string().trim().nullable().optional(),
  model: z.string().trim().nullable().optional(),
  costPriceUSD: z.number().min(0, 'Cost price must be non-negative'),
  sellingPriceUSD: z.number().min(0, 'Selling price must be non-negative'),
  sellingPriceKHR: z.number().min(0).optional(),
  isActive: z.boolean().optional().default(true),
  initialStock: z.number().min(0).optional(),
  initialLocationId: z.string().optional(),
});

export type CreateVariantInput = z.infer<typeof createVariantSchema>;

export const updateVariantSchema = createVariantSchema.partial().extend({
  id: z.string().optional(),
});

export type UpdateVariantInput = z.infer<typeof updateVariantSchema>;

export const categorySchema = z.object({
  name: z.string().min(1, 'Category name is required').trim(),
  code: z.string().trim().nullable().optional(),
  parentId: z.string().nullable().optional(),
  color: z.string().trim().optional().default('#4f46e5'),
  icon: z.string().trim().nullable().optional(),
  sortOrder: z.number().int().optional().default(0),
  isActive: z.boolean().optional().default(true),
});

export type CategoryInput = z.infer<typeof categorySchema>;

export const brandSchema = z.object({
  name: z.string().min(1, 'Brand name is required').trim(),
  description: z.string().trim().nullable().optional(),
  isActive: z.boolean().optional().default(true),
});

export type BrandInput = z.infer<typeof brandSchema>;

export const supplierSchema = z.object({
  name: z.string().min(1, 'Supplier name is required').trim(),
  contactPerson: z.string().trim().nullable().optional(),
  phone: z.string().trim().nullable().optional(),
  email: z.string().email('Invalid email address').trim().nullable().optional().or(z.literal('')),
  address: z.string().trim().nullable().optional(),
  taxId: z.string().trim().nullable().optional(),
  isActive: z.boolean().optional().default(true),
});

export type SupplierInput = z.infer<typeof supplierSchema>;

export const inventoryLocationSchema = z.object({
  storeId: z.string().min(1, 'Store ID is required'),
  name: z.string().min(1, 'Location name is required').trim(),
  code: z.string().min(1, 'Location code is required').trim(),
  description: z.string().trim().nullable().optional(),
  isDefault: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
});

export type InventoryLocationInput = z.infer<typeof inventoryLocationSchema>;

export const stockAdjustmentSchema = z.object({
  storeId: z.string().optional(),
  locationId: z.string().min(1, 'Inventory location is required'),
  productId: z.string().min(1, 'Product is required'),
  variantId: z.string().nullable().optional(),
  type: z.enum(['PURCHASE', 'RETURN', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'DAMAGE', 'EXPIRED']),
  quantityChange: z.number().refine((n) => n !== 0, {
    message: 'Quantity change cannot be zero',
  }),
  unitCost: z.number().min(0).optional(),
  reason: z
    .string()
    .min(3, 'A specific audit reason is strictly required for stock adjustment')
    .trim(),
  referenceType: z.string().optional().default('MANUAL_ADJUSTMENT'),
  referenceId: z.string().optional(),
});

export type StockAdjustmentInputType = z.infer<typeof stockAdjustmentSchema>;

export const stockTransferSchema = z
  .object({
    storeId: z.string().optional(),
    fromLocationId: z.string().min(1, 'Source location is required'),
    toLocationId: z.string().min(1, 'Destination location is required'),
    productId: z.string().min(1, 'Product is required'),
    variantId: z.string().nullable().optional(),
    quantity: z.number().positive('Transfer quantity must be greater than zero'),
    reason: z.string().min(3, 'A specific transfer reason is strictly required').trim(),
  })
  .refine((data) => data.fromLocationId !== data.toLocationId, {
    message: 'Source and destination locations cannot be the same',
    path: ['toLocationId'],
  });

export type StockTransferInputType = z.infer<typeof stockTransferSchema>;

// ------------------------------------------------------------------------------
// HARDWARE INTEGRATION VALIDATION SCHEMAS
// ------------------------------------------------------------------------------

export const printerConfigSchema = z.object({
  driver: z.enum(['LOCAL_BRIDGE', 'NETWORK_TCP', 'WEB_SERIAL', 'WEB_USB', 'BROWSER_FALLBACK']),
  name: z.string().min(1, 'Printer name is required').trim(),
  paperSize: z.enum(['58mm', '80mm']),
  networkIp: z.string().optional(),
  networkPort: z.number().int().min(1).max(65535).optional().default(9100),
  autoCut: z.boolean().default(true),
  autoOpenDrawer: z.boolean().default(true),
  copies: z.number().int().min(1).max(5).default(1),
  headerText: z.string().optional(),
  footerText: z.string().optional(),
});

export const printJobItemSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().positive(),
  unitPriceUSD: z.number().min(0),
  totalUSD: z.number().min(0),
  discountUSD: z.number().min(0).optional(),
});

export const printJobDataSchema = z.object({
  storeName: z.string().min(1),
  storeAddress: z.string().optional(),
  storePhone: z.string().optional(),
  receiptNumber: z.string().min(1),
  orderNumber: z.string().min(1),
  cashierName: z.string().optional(),
  customerName: z.string().optional(),
  createdAt: z.string(),
  items: z.array(printJobItemSchema),
  subtotalUSD: z.number().min(0),
  discountUSD: z.number().min(0).optional(),
  taxUSD: z.number().min(0).optional(),
  totalUSD: z.number().min(0),
  totalKHR: z.number().min(0),
  exchangeRateKHR: z.number().positive(),
  payments: z.array(
    z.object({
      method: z.string(),
      amountUSD: z.number().min(0),
      amountKHR: z.number().min(0),
      tenderUSD: z.number().min(0).optional(),
      tenderKHR: z.number().min(0).optional(),
    }),
  ),
  changeUSD: z.number().min(0).optional(),
  changeKHR: z.number().min(0).optional(),
  qrPayload: z.string().optional(),
  reprintNotice: z.boolean().optional(),
  headerText: z.string().optional(),
  footerText: z.string().optional(),
});

export const printJobSchema = z.object({
  jobId: z.string().min(1),
  type: z.enum(['TEST', 'RECEIPT', 'REPRINT']),
  printer: printerConfigSchema,
  data: printJobDataSchema.optional(),
  rawEscPos: z.string().optional(),
  timestamp: z.string(),
});

export const scannerConfigSchema = z.object({
  mode: z.enum(['KEYBOARD_WEDGE', 'CAMERA', 'LOCAL_BRIDGE', 'WEB_SERIAL']),
  interKeyTimeoutMs: z.number().int().min(10).max(250).default(50),
  minBarcodeLength: z.number().int().min(1).max(20).default(4),
  soundBeepOnScan: z.boolean().default(true),
  vibrateOnScan: z.boolean().default(true),
  prefix: z.string().optional(),
  suffix: z.string().optional().default('\n'),
});

export const cashDrawerConfigSchema = z.object({
  driver: z.enum(['PRINTER_KICK', 'LOCAL_BRIDGE_DIRECT', 'MANUAL_FALLBACK']),
  kickPin: z.union([z.literal(2), z.literal(5)]).default(2),
  pulseOnMs: z.number().int().min(10).max(500).default(50),
  autoOpenOnCashPayment: z.boolean().default(true),
  soundChirp: z.boolean().default(true),
});

export const customerDisplayConfigSchema = z.object({
  driver: z.enum(['SECONDARY_WINDOW', 'LOCAL_BRIDGE_VFD', 'DISABLED']),
  idleLine1: z.string().default('Welcome to Angkor Fresh Mart!'),
  idleLine2: z.string().default('Scan items to begin checkout'),
  polePort: z.string().optional(),
  poleBaudRate: z.number().int().default(9600),
});

export const bridgeConfigSchema = z.object({
  enabled: z.boolean().default(true),
  bridgeUrl: z.string().url().default('http://127.0.0.1:9123'),
  wsUrl: z.string().optional(),
  pollIntervalMs: z.number().int().min(1000).max(60000).default(5000),
});

export const hardwareSettingsProfileSchema = z.object({
  terminalId: z.string().min(1),
  storeId: z.string().min(1),
  bridge: bridgeConfigSchema,
  printer: printerConfigSchema,
  scanner: scannerConfigSchema,
  cashDrawer: cashDrawerConfigSchema,
  customerDisplay: customerDisplayConfigSchema,
  lastSavedAt: z.string(),
});

export const registerDeviceInputSchema = z.object({
  storeId: z.string().min(1, 'Store ID is required'),
  name: z.string().min(1, 'Device name is required').trim(),
  deviceIdentifier: z.string().min(1, 'Device identifier is required').trim(),
  deviceType: z.enum(['TERMINAL', 'TABLET', 'MOBILE', 'DESKTOP']).optional().default('TERMINAL'),
  hardwareConfig: z.record(z.any()).optional(),
});

// ------------------------------------------------------------------------------
// OFFLINE SYNC VALIDATION SCHEMAS
// ------------------------------------------------------------------------------

export const syncItemStatusSchema = z.enum([
  'pending',
  'syncing',
  'synchronized',
  'failed',
  'conflict',
]);

export const conflictReasonCodeSchema = z.enum([
  'PRODUCT_NOT_FOUND',
  'PRODUCT_INACTIVE',
  'PRICE_MISMATCH',
  'INVENTORY_NEGATIVE',
  'CUSTOMER_NOT_FOUND',
  'DUPLICATE_KEY',
  'VALIDATION_FAILED',
  'INTERNAL_ERROR',
]);

export const offlineConflictInfoSchema = z.object({
  reason: conflictReasonCodeSchema,
  message: z.string(),
  details: z.record(z.any()).optional(),
  occurredAt: z.string(),
  localVersion: z.record(z.any()).optional(),
  serverVersion: z.record(z.any()).optional(),
  resolutionAction: z.enum(['OVERRIDE_ACCEPT', 'RETRY', 'DISCARD']).optional(),
  resolvedAt: z.string().optional(),
  resolvedBy: z.string().optional(),
});

export const offlineSyncQueueItemSchema = z.object({
  id: z.string().min(1),
  clientSyncId: z.string().min(1),
  offlineOrderNumber: z.string().min(1),
  offlineReceiptNumber: z.string().min(1),
  storeId: z.string().min(1),
  registerId: z.string().optional(),
  cashierId: z.string().min(1),
  cashierName: z.string().min(1),
  status: syncItemStatusSchema,
  createdAt: z.string(),
  lastAttemptAt: z.string().nullable().optional(),
  syncedAt: z.string().nullable().optional(),
  attempts: z.number().int().min(0).default(0),
  errorMessage: z.string().nullable().optional(),
  conflict: offlineConflictInfoSchema.nullable().optional(),
  payload: checkoutInputSchema.extend({
    offlineMetadata: z
      .object({
        deviceIdentifier: z.string().optional(),
        offlineCreatedAt: z.string().optional(),
        subtotalUSD: z.number().optional(),
        totalUSD: z.number().optional(),
        totalKHR: z.number().optional(),
        itemsDetail: z
          .array(
            z.object({
              productId: z.string(),
              productName: z.string(),
              sku: z.string(),
              barcode: z.string().nullable().optional(),
              quantity: z.number(),
              unitPriceUSD: z.number(),
              discountUSD: z.number().optional().default(0),
            }),
          )
          .optional(),
      })
      .optional(),
  }),
  serverOrderId: z.string().nullable().optional(),
  serverOrderNumber: z.string().nullable().optional(),
});

export const syncBatchRequestSchema = z.object({
  deviceId: z.string().optional(),
  deviceIdentifier: z.string().optional(),
  storeId: z.string().optional(),
  items: z.array(offlineSyncQueueItemSchema).min(1, 'At least one queue item is required to sync'),
});

export const resolveConflictInputSchema = z.object({
  syncQueueId: z.string().min(1, 'Sync queue item ID is required'),
  action: z.enum(['OVERRIDE_ACCEPT', 'RETRY', 'DISCARD']),
  notes: z.string().optional(),
});

// Register Session & Cash Movement Schemas
export const openRegisterSchema = z.object({
  registerId: z.string().min(1, 'Register ID is required'),
  openingFloatUSD: z.number().min(0, 'Opening float USD must be >= 0').default(0),
  openingFloatKHR: z.number().min(0, 'Opening float KHR must be >= 0').default(0),
  notes: z.string().optional(),
});

export type OpenRegisterInputType = z.infer<typeof openRegisterSchema>;

export const cashMovementSchema = z
  .object({
    sessionId: z.string().optional(),
    registerId: z.string().optional(),
    type: z.enum(['CASH_IN', 'CASH_OUT', 'FLOAT_ADD', 'PAY_OUT', 'EXPENSE']),
    amountUSD: z.number().min(0).default(0),
    amountKHR: z.number().min(0).default(0),
    reason: z.string().min(2, 'Reason must be at least 2 characters long'),
    referenceNumber: z.string().optional(),
    category: z.string().optional(),
  })
  .refine((data) => data.amountUSD > 0 || data.amountKHR > 0, {
    message: 'Either USD or KHR amount must be greater than 0',
    path: ['amountUSD'],
  });

export type CashMovementInputType = z.infer<typeof cashMovementSchema>;

export const closeRegisterSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
  actualCashUSD: z.number().min(0, 'Counted cash USD must be >= 0'),
  actualCashKHR: z.number().min(0, 'Counted cash KHR must be >= 0'),
  denominationBreakdown: z.any().optional(),
  closingNotes: z.string().optional(),
});

export type CloseRegisterInputType = z.infer<typeof closeRegisterSchema>;

export const registerReportFilterSchema = z.object({
  storeId: z.string().optional(),
  registerId: z.string().optional(),
  cashierId: z.string().optional(),
  status: z.enum(['OPEN', 'CLOSED']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export type RegisterReportFilterType = z.infer<typeof registerReportFilterSchema>;

// Return & Refund Validation Schemas
export const returnItemInputSchema = z.object({
  orderItemId: z.string().min(1, 'Order item ID is required'),
  quantity: z.number().positive('Return quantity must be greater than zero'),
  restockInventory: z.boolean().optional().default(true),
  condition: z.enum(['RESELLABLE', 'DAMAGED', 'DEFECTIVE']).optional().default('RESELLABLE'),
  notes: z.string().optional(),
});

export const processReturnRefundSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  reason: z.enum([
    'DEFECTIVE',
    'WRONG_ITEM',
    'CUSTOMER_CHANGED_MIND',
    'DAMAGED',
    'EXPIRED',
    'OTHER',
  ]),
  reasonNotes: z.string().optional(),
  items: z.array(returnItemInputSchema).min(1, 'At least one item must be returned'),
  refundMethodCode: z.string().min(1, 'Refund payment method is required'),
  sessionId: z.string().optional(),
  notes: z.string().optional(),
});

export type ProcessReturnRefundInputType = z.infer<typeof processReturnRefundSchema>;

// General Reporting Filter Schema
export const reportingFilterSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  storeId: z.string().optional(),
  storeIds: z.union([z.string(), z.array(z.string())]).optional(),
  cashierId: z.string().optional(),
  paymentMethodCode: z.string().optional(),
  paymentMethodId: z.string().optional(),
  interval: z.enum(['daily', 'weekly', 'monthly']).optional(),
  format: z.enum(['json', 'csv', 'excel']).optional().default('json'),
});

export type ReportingFilterType = z.infer<typeof reportingFilterSchema>;

// ------------------------------------------------------------------------------
// MULTI-STORE & INVENTORY TRANSFER VALIDATION SCHEMAS
// ------------------------------------------------------------------------------

export const storeSettingsSchema = z.object({
  defaultCurrency: z.enum(['USD', 'KHR']).optional(),
  timezone: z.string().optional(),
  receiptHeader: z.string().nullable().optional(),
  receiptFooter: z.string().nullable().optional(),
  taxRate: z.number().min(0).max(1).optional(),
  autoPrintReceipt: z.boolean().optional(),
  allowNegativeStock: z.boolean().optional(),
  lowStockThreshold: z.number().min(0).optional(),
});

export type StoreSettingsInput = z.infer<typeof storeSettingsSchema>;

export const createStoreSchema = z.object({
  name: z.string().min(1, 'Store name is required').trim(),
  code: z.string().min(1, 'Store code is required').trim().toUpperCase(),
  phone: z.string().nullable().optional(),
  email: z.string().email('Invalid email address').nullable().optional().or(z.literal('')),
  address: z.string().nullable().optional(),
  receiptHeader: z.string().nullable().optional(),
  receiptFooter: z.string().nullable().optional(),
  settings: storeSettingsSchema.optional(),
  isActive: z.boolean().optional().default(true),
});

export type CreateStoreInput = z.infer<typeof createStoreSchema>;

export const updateStoreSchema = createStoreSchema.partial();
export type UpdateStoreInput = z.infer<typeof updateStoreSchema>;

export const createStoreRegisterSchema = z.object({
  name: z.string().min(1, 'Register name is required').trim(),
  code: z.string().min(1, 'Register code is required').trim().toUpperCase(),
  isActive: z.boolean().optional().default(true),
});

export type CreateStoreRegisterInput = z.infer<typeof createStoreRegisterSchema>;

export const updateStoreRegisterSchema = createStoreRegisterSchema.partial();
export type UpdateStoreRegisterInput = z.infer<typeof updateStoreRegisterSchema>;

export const assignStoreUserSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  roleId: z.string().min(1, 'Role ID is required'),
});

export type AssignStoreUserInput = z.infer<typeof assignStoreUserSchema>;

export const updateStoreProductSchema = z.object({
  isActive: z.boolean().optional(),
  customPriceUSD: z.number().min(0).nullable().optional(),
  customPriceKHR: z.number().min(0).nullable().optional(),
  minStockLevel: z.number().min(0).nullable().optional(),
  maxStockLevel: z.number().min(0).nullable().optional(),
});

export type UpdateStoreProductInput = z.infer<typeof updateStoreProductSchema>;

export const transferItemInputSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  variantId: z.string().nullable().optional(),
  requestedQuantity: z.number().positive('Requested quantity must be greater than 0'),
  notes: z.string().optional(),
});

export const createTransferRequestSchema = z.object({
  sourceStoreId: z.string().min(1, 'Source store is required'),
  targetStoreId: z.string().min(1, 'Target store is required'),
  notes: z.string().optional(),
  items: z
    .array(transferItemInputSchema)
    .min(1, 'At least one item is required in the transfer request'),
});

export type CreateTransferRequestInput = z.infer<typeof createTransferRequestSchema>;

export const sendTransferItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  variantId: z.string().nullable().optional(),
  sentQuantity: z.number().min(0, 'Sent quantity must be non-negative'),
  notes: z.string().optional(),
});

export const sendTransferSchema = z.object({
  notes: z.string().optional(),
  items: z.array(sendTransferItemSchema).optional(),
});

export type SendTransferInput = z.infer<typeof sendTransferSchema>;

export const receiveTransferItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  variantId: z.string().nullable().optional(),
  receivedQuantity: z.number().min(0, 'Received quantity must be non-negative'),
  notes: z.string().optional(),
});

export const receiveTransferSchema = z.object({
  notes: z.string().optional(),
  items: z.array(receiveTransferItemSchema).optional(),
});

export type ReceiveTransferInput = z.infer<typeof receiveTransferSchema>;

// ------------------------------------------------------------------------------
// SETTINGS SYSTEM VALIDATION SCHEMAS
// ------------------------------------------------------------------------------

export const updateBusinessSettingsSchema = z.object({
  name: z.string().min(1, 'Business name is required').trim(),
  logoUrl: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email('Invalid email address').nullable().optional().or(z.literal('')),
  taxNumber: z.string().nullable().optional(),
  defaultCurrency: z.string().min(1).default('USD'),
  baseExchangeRate: z.number().positive('Exchange rate must be positive').default(4100),
  timezone: z.string().min(1).default('Asia/Phnom_Penh'),
});

export type UpdateBusinessSettingsInput = z.infer<typeof updateBusinessSettingsSchema>;

export const storeReceiptSettingsSchema = z.object({
  showLogo: z.boolean().default(true),
  showTaxBreakdown: z.boolean().default(true),
  showCashierName: z.boolean().default(true),
  showCustomerInfo: z.boolean().default(true),
  paperSize: z.enum(['58mm', '80mm']).default('80mm'),
  customHeader: z.string().nullable().optional(),
  customFooter: z.string().nullable().optional(),
});

export const storeTaxSettingsSchema = z.object({
  defaultTaxRate: z.number().min(0).max(100).default(0.1),
  isTaxInclusive: z.boolean().default(false),
  enableTax: z.boolean().default(true),
  taxNumber: z.string().nullable().optional(),
});

export const storeInventorySettingsSchema = z.object({
  allowNegativeStock: z.boolean().default(false),
  defaultLowStockAlert: z.number().min(0).default(5),
  trackBatches: z.boolean().default(false),
  enableStockTransfers: z.boolean().default(true),
});

export const updateStoreSettingsExtendedSchema = z.object({
  storeName: z.string().min(1, 'Store name is required').optional(),
  address: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  receipt: storeReceiptSettingsSchema.optional(),
  tax: storeTaxSettingsSchema.optional(),
  inventory: storeInventorySettingsSchema.optional(),
});

export type UpdateStoreSettingsExtendedInput = z.infer<typeof updateStoreSettingsExtendedSchema>;

export const updatePosSettingsSchema = z.object({
  receiptSize: z.enum(['58mm', '80mm']).default('80mm'),
  barcodeBehavior: z.object({
    autoAddToCart: z.boolean().default(true),
    beepOnScan: z.boolean().default(true),
    focusInputByDefault: z.boolean().default(true),
    minLength: z.number().min(1).default(3),
  }),
  sound: z.object({
    enabled: z.boolean().default(true),
    volume: z.number().min(0).max(1).default(0.7),
    playBeep: z.boolean().default(true),
    playCashDrawer: z.boolean().default(true),
    playWarning: z.boolean().default(true),
    playSuccess: z.boolean().default(true),
  }),
  keyboardShortcuts: z.object({
    enabled: z.boolean().default(true),
    customBindings: z.record(z.string()).default({
      search: 'F1',
      barcode: 'F2',
      customer: 'F4',
      payment: 'F8',
      clear: 'Delete',
      shortcuts: '?',
    }),
  }),
  customerDisplay: z.object({
    enabled: z.boolean().default(false),
    port: z.string().default('COM3'),
    baudRate: z.number().default(9600),
    lineLength: z.number().default(20),
    welcomeMessage: z.string().default('Welcome to POS!'),
    idleMessage: z.string().default('Thank You!'),
  }),
  printer: z.object({
    enabled: z.boolean().default(true),
    type: z.enum(['network', 'usb', 'bluetooth']).default('network'),
    ip: z.string().default('192.168.1.200'),
    port: z.number().default(9100),
    charactersPerLine: z.number().default(48),
    autoCut: z.boolean().default(true),
  }),
  cashDrawer: z.object({
    enabled: z.boolean().default(true),
    driver: z.enum(['printer_kick', 'direct_serial']).default('printer_kick'),
    pulsePin: z.number().default(0),
    openOnCashSale: z.boolean().default(true),
  }),
});

export type UpdatePosSettingsInput = z.infer<typeof updatePosSettingsSchema>;

export const updateLocalizationSettingsSchema = z.object({
  language: z.enum(['en', 'km', 'zh']).default('en'),
  defaultCurrency: z.enum(['USD', 'KHR']).default('USD'),
  currencyFormatting: z.object({
    symbol: z.string().default('$'),
    position: z.enum(['prefix', 'suffix']).default('prefix'),
    decimalPlaces: z.number().min(0).max(4).default(2),
    thousandsSeparator: z.string().default(','),
    decimalSeparator: z.string().default('.'),
  }),
  dateTimeFormatting: z.object({
    dateFormat: z.string().default('DD/MM/YYYY'),
    timeFormat: z.string().default('hh:mm A'),
    timezone: z.string().default('Asia/Phnom_Penh'),
    use24Hour: z.boolean().default(false),
  }),
});

export type UpdateLocalizationSettingsInput = z.infer<typeof updateLocalizationSettingsSchema>;

export const paymentMethodConfigSchema = z.object({
  name: z.string().min(1, 'Payment method name is required'),
  code: z.string().min(1, 'Payment code is required').trim().toUpperCase(),
  type: z.enum(['CASH', 'DIGITAL_QR', 'CARD', 'BANK_TRANSFER', 'CUSTOMER_CREDIT', 'OTHER']),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  config: z.record(z.any()).nullable().optional(),
});

export type PaymentMethodConfigInput = z.infer<typeof paymentMethodConfigSchema>;

export const createSystemUserSchema = z
  .object({
    username: z.string().min(3, 'Username must be at least 3 characters').trim(),
    email: z.string().email('Invalid email address').nullable().optional().or(z.literal('')),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    pinCode: z.string().min(4, 'PIN must be 4-6 digits').max(6).optional(),
    fullName: z.string().min(1, 'Full name is required').trim(),
    phone: z.string().nullable().optional(),
    roleId: z.string().optional(),
    roleIds: z.array(z.string()).optional(),
    storeIds: z.array(z.string()).optional().default([]), // Empty means all stores
    isActive: z.boolean().optional().default(true),
  })
  .refine((data) => Boolean(data.roleId || (data.roleIds && data.roleIds.length > 0)), {
    message: 'At least one role must be specified (roleId or roleIds)',
    path: ['roleId'],
  });

export type CreateSystemUserInput = z.infer<typeof createSystemUserSchema>;

export const updateSystemUserSchema = z.object({
  fullName: z.string().min(1, 'Full name is required').optional(),
  email: z.string().email('Invalid email address').nullable().optional().or(z.literal('')),
  phone: z.string().nullable().optional(),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  pinCode: z.string().min(4, 'PIN must be 4-6 digits').max(6).optional(),
  roleId: z.string().optional(),
  roleIds: z.array(z.string()).optional(),
  storeIds: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateSystemUserInput = z.infer<typeof updateSystemUserSchema>;
