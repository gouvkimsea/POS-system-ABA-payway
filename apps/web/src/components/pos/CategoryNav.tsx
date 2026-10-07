'use client';

import React, { useRef } from 'react';
import { PosCategory } from '@pos/types';
import { ChevronLeft, ChevronRight, Layers } from 'lucide-react';

interface CategoryNavProps {
  categories: PosCategory[];
  selectedCategoryId: string;
  totalProductsCount: number;
  onSelectCategory: (categoryId: string) => void;
}

export const CategoryNav: React.FC<CategoryNavProps> = ({
  categories,
  selectedCategoryId,
  totalProductsCount,
  onSelectCategory,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -160, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 160, behavior: 'smooth' });
    }
  };

  return (
    <div className="relative flex items-center bg-white border-b border-slate-200 px-2 py-2 shrink-0">
      {/* Scroll Left Button */}
      <button
        onClick={scrollLeft}
        className="hidden md:flex w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 items-center justify-center shrink-0 mr-1 shadow-xs transition-colors"
        aria-label="Scroll categories left"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {/* Categories Scrollable Container */}
      <div
        ref={scrollContainerRef}
        className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth flex-1 py-0.5 px-0.5"
      >
        {/* All Items Pill */}
        <button
          onClick={() => onSelectCategory('all')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
            selectedCategoryId === 'all'
              ? 'bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-600/20'
              : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>All Items</span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              selectedCategoryId === 'all'
                ? 'bg-indigo-800 text-indigo-100'
                : 'bg-slate-200 text-slate-600'
            }`}
          >
            {totalProductsCount}
          </span>
        </button>

        {/* Individual Categories */}
        {categories.map((cat) => {
          const isSelected = selectedCategoryId === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                isSelected
                  ? 'bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-600/20'
                  : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700'
              }`}
            >
              {cat.color && (
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: isSelected ? '#ffffff' : cat.color }}
                />
              )}
              <span>{cat.name}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  isSelected ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {cat.productCount}
              </span>
            </button>
          );
        })}
      </div>

      {/* Scroll Right Button */}
      <button
        onClick={scrollRight}
        className="hidden md:flex w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 items-center justify-center shrink-0 ml-1 shadow-xs transition-colors"
        aria-label="Scroll categories right"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
};
