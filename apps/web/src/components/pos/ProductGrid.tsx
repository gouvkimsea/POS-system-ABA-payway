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
        className={`group bg-slate-900 rounded-lg border border-slate-800 hover:border-slate-700 hover:bg-slate-850 p-2.5 sm:p-3 flex flex-col justify-between transition-colors cursor-pointer select-none relative overflow-hidden ${
          isOutOfStock ? 'opacity-40 cursor-not-allowed bg-slate-950/60' : ''
        }`}
      >
        {/* Top Area: Image & Stock Badge */}
        <div className="relative w-full aspect-4/3 rounded-md bg-slate-950 overflow-hidden mb-2 border border-slate-800/80 flex items-center justify-center">
          {product.imageUrl && !hasImageError ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              loading="lazy"
              decoding="async"
              onError={() => onImageError(product.id)}
              className="w-full h-full object-cover"
            />
          ) : (
            <ShoppingBag className="w-8 h-8 text-slate-600" />
          )}

          {/* Stock Status Badge */}
          <div className="absolute top-1.5 left-1.5">
            {isOutOfStock ? (
              <span className="bg-rose-950 text-rose-300 border border-rose-800 text-[10px] font-semibold px-1.5 py-0.5 rounded shadow-xs">
                Out of Stock
              </span>
            ) : isLowStock ? (
              <span className="bg-amber-950 text-amber-300 border border-amber-800 text-[10px] font-semibold px-1.5 py-0.5 rounded shadow-xs">
                {product.stockQuantity} left
              </span>
            ) : (
              <span className="bg-slate-950/90 text-slate-300 border border-slate-700/80 text-[10px] font-medium px-1.5 py-0.5 rounded shadow-xs">
                {product.stockQuantity} in stock
              </span>
            )}
          </div>
        </div>

        {/* Middle Area: Title & SKU */}
        <div className="flex-1 min-h-[38px] mb-2">
          <h4 className="text-xs sm:text-[13px] font-semibold text-slate-100 line-clamp-2 leading-snug group-hover:text-white transition-colors">
            {product.name}
          </h4>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">{product.sku}</div>
        </div>

        {/* Bottom Area: Price & Quick Add Button */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <div>
            <div className="text-sm sm:text-base font-bold text-emerald-400 font-mono tracking-tight leading-none">
              {formatCurrency(product.sellingPriceUSD, 'USD')}
            </div>
            <div className="text-[10px] font-medium text-slate-400 font-mono mt-0.5">
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
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors border ${
              isOutOfStock
                ? 'bg-slate-950 text-slate-600 border-slate-800'
                : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-emerald-600 hover:text-white hover:border-emerald-500 shadow-xs'
            }`}
            title="Add to cart"
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
    errorMessage = 'Could not load products. Please check your connection.',
    onRetry,
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
              className="bg-slate-900 rounded-lg border border-slate-800 p-3 flex flex-col justify-between animate-pulse h-48"
            >
              <div className="w-full h-24 bg-slate-800/80 rounded-md mb-2" />
              <div className="space-y-1.5">
                <div className="h-3.5 bg-slate-800 rounded w-4/5" />
                <div className="h-2.5 bg-slate-800 rounded w-1/2" />
              </div>
              <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-800">
                <div className="h-4 bg-slate-800 rounded w-16" />
                <div className="w-7 h-7 bg-slate-800 rounded-md" />
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
          <div className="w-12 h-12 rounded-lg bg-rose-950/60 border border-rose-800/80 text-rose-400 flex items-center justify-center mb-3">
            <Package className="w-6 h-6" />
          </div>
          <h3 className="font-semibold text-slate-100 text-sm mb-1">Failed to load catalog products</h3>
          <p className="text-xs text-slate-400 max-w-sm mb-4">
            {errorMessage}
          </p>
          <button
            onClick={onRetry}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition-colors"
          >
            Retry Loading
          </button>
        </div>
      );
    }

    // Empty State
    if (products.length === 0) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-12 h-12 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 flex items-center justify-center mb-3">
            <Package className="w-6 h-6" />
          </div>
          <h3 className="font-semibold text-slate-100 text-sm mb-1">No products found</h3>
          <p className="text-xs text-slate-400 max-w-xs mb-4">
            No items matched the active search keywords or category filter.
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
        <div className="flex-1 overflow-y-auto p-2 pb-32 sm:pb-36 lg:pb-6 touch-scroll">
          <div className="bg-slate-900 border border-slate-800 divide-y divide-slate-800 rounded-lg overflow-hidden">
            {displayedProducts.map((product) => {
              const isOutOfStock = product.trackInventory && product.stockQuantity <= 0;
              return (
                <div
                  key={product.id}
                  onClick={() => !isOutOfStock && onAddToCart(product)}
                  className={`p-2.5 flex items-center justify-between gap-3 hover:bg-slate-800/60 transition-colors cursor-pointer select-none ${
                    isOutOfStock ? 'opacity-40 cursor-not-allowed' : 'active:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-md bg-slate-950 shrink-0 overflow-hidden border border-slate-800 flex items-center justify-center">
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
                        <ShoppingBag className="w-4 h-4 text-slate-600" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-100 truncate">
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
                      <div className="text-xs sm:text-sm font-bold text-emerald-400 font-mono">
                        {formatCurrency(product.sellingPriceUSD, 'USD')}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {isOutOfStock ? (
                          <span className="text-rose-400 font-medium">Out of Stock</span>
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
                      className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-300 border border-slate-700 flex items-center justify-center transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {hasMore && (
            <div className="p-3 text-center">
              <button
                type="button"
                onClick={() => setVisibleCount((prev) => prev + 60)}
                className="text-xs font-semibold text-emerald-400 hover:text-white bg-slate-900 border border-slate-800 hover:bg-slate-800 px-4 py-2 rounded-lg transition-colors"
              >
                Load more products ({products.length - visibleCount} remaining)
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
              className="text-xs font-semibold text-emerald-400 hover:text-white bg-slate-900 border border-slate-800 hover:bg-slate-800 px-5 py-2 rounded-lg transition-colors"
            >
              Load more products ({products.length - visibleCount} remaining)
            </button>
          </div>
        )}
      </div>
    );
  },
);
ProductGrid.displayName = 'ProductGrid';
