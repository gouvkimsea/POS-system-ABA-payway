import { z } from 'zod';
import { PaymentMethod, DiscountType } from '@prisma/client';

export const createSaleItemSchema = z.object({
  productId: z.string().uuid('Valid product ID is required'),
  variantId: z.string().uuid().optional().nullable(),
  quantity: z.number().positive('Quantity must be greater than zero'),
  discountAmountUSD: z.number().min(0).default(0),
});

export const createSalePaymentSchema = z.object({
  method: z.nativeEnum(PaymentMethod),
  amountUSD: z.number().min(0).default(0),
  amountKHR: z.number().min(0).default(0),
  tenderAmountUSD: z.number().min(0).default(0),
  tenderAmountKHR: z.number().min(0).default(0),
  transactionRef: z.string().optional(),
});

export const createSaleSchema = z.object({
  registerId: z.string().uuid().optional().nullable(),
  customerId: z.string().optional().nullable(),
  items: z.array(createSaleItemSchema).min(1, 'Sale must contain at least one item'),
  discountType: z.nativeEnum(DiscountType).default(DiscountType.NONE),
  discountValue: z.number().min(0).default(0),
  payments: z.array(createSalePaymentSchema).min(1, 'At least one payment method is required'),
  notes: z.string().optional(),
  offlineSyncId: z.string().optional(),
});

export const refundItemSchema = z.object({
  saleItemId: z.string().uuid('Valid sale item ID is required'),
  quantity: z.number().positive('Quantity must be positive'),
  restockInventory: z.boolean().default(true),
});

export const refundSaleSchema = z.object({
  reason: z.string().min(2, 'Refund reason is required'),
  items: z.array(refundItemSchema).min(1, 'At least one item must be refunded'),
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type RefundSaleInput = z.infer<typeof refundSaleSchema>;
