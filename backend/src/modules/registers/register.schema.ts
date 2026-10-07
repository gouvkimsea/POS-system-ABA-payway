import { z } from 'zod';
import { CashMovementType } from '@prisma/client';

export const openSessionSchema = z.object({
  registerId: z.string().uuid('Valid register ID is required'),
  openingFloatUSD: z.number().min(0).default(0),
  openingFloatKHR: z.number().min(0).default(0),
  notes: z.string().optional(),
});

export const closeSessionSchema = z.object({
  actualCashUSD: z.number().min(0, 'Actual USD cash amount is required'),
  actualCashKHR: z.number().min(0, 'Actual KHR cash amount is required'),
  closingNotes: z.string().optional(),
});

export const cashMovementSchema = z.object({
  type: z.nativeEnum(CashMovementType),
  amountUSD: z.number().min(0).default(0),
  amountKHR: z.number().min(0).default(0),
  reason: z.string().min(2, 'Reason is required for cash movement'),
  referenceNumber: z.string().optional(),
});

export type OpenSessionInput = z.infer<typeof openSessionSchema>;
export type CloseSessionInput = z.infer<typeof closeSessionSchema>;
export type CashMovementInput = z.infer<typeof cashMovementSchema>;
