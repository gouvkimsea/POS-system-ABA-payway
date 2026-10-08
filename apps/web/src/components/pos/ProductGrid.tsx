'use client';

import React, { useState, memo, useCallback } from 'react';
import { PosProduct } from '@pos/types';
import { Plus, Package, ShoppingBag } from 'lucide-react';
import { useSettings } from '../../lib/settings-context';

interface ProductGridProps {
  products: PosProduct[];
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  onRetry: () => void;
  onAddToCart: (product: PosProduct) => void;
  viewMode: 'grid' | 'list';
}

interface ProductCardProps {
  product: PosProduct;
  onAddToCart: (product: PosProduct) => void;
  hasImageError: boolean;
  onImageError: (id: string) => void;
}

/**
 * High-Performance Memoized Product Card
 * Prevents re-rendering untouched product tiles when cart or active items change
 */
const ProductCard = memo<ProductCardProps>(
  ({ product, onAddToCart, hasImageError, onImageError }) => {
    const { settings, formatCurrency } = useSettings();
    const isOutOfStock = product.trackInventory && product.stockQuantity <= 0;
    const lowStockThreshold =
      settings.store?.inventory?.defaultLowStockAlert ?? product.alertLowStock ?? 10;
    const isLowStock =
      product.trackInventory &&
      product.stockQuantity > 0 &&
      product.stockQuantity <= lowStockThreshold;

    return (
      <div
        onClick={() => !isOutOfStock && onAddToCart(product)}
        className={`group bg-white rounded-2xl border border-slate-200/90 hover:border-indigo-400 p-2.5 sm:p-3 flex flex-col justify-between transition-all duration-150 shadow-xs hover:shadow-md cursor-pointer select-none relative overflow-hidden ${
          isOutOfStock ? 'opacity-55 cursor-not-allowed bg-slate-50' : 'active:scale-[0.98]'
        }`}
      >
        {/* Top Area: Image & Stock Badge */}
        <div className="relative w-full aspect-4/3 rounded-xl bg-slate-100 overflow-hidden mb-2 border border-slate-100 flex items-center justify-center">
          {product.imageUrl && !hasImageError ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              loading="lazy"
              decoding="async"
              onError={() => onImageError(product.id)}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            />
          ) : (
            <ShoppingBag className="w-8 h-8 text-slate-300" />
          )}

          {/* Stock Status Badge */}
          <div className="absolute top-1.5 left-1.5">
            {isOutOfStock ? (
              <span className="bg-rose-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-xs">
                Out of Stock
              </span>
            ) : isLowStock ? (
              <span className="bg-amber-500 text-slate-950 text-[10px] font-bold px-1.5 py-0.5 rounded shadow-xs">
                {product.stockQuantity} left
              </span>
            ) : (
              <span className="bg-emerald-600/90 text-white text-[10px] font-medium px-1.5 py-0.5 rounded shadow-xs">
                {product.stockQuantity} in stock
              </span>
            )}
          </div>
        </div>

        {/* Middle Area: Title & SKU */}
        <div className="flex-1 min-h-[38px] mb-2">
          <h4 className="text-xs sm:text-[13px] font-semibold text-slate-800 line-clamp-2 leading-snug group-hover:text-indigo-600 transition-colors">
            {product.name}
          </h4>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">{product.sku}</div>
        </div>

        {/* Bottom Area: Price & Quick Add Button */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <div>
            <div className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight leading-none">
              {formatCurrency(product.sellingPriceUSD, 'USD')}
            </div>
            <div className="text-[10px] font-medium text-slate-400 mt-0.5">
              {formatCurrency(product.sellingPriceKHR, 'KHR')}
            </div>
          </div>

          <button
            type="button"
            disabled={isOutOfStock}
            onClick={(e) => {
              e.stopPropagation();
              onAddToCart(product);
            }}
            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
              isOutOfStock
                ? 'bg-slate-100 text-slate-400'
                : 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white shadow-xs'
            }`}
            title="Quick Add to Cart"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  },
);
ProductCard.displayName = 'ProductCard';

export const ProductGrid: React.FC<ProductGridProps> = memo(
  ({
    products,
    isLoading,
    isError,
    errorMessage: _errorMessage,
    onRetry: _onRetry,
    onAddToCart,
    viewMode,
  }) => {
    const { formatCurrency } = useSettings();
    const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
    const [visibleCount, setVisibleCount] = useState<number>(80);

    const handleImageError = useCallback((id: string) => {
      setFailedImages((prev) => ({ ...prev, [id]: true }));
    }, []);

    // Loading Skeleton State
    if (isLoading) {
      return (
        <div className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5 sm:gap-3 overflow-y-auto flex-1">
          {Array.from({ length: 10 }).map((_, idx) => (
            <div
              key={idx}
              className="bg-white rounded-2xl border border-slate-200 p-3 flex flex-col justify-between animate-pulse h-48"
            >
              <div className="w-full h-24 bg-slate-100 rounded-xl mb-2" />
              <div className="space-y-1.5">
                <div className="h-3.5 bg-slate-100 rounded w-4/5" />
                <div className="h-2.5 bg-slate-100 rounded w-1/2" />
              </div>
              <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-100">
                <div className="h-4 bg-slate-100 rounded w-16" />
                <div className="w-7 h-7 bg-slate-100 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      );
    }

    // Error State
    if (isError) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-3">
            <Package className="w-7 h-7" />
          </div>
          <h3 className="font-bold text-slate-800 text-sm mb-1">Failed to Load Catalog</h3>
          <p className="text-xs text-slate-500 max-w-xs mb-3">
            Unable to synchronize products. Please check network connection.
          </p>
        </div>
      );
    }

    // Empty State
    if (products.length === 0) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
            <Package className="w-7 h-7" />
          </div>
          <h3 className="font-bold text-slate-700 text-sm mb-1">No Matching Products</h3>
          <p className="text-xs text-slate-400 max-w-xs mb-3">
            Try searching with another keyword, clearing the category filter, or scanning a valid
            barcode.
          </p>
        </div>
      );
    }

    // Progressive rendering window: limit initial DOM nodes for large 10,000+ catalogs
    const displayedProducts = products.slice(0, visibleCount);
    const hasMore = products.length > visibleCount;

    // Compact List View
    if (viewMode === 'list') {
      return (
        <div className="flex-1 overflow-y-auto p-2 divide-y divide-slate-100 bg-white pb-32 sm:pb-36 lg:pb-6 touch-scroll">
          {displayedProducts.map((product) => {
            const isOutOfStock = product.trackInventory && product.stockQuantity <= 0;
            return (
              <div
                key={product.id}
                onClick={() => !isOutOfStock && onAddToCart(product)}
                className={`p-2.5 flex items-center justify-between gap-3 hover:bg-indigo-50/40 rounded-xl transition-colors cursor-pointer select-none ${
                  isOutOfStock ? 'opacity-50 cursor-not-allowed' : 'active:bg-indigo-100/50'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-lg bg-slate-100 shrink-0 overflow-hidden border border-slate-200 flex items-center justify-center">
                    {product.imageUrl && !failedImages[product.id] ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        loading="lazy"
                        decoding="async"
                        onError={() => handleImageError(product.id)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ShoppingBag className="w-5 h-5 text-slate-300" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-800 truncate">
                      {product.name}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {product.sku}
                      {product.barcode && ` • ${product.barcode}`}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className="text-xs sm:text-sm font-extrabold text-slate-900">
                      {formatCurrency(product.sellingPriceUSD, 'USD')}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {isOutOfStock ? (
                        <span className="text-rose-500 font-medium">Out of Stock</span>
                      ) : (
                        `${product.stockQuantity} in stock`
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isOutOfStock}
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddToCart(product);
                    }}
                    className="w-8 h-8 rounded-lg bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-600 flex items-center justify-center transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}

          {hasMore && (
            <div className="p-3 text-center">
              <button
                type="button"
                onClick={() => setVisibleCount((prev) => prev + 60)}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-4 py-2 rounded-xl"
              >
                Load More Products ({products.length - visibleCount} remaining)
              </button>
            </div>
          )}
        </div>
      );
    }

    // Standard Touch Grid View
    return (
      <div className="flex-1 overflow-y-auto p-2.5 sm:p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5 sm:gap-3 content-start pb-32 sm:pb-36 lg:pb-6 touch-scroll">
        {displayedProducts.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            onAddToCart={onAddToCart}
            hasImageError={Boolean(failedImages[product.id])}
            onImageError={handleImageError}
          />
        ))}

        {hasMore && (
          <div className="col-span-full py-4 text-center">
            <button
              type="button"
              onClick={() => setVisibleCount((prev) => prev + 60)}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-5 py-2.5 rounded-xl transition-all shadow-xs"
            >
              Load More Products ({products.length - visibleCount} remaining)
            </button>
          </div>
        )}
      </div>
    );
  },
);
ProductGrid.displayName = 'ProductGrid';
