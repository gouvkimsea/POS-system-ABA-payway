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
    <div className="bg-slate-900 border-b border-slate-800 p-2.5 sm:p-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
      {/* Search Input (F1) */}
      <div className="relative flex-1">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
          <Search className="w-4 h-4" />
        </div>
        <input
          ref={searchInputRef}
          type="text"
          inputMode="search"
          enterKeyHint="search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by name or SKU (F1)"
          className="w-full pl-9 pr-8 py-2 min-h-[42px] sm:min-h-[38px] bg-slate-950 border border-slate-800 rounded-lg text-base sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors font-medium"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-500 hover:text-slate-300"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Barcode Scanner Input (F2) & Camera Trigger */}
      <div className="flex items-center gap-1.5 flex-1 sm:max-w-[320px]">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
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
            placeholder="Scan barcode (F2)"
            className="w-full pl-9 pr-14 py-2 min-h-[42px] sm:min-h-[38px] bg-slate-950 border border-slate-700/80 rounded-lg text-base sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors font-mono font-medium"
          />
          <div className="absolute inset-y-0 right-1 flex items-center">
            <span className="text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700 font-semibold px-1.5 py-0.5 rounded mr-1">
              ↵ Enter
            </span>
          </div>
        </div>

        {onOpenCameraScanner && (
          <button
            type="button"
            onClick={onOpenCameraScanner}
            className="p-2 sm:p-2 min-h-[40px] min-w-[40px] bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg transition-colors shrink-0 flex items-center justify-center active:bg-slate-600"
            title="Scan barcode with camera"
            aria-label="Scan barcode with camera"
          >
            <Camera className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* View Toggle (Grid vs List) */}
      <div className="hidden md:flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 shrink-0">
        <button
          onClick={() => onToggleViewMode('grid')}
          className={`p-1.5 rounded-md transition-colors ${
            viewMode === 'grid'
              ? 'bg-slate-800 text-emerald-400 shadow-xs'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Grid View"
        >
          <LayoutGrid className="w-4 h-4" />
        </button>
        <button
          onClick={() => onToggleViewMode('list')}
          className={`p-1.5 rounded-md transition-colors ${
            viewMode === 'list'
              ? 'bg-slate-800 text-emerald-400 shadow-xs'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="List view"
        >
          <List className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
