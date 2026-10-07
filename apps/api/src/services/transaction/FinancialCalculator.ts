import { prisma } from '../../db/index.js';
import { OrderCalculationItemInput, OrderCalculationQuote } from '@pos/types';

export interface ValidatedLineItem {
  productId: string;
  variantId: string | null;
  productName: string;
  sku: string;
  barcode: string | null;
  quantity: number;
  costPriceUSD: number;
  unitPriceUSD: number;
  lineDiscountUSD: number;
  lineSubtotalUSD: number;
  lineTotalUSD: number;
  lineTotalKHR: number;
  taxRate: number;
  trackInventory: boolean;
  notes?: string;
}

export interface CalculatedOrderBreakdown {
  items: ValidatedLineItem[];
  subtotalUSD: number;
  orderDiscountUSD: number;
  effectiveDiscountUSD: number;
  taxableAmountUSD: number;
  taxRate: number;
  taxUSD: number;
  totalUSD: number;
  totalKHR: number;
  exchangeRateKHR: number;
}

export class FinancialCalculator {
  /**
   * Validate cart items against database catalog and calculate financial totals.
   * NEVER trust client-submitted unit prices or line totals.
   */
  public static async calculate(params: {
    items: (OrderCalculationItemInput & { notes?: string; unitPriceUSD?: number })[];
    businessId: string;
    discountCode?: string;
    discountUSD?: number;
    exchangeRateKHR?: number;
    isTaxInclusive?: boolean;
  }): Promise<CalculatedOrderBreakdown> {
    const { items, businessId, discountUSD = 0 } = params;

    if (!items || items.length === 0) {
      throw new Error('Cannot calculate totals for an empty cart');
    }

    // 1. Resolve business & exchange rate
    const business = await prisma.business.findUnique({
      where: { id: businessId },
    });
    const exchangeRateKHR =
      params.exchangeRateKHR || Number(business?.baseExchangeRate || 4100.0);

    // 2. Fetch products and variants from PostgreSQL
    const productIds = Array.from(new Set(items.map((i) => i.productId)));
    const dbProducts = await prisma.product.findMany({
      where: { id: { in: productIds }, businessId },
      include: { variants: true },
    });

    const productMap = new Map<string, any>(dbProducts.map((p: any) => [p.id, p]));

    const validatedItems: ValidatedLineItem[] = [];
    let grossSubtotalUSD = 0;

    for (const item of items) {
      const product: any = productMap.get(item.productId);
      if (!product) {
        throw new Error(`Product with ID "${item.productId}" was not found or is inactive`);
      }

      let unitPriceUSD = Number(product.sellingPriceUSD);
      let costPriceUSD = Number(product.costPriceUSD);
      let sku = product.sku;
      let barcode = product.barcode;
      let name = product.name;

      if (item.variantId) {
        const variant = product.variants?.find((v: any) => v.id === item.variantId);
        if (!variant) {
          throw new Error(`Variant "${item.variantId}" not found for product "${product.name}"`);
        }
        unitPriceUSD = Number(variant.sellingPriceUSD);
        costPriceUSD = Number(variant.costPriceUSD);
        sku = variant.sku;
        barcode = variant.barcode || product.barcode;
        name = `${product.name} (${variant.name})`;
      }

      const qty = Number(item.quantity);
      if (qty <= 0) {
        throw new Error(`Invalid item quantity: ${qty} for ${name}`);
      }

      // Compute line financial numbers
      const lineGrossUSD = Number((unitPriceUSD * qty).toFixed(2));
      const requestedLineDiscount = Math.max(0, Number(item.discountUSD || 0));
      // Line discount cannot exceed line gross
      const lineDiscountUSD = Math.min(lineGrossUSD, requestedLineDiscount);
      const lineTotalUSD = Number((lineGrossUSD - lineDiscountUSD).toFixed(2));
      const lineTotalKHR = Math.round(lineTotalUSD * exchangeRateKHR);

      grossSubtotalUSD += lineTotalUSD;

      validatedItems.push({
        productId: product.id,
        variantId: item.variantId || null,
        productName: name,
        sku,
        barcode,
        quantity: qty,
        costPriceUSD,
        unitPriceUSD,
        lineDiscountUSD,
        lineSubtotalUSD: lineGrossUSD,
        lineTotalUSD,
        lineTotalKHR,
        taxRate: Number(product.taxRate || 0.1),
        trackInventory: product.trackInventory,
        notes: item.notes,
      });
    }

    grossSubtotalUSD = Number(grossSubtotalUSD.toFixed(2));

    // 3. Process order-level discount
    let effectiveOrderDiscountUSD = 0;
    if (discountUSD > 0) {
      effectiveOrderDiscountUSD = Math.min(grossSubtotalUSD, Number(discountUSD.toFixed(2)));
    }

    // 4. Compute Taxable Amount & Tax (10% VAT default)
    const taxableAmountUSD = Number((grossSubtotalUSD - effectiveOrderDiscountUSD).toFixed(2));
    const defaultTaxRate = 0.1; // 10% VAT
    const isTaxInclusive = params.isTaxInclusive ?? true;

    let taxUSD = 0;
    let totalUSD = 0;

    if (isTaxInclusive) {
      totalUSD = taxableAmountUSD;
      taxUSD = Number((taxableAmountUSD - taxableAmountUSD / (1 + defaultTaxRate)).toFixed(2));
    } else {
      taxUSD = Number((taxableAmountUSD * defaultTaxRate).toFixed(2));
      totalUSD = Number((taxableAmountUSD + taxUSD).toFixed(2));
    }

    const totalKHR = Math.round(totalUSD * exchangeRateKHR);

    return {
      items: validatedItems,
      subtotalUSD: grossSubtotalUSD,
      orderDiscountUSD: discountUSD,
      effectiveDiscountUSD: effectiveOrderDiscountUSD,
      taxableAmountUSD,
      taxRate: defaultTaxRate,
      taxUSD,
      totalUSD,
      totalKHR,
      exchangeRateKHR,
    };
  }

  /**
   * Produce a lightweight quote object for frontend preview
   */
  public static toQuote(breakdown: CalculatedOrderBreakdown): OrderCalculationQuote {
    return {
      subtotalUSD: breakdown.subtotalUSD,
      orderDiscountUSD: breakdown.effectiveDiscountUSD,
      taxableAmountUSD: breakdown.taxableAmountUSD,
      taxRate: breakdown.taxRate,
      taxUSD: breakdown.taxUSD,
      totalUSD: breakdown.totalUSD,
      totalKHR: breakdown.totalKHR,
      exchangeRateKHR: breakdown.exchangeRateKHR,
      items: breakdown.items.map((i) => ({
        productId: i.productId,
        variantId: i.variantId,
        productName: i.productName,
        sku: i.sku,
        quantity: i.quantity,
        unitPriceUSD: i.unitPriceUSD,
        lineDiscountUSD: i.lineDiscountUSD,
        lineTotalUSD: i.lineTotalUSD,
        lineTotalKHR: i.lineTotalKHR,
      })),
    };
  }
}
