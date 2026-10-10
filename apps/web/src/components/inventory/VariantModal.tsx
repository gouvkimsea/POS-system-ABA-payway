'use client';

import React, { useState, useEffect } from 'react';
import { Layers, X, AlertCircle } from 'lucide-react';
import { ProductVariantRecord, ProductRecord, InventoryLocationRecord } from '@pos/types';

interface VariantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (variantData: any) => Promise<void>;
  product: ProductRecord | null;
  variant?: ProductVariantRecord | null;
  locations: InventoryLocationRecord[];
}

export function VariantModal({
  isOpen,
  onClose,
  onSave,
  product,
  variant,
  locations,
}: VariantModalProps) {
  const isEditing = !!variant;

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [size, setSize] = useState('');
  const [color, setColor] = useState('');
  const [weight, setWeight] = useState('');
  const [model, setModel] = useState('');
  const [costPriceUSD, setCostPriceUSD] = useState('0.00');
  const [sellingPriceUSD, setSellingPriceUSD] = useState('0.00');
  const [isActive, setIsActive] = useState(true);
  const [initialStock, setInitialStock] = useState('0');
  const [initialLocationId, setInitialLocationId] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (variant) {
      setName(variant.name || '');
      setSku(variant.sku || '');
      setBarcode(variant.barcode || '');
      setSize(variant.size || '');
      setColor(variant.color || '');
      setWeight(variant.weight || '');
      setModel(variant.model || '');
      setCostPriceUSD(String(variant.costPriceUSD || 0));
      setSellingPriceUSD(String(variant.sellingPriceUSD || 0));
      setIsActive(variant.isActive !== false);
      setInitialStock('0');
      setInitialLocationId('');
    } else if (product) {
      setName('');
      setSku(`${product.sku}-VAR-${Date.now().toString().slice(-4)}`);
      setBarcode('');
      setSize('');
      setColor('');
      setWeight('');
      setModel('');
      setCostPriceUSD(String(product.costPriceUSD || 0));
      setSellingPriceUSD(String(product.sellingPriceUSD || 0));
      setIsActive(true);
      setInitialStock('0');
      setInitialLocationId(locations[0]?.id || '');
    }
    setError(null);
  }, [variant, product, isOpen, locations]);

  if (!isOpen || !product) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Variant Name is required (e.g. Size M / Black)');
      return;
    }
    if (!sku.trim()) {
      setError('Variant SKU is required');
      return;
    }

    const cost = parseFloat(costPriceUSD) || 0;
    const sell = parseFloat(sellingPriceUSD) || 0;
    const stock = parseFloat(initialStock) || 0;

    const payload: any = {
      productId: product.id,
      name: name.trim(),
      sku: sku.trim(),
      barcode: barcode.trim() || undefined,
      size: size.trim() || undefined,
      color: color.trim() || undefined,
      weight: weight.trim() || undefined,
      model: model.trim() || undefined,
      costPriceUSD: cost,
      sellingPriceUSD: sell,
      sellingPriceKHR: Math.round(sell * 4100),
      isActive,
    };

    if (!isEditing && stock > 0) {
      payload.initialStock = stock;
      payload.initialLocationId = initialLocationId || undefined;
    }

    try {
      setIsSubmitting(true);
      await onSave(payload);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save variant');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-lg w-full max-w-xl overflow-hidden shadow-xl text-slate-100">
        <div className="px-6 py-4 bg-slate-800/80 border-b border-slate-700/60 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {isEditing ? `Edit Variant: ${variant?.name}` : `Add Variant - ${product?.name}`}
              </h2>
              <p className="text-xs text-slate-400">
                Enter size, color, weight, model, and barcode.
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Variant Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Size M / Navy Blue"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                SKU *
              </label>
              <input
                type="text"
                required
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="POLO-BLU-M"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm font-mono text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Barcode
              </label>
              <input
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="8840009001"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm font-mono text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
              />
            </div>
          </div>

          {/* Variant Specific Attributes */}
          <div className="bg-slate-800/40 p-3.5 rounded-lg border border-slate-800 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Attributes
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Size
                </label>
                <input
                  type="text"
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  placeholder="e.g. M, L, 500ml"
                  className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Color
                </label>
                <input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="e.g. Navy Blue, White"
                  className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Weight
                </label>
                <input
                  type="text"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="e.g. 250g, 1kg"
                  className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Model / Edition
                </label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="Classic-2026"
                  className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
                />
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Cost ($ USD)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={costPriceUSD}
                onChange={(e) => setCostPriceUSD(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Price ($ USD)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={sellingPriceUSD}
                onChange={(e) => setSellingPriceUSD(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm font-semibold text-emerald-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
              />
            </div>
          </div>

          {!isEditing && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Starting Stock
                </label>
                <input
                  type="number"
                  min="0"
                  value={initialStock}
                  onChange={(e) => setInitialStock(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Storage Location
                </label>
                <select
                  value={initialLocationId}
                  onChange={(e) => setInitialLocationId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
                >
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} {loc.isDefault ? '(Default)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="pt-2 flex items-center justify-between">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              <span className="ml-3 text-xs font-medium text-slate-200">
                {isActive ? 'Active (available in POS)' : 'Inactive (hidden in POS)'}
              </span>
            </label>

            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-semibold shadow-xs transition disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Variant'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
