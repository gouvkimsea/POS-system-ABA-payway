import {
  IPaymentProvider,
  PaymentProcessRequest,
  PaymentProcessResult,
  PaymentRefundRequest,
  PaymentRefundResult,
} from './IPaymentProvider';

export class CardPaymentProvider implements IPaymentProvider {
  readonly code = 'CARD';
  readonly name = 'Credit / Debit Card Terminal';
  readonly type = 'CARD' as const;

  async processPayment(request: PaymentProcessRequest): Promise<PaymentProcessResult> {
    const { amountUSD, exchangeRateKHR, transactionRef, metadata } = request;
    const amountKHR = request.amountKHR || Math.round(amountUSD * exchangeRateKHR);

    // Validate failure triggers (e.g. Card declined, expired card, network error)
    if (
      transactionRef === 'DECLINED' ||
      transactionRef === 'FAIL' ||
      metadata?.simulateFailure ||
      metadata?.cardStatus === 'DECLINED'
    ) {
      return {
        success: false,
        status: 'FAILED',
        transactionRef: transactionRef || `CARD-DEC-${Date.now()}`,
        amountUSD,
        amountKHR,
        tenderAmountUSD: 0,
        tenderAmountKHR: 0,
        changeUSD: 0,
        changeKHR: 0,
        errorCode: 'CARD_DECLINED',
        errorMessage: 'Card payment was declined by issuing bank: insufficient funds or card blocked',
        gatewayResponse: {
          processor: 'EMV_TERMINAL',
          responseCode: '51',
          responseMessage: 'DECLINE_DO_NOT_HONOR',
        },
      };
    }

    // Generate or verify approval authorization code
    const authCode =
      metadata?.authCode ||
      `AUTH${Math.floor(100000 + Math.random() * 900000)}`;
    const ref = transactionRef || `CARD-${Date.now().toString().slice(-6)}-${authCode}`;

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
        processor: 'EMV_TERMINAL',
        cardNetwork: metadata?.cardNetwork || 'VISA',
        last4: metadata?.last4 || '4242',
        authCode,
        entryMode: metadata?.entryMode || 'CHIP_CONTACTLESS',
      },
    };
  }

  async refundPayment(request: PaymentRefundRequest): Promise<PaymentRefundResult> {
    if (request.metadata?.simulateFailure) {
      return {
        success: false,
        refundRef: `REF-ERR-${Date.now()}`,
        amountUSD: request.amountUSD,
        errorCode: 'CARD_REFUND_FAILED',
        errorMessage: 'Gateway connection timed out during refund request',
      };
    }

    return {
      success: true,
      refundRef: `REF-CARD-${Date.now().toString().slice(-6)}`,
      amountUSD: request.amountUSD,
      gatewayResponse: {
        processor: 'EMV_TERMINAL',
        originalTransactionRef: request.transactionRef,
        refundAuthCode: `R${Math.floor(100000 + Math.random() * 900000)}`,
        status: 'PROCESSED',
      },
    };
  }
}
