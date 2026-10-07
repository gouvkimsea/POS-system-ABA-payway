import { PaymentMethodType, PaymentStatus } from '@pos/types';

export interface PaymentProcessRequest {
  paymentMethodCode: string;
  amountUSD: number;
  amountKHR?: number;
  tenderAmountUSD?: number;
  tenderAmountKHR?: number;
  exchangeRateKHR: number;
  transactionRef?: string;
  metadata?: Record<string, any>;
  orderNumber?: string;
}

export interface PaymentProcessResult {
  success: boolean;
  status: PaymentStatus;
  transactionRef: string;
  amountUSD: number;
  amountKHR: number;
  tenderAmountUSD: number;
  tenderAmountKHR: number;
  changeUSD: number;
  changeKHR: number;
  gatewayResponse?: any;
  errorCode?: string;
  errorMessage?: string;
}

export interface PaymentRefundRequest {
  paymentId: string;
  transactionRef?: string | null;
  amountUSD: number;
  reason: string;
  metadata?: Record<string, any>;
}

export interface PaymentRefundResult {
  success: boolean;
  refundRef: string;
  amountUSD: number;
  gatewayResponse?: any;
  errorCode?: string;
  errorMessage?: string;
}

export interface IPaymentProvider {
  /**
   * Unique identifier/code matching PaymentMethod.code or provider identifier
   */
  readonly code: string;

  /**
   * Human readable provider display name
   */
  readonly name: string;

  /**
   * Method category type (CASH, CARD, BANK_TRANSFER, DIGITAL_QR, OTHER)
   */
  readonly type: PaymentMethodType;

  /**
   * Execute or validate the incoming payment
   */
  processPayment(request: PaymentProcessRequest): Promise<PaymentProcessResult>;

  /**
   * Refund an existing payment transaction
   */
  refundPayment?(request: PaymentRefundRequest): Promise<PaymentRefundResult>;

  /**
   * Verify an asynchronous or external payment status
   */
  verifyPayment?(transactionRef: string): Promise<PaymentProcessResult>;
}
