import { IPaymentProvider } from './IPaymentProvider';
import { CashPaymentProvider } from './CashPaymentProvider';
import { CardPaymentProvider } from './CardPaymentProvider';
import { BankTransferProvider } from './BankTransferProvider';
import { QRPaymentProvider } from './QRPaymentProvider';
import { OtherPaymentProvider } from './OtherPaymentProvider';
import { logger } from '../../logger/index.js';

export class PaymentRegistry {
  private static instance: PaymentRegistry;
  private providers = new Map<string, IPaymentProvider>();

  private constructor() {
    this.registerDefaults();
  }

  public static getInstance(): PaymentRegistry {
    if (!PaymentRegistry.instance) {
      PaymentRegistry.instance = new PaymentRegistry();
    }
    return PaymentRegistry.instance;
  }

  private registerDefaults() {
    this.register(new CashPaymentProvider());
    this.register(new CardPaymentProvider());
    this.register(new BankTransferProvider());
    this.register(new QRPaymentProvider());
    this.register(new OtherPaymentProvider());
  }

  /**
   * Register a payment provider by its code and type
   */
  public register(provider: IPaymentProvider): void {
    this.providers.set(provider.code.toUpperCase(), provider);
    this.providers.set(provider.type.toUpperCase(), provider);
    logger.info(
      `[PaymentRegistry] Registered payment provider: ${provider.name} [${provider.code}]`,
    );
  }

  /**
   * Resolve a payment provider by method code or type
   */
  public get(codeOrType: string): IPaymentProvider {
    const key = (codeOrType || '').toUpperCase().trim();
    const provider = this.providers.get(key);

    if (provider) {
      return provider;
    }

    // Secondary matches: e.g. KHQR -> QRPaymentProvider
    if (key.includes('QR') || key.includes('BAKONG') || key.includes('ABA')) {
      const qrProvider = this.providers.get('KHQR_ABA');
      if (qrProvider) return qrProvider;
    }

    if (key.includes('CARD') || key.includes('VISA') || key.includes('MASTER')) {
      const cardProvider = this.providers.get('CARD');
      if (cardProvider) return cardProvider;
    }

    if (key.includes('BANK') || key.includes('TRANSFER')) {
      const bankProvider = this.providers.get('BANK_TRANSFER');
      if (bankProvider) return bankProvider;
    }

    if (key.includes('CASH')) {
      const cashProvider = this.providers.get('CASH');
      if (cashProvider) return cashProvider;
    }

    // Default fallback to OTHER
    const otherProvider = this.providers.get('OTHER');
    if (otherProvider) return otherProvider;

    throw new Error(`[PaymentRegistry] No payment provider registered for code: ${codeOrType}`);
  }

  public getAll(): IPaymentProvider[] {
    const unique = new Set(this.providers.values());
    return Array.from(unique);
  }
}

export const paymentRegistry = PaymentRegistry.getInstance();
