'use client';

import React from 'react';
import { MapPin, Wine, Sun, Moon } from 'lucide-react';
import { UserLocation } from '@/types/threats';

interface HeaderProps {
  userLocation: UserLocation;
  setUserLocation: (loc: UserLocation) => void;
  isDark: boolean;
  toggleTheme: () => void;
}

export default function Header({
  userLocation,
  isDark,
  toggleTheme,
}: HeaderProps) {
  return (
    <header className={`border-b backdrop-blur sticky top-0 z-40 transition-colors ${
      isDark
        ? 'border-[#282a33] bg-[#121316]/95 text-white'
        : 'border-slate-200 bg-white/95 text-slate-900 shadow-sm'
    }`}>
      <div className="max-w-6xl mx-auto px-4 py-3.5 flex flex-wrap items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[#FF007F]/10 border border-[#FF007F]/25 text-[#FF007F] flex items-center justify-center">
            <Wine className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className={`text-lg font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                BSL-4
              </h1>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#FF007F]/15 text-[#FF007F] border border-[#FF007F]/30">
                Pairings
              </span>
            </div>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Global Telemetry & Curated Drink Recommendations
            </p>
          </div>
        </div>

        {/* Controls: Active Location Badge, Theme Toggle */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Active location indicator */}
          {userLocation.cityName && (
            <div className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border ${
              isDark ? 'text-slate-300 bg-[#16171c] border-[#282a33]' : 'text-slate-700 bg-slate-50 border-slate-200'
            }`}>
              <MapPin className="w-3.5 h-3.5 text-[#FF007F] shrink-0" />
              <span className="truncate max-w-[180px] sm:max-w-[240px]">
                {userLocation.cityName.split(',')[0]}
              </span>
            </div>
          )}

          {/* Theme Toggle (Light / Dark) */}
          <button
            onClick={toggleTheme}
            className={`p-2 rounded-lg border transition-colors flex items-center justify-center ${
              isDark
                ? 'bg-[#16171c] hover:bg-[#20222a] border-[#282a33] text-amber-400'
                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
            }`}
            title={isDark ? 'Switch to Bright/Light Theme' : 'Switch to Dark Theme'}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4 text-slate-700" />}
          </button>
        </div>
      </div>
    </header>
  );
}
