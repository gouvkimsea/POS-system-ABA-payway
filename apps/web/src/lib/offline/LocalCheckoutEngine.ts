import {
  CheckoutInput,
  CheckoutResult,
  OfflineSyncQueueItem,
  PosProduct,
  PosCustomer,
} from '@pos/types';
import { OfflineDb } from './OfflineDb';

export class LocalCheckoutEngine {
  /**
   * Helper to generate unique offline temporary order number
   */
  public static generateOfflineOrderNumber(): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `OFF-ORD-${date}-${rand}`;
  }

  /**
   * Helper to generate unique offline receipt number
   */
  public static generateOfflineReceiptNumber(): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `OFF-RCP-${date}-${rand}`;
  }

  /**
   * Execute an offline sale completely on the local device, persisting to IndexedDB
   */
  public static async executeOfflineCheckout(
    input: CheckoutInput,
    context: {
      userId: string;
      userName: string;
      storeId: string;
      registerId?: string;
      customer?: PosCustomer | null;
      productsLookup?: PosProduct[];
    },
  ): Promise<{ result: CheckoutResult; queueItem: OfflineSyncQueueItem }> {
    const timestamp = new Date().toISOString();
    const offlineOrderNumber = this.generateOfflineOrderNumber();
    const offlineReceiptNumber = this.generateOfflineReceiptNumber();
    const clientSyncId =
      input.idempotencyKey ||
      `SYNC-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // 1. Resolve cached product catalog
    let products = context.productsLookup;
    if (!products || products.length === 0) {
      products = await OfflineDb.getCachedProducts();
    }
    const productMap = new Map(products.map((p) => [p.id, p]));

    // 2. Resolve cached store and tax config
    const { store } = await OfflineDb.getCachedStoreConfig();
    const cachedTax = await OfflineDb.getCachedTaxConfig();
    const exchangeRateKHR = store?.baseExchangeRate || 4100;
    const taxRate = cachedTax?.vatRate ?? store?.taxRate ?? 0.1;

    // 3. Calculate line items and financials
    let subtotalUSD = 0;
    const itemsDetail: Array<{
      productId: string;
      variantId?: string | null;
      productName: string;
      sku: string;
      barcode?: string | null;
      quantity: number;
      unitPriceUSD: number;
      discountUSD: number;
      subtotalUSD: number;
      totalUSD: number;
      totalKHR: number;
    }> = [];

    for (const item of input.items) {
      const prod = productMap.get(item.productId);
      const unitPrice =
        item.unitPriceUSD !== undefined ? item.unitPriceUSD : prod ? prod.sellingPriceUSD : 0;

      const lineSubtotal = Number((unitPrice * item.quantity).toFixed(2));
      const lineDiscount = item.discountUSD || 0;
      const lineTotal = Math.max(0, Number((lineSubtotal - lineDiscount).toFixed(2)));
      const lineTotalKHR = Math.round(lineTotal * exchangeRateKHR);

      subtotalUSD += lineSubtotal;

      itemsDetail.push({
        productId: item.productId,
        variantId: item.variantId || null,
        productName: prod ? prod.name : 'Offline Item',
        sku: prod ? prod.sku : 'OFFLINE-SKU',
        barcode: prod?.barcode || null,
        quantity: item.quantity,
        unitPriceUSD: unitPrice,
        discountUSD: lineDiscount,
        subtotalUSD: lineSubtotal,
        totalUSD: lineTotal,
        totalKHR: lineTotalKHR,
      });

      // Immediately deduct local IndexedDB stock so next scan displays realistic inventory
      if (prod) {
        await OfflineDb.decrementCachedProductStock(prod.id, item.quantity);
      }
    }

    const discountUSD = Number((input.discountUSD || 0).toFixed(2));
    const taxableAmount = Math.max(0, subtotalUSD - discountUSD);
    const taxUSD = Number((taxableAmount * taxRate).toFixed(2));
    const totalUSD = Number((taxableAmount + taxUSD).toFixed(2));
    const totalKHR = Math.round(totalUSD * exchangeRateKHR);

    // 4. Calculate Payments and Change
    let paidUSD = 0;
    let paidKHR = 0;
    let totalTenderUSD = 0;
    let totalTenderKHR = 0;

    const paymentsList = input.payments.map((p, idx) => {
      paidUSD += p.amountUSD || 0;
      paidKHR += p.amountKHR || 0;
      totalTenderUSD += p.tenderAmountUSD || p.amountUSD || 0;
      totalTenderKHR += p.tenderAmountKHR || p.amountKHR || 0;

      return {
        id: `OFF-PAY-${Date.now()}-${idx}`,
        paymentMethodCode: p.paymentMethodCode,
        paymentMethodName: p.paymentMethodCode,
        amountUSD: p.amountUSD,
        amountKHR: p.amountKHR || 0,
        tenderAmountUSD: p.tenderAmountUSD || p.amountUSD,
        tenderAmountKHR: p.tenderAmountKHR || p.amountKHR || 0,
        changeUSD: 0,
        changeKHR: 0,
        status: 'COMPLETED' as any,
        transactionRef: p.transactionRef || `OFFLINE-PAY-${clientSyncId.slice(0, 6)}`,
      };
    });

    const totalTenderInUSD = totalTenderUSD + totalTenderKHR / exchangeRateKHR;
    const changeUSD = Math.max(0, Number((totalTenderInUSD - totalUSD).toFixed(2)));
    const changeKHR = Math.round(changeUSD * exchangeRateKHR);

    // 5. Construct CheckoutResult DTO for UI & Hardware (ReceiptModal, CFD, Drawer)
    const result: CheckoutResult = {
      orderId: `OFF-ORD-ID-${Date.now()}`,
      orderNumber: offlineOrderNumber,
      receiptNumber: offlineReceiptNumber,
      status: 'COMPLETED' as any,
      subtotalUSD,
      discountUSD,
      taxUSD,
      taxRate,
      totalUSD,
      totalKHR,
      exchangeRateKHR,
      paidUSD,
      paidKHR,
      remainingUSD: 0,
      remainingKHR: 0,
      changeUSD,
      changeKHR,
      createdAt: timestamp,
      idempotencyKey: clientSyncId,
      customer: context.customer || null,
      items: itemsDetail,
      payments: paymentsList,
      receipt: {
        id: `OFF-RCP-ID-${Date.now()}`,
        receiptNumber: offlineReceiptNumber,
        headerText: store?.name || 'Angkor Fresh Mart',
        footerText: 'Thank you! (Offline Sale - Queued for sync)',
        qrCodeData: `OFFLINE://ORDER/${offlineOrderNumber}`,
      },
    };

    // 6. Build OfflineSyncQueueItem for IndexedDB
    const queueItem: OfflineSyncQueueItem = {
      id: `OFF-TX-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      clientSyncId,
      offlineOrderNumber,
      offlineReceiptNumber,
      storeId: context.storeId,
      registerId: context.registerId,
      cashierId: context.userId,
      cashierName: context.userName,
      status: 'pending',
      createdAt: timestamp,
      attempts: 0,
      errorMessage: null,
      conflict: null,
      payload: {
        ...input,
        idempotencyKey: clientSyncId,
        offlineMetadata: {
          offlineCreatedAt: timestamp,
          subtotalUSD,
          totalUSD,
          totalKHR,
          itemsDetail: itemsDetail.map((i) => ({
            productId: i.productId,
            productName: i.productName,
            sku: i.sku,
            barcode: i.barcode,
            quantity: i.quantity,
            unitPriceUSD: i.unitPriceUSD,
            discountUSD: i.discountUSD,
          })),
        },
      },
      serverOrderId: null,
      serverOrderNumber: null,
    };

    // 7. Enqueue to IndexedDB
    await OfflineDb.enqueueOfflineTransaction(queueItem);

    return { result, queueItem };
  }
}
