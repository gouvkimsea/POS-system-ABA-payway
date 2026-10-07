'use client';

import React, { useState, useEffect } from 'react';
import { InventoryLocationRecord, ProductRecord, StockLevelRecord } from '@pos/types';

interface StockAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdjustSuccess: () => void;
  products: ProductRecord[];
  locations: InventoryLocationRecord[];
  initialStockItem?: StockLevelRecord | null;
}

export function StockAdjustmentModal({
  isOpen,
  onClose,
  onAdjustSuccess,
  products,
  locations,
  initialStockItem,
}: StockAdjustmentModalProps) {
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [movementType, setMovementType] = useState<
    'PURCHASE' | 'RETURN' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'DAMAGE' | 'EXPIRED'
  >('ADJUSTMENT_IN');
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState('');
  const [referenceType, setReferenceType] = useState('MANUAL_ADJUSTMENT');
  const [referenceId, setReferenceId] = useState('');

  const [currentStock, setCurrentStock] = useState<number>(0);
  const [isLoadingStock, setIsLoadingStock] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialStockItem) {
      setSelectedLocationId(initialStockItem.locationId);
      setSelectedProductId(initialStockItem.productId);
      setSelectedVariantId(initialStockItem.variantId || '');
      setCurrentStock(initialStockItem.quantity);
    } else {
      setSelectedLocationId(locations[0]?.id || '');
      setSelectedProductId(products[0]?.id || '');
      setSelectedVariantId('');
      setCurrentStock(0);
    }
    setMovementType('ADJUSTMENT_IN');
    setQuantity('1');
    setReason('');
    setReferenceId('');
    setError(null);
  }, [initialStockItem, isOpen, locations, products]);

  // Fetch real-time current stock when location/product/variant changes
  useEffect(() => {
    if (!selectedLocationId || !selectedProductId) return;

    let isMounted = true;
    const fetchCurrent = async () => {
      try {
        setIsLoadingStock(true);
        const token = localStorage.getItem('pos_access_token');
        const url = `/api/inventory/stock?locationId=${selectedLocationId}&productId=${selectedProductId}`;
        const res = await fetch(url, { credentials: 'include', headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.data) {
            const match = data.data.find(
              (item: any) =>
                item.locationId === selectedLocationId &&
                item.productId === selectedProductId &&
                (selectedVariantId ? item.variantId === selectedVariantId : !item.variantId),
            );
            setCurrentStock(match ? match.quantity : 0);
          }
        }
      } catch (err) {
        console.error('Failed to fetch balance', err);
      } finally {
        if (isMounted) setIsLoadingStock(false);
      }
    };

    fetchCurrent();
    return () => {
      isMounted = false;
    };
  }, [selectedLocationId, selectedProductId, selectedVariantId]);

  if (!isOpen) return null;

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const availableVariants = selectedProduct?.variants || [];

  // Calculate projected new balance
  const parsedQty = parseFloat(quantity) || 0;
  const isDeduction = ['ADJUSTMENT_OUT', 'DAMAGE', 'EXPIRED'].includes(movementType);
  const delta = isDeduction ? -parsedQty : parsedQty;
  const projectedBalance = currentStock + delta;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedLocationId) {
      setError('Please select an inventory location');
      return;
    }
    if (!selectedProductId) {
      setError('Please select a product');
      return;
    }
    if (parsedQty <= 0) {
      setError('Quantity must be greater than zero');
      return;
    }
    if (!reason.trim() || reason.trim().length < 3) {
      setError('CRITICAL: Never change stock without recording a descriptive reason (minimum 3 characters)');
      return;
    }
    if (projectedBalance < 0) {
      setError(`Cannot deduct ${parsedQty} items: Current stock is only ${currentStock}. Negative stock is prohibited.`);
      return;
    }

    try {
      setIsSubmitting(true);
      const token = localStorage.getItem('pos_access_token');
      const res = await fetch('/api/inventory/adjust', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          locationId: selectedLocationId,
          productId: selectedProductId,
          variantId: selectedVariantId || undefined,
          type: movementType,
          quantityChange: parsedQty,
          reason: reason.trim(),
          referenceType: referenceType || undefined,
          referenceId: referenceId.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || 'Stock adjustment failed');
      }

      onAdjustSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error executing stock adjustment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-800/80 border-b border-slate-700/60 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 flex items-center justify-center text-lg">
              ⚡
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Record Stock Adjustment</h2>
              <p className="text-xs text-slate-400">
                Transactional inventory change with mandatory reason tracking & audit logging
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700 transition"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 text-xs flex items-center space-x-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Location & Product Selectors */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Target Storage Location *</label>
              <select
                required
                value={selectedLocationId}
                onChange={(e) => setSelectedLocationId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-indigo-500"
              >
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} {loc.isDefault ? '(Default Sales Floor)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Target Product *</label>
              <select
                required
                value={selectedProductId}
                onChange={(e) => {
                  setSelectedProductId(e.target.value);
                  setSelectedVariantId('');
                }}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-indigo-500"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Variant Selector (if product has variants) */}
          {availableVariants.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Specific Product Variant</label>
              <select
                value={selectedVariantId}
                onChange={(e) => setSelectedVariantId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- Main Product (No Variant) --</option>
                {availableVariants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} &bull; SKU: {v.sku} {v.size ? `(Size ${v.size})` : ''} {v.color ? `(${v.color})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Movement Type & Quantity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Adjustment Reason / Type *</label>
              <select
                value={movementType}
                onChange={(e) => setMovementType(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm font-semibold text-white focus:ring-2 focus:ring-indigo-500"
              >
                <optgroup label="Stock Inflow (+)">
                  <option value="PURCHASE">📦 Purchase Receiving (+Stock)</option>
                  <option value="RETURN">🔄 Customer Return (+Stock)</option>
                  <option value="ADJUSTMENT_IN">➕ Manual Stock Found (+Stock)</option>
                </optgroup>
                <optgroup label="Stock Outflow (-)">
                  <option value="ADJUSTMENT_OUT">➖ Manual Stock Count Reduction (-Stock)</option>
                  <option value="DAMAGE">💥 Damaged / Broken Goods (-Stock)</option>
                  <option value="EXPIRED">⏳ Expired / Rotated Goods (-Stock)</option>
                </optgroup>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Quantity Amount *</label>
              <input
                type="number"
                step="1"
                min="1"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm font-bold text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Live Before & After Balance Calculation */}
          <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/80 flex items-center justify-around">
            <div className="text-center">
              <p className="text-[11px] text-slate-400 uppercase font-semibold">Current Stock</p>
              <p className="text-xl font-bold text-slate-200">
                {isLoadingStock ? '...' : currentStock} <span className="text-xs font-normal">{selectedProduct?.unit || 'pcs'}</span>
              </p>
            </div>
            <div className="text-2xl text-slate-500">
              {isDeduction ? '➖' : '➕'}
            </div>
            <div className="text-center">
              <p className="text-[11px] text-slate-400 uppercase font-semibold">Adjustment</p>
              <p className={`text-xl font-bold ${isDeduction ? 'text-rose-400' : 'text-emerald-400'}`}>
                {isDeduction ? `-${parsedQty}` : `+${parsedQty}`} <span className="text-xs font-normal">{selectedProduct?.unit || 'pcs'}</span>
              </p>
            </div>
            <div className="text-2xl text-slate-500">➔</div>
            <div className="text-center">
              <p className="text-[11px] text-slate-400 uppercase font-semibold">Projected New Balance</p>
              <p className={`text-xl font-extrabold ${projectedBalance < 0 ? 'text-rose-500 animate-pulse' : 'text-indigo-400'}`}>
                {projectedBalance} <span className="text-xs font-normal">{selectedProduct?.unit || 'pcs'}</span>
              </p>
            </div>
          </div>

          {/* Mandatory Reason Note (INVARIANT: Never change stock without reason!) */}
          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-1 flex items-center justify-between">
              <span>Audit Reason / Notes * (Strictly Required)</span>
              <span className="text-[10px] text-amber-400">Mandatory audit trail log</span>
            </label>
            <textarea
              required
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Broken packaging discovered during shelf cleaning / Invoice PO-881 supplier delivery"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Reference Meta */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Reference Doc Type</label>
              <input
                type="text"
                value={referenceType}
                onChange={(e) => setReferenceType(e.target.value)}
                placeholder="MANUAL_ADJUSTMENT / PO / AUDIT"
                className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Reference Doc ID</label>
              <input
                type="text"
                value={referenceId}
                onChange={(e) => setReferenceId(e.target.value)}
                placeholder="e.g. PO-2026-99"
                className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || projectedBalance < 0}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold shadow-md shadow-indigo-600/30 transition disabled:opacity-50"
            >
              {isSubmitting ? 'Adjusting Stock...' : 'Confirm Stock Adjustment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
