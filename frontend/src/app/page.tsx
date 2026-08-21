'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Header from '@/components/Header';
import SimpleFlatMap from '@/components/TacticalRadarMap';
import LocationSearch from '@/components/LocationSearch';
import EventTable from '@/components/ThreatCard';
import CocktailModal from '@/components/CocktailModal';
import { ThreatRecord, ThreatCategory, UserLocation } from '@/types/threats';
import { fetchLatestThreats } from '@/lib/api';
import { calculateDistanceKm } from '@/lib/geo';
import { Search, Compass } from 'lucide-react';

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
  const [refreshing] = useState(false);
  const [selectedThreat, setSelectedThreat] = useState<ThreatRecord | null>(null);
  const [activeCategory, setActiveCategory] = useState<ThreatCategory>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDark, setIsDark] = useState(true);

  const toggleTheme = () => setIsDark(!isDark);

  // User location for proximity calculations
  const [userLocation, setUserLocation] = useState<UserLocation>({
    latitude: 34.0522,
    longitude: -118.2437,
    cityName: 'Los Angeles, CA, USA',
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
        }
      } catch {
        // Ignored
      }
      return { ...t, distanceKm };
    });
  }, [threats, userLocation]);

  // Filtered threats based on category and search
  const filteredThreats = useMemo(() => {
    return enrichedThreats.filter((t) => {
      // Category filter
      if (activeCategory !== 'ALL' && t.threatType !== activeCategory) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchDesc = t.description.toLowerCase().includes(q);
        const matchDrink = t.recommendedDrink.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchDrink) return false;
      }
      return true;
    });
  }, [enrichedThreats, activeCategory, searchQuery]);

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-200 ${
      isDark ? 'bg-[#0f1013] text-slate-100' : 'bg-[#f8fafc] text-slate-900'
    }`}>
      {/* Top Header */}
      <Header
        userLocation={userLocation}
        setUserLocation={setUserLocation}
        onRefresh={loadData}
        isRefreshing={loading || refreshing}
        isDark={isDark}
        toggleTheme={toggleTheme}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 space-y-6">
        {/* 1. Global Activity Map at Top of Screen */}
        <SimpleFlatMap
          threats={enrichedThreats}
          userLocation={userLocation}
          onSelectThreat={(t) => setSelectedThreat(t)}
          isDark={isDark}
        />

        {/* 2. Granular Global Address & Location Lookup */}
        <LocationSearch
          userLocation={userLocation}
          setUserLocation={setUserLocation}
          isDark={isDark}
          onOpenCocktail={(cocktailData, title, drinkName, severity) => {
            setSelectedThreat({
              title,
              threatType: 'TERRESTRIAL_WEATHER',
              severityScore: severity,
              description: `Live regional conditions for ${userLocation.cityName || 'Selected Area'}.`,
              recommendedDrink: drinkName,
              metadata: JSON.stringify({ cocktail: cocktailData }),
              recordedAt: new Date().toISOString(),
            });
          }}
        />

        {/* 3. Category Tabs & Search */}
        <div className="space-y-4 pt-2">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Category Pills */}
            <div className="flex flex-wrap items-center gap-2">
              {CATEGORIES.map((cat) => {
                const isActive = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                      isActive
                        ? 'bg-[#FF007F] text-white shadow-sm'
                        : isDark
                        ? 'bg-[#16171c] text-slate-400 hover:text-white border border-[#282a33]'
                        : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>

            {/* Search Input */}
            <div className="relative sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search events or drinks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-8 pr-3 py-1.5 border rounded-lg text-xs focus:outline-none focus:border-[#FF007F] transition-colors ${
                  isDark
                    ? 'bg-[#16171c] border-[#282a33] text-white placeholder-slate-500'
                    : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
                }`}
              />
            </div>
          </div>

          {/* Event Table */}
          {filteredThreats.length > 0 ? (
            <EventTable
              threats={filteredThreats}
              onSelectThreat={(t) => setSelectedThreat(t)}
              isDark={isDark}
            />
          ) : (
            <div className={`border rounded-xl p-10 text-center space-y-2 transition-colors ${
              isDark ? 'bg-[#16171c] border-[#282a33]' : 'bg-white border-slate-200'
            }`}>
              <Compass className="w-7 h-7 text-[#FF007F] mx-auto" />
              <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                No active events match this filter
              </h3>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Try switching categories or clearing your search query.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Cocktail Recipe Modal */}
      <CocktailModal
        threat={selectedThreat}
        onClose={() => setSelectedThreat(null)}
      />

      {/* Minimal Footer */}
      <footer className={`border-t py-5 mt-10 text-xs text-center transition-colors ${
        isDark ? 'border-[#282a33] text-slate-500' : 'border-slate-200 text-slate-500 bg-white'
      }`}>
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>BSL-4 &bull; Global Event Telemetry &bull; Updates every 30 minutes</div>
          <div className="text-[#FF007F] font-medium">
            Assess the situation. Pick the drink.
          </div>
        </div>
      </footer>
    </div>
  );
}
