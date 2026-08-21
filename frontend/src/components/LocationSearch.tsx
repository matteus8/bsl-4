'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Search, Wine, CloudSun, Loader2, Navigation, ShieldAlert } from 'lucide-react';
import { UserLocation, RegionalAssessment, GeocodedLocation } from '@/types/threats';
import { geocodeAddress, assessLocation } from '@/lib/api';

interface LocationSearchProps {
  userLocation: UserLocation;
  setUserLocation: (loc: UserLocation) => void;
  onOpenCocktail: (cocktailData: Record<string, unknown>, title: string, drinkName: string, severity: number) => void;
  isDark: boolean;
}

export default function LocationSearch({
  userLocation,
  setUserLocation,
  onOpenCocktail,
  isDark,
}: LocationSearchProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<GeocodedLocation[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [assessment, setAssessment] = useState<RegionalAssessment | null>(null);
  const [loadingAssessment, setLoadingAssessment] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [locatingDevice, setLocatingDevice] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounced geocoding search
  useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoadingSuggestions(true);
      try {
        const results = await geocodeAddress(query);
        setSuggestions(results);
        setShowDropdown(results.length > 0);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  // Initial assessment on mount or location change
  useEffect(() => {
    loadAssessmentForLocation(userLocation.latitude, userLocation.longitude, userLocation.cityName);
  }, [userLocation.latitude, userLocation.longitude, userLocation.cityName]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadAssessmentForLocation = async (lat: number, lon: number, name?: string) => {
    setLoadingAssessment(true);
    try {
      const data = await assessLocation({ address: name, lat, lon });
      if (data) {
        setAssessment(data);
      }
    } finally {
      setLoadingAssessment(false);
    }
  };

  const handleSelectLocation = (loc: GeocodedLocation) => {
    setQuery(loc.displayName);
    setShowDropdown(false);
    setUserLocation({
      latitude: loc.latitude,
      longitude: loc.longitude,
      cityName: loc.displayName,
      isAutoDetected: false,
    });
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) {
      handleDeviceLocate();
      return;
    }
    setLoadingSuggestions(true);
    try {
      const results = await geocodeAddress(query);
      if (results.length > 0) {
        handleSelectLocation(results[0]);
      } else {
        // Direct coordinates approximation
        setUserLocation({
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          cityName: query.trim(),
          isAutoDetected: false,
        });
      }
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleDeviceLocate = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setLocatingDevice(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setLocatingDevice(false);
        setUserLocation({
          latitude: lat,
          longitude: lon,
          cityName: `Local Coordinates (${lat.toFixed(2)}°, ${lon.toFixed(2)}°)`,
          isAutoDetected: true,
        });
      },
      (err) => {
        console.warn('Geolocation failed:', err);
        setLocatingDevice(false);
      },
      { timeout: 8000 }
    );
  };

  return (
    <div className={`border rounded-2xl p-5 sm:p-6 shadow-sm transition-colors ${
      isDark ? 'bg-[#16171c] border-[#282a33]' : 'bg-white border-slate-200'
    } space-y-4`}>
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-[#FF007F]" />
            <h2 className={`text-base sm:text-lg font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Location Threat Matrix & Amalgamated Drink Countermeasure
            </h2>
          </div>
          <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Enter any address, city, or country. BSL-4 amalgamates all active seismic proximity, solar flares, market volatility, and local weather into a single composite threat level and unified liquid prescription.
          </p>
        </div>
      </div>

      {/* Search Input with Autocomplete & Device Locate */}
      <div className="relative" ref={dropdownRef}>
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => {
                if (suggestions.length > 0) setShowDropdown(true);
              }}
              placeholder="Search any location (e.g. Lima Peru, Los Angeles, Tokyo, London, 90210, Sydney)..."
              className={`w-full pl-10 pr-10 py-3 text-xs sm:text-sm rounded-xl border focus:outline-none focus:border-[#FF007F] transition-colors ${
                isDark
                  ? 'bg-[#101114] border-[#282a33] text-white placeholder-slate-500'
                  : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
              }`}
            />
            {loadingSuggestions && (
              <Loader2 className="w-4 h-4 text-[#FF007F] animate-spin absolute right-3.5 top-1/2 -translate-y-1/2" />
            )}
          </div>

          {/* Quick Device GPS Button */}
          <button
            type="button"
            onClick={handleDeviceLocate}
            disabled={locatingDevice}
            title="Auto-detect my location via GPS"
            className={`px-3.5 py-3 border rounded-xl transition flex items-center justify-center ${
              isDark
                ? 'bg-[#1a1c23] hover:bg-[#22252e] border-[#282a33] text-slate-300'
                : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
            }`}
          >
            <Navigation className={`w-4 h-4 text-[#FF007F] ${locatingDevice ? 'animate-spin' : ''}`} />
          </button>

          {/* Main Locate Action */}
          <button
            type="submit"
            disabled={loadingSuggestions}
            className="px-5 py-3 bg-[#FF007F] hover:bg-[#E60072] text-white font-bold rounded-xl text-xs sm:text-sm shadow-md transition disabled:opacity-50 flex items-center gap-1.5 shrink-0"
          >
            <MapPin className="w-4 h-4" />
            <span>Locate</span>
          </button>
        </form>

        {/* Autocomplete Dropdown */}
        {showDropdown && suggestions.length > 0 && (
          <div className={`absolute top-full left-0 right-0 mt-1.5 border rounded-xl shadow-2xl overflow-hidden z-50 max-h-60 overflow-y-auto divide-y transition-colors ${
            isDark ? 'bg-[#1a1c23] border-[#2e313d] divide-[#282a33]' : 'bg-white border-slate-200 divide-slate-100'
          }`}>
            {suggestions.map((loc, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectLocation(loc)}
                className={`w-full text-left px-4 py-3 flex items-center justify-between gap-3 text-xs transition-colors ${
                  isDark ? 'hover:bg-[#22252e] text-slate-200' : 'hover:bg-slate-50 text-slate-800'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <MapPin className="w-3.5 h-3.5 text-[#FF007F] shrink-0" />
                  <span className="truncate font-medium">{loc.displayName}</span>
                </div>
                <span className={`text-[10px] shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {loc.latitude.toFixed(2)}°, {loc.longitude.toFixed(2)}°
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Localized Amalgamated Threat & Countermeasure Card */}
      {assessment && (
        <div className={`border rounded-xl p-4 sm:p-5 transition-colors ${
          isDark ? 'bg-[#101114] border-[#282a33]' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
            {/* Left: Weather & Multi-Vector Telemetry */}
            <div className="space-y-2.5 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-lg text-xs font-bold bg-[#FF007F]/15 text-[#FF007F] border border-[#FF007F]/30 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{assessment.locationName}</span>
                </span>
                <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold font-mono bg-rose-500/15 text-rose-400 border border-rose-500/30">
                  Amalgamated Threat: {assessment.localSeverityScore.toFixed(1)} / 10
                </span>
                {loadingAssessment && (
                  <Loader2 className="w-3.5 h-3.5 text-[#FF007F] animate-spin" />
                )}
              </div>

              {/* Weather info */}
              {assessment.weather && (
                <div className="flex flex-wrap items-center gap-4 text-xs pt-0.5">
                  <div className={`flex items-center gap-1.5 font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    <CloudSun className="w-4 h-4 text-amber-400" />
                    <span>{assessment.weather.temperatureF.toFixed(0)}°F</span>
                    <span className={`font-normal ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      ({assessment.weather.conditionText})
                    </span>
                  </div>
                  <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Wind: {assessment.weather.windSpeedMph.toFixed(0)} mph &bull; Humidity: {assessment.weather.humidityPercent}%
                  </div>
                </div>
              )}

              {/* Situation Summary Briefing */}
              <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                {assessment.situationSummary}
              </p>
            </div>

            {/* Right: Unified Prescribed Amalgamated Drink Countermeasure */}
            <div className="w-full lg:w-auto flex flex-col items-stretch lg:items-end gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-[#282a33]/60">
              <div className="text-[11px] uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1 lg:justify-end">
                <span>Prescribed Liquid Countermeasure:</span>
              </div>
              <button
                onClick={() => {
                  onOpenCocktail(
                    assessment.cocktail || {},
                    `Amalgamated Protocol for ${assessment.locationName}`,
                    assessment.recommendedDrink,
                    assessment.localSeverityScore
                  );
                }}
                className="px-5 py-3 bg-[#FF007F] hover:bg-[#E60072] text-white font-bold rounded-xl text-xs sm:text-sm shadow-pink-glow-sm hover:shadow-pink-glow transition flex items-center justify-center gap-2 group"
              >
                <Wine className="w-4 h-4 group-hover:scale-110 transition-transform" />
                <span>Pour: {assessment.recommendedDrink}</span>
              </button>
              <div className="text-[10px] text-slate-500 font-mono text-center lg:text-right">
                Synthesized from all 5 threat vectors
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

