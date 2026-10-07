export interface OrderItemCalculationInput {
  productId: string;
  variantId?: string | null;
  unitPriceUSD: number;
  quantity: number;
  discountAmountUSD?: number;
  taxRate?: number; // e.g. 0.10 for 10%
  isTaxInclusive?: boolean;
}

export interface CalculatedOrderItem {
  productId: string;
  variantId?: string | null;
  unitPriceUSD: number;
  quantity: number;
  discountAmountUSD: number;
  subtotalUSD: number;
  taxAmountUSD: number;
  totalUSD: number;
  totalKHR: number;
}

export interface CalculationResult {
  items: CalculatedOrderItem[];
  subtotalUSD: number;
  discountType: 'NONE' | 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue: number;
  orderDiscountUSD: number;
  totalDiscountUSD: number;
  taxRate: number;
  taxAmountUSD: number;
  totalUSD: number;
  totalKHR: number;
  exchangeRateKHR: number;
}

export interface PaymentCalculationInput {
  totalUSD: number;
  exchangeRateKHR: number;
  tenderUSD?: number;
  tenderKHR?: number;
}

export interface PaymentCalculationResult {
  totalUSD: number;
  totalKHR: number;
  tenderUSD: number;
  tenderKHR: number;
  totalPaidUSD: number;
  totalPaidKHR: number;
  isFullyPaid: boolean;
  remainingDueUSD: number;
  remainingDueKHR: number;
  changeUSD: number;
  changeKHR: number;
}

/**
 * Rounds USD to 2 decimal places (cents)
 */
