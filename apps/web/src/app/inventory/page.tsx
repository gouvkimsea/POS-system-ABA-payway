'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AuthGuard } from '../../components/AuthGuard';
import {
  ProductRecord,
  ProductVariantRecord,
  CategoryRecord,
  BrandRecord,
  SupplierRecord,
  InventoryLocationRecord,
  StockLevelRecord,
  StockMovementRecord,
} from '@pos/types';
import { InventoryNav, InventoryTab } from '../../components/inventory/InventoryNav';
import { ProductModal } from '../../components/inventory/ProductModal';
import { VariantModal } from '../../components/inventory/VariantModal';
import { StockAdjustmentModal } from '../../components/inventory/StockAdjustmentModal';
import { StockTransferModal } from '../../components/inventory/StockTransferModal';
import {
  CategoryBrandSupplierModal,
  ClassificationType,
} from '../../components/inventory/CategoryBrandSupplierModal';
import { LocationModal } from '../../components/inventory/LocationModal';
import {
  RefreshCw,
  Package,
  ArrowLeftRight,
  AlertTriangle,
  MapPin,
  Tag,
  Building2,
  Pencil,
  Trash2,
  CheckCircle2,
  X,
  Search,
  Plus,
} from 'lucide-react';

export default function InventoryPage() {
  return (
    <AuthGuard requiredPermission="inventory.view">
      <InventoryHubContent />
    </AuthGuard>
  );
}

