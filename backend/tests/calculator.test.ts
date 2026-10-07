import { describe, it, expect } from 'vitest';
import {
  roundUSD,
  roundKHR,
  convertUSDtoKHR,
  convertKHRtoUSD,
  calculateOrderFinancials,
  calculatePaymentAndChange,
} from '../src/utils/calculator.js';

describe('Financial Calculator Engine', () => {
  it('should round USD properly to cents', () => {
    expect(roundUSD(10.555)).toBe(10.56);
    expect(roundUSD(10.554)).toBe(10.55);
    expect(roundUSD(0.1 + 0.2)).toBe(0.3);
  });

  it('should round KHR properly to 100 Riel increments', () => {
    expect(roundKHR(4125)).toBe(4100);
    expect(roundKHR(4160)).toBe(4200);
    expect(roundKHR(4100)).toBe(4100);
  });

  it('should convert USD to KHR and KHR to USD accurately', () => {
    expect(convertUSDtoKHR(1.00, 4100)).toBe(4100);
    expect(convertUSDtoKHR(2.50, 4100)).toBe(10300); // 10,250 rounds to 10,300
    expect(convertKHRtoUSD(4100, 4100)).toBe(1.00);
    expect(convertKHRtoUSD(8200, 4100)).toBe(2.00);
  });

  it('should accurately calculate order subtotal, discount, tax, and totals on the server', () => {
    const result = calculateOrderFinancials({
      items: [
        {
          productId: 'prod-coke',
          unitPriceUSD: 0.65,
          quantity: 2, // 1.30
        },
        {
          productId: 'prod-water',
          unitPriceUSD: 0.35,
          quantity: 3, // 1.05
        },
      ],
      orderDiscountType: 'PERCENTAGE',
      orderDiscountValue: 10, // 10% discount on 2.35 = 0.235 -> 0.24
      defaultTaxRate: 0.10, // 10% tax on (2.35 - 0.24 = 2.11) = 0.211 -> 0.21
      exchangeRateKHR: 4100,
    });

    expect(result.subtotalUSD).toBe(2.35);
    expect(result.orderDiscountUSD).toBe(0.24);
    expect(result.taxAmountUSD).toBe(0.21);
    expect(result.totalUSD).toBe(2.32); // 2.11 + 0.21
    expect(result.totalKHR).toBe(9500); // 2.32 * 4100 = 9512 -> rounded to 9500
  });

  it('should handle cash payment in USD with USD and KHR change', () => {
    const payment = calculatePaymentAndChange({
      totalUSD: 15.50,
      exchangeRateKHR: 4100,
      tenderUSD: 20.00,
      tenderKHR: 0,
    });

    expect(payment.isFullyPaid).toBe(true);
    expect(payment.totalPaidUSD).toBe(20.00);
    expect(payment.changeUSD).toBe(4.50);
    expect(payment.changeKHR).toBe(18500); // 4.50 * 4100 = 18450 -> 18500
  });

  it('should handle split payment (USD + KHR cash bills)', () => {
    // Total is $10.00. Customer gives $5.00 USD and 20,500 KHR ($5.00 equivalent)
    const payment = calculatePaymentAndChange({
      totalUSD: 10.00,
      exchangeRateKHR: 4100,
      tenderUSD: 5.00,
      tenderKHR: 20500,
    });

    expect(payment.isFullyPaid).toBe(true);
    expect(payment.totalPaidUSD).toBe(10.00);
    expect(payment.changeUSD).toBe(0.00);
    expect(payment.changeKHR).toBe(0);
  });

  it('should detect underpayment and report remaining balance due', () => {
    const payment = calculatePaymentAndChange({
      totalUSD: 20.00,
      exchangeRateKHR: 4100,
      tenderUSD: 10.00,
      tenderKHR: 0,
    });

    expect(payment.isFullyPaid).toBe(false);
    expect(payment.remainingDueUSD).toBe(10.00);
    expect(payment.remainingDueKHR).toBe(41000);
    expect(payment.changeUSD).toBe(0);
  });
});
