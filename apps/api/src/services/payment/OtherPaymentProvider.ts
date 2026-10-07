import {
  IPaymentProvider,
  PaymentProcessRequest,
  PaymentProcessResult,
  PaymentRefundRequest,
  PaymentRefundResult,
} from './IPaymentProvider';

export class OtherPaymentProvider implements IPaymentProvider {
  readonly code = 'OTHER';
  readonly name = 'Voucher / Gift Card / Other Tender';
  readonly type = 'OTHER' as const;

  async processPayment(request: PaymentProcessRequest): Promise<PaymentProcessResult> {
    const { amountUSD, exchangeRateKHR, transactionRef, metadata } = request;
    const amountKHR = request.amountKHR || Math.round(amountUSD * exchangeRateKHR);

    if (
      transactionRef === 'FAIL' ||
      transactionRef === 'INVALID_VOUCHER' ||
      metadata?.simulateFailure
    ) {
      return {
        success: false,
        status: 'FAILED',
        transactionRef: transactionRef || `VOUCH-ERR-${Date.now()}`,
        amountUSD,
        amountKHR,
        tenderAmountUSD: 0,
        tenderAmountKHR: 0,
        changeUSD: 0,
        changeKHR: 0,
        errorCode: 'INVALID_VOUCHER',
        errorMessage: 'Voucher code is expired, exhausted, or invalid for this transaction',
      };
    }

    const ref = transactionRef || `VOUCH-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    return {
      success: true,
      status: 'COMPLETED',
      transactionRef: ref,
      amountUSD,
      amountKHR,
      tenderAmountUSD: amountUSD,
      tenderAmountKHR: 0,
      changeUSD: 0,
      changeKHR: 0,
      gatewayResponse: {
        method: 'OTHER_TENDER',
        tenderType: metadata?.tenderType || 'STORE_VOUCHER',
        voucherCode: ref,
        appliedUSD: amountUSD,
      },
    };
  }

  async refundPayment(request: PaymentRefundRequest): Promise<PaymentRefundResult> {
    return {
      success: true,
      refundRef: `REF-VOUCH-${Date.now().toString().slice(-6)}`,
      amountUSD: request.amountUSD,
      gatewayResponse: {
        method: 'STORE_CREDIT_REISSUE',
        amountUSD: request.amountUSD,
        reason: request.reason,
      },
    };
  }
}
