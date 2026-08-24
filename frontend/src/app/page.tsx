'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Header from '@/components/Header';
import AIVerdictBanner from '@/components/AIVerdictBanner';
import TacticalRadarMap from '@/components/TacticalRadarMap';
import OrbitalSpaceWatch from '@/components/OrbitalSpaceWatch';
import MacroNoiseSection from '@/components/MacroNoiseSection';
import EventTable from '@/components/ThreatCard';
import EventDetailModal from '@/components/EventDetailModal';
import { ThreatRecord, ThreatCategory, UserLocation, DateRangePreset } from '@/types/threats';
import { fetchNearbyThreats, triggerProtocolZeroRefresh } from '@/lib/api';
import { calculateDistanceKm } from '@/lib/geo';
import { Search, Compass, RefreshCw, Layers } from 'lucide-react';

const CATEGORIES: { id: ThreatCategory; label: string }[] = [
  { id: 'ALL', label: 'All Hazards' },
  { id: 'EARTHQUAKE', label: 'Earthquakes' },
  { id: 'SPACE_WEATHER', label: 'Space Weather' },
  { id: 'ASTEROID', label: 'Asteroids' },
  { id: 'TERRESTRIAL_WEATHER', label: 'Weather Alerts' },
  { id: 'STOCK_MARKET', label: 'Market Volatility' },
];

export default function Dashboard() {
  const [threats, setThreats] = useState<ThreatRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedThreat, setSelectedThreat] = useState<ThreatRecord | null>(null);
  const [hoveredThreatId, setHoveredThreatId] = useState<number | string | null>(null);
  const [activeCategory, setActiveCategory] = useState<ThreatCategory>('ALL');
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('30D');
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

  const loadData = useCallback(async (lat = userLocation.latitude, lon = userLocation.longitude) => {
    setLoading(true);
    try {
      const data = await fetchNearbyThreats(lat, lon);
      setThreats(data);
    } finally {
      setLoading(false);
    }
  }, [userLocation.latitude, userLocation.longitude]);

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
    loadData(userLocation.latitude, userLocation.longitude);
  }, [loadData, userLocation.latitude, userLocation.longitude]);

  useEffect(() => {
    // 30-minute automatic background refresh
    const interval = setInterval(() => {
      loadData(userLocation.latitude, userLocation.longitude);
    }, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadData, userLocation.latitude, userLocation.longitude]);

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
        // Handled
      }
      return { ...t, distanceKm };
    });
  }, [threats, userLocation]);

  // Filtered threats for the event table
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

  // Counts per category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: 0 };
    CATEGORIES.forEach((c) => (counts[c.id] = 0));

    enrichedThreats.forEach((t) => {
      counts.ALL = (counts.ALL || 0) + 1;
      counts[t.threatType] = (counts[t.threatType] || 0) + 1;
    });

    return counts;
  }, [enrichedThreats]);

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
        {/* ================================================================ */}
        {/* SECTION 1: THE AI VERDICT (Top Banner)                           */}
        {/* ================================================================ */}
        <AIVerdictBanner
          threats={enrichedThreats}
          isDark={isDark}
        />

        {/* ================================================================ */}
        {/* SECTION 2: GEOSPATIAL MAP & LOCAL REALITY                        */}
        {/* ================================================================ */}
        <TacticalRadarMap
          threats={enrichedThreats}
          userLocation={userLocation}
          setUserLocation={setUserLocation}
          onSelectThreat={(t) => setSelectedThreat(t)}
          hoveredThreatId={hoveredThreatId}
          setHoveredThreatId={setHoveredThreatId}
          activeCategory={activeCategory}
          isDark={isDark}
        />

        {/* ================================================================ */}
        {/* SECTION 3: ORBITAL & SPACE WATCH (Dedicated Box)                 */}
        {/* ================================================================ */}
        <OrbitalSpaceWatch
          threats={enrichedThreats}
          onSelectThreat={(t) => setSelectedThreat(t)}
          hoveredThreatId={hoveredThreatId}
          setHoveredThreatId={setHoveredThreatId}
          isDark={isDark}
        />

        {/* ================================================================ */}
        {/* SECTION 4: THE MACRO NOISE (Markets, Economy & Social Hysteria)  */}
        {/* ================================================================ */}
        <MacroNoiseSection
          threats={enrichedThreats}
          onSelectThreat={(t) => setSelectedThreat(t)}
          hoveredThreatId={hoveredThreatId}
          setHoveredThreatId={setHoveredThreatId}
          isDark={isDark}
        />

        {/* ================================================================ */}
        {/* DETAILED EVENT REGISTRY TABLE (Search, Filters, Full Archive)     */}
        {/* ================================================================ */}
        <div className="space-y-4 pt-4 border-t border-[#282a33]/60">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md bg-[#FF007F]/10 text-[#FF007F] border border-[#FF007F]/25 flex items-center gap-1.5 font-mono">
                <Layers className="w-3.5 h-3.5" />
                RAW TELEMETRY REGISTRY
              </span>
              <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Detailed Multi-Vector Sensor Log
              </span>
            </div>

            <button
              onClick={handleSync}
              disabled={isSyncing || loading}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-mono transition flex items-center gap-1.5 ${
                isDark
                  ? 'bg-[#16171c] hover:bg-[#20222a] border border-[#282a33] text-slate-200'
                  : 'bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 shadow-sm'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing || loading ? 'animate-spin text-[#FF007F]' : 'text-[#FF007F]'}`} />
              <span>{isSyncing || loading ? 'Syncing...' : 'Sync Telemetry'}</span>
            </button>
          </div>

          {/* Category Filter Buttons */}
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

          {/* Date Filter Bar & Sort Controls */}
          <div className={`p-3 rounded-xl border flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 ${
            isDark ? 'bg-[#16171c] border-[#282a33]' : 'bg-white border-slate-200'
          }`}>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                Time Window:
              </span>
              {(
                [
                  { id: '24H', label: '24 Hours' },
                  { id: '7D', label: '7 Days' },
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

            <div className="flex items-center gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'NEWEST' | 'SEVERITY' | 'PROXIMITY' | 'OLDEST')}
                className={`px-3 py-1.5 border rounded-lg text-xs focus:outline-none focus:border-[#FF007F] transition-colors ${
                  isDark
                    ? 'bg-[#101114] border-[#282a33] text-slate-200'
                    : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              >
                <option value="PROXIMITY">Sort: Closest to You</option>
                <option value="SEVERITY">Sort: Highest Severity</option>
                <option value="NEWEST">Sort: Newest First</option>
                <option value="OLDEST">Sort: Oldest First</option>
              </select>

              <div className="relative flex-1 md:w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search telemetry..."
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
                Try expanding your time window to <strong>30 Days</strong> or selecting <strong>All Hazards</strong>.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Hazard Telemetry Modal for Event Inspect */}
      <EventDetailModal
        threat={selectedThreat}
        onClose={() => setSelectedThreat(null)}
      />

      {/* Minimal Footer */}
      <footer className={`border-t py-5 mt-10 text-xs text-center transition-colors ${
        isDark ? 'border-[#282a33] text-slate-500' : 'border-slate-200 text-slate-500 bg-white'
      }`}>
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>BSL-4 Protocol Zero &bull; Global Planetary Hazard vs. Hysteria Telemetry</div>
          <div className="text-emerald-400 font-mono font-medium flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            REALITY MONITOR: NOMINAL
          </div>
        </div>
      </footer>
    </div>
  );
}
