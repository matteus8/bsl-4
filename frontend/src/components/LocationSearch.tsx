'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Search, Wine, CloudSun, Loader2 } from 'lucide-react';
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
    }, 250);

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
    if (!query.trim()) return;
    setLoadingSuggestions(true);
    try {
      const results = await geocodeAddress(query);
      if (results.length > 0) {
        handleSelectLocation(results[0]);
      }
    } finally {
      setLoadingSuggestions(false);
    }
  };

  return (
    <div className={`border rounded-2xl p-5 sm:p-6 shadow-sm transition-colors ${
      isDark ? 'bg-[#16171c] border-[#282a33]' : 'bg-white border-slate-200'
    } space-y-4`}>
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className={`text-base sm:text-lg font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Global Location & Address Telemetry
          </h2>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Enter any address, city, zip code, or region worldwide to pair live local weather and seismic hazards with a cocktail.
          </p>
        </div>
      </div>

      {/* Search Input with Autocomplete */}
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
              placeholder="Enter any address (e.g. 10 Downing St London, Shibuya Tokyo, 90210, Sydney Australia)..."
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

      {/* Localized Assessment Card */}
      {assessment && (
        <div className={`border rounded-xl p-4 sm:p-5 transition-colors ${
          isDark ? 'bg-[#101114] border-[#282a33]' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            {/* Left: Weather & Seismic Telemetry */}
            <div className="space-y-2 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FF007F]/15 text-[#FF007F] border border-[#FF007F]/30 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  <span>{assessment.locationName}</span>
                </span>
                {loadingAssessment && (
                  <Loader2 className="w-3 h-3 text-[#FF007F] animate-spin" />
                )}
                <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  ({assessment.latitude.toFixed(2)}°, {assessment.longitude.toFixed(2)}°)
                </span>
              </div>

              {/* Weather info */}
              {assessment.weather && (
                <div className="flex flex-wrap items-center gap-4 text-xs pt-1">
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

              {/* Situation Summary */}
              <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                {assessment.situationSummary}
              </p>
            </div>

            {/* Right: Curated Drink Recommendation */}
            <div className="w-full lg:w-auto flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end gap-2 shrink-0 pt-2 lg:pt-0">
              <button
                onClick={() => {
                  onOpenCocktail(
                    assessment.cocktail || {},
                    `Telemetry for ${assessment.locationName}`,
                    assessment.recommendedDrink,
                    assessment.localSeverityScore
                  );
                }}
                className="px-4 py-2.5 bg-[#FF007F] hover:bg-[#E60072] text-white font-bold rounded-xl text-xs shadow-md transition flex items-center justify-center gap-2"
              >
                <Wine className="w-4 h-4" />
                <span>Pairing: {assessment.recommendedDrink}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
