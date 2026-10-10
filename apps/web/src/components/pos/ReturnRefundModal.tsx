'use client';

import React, { useState, useEffect } from 'react';
import {
  RotateCcw,
  X,
  Search,
  CheckCircle,
  AlertTriangle,
  ShieldAlert,
  Plus,
  Minus,
  Receipt,
} from 'lucide-react';
import { OrderRefundEligibility, ReturnReason, ReturnRecord, RefundRecord } from '@pos/types';

interface ReturnRefundModalProps {
  isOpen: boolean;
  onClose: () => void;
  userPermissions?: string[];
  userRoles?: string[];
  activeSessionId?: string | null;
  onRefundCompleted?: (returnRec: ReturnRecord, refundRec: RefundRecord) => void;
}

export const ReturnRefundModal: React.FC<ReturnRefundModalProps> = ({
  isOpen,
  onClose,
  userPermissions = [],
  userRoles = [],
  activeSessionId,
  onRefundCompleted,
}) => {
  const [orderQuery, setOrderQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [eligibility, setEligibility] = useState<OrderRefundEligibility | null>(null);

  // Return items form state
  const [returnQtys, setReturnQtys] = useState<Record<string, number>>({});
  const [restockMap, setRestockMap] = useState<Record<string, boolean>>({});
  const [conditionMap, setConditionMap] = useState<
    Record<string, 'RESELLABLE' | 'DAMAGED' | 'DEFECTIVE'>
  >({});

  // Refund metadata
  const [reason, setReason] = useState<ReturnReason>('CUSTOMER_CHANGED_MIND');
  const [reasonNotes, setReasonNotes] = useState('');
  const [refundMethodCode, setRefundMethodCode] = useState('CASH');

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{
    returnRecord: ReturnRecord;
    refundRecord: RefundRecord;
  } | null>(null);

  // Check permission
  const hasRefundPermission =
    userRoles.includes('ADMIN') ||
    userRoles.includes('MANAGER') ||
    userPermissions.includes('sales.refund');

  // Reset when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setOrderQuery('');
      setEligibility(null);
      setReturnQtys({});
      setRestockMap({});
      setConditionMap({});
      setReason('CUSTOMER_CHANGED_MIND');
      setReasonNotes('');
      setSearchError(null);
      setSubmitError(null);
      setSuccessResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSearchOrder = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!orderQuery.trim()) return;

    setIsSearching(true);
    setSearchError(null);
    setEligibility(null);
    setSuccessResult(null);

    try {
      const token = localStorage.getItem('pos_access_token');
      const res = await fetch(`/api/returns/eligibility/${encodeURIComponent(orderQuery.trim())}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Order not found or not eligible for return');
      }

      const data: OrderRefundEligibility = json.data;
      setEligibility(data);

      // Initialize defaults
      const initQtys: Record<string, number> = {};
      const initRestock: Record<string, boolean> = {};
      const initCondition: Record<string, 'RESELLABLE' | 'DAMAGED' | 'DEFECTIVE'> = {};

      data.items.forEach((item) => {
        initQtys[item.orderItemId] = 0;
        initRestock[item.orderItemId] = true;
        initCondition[item.orderItemId] = 'RESELLABLE';
      });

      setReturnQtys(initQtys);
      setRestockMap(initRestock);
      setConditionMap(initCondition);
    } catch (err: any) {
      setSearchError(err.message || 'Error looking up order');
    } finally {
      setIsSearching(false);
    }
  };

  const handleQtyChange = (orderItemId: string, newQty: number, maxQty: number) => {
    const clamped = Math.max(0, Math.min(newQty, maxQty));
    setReturnQtys((prev) => ({ ...prev, [orderItemId]: clamped }));
  };

  const handleReturnAll = () => {
    if (!eligibility) return;
    const allQtys: Record<string, number> = {};
    eligibility.items.forEach((item) => {
      allQtys[item.orderItemId] = item.maxReturnableQuantity;
    });
    setReturnQtys(allQtys);
  };

  // Calculate live total refund
  let calculatedRefundUSD = 0;
  if (eligibility) {
    eligibility.items.forEach((item) => {
      const qty = returnQtys[item.orderItemId] || 0;
      calculatedRefundUSD += qty * item.unitPriceUSD;
    });
  }
  calculatedRefundUSD = Math.round(calculatedRefundUSD * 100) / 100;
  const calculatedRefundKHR = Math.round(calculatedRefundUSD * 4100);

  const totalItemsToReturn = Object.values(returnQtys).reduce((a, b) => a + b, 0);

  const handleSubmitRefund = async () => {
    if (!eligibility) return;
    if (totalItemsToReturn <= 0) {
      setSubmitError('Please select at least one item to return');
      return;
    }

    if (calculatedRefundUSD > eligibility.maxRefundableUSD + 0.01) {
      setSubmitError(
        `Refund amount ($${calculatedRefundUSD}) exceeds maximum refundable balance ($${eligibility.maxRefundableUSD})`,
      );
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const token = localStorage.getItem('pos_access_token');
      const itemsToSubmit = eligibility.items
        .filter((item) => (returnQtys[item.orderItemId] || 0) > 0)
        .map((item) => ({
          orderItemId: item.orderItemId,
          quantity: returnQtys[item.orderItemId],
          restockInventory: restockMap[item.orderItemId] ?? true,
          condition: conditionMap[item.orderItemId] || 'RESELLABLE',
        }));

      const payload = {
        orderId: eligibility.orderId,
        reason,
        reasonNotes: reasonNotes.trim() || undefined,
        items: itemsToSubmit,
        refundMethodCode,
        sessionId: activeSessionId || undefined,
      };

      const res = await fetch('/api/returns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to process return and refund');
      }

      setSuccessResult({
        returnRecord: json.data.returnRecord,
        refundRecord: json.data.refundRecord,
      });

      if (onRefundCompleted) {
        onRefundCompleted(json.data.returnRecord, json.data.refundRecord);
      }
    } catch (err: any) {
      setSubmitError(err.message || 'Refund processing failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 sm:p-4">
      <div className="bg-slate-900 rounded-lg max-w-2xl w-full shadow-2xl border border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-white">Return and Refund</h3>
              <p className="text-xs text-slate-400">
                Select items to return and issue refund.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Permission Notice */}
        {!hasRefundPermission && (
          <div className="p-4 bg-amber-950/30 border-b border-amber-900/50 flex items-center gap-3 text-amber-200 text-xs">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <span className="font-bold">Permission Required:</span> You need{' '}
              <code className="bg-amber-900/40 px-1 py-0.5 rounded font-mono text-amber-300">sales.refund</code>{' '}
              permission to process refunds. Ask a manager for assistance.
            </div>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {/* Step 1: Search Order */}
          {!successResult && (
            <form onSubmit={handleSearchOrder} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
                <input
                  type="text"
                  autoFocus
                  value={orderQuery}
                  onChange={(e) => setOrderQuery(e.target.value)}
                  placeholder="Scan or enter order number (e.g. ORD-20261007-0001)..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 font-mono"
                />
              </div>
              <button
                type="submit"
                disabled={isSearching || !orderQuery.trim()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {isSearching ? 'Searching...' : 'Search'}
              </button>
            </form>
          )}

          {searchError && (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-900/60 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{searchError}</span>
            </div>
          )}

          {/* Success Screen */}
          {successResult && (
            <div className="py-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
                <CheckCircle className="w-9 h-9" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-white">
                  Refund Complete
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  Inventory and payment records have been updated.
                </p>
              </div>

              <div className="max-w-md mx-auto p-4 rounded-lg bg-slate-950 border border-slate-800 text-left space-y-2 text-xs divide-y divide-slate-800/60">
                <div className="flex justify-between py-1.5 first:pt-0">
                  <span className="text-slate-400">Return Reference:</span>
                  <span className="font-mono font-bold text-slate-200">
                    {successResult.returnRecord.returnNumber}
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-400">Refund Reference:</span>
                  <span className="font-mono font-bold text-slate-200">
                    {successResult.refundRecord.refundNumber}
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-400">Original Sale:</span>
                  <span className="font-mono text-slate-200">
                    {successResult.returnRecord.orderNumber}
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-400">Refund Amount:</span>
                  <span className="font-bold text-rose-400 font-mono text-sm">
                    ${successResult.refundRecord.amountUSD.toFixed(2)} (៛
                    {successResult.refundRecord.amountKHR.toLocaleString()})
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-400">Payment Method:</span>
                  <span className="font-semibold text-slate-200">
                    {successResult.refundRecord.paymentMethodName}
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-400">Items Returned:</span>
                  <span className="font-semibold text-slate-200">
                    {successResult.returnRecord.items.length} line items
                  </span>
                </div>
              </div>

              <div className="pt-2 flex justify-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Order Eligibility and Item Selection */}
          {!successResult && eligibility && (
            <div className="space-y-4">
              {/* Order Metadata Banner */}
              <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <div className="font-bold text-white flex items-center gap-1.5 font-mono">
                    <Receipt className="w-3.5 h-3.5 text-emerald-400" />
                    {eligibility.orderNumber}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                    <span>Customer: {eligibility.customerName || 'Walk-in Customer'}</span>
                    <span>•</span>
                    <span>{new Date(eligibility.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[11px] text-slate-400 font-mono">
                    Paid: ${eligibility.totalPaidUSD.toFixed(2)}
                  </div>
                  <div className="font-bold text-slate-200">
                    Max Refundable:{' '}
                    <span className="text-emerald-400 font-mono">
                      ${eligibility.maxRefundableUSD.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {eligibility.maxRefundableUSD <= 0 ? (
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 text-xs text-center">
                  This order has already been fully refunded.
                </div>
              ) : (
                <>
                  {/* Items Table */}
                  <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950/60">
                    <div className="bg-slate-950 px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold text-slate-300 border-b border-slate-800">
                      <span>Purchased Items</span>
                      <button
                        type="button"
                        onClick={handleReturnAll}
                        className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
                      >
                        Return All
                      </button>
                    </div>

                    <div className="divide-y divide-slate-800/60 max-h-56 overflow-y-auto">
                      {eligibility.items.map((item) => {
                        const currentReturnQty = returnQtys[item.orderItemId] || 0;
                        const isEligible = item.maxReturnableQuantity > 0;

                        return (
                          <div
                            key={item.orderItemId}
                            className="p-3 flex items-center justify-between gap-3 hover:bg-slate-900/50 transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-xs text-white truncate">
                                {item.productName}
                              </div>
                              <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5 font-mono">
                                <span>${item.unitPriceUSD.toFixed(2)} / unit</span>
                                <span>•</span>
                                <span>
                                  Bought: {item.purchasedQuantity} (Returned:{' '}
                                  {item.alreadyRefundedQuantity})
                                </span>
                              </div>

                              {currentReturnQty > 0 && (
                                <div className="mt-2 flex items-center gap-3 text-[11px]">
                                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 font-medium">
                                    <input
                                      type="checkbox"
                                      checked={restockMap[item.orderItemId] ?? true}
                                      onChange={(e) =>
                                        setRestockMap((prev) => ({
                                          ...prev,
                                          [item.orderItemId]: e.target.checked,
                                        }))
                                      }
                                      className="rounded bg-slate-900 border-slate-700 text-emerald-600 focus:ring-0"
                                    />
                                    <span>Restock item</span>
                                  </label>

                                  <select
                                    value={conditionMap[item.orderItemId] || 'RESELLABLE'}
                                    onChange={(e) =>
                                      setConditionMap((prev) => ({
                                        ...prev,
                                        [item.orderItemId]: e.target.value as any,
                                      }))
                                    }
                                    className="border border-slate-700 rounded px-1.5 py-0.5 text-[11px] bg-slate-900 text-slate-200 focus:outline-none focus:border-slate-600"
                                  >
                                    <option value="RESELLABLE">Resellable</option>
                                    <option value="DAMAGED">Damaged</option>
                                    <option value="DEFECTIVE">Defective</option>
                                  </select>
                                </div>
                              )}
                            </div>

                            {/* Stepper */}
                            <div className="flex items-center gap-2">
                              {isEligible ? (
                                <div className="flex items-center border border-slate-700 rounded-lg bg-slate-900 overflow-hidden">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleQtyChange(
                                        item.orderItemId,
                                        currentReturnQty - 1,
                                        item.maxReturnableQuantity,
                                      )
                                    }
                                    disabled={currentReturnQty <= 0}
                                    className="p-1.5 hover:bg-slate-800 text-slate-300 disabled:opacity-30 transition-colors"
                                  >
                                    <Minus className="w-3.5 h-3.5" />
                                  </button>
                                  <span className="w-8 text-center text-xs font-bold font-mono text-white">
                                    {currentReturnQty}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleQtyChange(
                                        item.orderItemId,
                                        currentReturnQty + 1,
                                        item.maxReturnableQuantity,
                                      )
                                    }
                                    disabled={currentReturnQty >= item.maxReturnableQuantity}
                                    className="p-1.5 hover:bg-slate-800 text-slate-300 disabled:opacity-30 transition-colors"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[11px] text-slate-500 italic">
                                  Fully Returned
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Return Reasons and Methods */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block font-medium text-slate-300 mb-1">
                        Return Reason <span className="text-rose-400">*</span>
                      </label>
                      <select
                        value={reason}
                        onChange={(e) => setReason(e.target.value as ReturnReason)}
                        className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
                      >
                        <option value="CUSTOMER_CHANGED_MIND">Customer Changed Mind</option>
                        <option value="DEFECTIVE">Defective</option>
                        <option value="WRONG_ITEM">Wrong Item</option>
                        <option value="DAMAGED">Damaged</option>
                        <option value="EXPIRED">Expired</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-medium text-slate-300 mb-1">
                        Refund Method <span className="text-rose-400">*</span>
                      </label>
                      <select
                        value={refundMethodCode}
                        onChange={(e) => setRefundMethodCode(e.target.value)}
                        className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
                      >
                        <option value="CASH">Cash (drawer)</option>
                        {eligibility.customerId && (
                          <option value="CUSTOMER_CREDIT">Store Credit</option>
                        )}
                        <option value="KHQR_ABA">ABA KHQR</option>
                        <option value="CARD">Card</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block font-medium text-slate-300 mb-1">
                      Notes
                    </label>
                    <input
                      type="text"
                      value={reasonNotes}
                      onChange={(e) => setReasonNotes(e.target.value)}
                      placeholder="Optional notes..."
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
                    />
                  </div>

                  {submitError && (
                    <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-900/60 text-rose-300 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>{submitError}</span>
                    </div>
                  )}

                  {/* Summary Footer */}
                  <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] text-slate-400">
                        {totalItemsToReturn} item(s) returning
                      </div>
                      <div className="text-lg font-bold font-mono text-rose-400">
                        ${calculatedRefundUSD.toFixed(2)}{' '}
                        <span className="text-xs font-normal text-slate-400">
                          (៛{calculatedRefundKHR.toLocaleString()})
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 border border-slate-700 text-slate-300 rounded-lg text-xs font-medium hover:bg-slate-800 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSubmitRefund}
                        disabled={
                          !hasRefundPermission ||
                          isSubmitting ||
                          totalItemsToReturn <= 0 ||
                          calculatedRefundUSD <= 0
                        }
                        className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5 transition-colors"
                      >
                        {isSubmitting ? 'Processing...' : 'Process Refund'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
