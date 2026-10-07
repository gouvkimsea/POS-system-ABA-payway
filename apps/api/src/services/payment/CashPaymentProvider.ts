import {
  IPaymentProvider,
  PaymentProcessRequest,
  PaymentProcessResult,
  PaymentRefundRequest,
  PaymentRefundResult,
} from './IPaymentProvider';

export class CashPaymentProvider implements IPaymentProvider {
  readonly code = 'CASH';
  readonly name = 'Cash Payment (USD & KHR)';
  readonly type = 'CASH' as const;

  async processPayment(request: PaymentProcessRequest): Promise<PaymentProcessResult> {
    const { amountUSD, exchangeRateKHR } = request;
    const amountKHR = request.amountKHR || Math.round(amountUSD * exchangeRateKHR);

    let tenderUSD = request.tenderAmountUSD ?? 0;
    let tenderKHR = request.tenderAmountKHR ?? 0;

    // If cashier didn't specify tender, assume exact tender
    if (tenderUSD === 0 && tenderKHR === 0) {
      tenderUSD = amountUSD;
      tenderKHR = 0;
    }

    const effectiveTenderUSD = tenderUSD + tenderKHR / exchangeRateKHR;

    // Tolerance of 0.005 for floating conversion
    if (effectiveTenderUSD < amountUSD - 0.005) {
      return {
        success: false,
        status: 'FAILED',
        transactionRef: `CASH-FAIL-${Date.now()}`,
        amountUSD,
        amountKHR,
        tenderAmountUSD: tenderUSD,
        tenderAmountKHR: tenderKHR,
        changeUSD: 0,
        changeKHR: 0,
        errorCode: 'INSUFFICIENT_TENDER',
        errorMessage: `Cash tendered ($${effectiveTenderUSD.toFixed(2)}) is less than payment amount due ($${amountUSD.toFixed(2)})`,
      };
    }

    const changeUSD = Math.max(0, Number((effectiveTenderUSD - amountUSD).toFixed(2)));
    const changeKHR = Math.round(changeUSD * exchangeRateKHR);

    const ref = `CASH-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    return {
      success: true,
      status: 'COMPLETED',
      transactionRef: ref,
      amountUSD,
      amountKHR,
      tenderAmountUSD: tenderUSD,
      tenderAmountKHR: tenderKHR,
      changeUSD,
      changeKHR,
      gatewayResponse: {
        method: 'CASH',
        tenderUSD,
        tenderKHR,
        exchangeRate: exchangeRateKHR,
      },
    };
  }

  async refundPayment(request: PaymentRefundRequest): Promise<PaymentRefundResult> {
    return {
      success: true,
      refundRef: `REF-CASH-${Date.now().toString().slice(-6)}`,
      amountUSD: request.amountUSD,
      gatewayResponse: {
        method: 'CASH',
        cashDrawerAction: 'DISBURSE_CASH',
        reason: request.reason,
      },
    };
  }
}
