'use client';

import React, { useState, useEffect } from 'react';
import { ArrowLeftRight, X, AlertCircle } from 'lucide-react';
import { InventoryLocationRecord, ProductRecord } from '@pos/types';

interface StockTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTransferSuccess: () => void;
  products: ProductRecord[];
  locations: InventoryLocationRecord[];
}

export function StockTransferModal({
  isOpen,
  onClose,
  onTransferSuccess,
  products,
  locations,
}: StockTransferModalProps) {
  const [fromLocationId, setFromLocationId] = useState('');
  const [toLocationId, setToLocationId] = useState('');
  const [productId, setProductId] = useState('');
  const [variantId, setVariantId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState('');

  const [availableStock, setAvailableStock] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (locations.length >= 2) {
      setFromLocationId(locations[1]?.id || locations[0]?.id || '');
      setToLocationId(locations[0]?.id || '');
    } else if (locations.length === 1) {
      setFromLocationId(locations[0]?.id || '');
      setToLocationId('');
    }
    setProductId(products[0]?.id || '');
    setVariantId('');
    setQuantity('1');
    setReason('');
    setError(null);
  }, [isOpen, locations, products]);

  // Fetch available stock in source location
  useEffect(() => {
    if (!fromLocationId || !productId) return;

    let isMounted = true;
    const checkStock = async () => {
      try {
        const token = localStorage.getItem('pos_access_token');
        const res = await fetch(
          `/api/inventory/stock?locationId=${fromLocationId}&productId=${productId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.data) {
            const match = data.data.find(
              (item: any) =>
                item.locationId === fromLocationId &&
                item.productId === productId &&
                (variantId ? item.variantId === variantId : !item.variantId),
            );
            setAvailableStock(match ? match.quantity : 0);
          }
        }
      } catch (err) {
        console.error('Error fetching source stock', err);
      }
    };

    checkStock();
    return () => {
      isMounted = false;
    };
  }, [fromLocationId, productId, variantId]);

  if (!isOpen) return null;

  const selectedProduct = products.find((p) => p.id === productId);
  const availableVariants = selectedProduct?.variants || [];
  const parsedQty = parseFloat(quantity) || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fromLocationId || !toLocationId) {
      setError('Both source and destination locations are required');
      return;
    }
    if (fromLocationId === toLocationId) {
      setError('Source and destination locations cannot be identical');
      return;
    }
    if (parsedQty <= 0) {
      setError('Transfer quantity must be greater than zero');
      return;
    }
    if (parsedQty > availableStock) {
      setError(
        `Requested transfer quantity (${parsedQty}) exceeds source location stock (${availableStock})`,
      );
      return;
    }
    if (!reason.trim() || reason.trim().length < 3) {
      setError('A descriptive transfer reason is strictly required (minimum 3 characters)');
      return;
    }

    try {
      setIsSubmitting(true);
      const token = localStorage.getItem('pos_access_token');
      const res = await fetch('/api/inventory/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fromLocationId,
          toLocationId,
          productId,
          variantId: variantId || undefined,
          quantity: parsedQty,
          reason: reason.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || 'Stock transfer failed');
      }

      onTransferSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error executing stock transfer');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-xl overflow-hidden shadow-xl text-slate-100">
        <div className="px-6 py-4 bg-slate-800/80 border-b border-slate-700/60 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-teal-600/20 text-teal-400 border border-teal-500/30 flex items-center justify-center">
              <ArrowLeftRight className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Transfer Stock Between Locations</h2>
              <p className="text-xs text-slate-400">
                Atomic two-way movement (Outflow &amp; Inflow)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Locations */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                From (Source) Location *
              </label>
              <select
                required
                value={fromLocationId}
                onChange={(e) => setFromLocationId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-indigo-500"
              >
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                To (Destination) Location *
              </label>
              <select
                required
                value={toLocationId}
                onChange={(e) => setToLocationId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-indigo-500"
              >
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id} disabled={loc.id === fromLocationId}>
                    {loc.name} {loc.id === fromLocationId ? '(Source)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Product & Variant */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Product *</label>
              <select
                required
                value={productId}
                onChange={(e) => {
                  setProductId(e.target.value);
                  setVariantId('');
                }}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-indigo-500"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Transfer Quantity *
              </label>
              <input
                type="number"
                min="1"
                step="1"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm font-bold text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {availableVariants.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Product Variant (Optional)
              </label>
              <select
                value={variantId}
                onChange={(e) => setVariantId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- Main Product --</option>
                {availableVariants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} (SKU: {v.sku})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Balance Indicator */}
          <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-400">Available in Source Location:</span>
            <span className="font-bold text-slate-200">
              {availableStock} {selectedProduct?.unit || 'pcs'}
            </span>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Transfer Reason * (Strictly Required)
            </label>
            <textarea
              required
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Replenishing retail display cooler before evening rush..."
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Footer */}
          <div className="pt-2 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || parsedQty > availableStock}
              className="px-5 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-semibold shadow-xs transition disabled:opacity-50"
            >
              {isSubmitting ? 'Transferring...' : 'Execute Stock Transfer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
