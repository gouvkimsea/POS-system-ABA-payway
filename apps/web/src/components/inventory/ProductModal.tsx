'use client';

import React, { useState, useEffect } from 'react';
import {
  CategoryRecord,
  BrandRecord,
  SupplierRecord,
  InventoryLocationRecord,
  ProductRecord,
} from '@pos/types';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (productData: any) => Promise<void>;
  product?: ProductRecord | null;
  categories: CategoryRecord[];
  brands: BrandRecord[];
  suppliers: SupplierRecord[];
  locations: InventoryLocationRecord[];
}

export function ProductModal({
  isOpen,
  onClose,
  onSave,
  product,
  categories,
  brands,
  suppliers,
  locations,
}: ProductModalProps) {
  const isEditing = !!product;

  const [name, setName] = useState('');
  const [nameKhmer, setNameKhmer] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [description, setDescription] = useState('');
  const [costPriceUSD, setCostPriceUSD] = useState('0.00');
  const [sellingPriceUSD, setSellingPriceUSD] = useState('0.00');
  const [taxRate, setTaxRate] = useState('0.10');
  const [unit, setUnit] = useState('pcs');
  const [reorderLevel, setReorderLevel] = useState('5');
  const [imageUrl, setImageUrl] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [initialStock, setInitialStock] = useState('0');
  const [initialLocationId, setInitialLocationId] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (product) {
      setName(product.name || '');
      setNameKhmer(product.nameKhmer || '');
      setSku(product.sku || '');
      setBarcode(product.barcode || '');
      setCategoryId(product.categoryId || '');
      setBrandId(product.brandId || '');
      setSupplierId(product.supplierId || '');
      setDescription(product.description || '');
      setCostPriceUSD(String(product.costPriceUSD || 0));
      setSellingPriceUSD(String(product.sellingPriceUSD || 0));
      setTaxRate(String(product.taxRate ?? 0.1));
      setUnit(product.unit || 'pcs');
      setReorderLevel(String(product.reorderLevel ?? 5));
      setImageUrl(product.imageUrl || '');
      setIsActive(product.isActive !== false);
      setInitialStock('0');
      setInitialLocationId('');
    } else {
      setName('');
      setNameKhmer('');
      setSku(`SKU-${Date.now().toString().slice(-6)}`);
      setBarcode('');
      setCategoryId(categories[0]?.id || '');
      setBrandId(brands[0]?.id || '');
      setSupplierId(suppliers[0]?.id || '');
      setDescription('');
      setCostPriceUSD('0.00');
      setSellingPriceUSD('0.00');
      setTaxRate('0.10');
      setUnit('pcs');
      setReorderLevel('5');
      setImageUrl('');
      setIsActive(true);
      setInitialStock('0');
      setInitialLocationId(locations[0]?.id || '');
    }
    setError(null);
  }, [product, isOpen, categories, brands, suppliers, locations]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Product Name is required');
      return;
    }
    if (!sku.trim()) {
      setError('Product SKU is required');
      return;
    }

    const cost = parseFloat(costPriceUSD) || 0;
    const sell = parseFloat(sellingPriceUSD) || 0;
    const tax = parseFloat(taxRate) || 0.1;
    const reorder = parseInt(reorderLevel, 10) || 5;
    const stock = parseFloat(initialStock) || 0;

    const payload: any = {
      name: name.trim(),
      nameKhmer: nameKhmer.trim() || undefined,
      sku: sku.trim(),
      barcode: barcode.trim() || undefined,
      categoryId: categoryId || undefined,
      brandId: brandId || undefined,
      supplierId: supplierId || undefined,
      description: description.trim() || undefined,
      costPriceUSD: cost,
      sellingPriceUSD: sell,
      sellingPriceKHR: Math.round(sell * 4100),
      taxRate: tax,
      unit: unit.trim() || 'pcs',
      reorderLevel: reorder,
      alertLowStock: reorder,
      imageUrl: imageUrl.trim() || undefined,
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
      setError(err.message || 'Failed to save product');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-800/80 border-b border-slate-700/60 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 flex items-center justify-center text-lg">
              📦
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {isEditing ? `Edit Product: ${product?.name}` : 'Create New Product'}
              </h2>
              <p className="text-xs text-slate-400">
                Configure item details, dual-language Khmer labels, barcode, pricing, and reorder
                levels
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
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 text-xs flex items-center space-x-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Basic Identification */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Product Name (English / Primary) *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Cambodia Premium Lager Beer 330ml Can"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Khmer Name (ឈ្មោះជាភាសាខ្មែរ)
              </label>
              <input
                type="text"
                value={nameKhmer}
                onChange={(e) => setNameKhmer(e.target.value)}
                placeholder="ឧ. ស្រាបៀរកម្ពុជា កំប៉ុង ៣៣០មីលីលីត្រ"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                SKU (Stock Keeping Unit) *
              </label>
              <input
                type="text"
                required
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="BEV-CAM-330"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm font-mono text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Barcode (EAN / UPC / Code128)
              </label>
              <input
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="8840001001"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm font-mono text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Categorization & Relations */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Category</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- No Category --</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Brand</label>
              <select
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- No Brand --</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Supplier</label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- No Supplier --</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Pricing & Units */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-800/40 p-3.5 rounded-xl border border-slate-800">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Cost Price ($ USD)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={costPriceUSD}
                onChange={(e) => setCostPriceUSD(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm font-semibold text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Selling Price ($ USD)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={sellingPriceUSD}
                onChange={(e) => setSellingPriceUSD(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm font-semibold text-emerald-400 focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                ≈ ៛{(parseFloat(sellingPriceUSD || '0') * 4100).toLocaleString()} KHR
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Tax Rate (e.g. 0.10 = 10%)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Unit of Measure
              </label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-indigo-500"
              >
                <option value="pcs">pcs (Pieces)</option>
                <option value="can">can (Can)</option>
                <option value="bottle">bottle (Bottle)</option>
                <option value="pack">pack (Pack)</option>
                <option value="box">box (Box)</option>
                <option value="kg">kg (Kilogram)</option>
                <option value="tube">tube (Tube)</option>
                <option value="bar">bar (Bar)</option>
              </select>
            </div>
          </div>

          {/* Inventory Controls */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Reorder Level (Low Stock Alert)
              </label>
              <input
                type="number"
                min="0"
                value={reorderLevel}
                onChange={(e) => setReorderLevel(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Triggers low-stock warnings when inventory ≤ this value
              </p>
            </div>

            {!isEditing && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Initial Opening Stock
                </label>
                <input
                  type="number"
                  min="0"
                  value={initialStock}
                  onChange={(e) => setInitialStock(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}

            {!isEditing && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Stock Receiving Location
                </label>
                <select
                  value={initialLocationId}
                  onChange={(e) => setInitialLocationId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-indigo-500"
                >
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} {loc.isDefault ? '(Default)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Image URL & Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Product Image URL
              </label>
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://images.unsplash.com/photo-..."
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center space-x-3 pt-6">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                <span className="ml-3 text-sm font-medium text-slate-200">
                  {isActive ? 'Active (Ready for POS)' : 'Inactive (Hidden from POS)'}
                </span>
              </label>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Product Notes / Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Merchandise packaging, allergen warnings, or handling notes..."
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Footer Buttons */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end space-x-3">
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
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold shadow-md shadow-indigo-600/30 transition disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : isEditing ? 'Update Product' : 'Create Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