export function roundUSD(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/**
 * Rounds KHR to nearest 100 Riel (standard Cambodian retail practice)
 */
export function roundKHR(amount: number): number {
  return Math.round(amount / 100) * 100;
}

/**
 * Converts USD amount to KHR using the given exchange rate
 */
export function convertUSDtoKHR(usd: number, exchangeRate: number = 4100): number {
  return roundKHR(usd * exchangeRate);
}

/**
 * Converts KHR amount to USD using the given exchange rate
 */
export function convertKHRtoUSD(khr: number, exchangeRate: number = 4100): number {
  return roundUSD(khr / exchangeRate);
}

/**
 * Pure server-side financial calculator for Point of Sale orders.
 * Never trust calculations from the client!
 */
export function calculateOrderFinancials(params: {
  items: OrderItemCalculationInput[];
  orderDiscountType?: 'NONE' | 'PERCENTAGE' | 'FIXED_AMOUNT';
  orderDiscountValue?: number;
  defaultTaxRate?: number;
  exchangeRateKHR?: number;
}): CalculationResult {
  const exchangeRate = params.exchangeRateKHR && params.exchangeRateKHR > 0 ? params.exchangeRateKHR : 4100;
  const discountType = params.orderDiscountType || 'NONE';
  const discountValue = Math.max(0, params.orderDiscountValue || 0);

  let subtotalUSD = 0;
  let itemsDiscountUSD = 0;

  const calculatedItems: CalculatedOrderItem[] = params.items.map((item) => {
    const qty = Math.max(0, item.quantity);
    const price = Math.max(0, item.unitPriceUSD);
    const itemDiscount = Math.max(0, item.discountAmountUSD || 0);

    const rawSubtotal = roundUSD(price * qty);
    const itemNetSubtotal = Math.max(0, roundUSD(rawSubtotal - itemDiscount));
    const taxRate = item.taxRate !== undefined ? item.taxRate : params.defaultTaxRate || 0.10;
    
    // If tax inclusive, extract tax, else add tax
    const taxAmount = item.isTaxInclusive
      ? roundUSD(itemNetSubtotal - itemNetSubtotal / (1 + taxRate))
      : roundUSD(itemNetSubtotal * taxRate);

    const itemTotal = item.isTaxInclusive ? itemNetSubtotal : roundUSD(itemNetSubtotal + taxAmount);
    const itemTotalKHR = convertUSDtoKHR(itemTotal, exchangeRate);

    subtotalUSD = roundUSD(subtotalUSD + rawSubtotal);
    itemsDiscountUSD = roundUSD(itemsDiscountUSD + itemDiscount);

    return {
      productId: item.productId,
      variantId: item.variantId || null,
      unitPriceUSD: price,
      quantity: qty,
      discountAmountUSD: itemDiscount,
      subtotalUSD: rawSubtotal,
      taxAmountUSD: taxAmount,
      totalUSD: itemTotal,
      totalKHR: itemTotalKHR,
    };
  });

  // Calculate order-level discount
  let orderDiscountUSD = 0;
  const netBeforeOrderDiscount = Math.max(0, subtotalUSD - itemsDiscountUSD);

  if (discountType === 'PERCENTAGE') {
    const percentage = Math.min(100, Math.max(0, discountValue));
    orderDiscountUSD = roundUSD((netBeforeOrderDiscount * percentage) / 100);
  } else if (discountType === 'FIXED_AMOUNT') {
    orderDiscountUSD = Math.min(netBeforeOrderDiscount, roundUSD(discountValue));
  }

  const totalDiscountUSD = roundUSD(itemsDiscountUSD + orderDiscountUSD);
  const netTaxableAmountUSD = Math.max(0, roundUSD(subtotalUSD - totalDiscountUSD));

  const taxRate = params.defaultTaxRate !== undefined ? params.defaultTaxRate : 0.10;
  const orderTaxUSD = roundUSD(netTaxableAmountUSD * taxRate);

  const totalUSD = roundUSD(netTaxableAmountUSD + orderTaxUSD);
  const totalKHR = convertUSDtoKHR(totalUSD, exchangeRate);

  return {
    items: calculatedItems,
    subtotalUSD,
    discountType,
    discountValue,
    orderDiscountUSD,
    totalDiscountUSD,
    taxRate,
    taxAmountUSD: orderTaxUSD,
    totalUSD,
    totalKHR,
    exchangeRateKHR: exchangeRate,
  };
}

/**
 * Calculates payments, split currency tender, and accurate change in USD and KHR.
 */
export function calculatePaymentAndChange(params: PaymentCalculationInput): PaymentCalculationResult {
  const tenderUSD = Math.max(0, roundUSD(params.tenderUSD || 0));
  const tenderKHR = Math.max(0, roundKHR(params.tenderKHR || 0));
  const exchangeRate = params.exchangeRateKHR > 0 ? params.exchangeRateKHR : 4100;

  const totalUSD = roundUSD(params.totalUSD);
  const totalKHR = convertUSDtoKHR(totalUSD, exchangeRate);

  const khrConvertedToUSD = roundUSD(tenderKHR / exchangeRate);
  const totalPaidUSD = roundUSD(tenderUSD + khrConvertedToUSD);
  const totalPaidKHR = roundKHR(convertUSDtoKHR(tenderUSD, exchangeRate) + tenderKHR);

  const diffUSD = roundUSD(totalPaidUSD - totalUSD);
  const isFullyPaid = diffUSD >= -0.009; // tolerance for 1 cent boundary

  let remainingDueUSD = 0;
  let remainingDueKHR = 0;
  let changeUSD = 0;
  let changeKHR = 0;

  if (diffUSD < 0) {
    remainingDueUSD = Math.abs(diffUSD);
    remainingDueKHR = convertUSDtoKHR(remainingDueUSD, exchangeRate);
  } else {
    changeUSD = diffUSD;
    changeKHR = convertUSDtoKHR(changeUSD, exchangeRate);
  }

  return {
    totalUSD,
    totalKHR,
    tenderUSD,
    tenderKHR,
    totalPaidUSD,
    totalPaidKHR,
    isFullyPaid,
    remainingDueUSD,
    remainingDueKHR,
    changeUSD,
    changeKHR,
  };
}
