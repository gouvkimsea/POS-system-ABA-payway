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
