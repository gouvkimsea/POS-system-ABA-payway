import { z } from 'zod';

export const productQuerySchema = z.object({
  search: z.string().optional(),
  categoryId: z.string().optional(),
  storeId: z.string().optional(),
  page: z.string().optional().default('1').transform((val) => parseInt(val, 10)),
  limit: z.string().optional().default('50').transform((val) => parseInt(val, 10)),
});

export const barcodeLookupSchema = z.object({
  barcode: z.string().min(1, 'Barcode is required'),
});

export const createProductSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  sku: z.string().min(1, 'SKU is required'),
  barcode: z.string().optional(),
  categoryId: z.string().optional(),
  costPrice: z.number().min(0).default(0),
  sellingPriceUSD: z.number().min(0),
  sellingPriceKHR: z.number().min(0).optional(),
  taxRate: z.number().min(0).max(1).default(0.10),
  isTaxInclusive: z.boolean().default(true),
  unit: z.string().default('pcs'),
  alertLowStock: z.number().default(5),
  initialStock: z.number().min(0).default(0),
});

export type ProductQueryInput = z.infer<typeof productQuerySchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
