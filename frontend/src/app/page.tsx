'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Header from '@/components/Header';
import TacticalRadarMap from '@/components/TacticalRadarMap';
import EventTable from '@/components/ThreatCard';
import EventDetailModal from '@/components/EventDetailModal';
import CocktailModal, { AmalgamatedCountermeasureData } from '@/components/CocktailModal';
import { ThreatRecord, ThreatCategory, UserLocation, DateRangePreset } from '@/types/threats';
import { fetchLatestThreats, triggerProtocolZeroRefresh } from '@/lib/api';
import { calculateDistanceKm } from '@/lib/geo';
import { Search, Compass, TrendingDown, Flame, Orbit, Sparkles, RefreshCw } from 'lucide-react';

const CATEGORIES: { id: ThreatCategory; label: string }[] = [
  { id: 'ALL', label: 'All Events' },
  { id: 'EARTHQUAKE', label: 'Earthquakes' },
  { id: 'SPACE_WEATHER', label: 'Space Weather' },
  { id: 'ASTEROID', label: 'Asteroids' },
  { id: 'TERRESTRIAL_WEATHER', label: 'Weather Alerts' },
  { id: 'STOCK_MARKET', label: 'Market Moves' },
];

export default function Dashboard() {
  const [threats, setThreats] = useState<ThreatRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedThreat, setSelectedThreat] = useState<ThreatRecord | null>(null);
  const [amalgamatedDrink, setAmalgamatedDrink] = useState<AmalgamatedCountermeasureData | null>(null);
  const [hoveredThreatId, setHoveredThreatId] = useState<number | string | null>(null);
  const [activeCategory, setActiveCategory] = useState<ThreatCategory>('ALL');
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('7D');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [sortBy, setSortBy] = useState<'NEWEST' | 'SEVERITY' | 'PROXIMITY' | 'OLDEST'>('PROXIMITY');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDark, setIsDark] = useState(true);

  const toggleTheme = () => setIsDark(!isDark);

  // User location for proximity calculations
  const [userLocation, setUserLocation] = useState<UserLocation>({
    latitude: 38.8339,
    longitude: -104.8214,
    cityName: 'Colorado Springs, CO, USA',
    isAutoDetected: false,
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchLatestThreats();
      setThreats(data);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await triggerProtocolZeroRefresh();
      await loadData();
    } catch (err) {
      console.error('Failed to sync telemetry:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    loadData();
    // Ingests / updates every 30 minutes (1,800,000 ms)
    const interval = setInterval(loadData, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Compute distances relative to userLocation
  const enrichedThreats = useMemo(() => {
    return threats.map((t) => {
      let distanceKm: number | undefined = undefined;
      try {
        const meta = typeof t.metadata === 'string' ? JSON.parse(t.metadata) : t.metadata;
        if (meta && typeof meta.latitude === 'number' && typeof meta.longitude === 'number') {
          distanceKm = calculateDistanceKm(
            userLocation.latitude,
            userLocation.longitude,
            meta.latitude,
            meta.longitude
          );
        } else if (meta && typeof meta.lat === 'number' && typeof meta.lon === 'number') {
          distanceKm = calculateDistanceKm(
            userLocation.latitude,
            userLocation.longitude,
            meta.lat,
            meta.lon
          );
        }
      } catch {
        // Ignored
      }
      return { ...t, distanceKm };
    });
  }, [threats, userLocation]);

  // Filtered threats based on category, date range, search query, and sorting
  const filteredThreats = useMemo(() => {
    const now = Date.now();

    const filtered = enrichedThreats.filter((t) => {
      // 1. Category filter
      if (activeCategory !== 'ALL' && t.threatType !== activeCategory) {
        return false;
      }

      // 2. Date Range filter
      const eventTime = new Date(t.recordedAt).getTime();
      if (dateRangePreset === '24H') {
        if (now - eventTime > 24 * 3600 * 1000) return false;
      } else if (dateRangePreset === '7D') {
        if (now - eventTime > 7 * 24 * 3600 * 1000) return false;
      } else if (dateRangePreset === '30D') {
        if (now - eventTime > 30 * 24 * 3600 * 1000) return false;
      } else if (dateRangePreset === 'CUSTOM') {
        if (customStartDate && eventTime < new Date(customStartDate).getTime()) return false;
        if (customEndDate && eventTime > new Date(customEndDate).getTime() + 24 * 3600 * 1000) return false;
      }

      // 3. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchDesc = t.description.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc) return false;
      }

      return true;
    });

    // 4. Sorting
    return filtered.sort((a, b) => {
      if (sortBy === 'SEVERITY') {
        return b.severityScore - a.severityScore;
      }
      if (sortBy === 'PROXIMITY') {
        const distA = a.distanceKm !== undefined ? a.distanceKm : 999999;
        const distB = b.distanceKm !== undefined ? b.distanceKm : 999999;
        if (distA !== distB) return distA - distB;
        return b.severityScore - a.severityScore;
      }
      if (sortBy === 'OLDEST') {
        return new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime();
      }
      // Default: NEWEST
      return new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime();
    });
  }, [enrichedThreats, activeCategory, dateRangePreset, customStartDate, customEndDate, searchQuery, sortBy]);

  // Count items per category based on active date range
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: 0 };
    CATEGORIES.forEach((c) => (counts[c.id] = 0));

    const now = Date.now();
    enrichedThreats.forEach((t) => {
      const eventTime = new Date(t.recordedAt).getTime();
      let matchesDate = true;
      if (dateRangePreset === '24H') matchesDate = (now - eventTime <= 24 * 3600 * 1000);
      else if (dateRangePreset === '7D') matchesDate = (now - eventTime <= 7 * 24 * 3600 * 1000);
      else if (dateRangePreset === '30D') matchesDate = (now - eventTime <= 30 * 24 * 3600 * 1000);
      else if (dateRangePreset === 'CUSTOM') {
        if (customStartDate && eventTime < new Date(customStartDate).getTime()) matchesDate = false;
        if (customEndDate && eventTime > new Date(customEndDate).getTime() + 24 * 3600 * 1000) matchesDate = false;
      }

      if (matchesDate) {
        counts.ALL = (counts.ALL || 0) + 1;
        counts[t.threatType] = (counts[t.threatType] || 0) + 1;
      }
    });

    return counts;
  }, [enrichedThreats, dateRangePreset, customStartDate, customEndDate]);

  // Non-geographical telemetry items (Market, Space, Asteroids) for highlight widget
  const nonGeoThreats = useMemo(() => {
    return filteredThreats.filter((t) => 
      t.threatType === 'STOCK_MARKET' || 
      t.threatType === 'SPACE_WEATHER' || 
      t.threatType === 'ASTEROID'
    );
  }, [filteredThreats]);

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-200 ${
      isDark ? 'bg-[#0f1013] text-slate-100' : 'bg-[#f8fafc] text-slate-900'
    }`}>
      {/* Top Header */}
      <Header
        userLocation={userLocation}
        setUserLocation={setUserLocation}
        isDark={isDark}
        toggleTheme={toggleTheme}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 space-y-6">
        {/* 1. Global Hazard Map with Floating Location Search & Interactive Target Pinning */}
        <TacticalRadarMap
          threats={filteredThreats}
          userLocation={userLocation}
          setUserLocation={setUserLocation}
          onSelectThreat={(t) => setSelectedThreat(t)}
          onOpenCocktail={(cocktailData, title, drinkName, severity) => {
            setAmalgamatedDrink({
              title,
              drinkName,
              severity,
              locationName: userLocation.cityName || 'Your Location',
              summary: `Amalgamated situation protocol synthesized for ${userLocation.cityName || 'Selected Coordinates'}.`,
              cocktailData,
            });
          }}
          hoveredThreatId={hoveredThreatId}
          setHoveredThreatId={setHoveredThreatId}
          activeCategory={activeCategory}
          isDark={isDark}
        />

        {/* 2. Non-Geographical Telemetry Highlight Strip (Market & Orbital Domain) */}
        {(activeCategory === 'ALL' || activeCategory === 'STOCK_MARKET' || activeCategory === 'SPACE_WEATHER' || activeCategory === 'ASTEROID') && nonGeoThreats.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                <Sparkles className="w-3.5 h-3.5 text-[#FF007F]" />
                <span>Orbital & Financial Telemetry (Non-Geospatial)</span>
              </div>
              <span className="text-[11px] text-slate-500 font-mono">
                {nonGeoThreats.length} Active in Filter Range
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {nonGeoThreats.map((threat) => {
                const isHovered = hoveredThreatId === (threat.id || threat.title);
                const isMarket = threat.threatType === 'STOCK_MARKET';
                const isSpace = threat.threatType === 'SPACE_WEATHER';
                const Icon = isMarket ? TrendingDown : isSpace ? Flame : Orbit;
                const accentColor = isMarket ? 'text-red-400 border-red-500/20' : isSpace ? 'text-amber-400 border-amber-500/20' : 'text-purple-400 border-purple-500/20';

                return (
                  <div
                    key={threat.id || threat.title}
                    onClick={() => setSelectedThreat(threat)}
                    onMouseEnter={() => setHoveredThreatId(threat.id || threat.title)}
                    onMouseLeave={() => setHoveredThreatId(null)}
                    className={`border rounded-xl p-3.5 cursor-pointer transition-all ${
                      isHovered
                        ? isDark ? 'bg-[#1f222b] border-[#FF007F] shadow-md' : 'bg-white border-[#FF007F] shadow-md'
                        : isDark ? 'bg-[#16171c] border-[#282a33] hover:border-slate-600' : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`p-1.5 rounded-lg border ${accentColor} ${isDark ? 'bg-[#1a1c24]' : 'bg-slate-50'}`}>
                          <Icon className="w-4 h-4" />
                        </span>
                        <div>
                          <div className={`font-bold text-xs truncate max-w-[170px] ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            {threat.title}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {isMarket ? 'Market Volatility' : isSpace ? 'Solar Activity' : 'Near-Earth Object'}
                          </div>
                        </div>
                      </div>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#FF007F]/10 text-[#FF007F] border border-[#FF007F]/20">
                        {threat.severityScore.toFixed(1)}
                      </span>
                    </div>

                    <p className={`text-[11px] mt-2 line-clamp-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      {threat.description}
                    </p>

                    <div className="mt-2.5 pt-2 border-t border-[#282a33]/60 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Vector Domain:</span>
                      <span className="font-mono text-emerald-400 font-medium">
                        GLOBAL STREAM
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 2. Controls Toolbar: Category Pills, Date Filter Presets, Sorting & Search */}
        <div className="space-y-4 pt-2">
          {/* Row 1: Category Filter Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {CATEGORIES.map((cat) => {
              const isActive = activeCategory === cat.id;
              const count = categoryCounts[cat.id] || 0;

              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                    isActive
                      ? 'bg-[#FF007F] text-white shadow-sm'
                      : isDark
                      ? 'bg-[#16171c] text-slate-400 hover:text-white border border-[#282a33]'
                      : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
                  }`}
                >
                  <span>{cat.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isActive 
                      ? 'bg-white/20 text-white' 
                      : isDark ? 'bg-[#252833] text-slate-400' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Row 2: Date Range Filter Bar, Sort Selector & Search */}
          <div className={`p-3 rounded-xl border flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 ${
            isDark ? 'bg-[#16171c] border-[#282a33]' : 'bg-white border-slate-200'
          }`}>
            {/* Date Range Selector */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                Time Window:
              </span>
              {(
                [
                  { id: '24H', label: '24 Hours' },
                  { id: '7D', label: '7 Days (Safe Default)' },
                  { id: '30D', label: '30 Days' },
                  { id: 'ALL', label: 'All Time' },
                  { id: 'CUSTOM', label: 'Custom' },
                ] as const
              ).map((preset) => {
                const isSelected = dateRangePreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => setDateRangePreset(preset.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      isSelected
                        ? 'bg-[#FF007F] text-white font-bold shadow-sm'
                        : isDark
                        ? 'bg-[#101114] text-slate-400 hover:text-slate-200 border border-[#282a33]'
                        : 'bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            {/* Right side: Sort Dropdown & Search Input */}
            <div className="flex items-center gap-2">
              {/* Sort Selector */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'NEWEST' | 'SEVERITY' | 'PROXIMITY' | 'OLDEST')}
                className={`px-3 py-1.5 border rounded-lg text-xs focus:outline-none focus:border-[#FF007F] transition-colors ${
                  isDark
                    ? 'bg-[#101114] border-[#282a33] text-slate-200'
                    : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              >
                <option value="NEWEST">Sort: Newest First</option>
                <option value="SEVERITY">Sort: Highest Severity</option>
                <option value="PROXIMITY">Sort: Closest to You</option>
                <option value="OLDEST">Sort: Oldest First</option>
              </select>

              {/* Search Box */}
              <div className="relative flex-1 md:w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search hazard events..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full pl-8 pr-3 py-1.5 border rounded-lg text-xs focus:outline-none focus:border-[#FF007F] transition-colors ${
                    isDark
                      ? 'bg-[#101114] border-[#282a33] text-white placeholder-slate-500'
                      : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Custom Date Pickers (Shown if CUSTOM selected) */}
          {dateRangePreset === 'CUSTOM' && (
            <div className={`p-3 rounded-xl border flex flex-wrap items-center gap-3 text-xs ${
              isDark ? 'bg-[#101114] border-[#282a33]' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-medium">Start Date:</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className={`px-2.5 py-1 rounded-lg border text-xs ${
                    isDark ? 'bg-[#16171c] border-[#282a33] text-white' : 'bg-white border-slate-200 text-slate-900'
                  }`}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-medium">End Date:</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className={`px-2.5 py-1 rounded-lg border text-xs ${
                    isDark ? 'bg-[#16171c] border-[#282a33] text-white' : 'bg-white border-slate-200 text-slate-900'
                  }`}
                />
              </div>
            </div>
          )}

          {/* Safe Default Filter Notice & Status */}
          {dateRangePreset === '7D' && (
            <div className={`px-4 py-2 rounded-xl border flex items-center justify-between text-xs transition ${
              isDark ? 'bg-[#121316] border-[#282a33] text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}>
              <span>
                Displaying <span className="text-white font-bold">{filteredThreats.length}</span> events from the <strong>Last 7 Days</strong> (Safe Default applied).
              </span>
              <button
                onClick={() => setDateRangePreset('30D')}
                className="text-[#FF007F] hover:underline font-bold text-xs"
              >
                Expand to 30 Days &rarr;
              </button>
            </div>
          )}

          {/* Event Table */}
          {filteredThreats.length > 0 ? (
            <EventTable
              threats={filteredThreats}
              onSelectThreat={(t) => setSelectedThreat(t)}
              hoveredThreatId={hoveredThreatId}
              setHoveredThreatId={setHoveredThreatId}
              isDark={isDark}
              onSync={handleSync}
              isSyncing={isSyncing || loading}
            />
          ) : (
            <div className={`border rounded-xl p-10 text-center space-y-2 transition-colors ${
              isDark ? 'bg-[#16171c] border-[#282a33]' : 'bg-white border-slate-200'
            }`}>
              <Compass className="w-7 h-7 text-[#FF007F] mx-auto" />
              <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                No hazard events match this time filter or category
              </h3>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Try expanding your time window to <strong>30 Days</strong> or selecting <strong>All Events</strong>.
              </p>
              <div className="flex items-center justify-center gap-2 mt-2">
                <button
                  onClick={() => {
                    setDateRangePreset('30D');
                    setActiveCategory('ALL');
                    setSearchQuery('');
                  }}
                  className="px-4 py-2 bg-[#FF007F] hover:bg-[#E60072] text-white font-bold rounded-lg text-xs transition inline-block"
                >
                  Show All 30-Day Events
                </button>
                <button
                  onClick={handleSync}
                  disabled={isSyncing || loading}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    isDark
                      ? 'bg-[#1a1c23] hover:bg-[#252833] border border-[#282a33] text-slate-200'
                      : 'bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 shadow-sm'
                  }`}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing || loading ? 'animate-spin text-[#FF007F]' : 'text-[#FF007F]'}`} />
                  <span>{isSyncing || loading ? 'Syncing...' : 'Sync Telemetry'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* 1. Pure Hazard Telemetry Modal for Event Inspect (NO DRINKS) */}
      <EventDetailModal
        threat={selectedThreat}
        onClose={() => setSelectedThreat(null)}
      />

      {/* 2. Amalgamated Location Countermeasure Modal (ONLY from Pour Drink button) */}
      <CocktailModal
        data={amalgamatedDrink}
        onClose={() => setAmalgamatedDrink(null)}
      />

      {/* Minimal Footer */}
      <footer className={`border-t py-5 mt-10 text-xs text-center transition-colors ${
        isDark ? 'border-[#282a33] text-slate-500' : 'border-slate-200 text-slate-500 bg-white'
      }`}>
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>BSL-4 &bull; Global Threat Telemetry &bull; Ingested server-side</div>
          <div className="text-[#FF007F] font-medium">
            Assess the threat. Pour the drink.
          </div>
        </div>
      </footer>
    </div>
  );
}

