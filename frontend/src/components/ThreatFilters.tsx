'use client';

import React from 'react';
import { ThreatCategory } from '@/types/threats';
import { Search, SlidersHorizontal, RefreshCw } from 'lucide-react';

interface ThreatFiltersProps {
  activeCategory: ThreatCategory;
  setActiveCategory: (cat: ThreatCategory) => void;
  minSeverity: number;
  setMinSeverity: (val: number) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

const CATEGORIES: { id: ThreatCategory; label: string }[] = [
  { id: 'ALL', label: 'ALL THREATS' },
  { id: 'SPACE_WEATHER', label: 'SPACE / SOLAR' },
  { id: 'ASTEROID', label: 'ASTEROIDS' },
  { id: 'EARTHQUAKE', label: 'EARTHQUAKES' },
  { id: 'TERRESTRIAL_WEATHER', label: 'ATMOSPHERIC' },
  { id: 'STOCK_MARKET', label: 'MARKET CRASH' },
];

export default function ThreatFilters({
  activeCategory,
  setActiveCategory,
  minSeverity,
  setMinSeverity,
  searchQuery,
  setSearchQuery,
  onRefresh,
  isRefreshing,
}: ThreatFiltersProps) {
  return (
    <div className="bg-surface-card border border-surface-border rounded-xl p-4 font-mono space-y-4">
      {/* Category Pills & Refresh Button */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                  isActive
                    ? 'bg-pink text-white shadow-pink-glow-sm'
                    : 'bg-surface hover:bg-pink/10 hover:text-pink text-slate-400 border border-surface-border'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-surface hover:bg-pink/20 border border-surface-border hover:border-pink/50 text-pink text-xs font-bold rounded-lg transition disabled:opacity-50"
          title="Query telemetry updates"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>SYNC TELEMETRY</span>
        </button>
      </div>

      {/* Search and Severity Slider */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-surface-border">
        {/* Search Bar */}
        <div className="md:col-span-2 relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 transform -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search hazard title, drink prescription, or telemetry keywords..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-surface border border-surface-border rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink"
          />
        </div>

        {/* Severity Range Slider */}
        <div className="flex items-center gap-3 bg-surface px-3 py-2 rounded-lg border border-surface-border">
          <SlidersHorizontal className="w-4 h-4 text-pink shrink-0" />
          <div className="flex-1 flex flex-col justify-center">
            <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
              <span>MIN SEVERITY</span>
              <span className="text-pink font-bold">{minSeverity.toFixed(1)} / 10.0</span>
            </div>
            <input
              type="range"
              min="0"
              max="10"
              step="0.5"
              value={minSeverity}
              onChange={(e) => setMinSeverity(parseFloat(e.target.value))}
              className="w-full accent-[#FF007F] cursor-pointer h-1.5 bg-surface-border rounded-lg"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