function InventoryHubContent() {
  // Active Tab & View States
  const [activeTab, setActiveTab] = useState<InventoryTab>('products');
  const [isLoading, setIsLoading] = useState(true);

  // Master Data Collections
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [brands, setBrands] = useState<BrandRecord[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);
  const [locations, setLocations] = useState<InventoryLocationRecord[]>([]);
  const [stockLevels, setStockLevels] = useState<StockLevelRecord[]>([]);
  const [movements, setMovements] = useState<StockMovementRecord[]>([]);
  const [lowStockCount, setLowStockCount] = useState(0);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [filterLowStockOnly, setFilterLowStockOnly] = useState(false);
  const [selectedMovementType, setSelectedMovementType] = useState('');

  // Modals Visibility State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductRecord | null>(null);

  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
  const [variantTargetProduct, setVariantTargetProduct] = useState<ProductRecord | null>(null);
  const [editingVariant, setEditingVariant] = useState<ProductVariantRecord | null>(null);

  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [adjustmentStockItem, setAdjustmentStockItem] = useState<StockLevelRecord | null>(null);

  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [classModalType, setClassModalType] = useState<ClassificationType>('category');
  const [editingClassItem, setEditingClassItem] = useState<any | null>(null);

  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<InventoryLocationRecord | null>(null);

  // Fast Barcode Lookup Match Popup
  const [barcodeMatchResult, setBarcodeMatchResult] = useState<any | null>(null);

  // Notification Toast State
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: 'success' | 'error';
  } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const getToken = () => localStorage.getItem('pos_access_token');

  // ============================================================================
  // DATA FETCHING ROUTINES
  // ============================================================================

  const fetchClassifications = useCallback(async () => {
    try {
      const token = getToken();
      const [catRes, brandRes, suppRes, locRes] = await Promise.all([
        fetch('/api/catalog/categories', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/catalog/brands', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/catalog/suppliers', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/inventory/locations', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (catRes.ok) {
        const d = await catRes.json();
        setCategories(d.data || []);
      }
      if (brandRes.ok) {
        const d = await brandRes.json();
        setBrands(d.data || []);
      }
      if (suppRes.ok) {
        const d = await suppRes.json();
        setSuppliers(d.data || []);
      }
      if (locRes.ok) {
        const d = await locRes.json();
        setLocations(d.data || []);
      }
    } catch (err) {
      console.error('Failed to load classifications', err);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const token = getToken();
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (selectedCategory) params.append('categoryId', selectedCategory);
      if (selectedBrand) params.append('brandId', selectedBrand);
      if (selectedSupplier) params.append('supplierId', selectedSupplier);
      if (filterLowStockOnly) params.append('lowStockOnly', 'true');
      params.append('limit', '100');

      const res = await fetch(`/api/catalog/products?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d = await res.json();
        setProducts(d.data?.items || []);
      }
    } catch (err) {
      console.error('Failed to load products', err);
    }
  }, [searchQuery, selectedCategory, selectedBrand, selectedSupplier, filterLowStockOnly]);

  const fetchStockLevels = useCallback(async () => {
    try {
      const token = getToken();
      const params = new URLSearchParams();
      if (selectedLocation) params.append('locationId', selectedLocation);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (filterLowStockOnly) params.append('lowStockOnly', 'true');

      const res = await fetch(`/api/inventory/stock?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d = await res.json();
        const items = d.data || [];
        setStockLevels(items);
        const lowCount = items.filter((i: StockLevelRecord) => i.isLowStock).length;
        setLowStockCount(lowCount);
      }
    } catch (err) {
      console.error('Failed to load stock levels', err);
    }
  }, [selectedLocation, searchQuery, filterLowStockOnly]);

  const fetchMovements = useCallback(async () => {
    try {
      const token = getToken();
      const params = new URLSearchParams();
      if (selectedMovementType) params.append('type', selectedMovementType);
      if (selectedLocation) params.append('locationId', selectedLocation);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      params.append('limit', '100');

      const res = await fetch(`/api/inventory/movements?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d = await res.json();
        setMovements(d.data?.items || []);
      }
    } catch (err) {
      console.error('Failed to load movements', err);
    }
  }, [selectedMovementType, selectedLocation, searchQuery]);

  const refreshAll = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([
      fetchClassifications(),
      fetchProducts(),
      fetchStockLevels(),
      fetchMovements(),
    ]);
    setIsLoading(false);
  }, [fetchClassifications, fetchProducts, fetchStockLevels, fetchMovements]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Fast Barcode Lookup Trigger
  const handleFastBarcodeScan = async (barcode: string) => {
    try {
      const token = getToken();
      const res = await fetch(`/api/catalog/products/barcode/${encodeURIComponent(barcode)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (res.ok && json.data) {
        setBarcodeMatchResult(json.data);
      } else {
        showToast(`No item found for barcode "${barcode}"`, 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Barcode scan failed', 'error');
    }
  };

  // Product CRUD Handlers
  const handleSaveProduct = async (productData: any) => {
    const token = getToken();
    const isEdit = !!editingProduct;
    const url = isEdit ? `/api/catalog/products/${editingProduct.id}` : '/api/catalog/products';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(productData),
    });

    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error?.message || 'Failed to save product');
    }

    showToast(`Product "${productData.name}" saved successfully`);
    fetchProducts();
    fetchStockLevels();
  };

  const handleDeleteProduct = async (prod: ProductRecord) => {
    if (!confirm(`Are you sure you want to delete product "${prod.name}"?`)) return;
    try {
      const token = getToken();
      const res = await fetch(`/api/catalog/products/${prod.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        showToast(`Product "${prod.name}" deleted`);
        fetchProducts();
        fetchStockLevels();
      } else {
        const j = await res.json();
        showToast(j.error?.message || 'Delete failed', 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Variant CRUD Handlers
  const handleSaveVariant = async (variantData: any) => {
    const token = getToken();
    const isEdit = !!editingVariant;
    const url = isEdit
      ? `/api/catalog/variants/${editingVariant.id}`
      : `/api/catalog/products/${variantTargetProduct?.id}/variants`;
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(variantData),
    });

    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error?.message || 'Failed to save variant');
    }

    showToast(`Variant "${variantData.name}" saved successfully`);
    fetchProducts();
    fetchStockLevels();
  };

  const handleDeleteVariant = async (v: ProductVariantRecord) => {
    if (!confirm(`Delete variant "${v.name}"?`)) return;
    try {
      const token = getToken();
      const res = await fetch(`/api/catalog/variants/${v.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        showToast(`Variant "${v.name}" deleted`);
        fetchProducts();
        fetchStockLevels();
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Header & Tab Navigation */}
      <InventoryNav
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setFilterLowStockOnly(false);
        }}
        lowStockCount={lowStockCount}
        totalProductsCount={products.length}
        onBarcodeScan={handleFastBarcodeScan}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-8 space-y-6">
        {/* Loading Indicator */}
        {isLoading && (
          <div className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 flex items-center justify-between text-xs text-slate-300">
            <span className="flex items-center space-x-2">
              <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
              <span>Updating catalog and inventory records...</span>
            </span>
          </div>
        )}

        {/* Toast Alert */}
        {toastMessage && (
          <div
            className={`fixed bottom-20 lg:bottom-6 right-4 sm:right-6 z-50 px-4 py-3 rounded-xl shadow-xl border text-sm flex items-center space-x-2 ${
              toastMessage.type === 'success'
                ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/40'
                : 'bg-rose-950/90 text-rose-200 border-rose-500/40'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
            )}
            <span className="font-medium">{toastMessage.text}</span>
          </div>
        )}

        {/* =========================================================================
            TAB 1: PRODUCTS & VARIANTS
           ========================================================================= */}
        {activeTab === 'products' && (
          <section className="space-y-5">
            {/* Action Bar & Filtering */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
              {/* Search & Selectors */}
              <div className="flex flex-wrap items-center gap-3 flex-1">
                <div className="relative min-w-[240px] flex-1">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Search className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by English, Khmer name, SKU, barcode..."
                    className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-400 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                >
                  <option value="">All Categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedBrand}
                  onChange={(e) => setSelectedBrand(e.target.value)}
                  className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                >
                  <option value="">All Brands</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedSupplier}
                  onChange={(e) => setSelectedSupplier(e.target.value)}
                  className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                >
                  <option value="">All Suppliers</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => setFilterLowStockOnly(!filterLowStockOnly)}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors ${
                    filterLowStockOnly
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-slate-800 text-amber-300 border border-amber-500/30 hover:bg-slate-700'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Low Stock Only</span>
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => {
                    setEditingProduct(null);
                    setIsProductModalOpen(true);
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Product</span>
                </button>
              </div>
            </div>

            {/* Products Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-800/80 text-slate-300 uppercase tracking-wider text-[11px] border-b border-slate-700">
                    <tr>
                      <th className="py-3.5 px-4 font-semibold">Product &amp; Khmer</th>
                      <th className="py-3.5 px-4 font-semibold">SKU / Barcode</th>
                      <th className="py-3.5 px-4 font-semibold">Classification</th>
                      <th className="py-3.5 px-4 font-semibold text-right">Cost / Selling</th>
                      <th className="py-3.5 px-4 font-semibold text-center">Stock Level</th>
                      <th className="py-3.5 px-4 font-semibold text-center">Status</th>
                      <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {products.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 px-4 text-center">
                          <div className="max-w-sm mx-auto space-y-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 mx-auto flex items-center justify-center text-slate-400">
                              <Package className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-200">No products found</p>
                              <p className="text-xs text-slate-400 mt-1">
                                {searchQuery || selectedCategory || selectedBrand || selectedSupplier || filterLowStockOnly
                                  ? 'No items match the active search or classification filters.'
                                  : 'The product catalog is currently empty.'}
                              </p>
                            </div>
                            {searchQuery || selectedCategory || selectedBrand || selectedSupplier || filterLowStockOnly ? (
                              <button
                                onClick={() => {
                                  setSearchQuery('');
                                  setSelectedCategory('');
                                  setSelectedBrand('');
                                  setSelectedSupplier('');
                                  setFilterLowStockOnly(false);
                                }}
                                className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors"
                              >
                                Reset All Filters
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  setEditingProduct(null);
                                  setIsProductModalOpen(true);
                                }}
                                className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-colors inline-flex items-center gap-1.5"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                Add First Product
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      products.map((product) => (
                        <React.Fragment key={product.id}>
                          <tr className="hover:bg-slate-800/40 transition-colors">
                            {/* Product Info & Image */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center space-x-3">
                                {product.imageUrl ? (
                                  <img
                                    src={product.imageUrl}
                                    alt={product.name}
                                    className="w-10 h-10 rounded-lg object-cover bg-slate-800 border border-slate-700"
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500">
                                    <Package className="w-5 h-5" />
                                  </div>
                                )}
                                <div>
                                  <p className="font-bold text-white text-sm">{product.name}</p>
                                  {product.nameKhmer && (
                                    <p className="text-indigo-300 text-xs font-medium">
                                      {product.nameKhmer}
                                    </p>
                                  )}
                                  <span className="text-[10px] text-slate-400">
                                    Unit: {product.unit}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* SKU & Barcode */}
                            <td className="py-3.5 px-4 font-mono text-slate-300">
                              <div className="font-semibold text-slate-200">{product.sku}</div>
                              <div className="text-[11px] text-slate-400">
                                {product.barcode || '—'}
                              </div>
                            </td>

                            {/* Classification */}
                            <td className="py-3.5 px-4 space-y-1">
                              {product.categoryName ? (
                                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                  {product.categoryName}
                                </span>
                              ) : (
                                <span className="text-slate-500">—</span>
                              )}
                              {product.brandName && (
                                <div className="text-[11px] text-slate-400">
                                  &bull; {product.brandName}
                                </div>
                              )}
                            </td>

                            {/* Pricing */}
                            <td className="py-3.5 px-4 text-right">
                              <div className="font-bold text-emerald-400 text-sm">
                                ${product.sellingPriceUSD.toFixed(2)}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                ៛{product.sellingPriceKHR.toLocaleString()}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                Cost: ${product.costPriceUSD.toFixed(2)}
                              </div>
                            </td>

                            {/* Stock & Low-Stock Indicator */}
                            <td className="py-3.5 px-4 text-center">
                              <div className="flex flex-col items-center">
                                <span
                                  className={`px-2.5 py-1 rounded-full font-bold text-xs ${
                                    product.isLowStock
                                      ? 'bg-rose-950/80 text-rose-300 border border-rose-800'
                                      : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/80'
                                  }`}
                                >
                                  {product.stockQuantity} {product.unit}
                                </span>
                                <span className="text-[10px] text-slate-400 mt-0.5">
                                  Reorder at &le; {product.reorderLevel}
                                </span>
                                {product.isLowStock && (
                                  <span className="text-[10px] font-semibold text-rose-400 mt-0.5">
                                    Low Stock
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Status */}
                            <td className="py-3.5 px-4 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                  product.isActive
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                                }`}
                              >
                                {product.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </td>

                            {/* Actions */}
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end space-x-1.5">
                                <button
                                  onClick={() => {
                                    setVariantTargetProduct(product);
                                    setEditingVariant(null);
                                    setIsVariantModalOpen(true);
                                  }}
                                  title="Add Variant (Size/Color/Weight/Model)"
                                  className="p-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 transition text-xs font-semibold"
                                >
                                  + Variant
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingProduct(product);
                                    setIsProductModalOpen(true);
                                  }}
                                  title="Edit Product"
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteProduct(product)}
                                  title="Delete Product"
                                  className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800 transition"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Nested Variants Display if variants exist */}
                          {product.variants && product.variants.length > 0 && (
                            <tr className="bg-slate-900/60">
                              <td colSpan={7} className="px-6 py-2.5">
                                <div className="pl-6 border-l-2 border-indigo-500/40 space-y-1.5">
                                  <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">
                                    Registered Variants ({product.variants.length})
                                  </p>
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {product.variants.map((v) => (
                                      <div
                                        key={v.id}
                                        className="p-2.5 bg-slate-800/80 rounded-xl border border-slate-700/80 flex items-center justify-between text-xs"
                                      >
                                        <div>
                                          <p className="font-bold text-white">{v.name}</p>
                                          <p className="font-mono text-[10px] text-slate-300">
                                            SKU: {v.sku} {v.barcode ? `&bull; ${v.barcode}` : ''}
                                          </p>
                                          <div className="flex flex-wrap gap-1 mt-1 text-[10px] text-indigo-300">
                                            {v.size && (
                                              <span className="bg-slate-700 px-1.5 py-0.2 rounded">
                                                Size: {v.size}
                                              </span>
                                            )}
                                            {v.color && (
                                              <span className="bg-slate-700 px-1.5 py-0.2 rounded">
                                                Color: {v.color}
                                              </span>
                                            )}
                                            {v.weight && (
                                              <span className="bg-slate-700 px-1.5 py-0.2 rounded">
                                                Wt: {v.weight}
                                              </span>
                                            )}
                                            {v.model && (
                                              <span className="bg-slate-700 px-1.5 py-0.2 rounded">
                                                Mod: {v.model}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                        <div className="text-right pl-2">
                                          <span className="font-bold text-emerald-400 block">
                                            ${v.sellingPriceUSD.toFixed(2)}
                                          </span>
                                          <span className="text-[11px] font-bold text-indigo-300">
                                            {v.stockQuantity} pcs
                                          </span>
                                          <div className="flex items-center space-x-1 mt-1">
                                            <button
                                              onClick={() => {
                                                setVariantTargetProduct(product);
                                                setEditingVariant(v);
                                                setIsVariantModalOpen(true);
                                              }}
                                              className="text-[10px] text-slate-300 hover:text-white underline"
                                            >
                                              Edit
                                            </button>
                                            <button
                                              onClick={() => handleDeleteVariant(v)}
                                              className="text-[10px] text-rose-400 hover:text-rose-300 underline"
                                            >
                                              Del
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* =========================================================================
            TAB 2: STOCK BALANCES & LOW-STOCK INDICATORS
           ========================================================================= */}
        {activeTab === 'stock' && (
          <section className="space-y-5">
            {/* Stock Metric Highlights */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl shadow-md">
                <p className="text-xs font-semibold text-slate-400">Total Tracked Items</p>
                <p className="text-2xl font-extrabold text-white mt-1">{stockLevels.length}</p>
              </div>
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl shadow-md">
                <p className="text-xs font-semibold text-slate-400">Physical Units in Stock</p>
                <p className="text-2xl font-extrabold text-emerald-400 mt-1">
                  {stockLevels.reduce((acc, s) => acc + s.quantity, 0).toLocaleString()}
                </p>
              </div>
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl shadow-md">
                <p className="text-xs font-semibold text-slate-400">Low Stock Items</p>
                <p className="text-2xl font-extrabold text-amber-400 mt-1">{lowStockCount}</p>
              </div>
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl shadow-md flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-400">Inventory Locations</p>
                  <p className="text-2xl font-extrabold text-indigo-400 mt-1">{locations.length}</p>
                </div>
                <button
                  onClick={() => setIsAdjustmentModalOpen(true)}
                  className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition"
                >
                  Adjust Stock
                </button>
              </div>
            </div>

            {/* Filter Controls */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center gap-3 justify-between">
              <div className="flex flex-wrap items-center gap-3 flex-1">
                <select
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                >
                  <option value="">All Storage Locations</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} {loc.isDefault ? '(Default Sales Floor)' : ''}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter stock by product name or SKU..."
                  className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white min-w-[220px]"
                />

                <button
                  onClick={() => setFilterLowStockOnly(!filterLowStockOnly)}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors ${
                    filterLowStockOnly
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-slate-800 text-amber-300 border border-amber-500/30'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Low Stock Alert ({lowStockCount})</span>
                </button>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsTransferModalOpen(true)}
                  className="px-3.5 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1.5"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5 shrink-0" />
                  <span>Transfer Stock</span>
                </button>
              </div>
            </div>

            {/* Granular Stock Balances Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-800/80 text-slate-300 uppercase tracking-wider text-[11px] border-b border-slate-700">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Location</th>
                      <th className="py-3 px-4 font-semibold">Product Name</th>
                      <th className="py-3 px-4 font-semibold">SKU / Barcode</th>
                      <th className="py-3 px-4 font-semibold text-center">Available Stock</th>
                      <th className="py-3 px-4 font-semibold text-center">Reorder Threshold</th>
                      <th className="py-3 px-4 font-semibold text-center">Indicator</th>
                      <th className="py-3 px-4 font-semibold text-right">Quick Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {stockLevels.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-400">
                          No stock inventory matches criteria.
                        </td>
                      </tr>
                    ) : (
                      stockLevels.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3.5 px-4 font-medium text-slate-200">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300">
                              <MapPin className="w-3.5 h-3.5 text-slate-400" />
                              <span>{item.locationName}</span>
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <p className="font-bold text-white text-sm">{item.productName}</p>
                            {item.productNameKhmer && (
                              <p className="text-indigo-300 text-xs">{item.productNameKhmer}</p>
                            )}
                            {item.variantName && (
                              <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[10px] bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                                Variant: {item.variantName}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-300">
                            <div>{item.variantSku || item.productSku}</div>
                            <div className="text-[10px] text-slate-500">
                              {item.productBarcode || '—'}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span
                              className={`text-base font-extrabold ${
                                item.isLowStock ? 'text-rose-400' : 'text-emerald-400'
                              }`}
                            >
                              {item.quantity}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center text-slate-300 font-medium">
                            &le; {item.reorderLevel}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {item.isLowStock ? (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-950/80 text-rose-300 border border-rose-800">
                                Low (Short {Math.max(0, item.reorderLevel - item.quantity)})
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800/80">
                                Optimal
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => {
                                setAdjustmentStockItem(item);
                                setIsAdjustmentModalOpen(true);
                              }}
                              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium transition"
                            >
                              Adjust
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* =========================================================================
            TAB 3: STOCK ADJUSTMENT & TRANSFER ACTION HUB
           ========================================================================= */}
        {activeTab === 'adjustments' && (
          <section className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h2 className="text-lg font-bold text-white mb-2">
                Stock Operations
              </h2>
              <p className="text-slate-400 text-xs max-w-3xl leading-relaxed">
                Record audited inventory adjustments, supplier deliveries, damaged write-offs, and inter-location transfers.
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  onClick={() => setIsAdjustmentModalOpen(true)}
                  className="px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition flex items-center space-x-2"
                >
                  <Package className="w-4 h-4" />
                  <span>Record Stock Adjustment</span>
                </button>

                <button
                  onClick={() => setIsTransferModalOpen(true)}
                  className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs transition flex items-center space-x-2"
                >
                  <ArrowLeftRight className="w-4 h-4 text-slate-400" />
                  <span>Location Transfer</span>
                </button>
              </div>
            </div>

            {/* Quick Adjustment Shortcuts */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-2">
                <div className="w-9 h-9 rounded-lg bg-emerald-950/80 border border-emerald-800/80 text-emerald-400 flex items-center justify-center">
                  <Package className="w-4 h-4" />
                </div>
                <h3 className="font-semibold text-white text-sm">Purchase Receiving</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Receive inbound supplier deliveries directly into the central warehouse or floor displays with supplier invoice references.
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-2">
                <div className="w-9 h-9 rounded-lg bg-rose-950/80 border border-rose-800/80 text-rose-400 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <h3 className="font-semibold text-white text-sm">
                  Damage &amp; Expiration Write-offs
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Deduct broken, damaged packaging, or date-expired goods with reason documentation.
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-2">
                <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center">
                  <ArrowLeftRight className="w-4 h-4" />
                </div>
                <h3 className="font-semibold text-white text-sm">Store Location Transfers</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Move inventory between storage rooms and counter shelves atomically.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* =========================================================================
            TAB 4: MOVEMENT AUDIT LOG (STOCK HISTORY)
           ========================================================================= */}
        {activeTab === 'movements' && (
          <section className="space-y-5">
            {/* Filter Bar */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center gap-3 justify-between">
              <div className="flex flex-wrap items-center gap-3 flex-1">
                <select
                  value={selectedMovementType}
                  onChange={(e) => setSelectedMovementType(e.target.value)}
                  className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                >
                  <option value="">All Movement Types</option>
                  <option value="SALE">SALE (Customer POS Checkout)</option>
                  <option value="PURCHASE">PURCHASE (Supplier Receiving)</option>
                  <option value="RETURN">RETURN (Customer Return)</option>
                  <option value="ADJUSTMENT_IN">ADJUSTMENT_IN (Manual Stock Found)</option>
                  <option value="ADJUSTMENT_OUT">ADJUSTMENT_OUT (Manual Stock Reduction)</option>
                  <option value="DAMAGE">DAMAGE (Broken / Damaged Stock)</option>
                  <option value="EXPIRED">EXPIRED (Expired Goods Write-off)</option>
                  <option value="TRANSFER_IN">TRANSFER_IN (Received from Transfer)</option>
                  <option value="TRANSFER_OUT">TRANSFER_OUT (Dispatched in Transfer)</option>
                </select>

                <select
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                >
                  <option value="">All Locations</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search reason notes or product..."
                  className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white min-w-[200px]"
                />
              </div>

              <button
                onClick={fetchMovements}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Logs</span>
              </button>
            </div>

            {/* Movement Audit Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-800/80 text-slate-300 uppercase tracking-wider text-[11px] border-b border-slate-700">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Timestamp</th>
                      <th className="py-3 px-4 font-semibold">Movement Type</th>
                      <th className="py-3 px-4 font-semibold">Product &amp; SKU</th>
                      <th className="py-3 px-4 font-semibold">Location</th>
                      <th className="py-3 px-4 font-semibold text-center">Net Change</th>
                      <th className="py-3 px-4 font-semibold text-center">Before &rarr; After</th>
                      <th className="py-3 px-4 font-semibold">Mandatory Reason / Notes</th>
                      <th className="py-3 px-4 font-semibold">Operator</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {movements.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400">
                          No stock movement history found.
                        </td>
                      </tr>
                    ) : (
                      movements.map((m) => {
                        const isPos = m.quantityChange > 0;
                        return (
                          <tr key={m.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                              {new Date(m.createdAt).toLocaleString()}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                  m.type === 'SALE'
                                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                    : m.type === 'PURCHASE'
                                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                      : m.type === 'RETURN'
                                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                        : m.type === 'DAMAGE'
                                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                          : m.type === 'EXPIRED'
                                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                            : m.type === 'TRANSFER_IN' || m.type === 'TRANSFER_OUT'
                                              ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                                              : 'bg-slate-800 text-slate-300'
                                }`}
                              >
                                {m.type}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <p className="font-bold text-white">{m.productName}</p>
                              <span className="font-mono text-[10px] text-slate-400">
                                {m.productSku}
                              </span>
                              {m.variantName && (
                                <span className="text-[10px] text-amber-300 ml-1">
                                  ({m.variantName})
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-slate-300">{m.locationName}</td>
                            <td className="py-3 px-4 text-center font-bold text-sm">
                              <span className={isPos ? 'text-emerald-400' : 'text-rose-400'}>
                                {isPos ? `+${m.quantityChange}` : m.quantityChange}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center text-slate-300 font-mono">
                              {m.quantityBefore} &rarr;{' '}
                              <span className="font-bold text-white">{m.quantityAfter}</span>
                            </td>
                            <td className="py-3 px-4 max-w-xs text-slate-200">
                              <p className="italic text-xs">"{m.notes}"</p>
                              {m.referenceId && (
                                <span className="text-[10px] text-slate-400 block font-mono">
                                  Ref: {m.referenceType}: {m.referenceId}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-slate-300">{m.createdByName}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* =========================================================================
            TAB 5: LOCATIONS MANAGEMENT
           ========================================================================= */}
        {activeTab === 'locations' && (
          <section className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Store Inventory Locations</h2>
                <p className="text-xs text-slate-400">
                  Manage retail sales floor display shelves, backrooms, and storage warehouses
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingLocation(null);
                  setIsLocationModalOpen(true);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center space-x-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Storage Location</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {locations.map((loc) => (
                <div
                  key={loc.id}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-3 relative overflow-hidden"
                >
                  {loc.isDefault && (
                    <div className="absolute top-0 right-0 bg-indigo-600 text-[10px] font-bold text-white px-3 py-1 rounded-bl-xl uppercase tracking-wider">
                      Default POS Floor
                    </div>
                  )}

                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-indigo-400">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base">{loc.name}</h3>
                      <p className="font-mono text-xs text-slate-400">Code: {loc.code}</p>
                    </div>
                  </div>

                  {loc.description && <p className="text-xs text-slate-300">{loc.description}</p>}

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-slate-400">Total Items: </span>
                      <span className="font-bold text-white">{loc.totalItems || 0}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Total Units: </span>
                      <span className="font-bold text-emerald-400">
                        {Number(loc.totalQuantity || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-end space-x-2">
                    <button
                      onClick={() => {
                        setEditingLocation(loc);
                        setIsLocationModalOpen(true);
                      }}
                      className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* =========================================================================
            TAB 6: CATEGORIES, BRANDS & SUPPLIERS CLASSIFICATIONS
           ========================================================================= */}
        {activeTab === 'classifications' && (
          <section className="space-y-6">
            {/* Categories */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center space-x-2">
                    <Tag className="w-4 h-4 text-indigo-400" />
                    <span>Product Categories ({categories.length})</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Organize items for touchscreen category navigation
                  </p>
                </div>
                <button
                  onClick={() => {
                    setClassModalType('category');
                    setEditingClassItem(null);
                    setIsClassModalOpen(true);
                  }}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Category</span>
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {categories.map((c) => (
                  <div
                    key={c.id}
                    className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-2.5">
                      <div
                        className="w-4 h-4 rounded-full border border-white/20"
                        style={{ backgroundColor: c.color || '#4f46e5' }}
                      />
                      <div>
                        <p className="font-semibold text-white text-xs">{c.name}</p>
                        <p className="text-[10px] text-slate-400">{c.productCount || 0} Products</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setClassModalType('category');
                        setEditingClassItem(c);
                        setIsClassModalOpen(true);
                      }}
                      className="text-slate-400 hover:text-white p-1 text-xs rounded hover:bg-slate-800"
                      title="Edit Category"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Brands */}
            <div className="space-y-3 pt-4 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center space-x-2">
                    <Tag className="w-4 h-4 text-purple-400" />
                    <span>Brands ({brands.length})</span>
                  </h3>
                  <p className="text-xs text-slate-400">Manufacturers and trademarks</p>
                </div>
                <button
                  onClick={() => {
                    setClassModalType('brand');
                    setEditingClassItem(null);
                    setIsClassModalOpen(true);
                  }}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Brand</span>
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {brands.map((b) => (
                  <div
                    key={b.id}
                    className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between"
                  >
                    <div>
                      <p className="font-semibold text-white text-xs">{b.name}</p>
                      <p className="text-[10px] text-slate-400">{b.productCount || 0} Products</p>
                    </div>
                    <button
                      onClick={() => {
                        setClassModalType('brand');
                        setEditingClassItem(b);
                        setIsClassModalOpen(true);
                      }}
                      className="text-slate-400 hover:text-white p-1 text-xs rounded hover:bg-slate-800"
                      title="Edit Brand"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Suppliers */}
            <div className="space-y-3 pt-4 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center space-x-2">
                    <Building2 className="w-4 h-4 text-emerald-400" />
                    <span>Suppliers &amp; Distributors ({suppliers.length})</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Vendor contacts and replenishment sources
                  </p>
                </div>
                <button
                  onClick={() => {
                    setClassModalType('supplier');
                    setEditingClassItem(null);
                    setIsClassModalOpen(true);
                  }}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Supplier</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {suppliers.map((s) => (
                  <div
                    key={s.id}
                    className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-white text-sm">{s.name}</h4>
                      <button
                        onClick={() => {
                          setClassModalType('supplier');
                          setEditingClassItem(s);
                          setIsClassModalOpen(true);
                        }}
                        className="text-slate-400 hover:text-white p-1 text-xs rounded hover:bg-slate-800"
                        title="Edit Supplier"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="text-xs text-slate-300 space-y-0.5">
                      {s.contactPerson && <p>&bull; Contact: {s.contactPerson}</p>}
                      {s.phone && <p>&bull; Phone: {s.phone}</p>}
                      {s.email && <p>&bull; Email: {s.email}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      {/* =========================================================================
          FAST BARCODE LOOKUP RESULT POPUP MODAL
         ========================================================================= */}
      {barcodeMatchResult && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-lg overflow-hidden p-6 space-y-4 text-slate-100 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Package className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-white text-base">Barcode Match Resolved</h3>
              </div>
              <button
                onClick={() => setBarcodeMatchResult(null)}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {barcodeMatchResult.matchType === 'VARIANT'
                  ? 'Product Variant'
                  : 'Standard Product'}
              </span>

              <h4 className="text-lg font-extrabold text-white">
                {barcodeMatchResult.matchType === 'VARIANT'
                  ? `${barcodeMatchResult.variant.product.name} - ${barcodeMatchResult.variant.name}`
                  : barcodeMatchResult.product.name}
              </h4>

              {barcodeMatchResult.product?.nameKhmer && (
                <p className="text-sm font-semibold text-indigo-300">
                  {barcodeMatchResult.product.nameKhmer}
                </p>
              )}

              <div className="grid grid-cols-2 gap-3 bg-slate-800/60 p-3 rounded-xl border border-slate-800 text-xs">
                <div>
                  <span className="text-slate-400">SKU:</span>
                  <span className="font-mono text-white block">
                    {barcodeMatchResult.matchType === 'VARIANT'
                      ? barcodeMatchResult.variant.sku
                      : barcodeMatchResult.product.sku}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Barcode:</span>
                  <span className="font-mono text-white block">
                    {barcodeMatchResult.matchType === 'VARIANT'
                      ? barcodeMatchResult.variant.barcode
                      : barcodeMatchResult.product.barcode}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Selling Price:</span>
                  <span className="font-bold text-emerald-400 block">
                    $
                    {(barcodeMatchResult.matchType === 'VARIANT'
                      ? barcodeMatchResult.variant.sellingPriceUSD
                      : barcodeMatchResult.product.sellingPriceUSD
                    ).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Total Stock:</span>
                  <span className="font-bold text-indigo-300 block">
                    {barcodeMatchResult.matchType === 'VARIANT'
                      ? barcodeMatchResult.variant.stockQuantity
                      : barcodeMatchResult.product.stockQuantity}{' '}
                    pcs
                  </span>
                </div>
              </div>

              {/* Per Location Inventory Breakdown */}
              <div className="space-y-1.5 pt-2">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Stock by Location
                </p>
                {(
                  (barcodeMatchResult.matchType === 'VARIANT'
                    ? barcodeMatchResult.variant.inventory
                    : barcodeMatchResult.product.inventory) || []
                ).map((inv: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-xs px-3 py-1.5 bg-slate-800/40 rounded-lg border border-slate-800"
                  >
                    <span className="inline-flex items-center gap-1 text-slate-300">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      <span>{inv.locationName}</span>
                    </span>
                    <span className="font-bold text-white">{inv.quantity} pcs</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-end space-x-2">
              <button
                onClick={() => {
                  setBarcodeMatchResult(null);
                  setIsAdjustmentModalOpen(true);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition"
              >
                Adjust Stock for this Item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product Modal */}
      <ProductModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        onSave={handleSaveProduct}
        product={editingProduct}
        categories={categories}
        brands={brands}
        suppliers={suppliers}
        locations={locations}
      />

      {/* Variant Modal */}
      <VariantModal
        isOpen={isVariantModalOpen}
        onClose={() => setIsVariantModalOpen(false)}
        onSave={handleSaveVariant}
        product={variantTargetProduct}
        variant={editingVariant}
        locations={locations}
      />

      {/* Stock Adjustment Modal */}
      <StockAdjustmentModal
        isOpen={isAdjustmentModalOpen}
        onClose={() => {
          setIsAdjustmentModalOpen(false);
          setAdjustmentStockItem(null);
        }}
        onAdjustSuccess={() => {
          showToast('Stock adjustment successfully executed & recorded to audit log');
          fetchProducts();
          fetchStockLevels();
          fetchMovements();
        }}
        products={products}
        locations={locations}
        initialStockItem={adjustmentStockItem}
      />

      {/* Stock Transfer Modal */}
      <StockTransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        onTransferSuccess={() => {
          showToast('Stock transfer successfully completed across locations');
          fetchProducts();
          fetchStockLevels();
          fetchMovements();
        }}
        products={products}
        locations={locations}
      />

      {/* Classification Modal */}
      <CategoryBrandSupplierModal
        isOpen={isClassModalOpen}
        onClose={() => setIsClassModalOpen(false)}
        type={classModalType}
        item={editingClassItem}
        onSaveSuccess={() => {
          showToast(`${classModalType} updated`);
          fetchClassifications();
          fetchProducts();
        }}
      />

      {/* Location Modal */}
      <LocationModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        location={editingLocation}
        storeId={locations[0]?.storeId || ''}
        onSaveSuccess={() => {
          showToast('Location saved');
          fetchClassifications();
          fetchStockLevels();
        }}
      />
    </div>
  );
}
