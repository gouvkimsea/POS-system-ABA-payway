'use client';

import React from 'react';
import { Search, Barcode, LayoutGrid, List, X, Camera } from 'lucide-react';

interface ProductSearchBarcodeProps {
  searchQuery: string;
  barcodeQuery: string;
  onSearchChange: (query: string) => void;
  onBarcodeChange: (code: string) => void;
  onBarcodeSubmit: (code: string) => void;
  viewMode: 'grid' | 'list';
  onToggleViewMode: (mode: 'grid' | 'list') => void;
  searchInputRef: React.RefObject<HTMLInputElement>;
  barcodeInputRef: React.RefObject<HTMLInputElement>;
  onOpenCameraScanner?: () => void;
}

export const ProductSearchBarcode: React.FC<ProductSearchBarcodeProps> = ({
  searchQuery,
  barcodeQuery,
  onSearchChange,
  onBarcodeChange,
  onBarcodeSubmit,
  viewMode,
  onToggleViewMode,
  searchInputRef,
  barcodeInputRef,
  onOpenCameraScanner,
}) => {
  const handleBarcodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = barcodeQuery.trim();
      if (trimmed) {
        onBarcodeSubmit(trimmed);
      }
    }
  };

  return (
    <div className="bg-white border-b border-slate-200 p-2.5 sm:p-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
      {/* Search Input (F1) */}
      <div className="relative flex-1">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
          <Search className="w-4 h-4" />
        </div>
        <input
          ref={searchInputRef}
          type="text"
          inputMode="search"
          enterKeyHint="search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search product name or SKU... (F1)"
          className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Barcode Scanner Input (F2) & Camera Trigger */}
      <div className="flex items-center gap-1.5 flex-1 sm:max-w-[320px]">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-indigo-500">
            <Barcode className="w-4 h-4" />
          </div>
          <input
            ref={barcodeInputRef}
            type="text"
            inputMode="numeric"
            enterKeyHint="go"
            value={barcodeQuery}
            onChange={(e) => onBarcodeChange(e.target.value)}
            onKeyDown={handleBarcodeKeyDown}
            placeholder="Scan barcode... (F2)"
            className="w-full pl-9 pr-14 py-2 bg-indigo-50/50 border border-indigo-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 transition-all font-mono font-medium"
          />
          <div className="absolute inset-y-0 right-1 flex items-center">
            <span className="text-[10px] font-mono bg-indigo-100 text-indigo-700 font-bold px-1.5 py-0.5 rounded mr-1">
              ↵ Enter
            </span>
          </div>
        </div>

        {onOpenCameraScanner && (
          <button
            type="button"
            onClick={onOpenCameraScanner}
            className="p-2 sm:p-2 min-h-[40px] min-w-[40px] bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 rounded-xl transition-colors shrink-0 flex items-center justify-center active:scale-95"
            title="Open Camera Barcode Scanner"
            aria-label="Scan barcode with camera"
          >
            <Camera className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* View Toggle (Grid vs List) */}
      <div className="hidden md:flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 shrink-0">
        <button
          onClick={() => onToggleViewMode('grid')}
          className={`p-1.5 rounded-lg transition-colors ${
            viewMode === 'grid'
              ? 'bg-white text-indigo-600 shadow-xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
          title="Grid View"
        >
          <LayoutGrid className="w-4 h-4" />
        </button>
        <button
          onClick={() => onToggleViewMode('list')}
          className={`p-1.5 rounded-lg transition-colors ${
            viewMode === 'list'
              ? 'bg-white text-indigo-600 shadow-xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
          title="Compact List View"
        >
          <List className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
