'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MapPin, Sun, Moon, ExternalLink } from 'lucide-react';
import { UserLocation } from '@/types/threats';

const GithubIcon = ({ className = 'w-3.5 h-3.5' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

interface HeaderProps {
  userLocation?: UserLocation;
  setUserLocation?: (loc: UserLocation) => void;
  isDark: boolean;
  toggleTheme: () => void;
}

export default function Header({
  userLocation,
  isDark,
  toggleTheme,
}: HeaderProps) {
  const pathname = usePathname();
  const isHome = pathname === '/' || pathname === '';
  const isApi = pathname === '/data-access' || pathname?.startsWith('/data-access');

  return (
    <header className={`border-b transition-colors ${
      isDark
        ? 'border-[#232733] bg-[#12141a] text-white'
        : 'border-slate-200 bg-white text-slate-900 shadow-sm'
    }`}>
      <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Left: Brand & Headline (Clickable to Home) */}
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="px-2.5 py-1 rounded-lg bg-[#FF007F]/10 border border-[#FF007F]/25 hover:border-[#FF007F]/60 text-[#FF007F] font-black text-xs tracking-wider font-mono flex items-center justify-center transition cursor-pointer"
            title="Return to BSL-4 Home Dashboard"
          >
            BSL-4
          </Link>
          <div className="flex items-center">
            <span className={`text-xs sm:text-sm font-bold tracking-wide uppercase font-mono px-2.5 py-1 rounded-md border ${
              isDark 
                ? 'bg-[#181a22] border-[#2c3040] text-slate-200' 
                : 'bg-slate-100 border-slate-200 text-slate-800'
            }`}>
              THE WORLD IS ENDING... BUT IS IT REALLY?
            </span>
          </div>
        </div>

        {/* Right Controls: Navigation Tabs, Location Pin, GitHub Link, Theme Toggle */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Navigation Tabs (Home & REST API) */}
          <nav className="flex items-center gap-1.5 font-mono text-xs">
            <Link
              href="/"
              className={`px-3 py-1.5 rounded-lg border font-semibold transition ${
                isHome
                  ? isDark
                    ? 'bg-[#232733] text-white border-[#3a4155]'
                    : 'bg-slate-200 text-slate-900 border-slate-300'
                  : isDark
                  ? 'bg-[#181a22] hover:bg-[#222530] border-[#2c3040] text-slate-400 hover:text-slate-200'
                  : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900'
              }`}
              title="Return to Home Dashboard"
            >
              Home
            </Link>

            <Link
              href="/data-access"
              className={`px-3 py-1.5 rounded-lg border font-semibold transition ${
                isApi
                  ? isDark
                    ? 'bg-[#232733] text-white border-[#3a4155]'
                    : 'bg-slate-200 text-slate-900 border-slate-300'
                  : isDark
                  ? 'bg-[#181a22] hover:bg-[#222530] border-[#2c3040] text-slate-400 hover:text-slate-200'
                  : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900'
              }`}
              title="Explore RESTful API & Data Feeds"
            >
              REST API
            </Link>
          </nav>

          {/* Active location indicator - shown only on dashboard where map/proximity is relevant */}
          {!isApi && userLocation?.cityName && (
            <div className={`hidden md:flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border font-mono ${
              isDark ? 'text-slate-300 bg-[#181a22] border-[#2c3040]' : 'text-slate-700 bg-slate-50 border-slate-200'
            }`}>
              <MapPin className="w-3.5 h-3.5 text-[#FF007F] shrink-0" />
              <span className="truncate max-w-[170px]">
                {userLocation.cityName.split(',')[0]}
              </span>
            </div>
          )}

          {/* GitHub Source Link */}
          <a
            href="https://github.com/matteus8/bsl-4/tree/main"
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold font-mono transition ${
              isDark
                ? 'bg-[#181a22] hover:bg-[#222530] border-[#2c3040] text-slate-200 hover:text-white'
                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 hover:text-slate-900'
            }`}
            title="View source code on GitHub"
          >
            <GithubIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">GitHub</span>
            <ExternalLink className="w-3 h-3 text-slate-500" />
          </a>

          {/* Theme Toggle (Light / Dark) */}
          <button
            onClick={toggleTheme}
            className={`p-2 rounded-lg border transition-colors flex items-center justify-center ${
              isDark
                ? 'bg-[#181a22] hover:bg-[#222530] border-[#2c3040] text-amber-400'
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
