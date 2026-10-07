'use client';

import React, { useState, useMemo } from 'react';
import { Search, Barcode, X, Layers, AlertCircle } from 'lucide-react';
import { Product, Category, Currency } from '../lib/types';

interface ProductCatalogProps {
  products: Product[];
  categories: Category[];
  selectedCategory: string | null;
  onSelectCategory: (id: string | null) => void;
  onAddToCart: (product: Product) => void;
  currency: Currency;
  onManualBarcodeScan: (barcode: string) => void;
}

export const ProductCatalog: React.FC<ProductCatalogProps> = ({
  products,
  categories,
  selectedCategory,
  onSelectCategory,
  onAddToCart,
  currency,
  onManualBarcodeScan,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesCategory = !selectedCategory || p.category?.id === selectedCategory;
      const matchesSearch =
        !searchTerm.trim() ||
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.barcode && p.barcode.includes(searchTerm));

      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategory, searchTerm]);

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (barcodeInput.trim()) {
      onManualBarcodeScan(barcodeInput.trim());
      setBarcodeInput('');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-100 overflow-hidden select-none">
      {/* Top Search & Barcode Quick Inputs */}
      <div className="p-3 bg-white border-b border-slate-200 flex flex-col sm:flex-row gap-2 shrink-0 shadow-sm">
        {/* Product Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            id="product-search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search products by name or SKU... (F1)"
            className="w-full pl-9 pr-8 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-slate-50 focus:bg-white transition"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Barcode Quick Entry */}
        <form onSubmit={handleBarcodeSubmit} className="relative sm:w-64">
          <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            id="barcode-scan-input"
            value={barcodeInput}
            onChange={(e) => setBarcodeInput(e.target.value)}
            placeholder="Scan or Enter barcode (F2)"
            className="w-full pl-9 pr-14 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-mono bg-slate-50 focus:bg-white transition"
          />
          <button
            type="submit"
            className="absolute right-1 top-1 bottom-1 px-2.5 bg-blue-600 text-white rounded text-xs font-semibold hover:bg-blue-700 transition"
          >
            Enter
          </button>
        </form>
      </div>

      {/* Categories Horizontal Scrolling Filter */}
      <div className="bg-white border-b border-slate-200 px-3 py-2 flex items-center space-x-2 overflow-x-auto shrink-0 scrollbar-none">
        <button
          onClick={() => onSelectCategory(null)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition flex items-center space-x-1.5 ${
            selectedCategory === null
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>All Products ({products.length})</span>
        </button>

        {categories.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition flex items-center space-x-1.5 ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full inline-block"
                style={{ backgroundColor: cat.color || '#3b82f6' }}
              ></span>
              <span>{cat.name}</span>
            </button>
          );
        })}
      </div>

      {/* Product Grid */}
      <div className="flex-1 overflow-y-auto p-3">
        {filteredProducts.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8">
            <AlertCircle className="w-12 h-12 mb-2 stroke-1" />
            <p className="text-base font-semibold text-slate-600">No products found</p>
            <p className="text-xs text-slate-400 mt-1">Try adjusting your search or category filter</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
            {filteredProducts.map((product) => {
              const isOutOfStock = product.stockQuantity <= 0;

              return (
                <button
                  key={product.id}
                  onClick={() => onAddToCart(product)}
                  disabled={isOutOfStock}
                  className={`bg-white border rounded-xl p-3 flex flex-col justify-between text-left transition relative active:scale-[0.98] shadow-sm hover:shadow hover:border-blue-400 ${
                    isOutOfStock ? 'opacity-60 bg-slate-50 cursor-not-allowed' : 'cursor-pointer'
                  }`}
                >
                  <div>
                    {/* Top Badges: Category & Stock */}
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span className="text-[10px] font-semibold text-slate-500 truncate max-w-[80px]">
                        {product.category?.name || 'General'}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
                          isOutOfStock
                            ? 'bg-red-100 text-red-700'
                            : product.isLowStock
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {isOutOfStock ? 'Out of stock' : `${product.stockQuantity} ${product.unit}`}
                      </span>
                    </div>

                    {/* Product Name */}
                    <h3 className="font-semibold text-slate-800 text-xs sm:text-sm line-clamp-2 leading-snug">
                      {product.name}
                    </h3>
                  </div>

                  {/* Prices in USD and KHR */}
                  <div className="mt-3 pt-2 border-t border-slate-100">
                    <div className="flex items-baseline justify-between">
                      <span className="font-bold text-slate-900 text-sm sm:text-base font-mono">
                        ${product.sellingPriceUSD.toFixed(2)}
                      </span>
                      <span className="text-xs font-semibold text-slate-500 font-mono">
                        {product.sellingPriceKHR.toLocaleString()} ៛
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
