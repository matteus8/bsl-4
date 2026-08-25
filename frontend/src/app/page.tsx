'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import AIVerdictBanner from '@/components/AIVerdictBanner';
import TacticalRadarMap from '@/components/TacticalRadarMap';
import OrbitalSpaceWatch from '@/components/OrbitalSpaceWatch';
import MacroNoiseSection from '@/components/MacroNoiseSection';
import EventTable from '@/components/ThreatCard';
import EventDetailModal from '@/components/EventDetailModal';
import { ThreatRecord, ThreatCategory, UserLocation } from '@/types/threats';
import { fetchLatestThreats, fetchLatestEditorialVerdict, EditorialVerdictResponse, triggerProtocolZeroRefresh } from '@/lib/api';
import { calculateDistanceKm } from '@/lib/geo';
import { Search, Compass, Layers } from 'lucide-react';

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
  const [storedVerdict, setStoredVerdict] = useState<EditorialVerdictResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedThreat, setSelectedThreat] = useState<ThreatRecord | null>(null);
  const [hoveredThreatId, setHoveredThreatId] = useState<number | string | null>(null);
  const [activeCategory, setActiveCategory] = useState<ThreatCategory>('ALL');
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

  const loadData = useCallback(async () => {
    try {
      const [data, verdictData] = await Promise.all([
        fetchLatestThreats(),
        fetchLatestEditorialVerdict(),
      ]);
      setThreats(data);
      if (verdictData) {
        setStoredVerdict(verdictData);
      }
    } catch (err) {
      console.error('Error loading telemetry data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

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
  }, [loadData]);

  useEffect(() => {
    // 30-minute automatic background refresh
    const interval = setInterval(() => {
      loadData();
    }, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadData]);

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
    const filtered = enrichedThreats.filter((t) => {
      // 1. Category filter
      if (activeCategory !== 'ALL' && t.threatType !== activeCategory) {
        return false;
      }

      // 2. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchDesc = t.description.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc) return false;
      }

      return true;
    });

    // 3. Sorting
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
  }, [enrichedThreats, activeCategory, searchQuery, sortBy]);

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
          storedVerdict={storedVerdict}
          loading={loading}
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
        {/* RAW TELEMETRY REGISTRY (Search, Category Filters, Event Table)    */}
        {/* ================================================================ */}
        <div className="space-y-4 pt-4 border-t border-[#282a33]/60">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md bg-[#FF007F]/10 text-[#FF007F] border border-[#FF007F]/25 flex items-center gap-1.5 font-mono">
                <Layers className="w-3.5 h-3.5" />
                RAW TELEMETRY REGISTRY
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'NEWEST' | 'SEVERITY' | 'PROXIMITY' | 'OLDEST')}
                className={`px-3 py-1.5 border rounded-lg text-xs focus:outline-none focus:border-[#FF007F] transition-colors font-mono ${
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

              <div className="relative flex-1 sm:w-56">
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
                No hazard events match this category
              </h3>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Try selecting <strong>All Hazards</strong>.
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

      {/* Professional Mission-Control Footer */}
      <Footer isDark={isDark} />
    </div>
  );
}
