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
  quantity: z.number().positive('Quantity must be greater than zero'),
  unitPriceUSD: z.number().min(0, 'Unit price must be non-negative'),
  discountUSD: z.number().min(0).optional().default(0),
  notes: z.string().optional(),
});

export const checkoutPaymentSchema = z.object({
  paymentMethodCode: z.string().min(1, 'Payment method code is required'),
  amountUSD: z.number().min(0),
  amountKHR: z.number().min(0),
  tenderAmountUSD: z.number().min(0).optional().default(0),
  tenderAmountKHR: z.number().min(0).optional().default(0),
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
});

export type CheckoutInputSchemaType = z.infer<typeof checkoutInputSchema>;

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

