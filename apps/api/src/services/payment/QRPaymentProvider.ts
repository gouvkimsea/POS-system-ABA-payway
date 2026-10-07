import {
  IPaymentProvider,
  PaymentProcessRequest,
  PaymentProcessResult,
  PaymentRefundRequest,
  PaymentRefundResult,
} from './IPaymentProvider';

export class QRPaymentProvider implements IPaymentProvider {
  readonly code = 'KHQR_ABA';
  readonly name = 'KHQR / ABA PayWay Dynamic QR';
  readonly type = 'DIGITAL_QR' as const;

  async processPayment(request: PaymentProcessRequest): Promise<PaymentProcessResult> {
    const { amountUSD, exchangeRateKHR, transactionRef, metadata } = request;
    const amountKHR = request.amountKHR || Math.round(amountUSD * exchangeRateKHR);

    // Check failure triggers
    if (
      transactionRef === 'FAIL' ||
      transactionRef === 'TIMEOUT' ||
      metadata?.simulateFailure ||
      metadata?.qrStatus === 'EXPIRED'
    ) {
      return {
        success: false,
        status: 'FAILED',
        transactionRef: transactionRef || `QR-TIMEOUT-${Date.now()}`,
        amountUSD,
        amountKHR,
        tenderAmountUSD: 0,
        tenderAmountKHR: 0,
        changeUSD: 0,
        changeKHR: 0,
        errorCode: 'QR_PAYMENT_TIMEOUT',
        errorMessage: 'Customer QR payment session expired or was cancelled by user',
        gatewayResponse: {
          gateway: 'KHQR_BAKONG',
          status: 'TIMEOUT_OR_CANCELLED',
        },
      };
    }

    // Generate or verify KHQR transaction reference
    const ref = transactionRef || `KHQR-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

    // KHQR payload string structure (EMVCo compliant QR payload simulation)
    const qrString = `00020101021229370016bakong@abaa0108${ref}5405${amountUSD.toFixed(2)}5802KH5916ANGKOR FRESH MART6010PHNOM PENH6304ABCD`;

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
        gateway: 'KHQR_ABA_PAYWAY',
        khqrString: qrString,
        currency: 'USD',
        merchantId: 'AFM_MERCHANT_01',
        paymentStatus: 'PAID',
        confirmedAt: new Date().toISOString(),
      },
    };
  }

  async refundPayment(request: PaymentRefundRequest): Promise<PaymentRefundResult> {
    return {
      success: true,
      refundRef: `REF-QR-${Date.now().toString().slice(-6)}`,
      amountUSD: request.amountUSD,
      gatewayResponse: {
        gateway: 'KHQR_ABA_PAYWAY',
        originalTransactionRef: request.transactionRef,
        refundStatus: 'SETTLED',
      },
    };
  }
}
