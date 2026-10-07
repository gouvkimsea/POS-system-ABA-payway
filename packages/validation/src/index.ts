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
  phone: z.string().min(6, 'Valid phone number required').trim().optional().or(z.literal('')),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  address: z.string().optional(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerInputSchema>;

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
  type: z.enum([
    'PURCHASE',
    'RETURN',
    'ADJUSTMENT_IN',
    'ADJUSTMENT_OUT',
    'DAMAGE',
    'EXPIRED',
  ]),
  quantityChange: z.number().refine((n) => n !== 0, {
    message: 'Quantity change cannot be zero',
  }),
  unitCost: z.number().min(0).optional(),
  reason: z.string().min(3, 'A specific audit reason is strictly required for stock adjustment').trim(),
  referenceType: z.string().optional().default('MANUAL_ADJUSTMENT'),
  referenceId: z.string().optional(),
});

export type StockAdjustmentInputType = z.infer<typeof stockAdjustmentSchema>;

export const stockTransferSchema = z.object({
  storeId: z.string().optional(),
  fromLocationId: z.string().min(1, 'Source location is required'),
  toLocationId: z.string().min(1, 'Destination location is required'),
  productId: z.string().min(1, 'Product is required'),
  variantId: z.string().nullable().optional(),
  quantity: z.number().positive('Transfer quantity must be greater than zero'),
  reason: z.string().min(3, 'A specific transfer reason is strictly required').trim(),
}).refine((data) => data.fromLocationId !== data.toLocationId, {
  message: 'Source and destination locations cannot be the same',
  path: ['toLocationId'],
});

export type StockTransferInputType = z.infer<typeof stockTransferSchema>;

// ------------------------------------------------------------------------------
// HARDWARE INTEGRATION VALIDATION SCHEMAS
// ------------------------------------------------------------------------------

export const printerConfigSchema = z.object({
  driver: z.enum([
    'LOCAL_BRIDGE',
    'NETWORK_TCP',
    'WEB_SERIAL',
    'WEB_USB',
    'BROWSER_FALLBACK',
  ]),
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

