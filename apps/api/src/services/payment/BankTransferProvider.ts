import {
  IPaymentProvider,
  PaymentProcessRequest,
  PaymentProcessResult,
  PaymentRefundRequest,
  PaymentRefundResult,
} from './IPaymentProvider';

export class BankTransferProvider implements IPaymentProvider {
  readonly code = 'BANK_TRANSFER';
  readonly name = 'Direct Bank Transfer / Wire';
  readonly type = 'BANK_TRANSFER' as const;

  async processPayment(request: PaymentProcessRequest): Promise<PaymentProcessResult> {
    const { amountUSD, exchangeRateKHR, transactionRef, metadata } = request;
    const amountKHR = request.amountKHR || Math.round(amountUSD * exchangeRateKHR);

    // If explicit failure trigger
    if (
      transactionRef === 'FAIL' ||
      transactionRef === 'INVALID_SLIP' ||
      metadata?.simulateFailure
    ) {
      return {
        success: false,
        status: 'FAILED',
        transactionRef: transactionRef || `BANK-ERR-${Date.now()}`,
        amountUSD,
        amountKHR,
        tenderAmountUSD: 0,
        tenderAmountKHR: 0,
        changeUSD: 0,
        changeKHR: 0,
        errorCode: 'INVALID_TRANSFER_REFERENCE',
        errorMessage: 'Bank transfer confirmation slip could not be verified or was rejected',
        gatewayResponse: {
          verificationStatus: 'REJECTED',
        },
      };
    }

    // Require non-trivial bank transaction slip reference (either from cashier or auto-generated if omitted)
    const ref =
      transactionRef && transactionRef.trim().length >= 4
        ? transactionRef.trim()
        : metadata?.slipNumber || `TXN-BNK-${Date.now().toString().slice(-8)}`;

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
        method: 'BANK_TRANSFER',
        bankName: metadata?.bankName || 'ABA Bank / Bakong',
        slipNumber: ref,
        payerAccount: metadata?.accountNumber || 'XXX-XXX-789',
        verifiedByCashier: true,
      },
    };
  }

  async refundPayment(request: PaymentRefundRequest): Promise<PaymentRefundResult> {
    return {
      success: true,
      refundRef: `REF-BNK-${Date.now().toString().slice(-6)}`,
      amountUSD: request.amountUSD,
      gatewayResponse: {
        method: 'BANK_TRANSFER_REVERSAL',
        originalReference: request.transactionRef,
        status: 'PENDING_BANK_RECONCILIATION',
      },
    };
  }
}
