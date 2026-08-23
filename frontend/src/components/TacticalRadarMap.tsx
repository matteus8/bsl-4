'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { ThreatRecord, ThreatCategory, UserLocation, GeocodedLocation, RegionalAssessment } from '@/types/threats';
import { Globe, Layers, Search, Navigation, MapPin, Loader2, Wine, ShieldAlert, X } from 'lucide-react';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import worldAtlasData from 'world-atlas/land-110m.json';
import { formatDistance } from '@/lib/geo';
import { geocodeAddress, assessLocation } from '@/lib/api';

interface TacticalRadarMapProps {
  threats: ThreatRecord[];
  userLocation: UserLocation;
  setUserLocation: (loc: UserLocation) => void;
  onSelectThreat: (threat: ThreatRecord) => void;
  onOpenCocktail?: (cocktailData: Record<string, unknown>, title: string, drinkName: string, severity: number) => void;
  hoveredThreatId?: number | string | null;
  setHoveredThreatId?: (id: number | string | null) => void;
  activeCategory?: ThreatCategory;
  isDark?: boolean;
}

export default function TacticalRadarMap({
  threats,
  userLocation,
  setUserLocation,
  onSelectThreat,
  onOpenCocktail,
  hoveredThreatId,
  setHoveredThreatId,
  activeCategory = 'ALL',
  isDark = true,
}: TacticalRadarMapProps) {
  // Search & Geocoding State
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<GeocodedLocation[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [locatingDevice, setLocatingDevice] = useState(false);
  const [assessment, setAssessment] = useState<RegionalAssessment | null>(null);
  const [loadingAssessment, setLoadingAssessment] = useState(false);
  const [showAssessmentCard, setShowAssessmentCard] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Generate real Natural Earth world map SVG path
  const { landPath, projection } = useMemo(() => {
    const landFeature = feature(
      worldAtlasData as unknown as Topology,
      worldAtlasData.objects.land as unknown as Topology['objects'][string]
    );

    const proj = geoNaturalEarth1().fitExtent(
      [[15, 15], [985, 485]],
      landFeature
    );

    const pathGenerator = geoPath(proj);
    const path = pathGenerator(landFeature) || '';

    return { landPath: path, projection: proj };
  }, []);

  // Compute user pin coordinates on real map
  const userPinCoords = useMemo(() => {
    const pt = projection([userLocation.longitude, userLocation.latitude]);
    return pt ? { x: pt[0], y: pt[1] } : { x: 200, y: 150 };
  }, [projection, userLocation]);

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

  // Assessment calculation when location changes
  useEffect(() => {
    let isCancelled = false;
    const fetchAssessment = async () => {
      setLoadingAssessment(true);
      try {
        const data = await assessLocation({
          address: userLocation.cityName,
          lat: userLocation.latitude,
          lon: userLocation.longitude,
        });
        if (!isCancelled && data) {
          setAssessment(data);
        }
      } finally {
        if (!isCancelled) setLoadingAssessment(false);
      }
    };

    fetchAssessment();
    return () => {
      isCancelled = true;
    };
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
        setQuery('');
      },
      (err) => {
        console.warn('Geolocation failed:', err);
        setLocatingDevice(false);
      },
      { timeout: 8000 }
    );
  };

  // Map Click to Set Location (Google Maps style)
  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!mapContainerRef.current) return;
    const rect = mapContainerRef.current.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * 1000;
    const clickY = ((e.clientY - rect.top) / rect.height) * 500;

    const coords = projection.invert?.([clickX, clickY]);
    if (coords && !isNaN(coords[0]) && !isNaN(coords[1])) {
      const lon = Math.round(coords[0] * 100) / 100;
      const lat = Math.round(coords[1] * 100) / 100;
      setUserLocation({
        latitude: lat,
        longitude: lon,
        cityName: `Map Pin (${lat.toFixed(2)}°, ${lon.toFixed(2)}°)`,
        isAutoDetected: false,
      });
      setQuery('');
    }
  };

  // Extract verified physical coordinates (Earthquakes, Weather alerts)
  const mappedThreats = useMemo(() => {
    return threats
      .filter((t) => activeCategory === 'ALL' || t.threatType === activeCategory)
      .map((t) => {
        let lat: number | null = null;
        let lon: number | null = null;

        try {
          const meta = typeof t.metadata === 'string' ? JSON.parse(t.metadata) : t.metadata;
          if (meta && typeof meta.latitude === 'number' && typeof meta.longitude === 'number') {
            lat = meta.latitude;
            lon = meta.longitude;
          } else if (meta && typeof meta.lat === 'number' && typeof meta.lon === 'number') {
            lat = meta.lat;
            lon = meta.lon;
          }
        } catch {
          // Ignored
        }

        if (lat === null || lon === null) return null;

        const pt = projection([lon, lat]);
        if (!pt) return null;

        return {
          ...t,
          mapX: pt[0],
          mapY: pt[1],
        };
      })
      .filter((t): t is ThreatRecord & { mapX: number; mapY: number } => t !== null);
  }, [threats, projection, activeCategory]);

  const isNonGeospatialCategory = 
    activeCategory === 'STOCK_MARKET' || 
    activeCategory === 'SPACE_WEATHER' || 
    activeCategory === 'ASTEROID';

  return (
    <div className={`border rounded-2xl p-4 sm:p-5 shadow-sm transition-colors ${
      isDark ? 'bg-[#16171c] border-[#282a33]' : 'bg-white border-slate-200'
    } space-y-3`}>
      {/* Map Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-[#FF007F]" />
          <h3 className={`text-sm font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Global Threat Radar & Proximity Map
          </h3>
          <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${
            isDark ? 'bg-[#21242d] text-slate-400' : 'bg-slate-100 text-slate-600'
          }`}>
            Click anywhere on map to pin
          </span>
        </div>
        <div className={`flex items-center gap-3 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          <span className="flex items-center gap-1.5 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF007F] shadow-sm" />
            <span className="truncate max-w-[160px] sm:max-w-none">{userLocation.cityName?.split(' (')[0] || 'Your Region'}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span>{mappedThreats.length} Active Mapped Hazards</span>
          </span>
        </div>
      </div>

      {/* SVG Map Container with Google Maps-style Floating Search Bar */}
      <div 
        ref={mapContainerRef}
        onClick={handleMapClick}
        className={`relative w-full aspect-[2/1] min-h-[300px] sm:min-h-[420px] border rounded-xl overflow-hidden flex items-center justify-center select-none cursor-crosshair ${
          isDark ? 'bg-[#101114] border-[#282a33]' : 'bg-[#f1f5f9] border-slate-200'
        }`}
      >
        {/* Real Geographical World Map Path */}
        <svg
          className="w-full h-full pointer-events-none"
          viewBox="0 0 1000 500"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Latitude & Longitude Reference Grid */}
          <line x1="0" y1="250" x2="1000" y2="250" stroke={isDark ? '#282a33' : '#cbd5e1'} strokeDasharray="3 3" strokeWidth="1" />
          <line x1="500" y1="0" x2="500" y2="500" stroke={isDark ? '#282a33' : '#cbd5e1'} strokeDasharray="3 3" strokeWidth="1" />
          <line x1="250" y1="0" x2="250" y2="500" stroke={isDark ? '#1f2128' : '#e2e8f0'} strokeDasharray="2 2" strokeWidth="0.8" />
          <line x1="750" y1="0" x2="750" y2="500" stroke={isDark ? '#1f2128' : '#e2e8f0'} strokeDasharray="2 2" strokeWidth="0.8" />

          <path
            d={landPath}
            fill={isDark ? '#21242d' : '#cbd5e1'}
            stroke={isDark ? '#323642' : '#94a3b8'}
            strokeWidth="0.8"
            strokeLinejoin="round"
          />
        </svg>

        {/* --------------------------------------------------------------- */}
        {/* GOOGLE MAPS STYLE FLOATING LOCATION SEARCH OVERLAY (Top-Left)  */}
        {/* --------------------------------------------------------------- */}
        <div 
          className="absolute top-3 left-3 z-30 max-w-[310px] sm:max-w-sm w-full pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
          ref={dropdownRef}
        >
          <div className={`p-1.5 rounded-2xl shadow-2xl border backdrop-blur-md transition-all ${
            isDark 
              ? 'bg-[#16171c]/90 border-[#2e313d] shadow-black/60 text-white' 
              : 'bg-white/90 border-slate-200 shadow-slate-400/20 text-slate-900'
          }`}>
            <form onSubmit={handleManualSubmit} className="flex items-center gap-1.5">
              <div className="relative flex-1 flex items-center">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
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
                  placeholder="Search location (e.g. Colorado Springs, Tokyo, Miami)..."
                  className={`w-full pl-9 pr-8 py-2 text-xs rounded-xl border focus:outline-none focus:border-[#FF007F] transition-colors ${
                    isDark
                      ? 'bg-[#101114] border-[#282a33] text-white placeholder-slate-500'
                      : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                  }`}
                />
                {loadingSuggestions ? (
                  <Loader2 className="w-3.5 h-3.5 text-[#FF007F] animate-spin absolute right-2.5" />
                ) : query.length > 0 ? (
                  <button 
                    type="button" 
                    onClick={() => setQuery('')}
                    className="absolute right-2.5 text-slate-400 hover:text-slate-200"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : null}
              </div>

              {/* GPS Device Button */}
              <button
                type="button"
                onClick={handleDeviceLocate}
                disabled={locatingDevice}
                title="Detect my device GPS location"
                className={`p-2 border rounded-xl transition flex items-center justify-center shrink-0 ${
                  isDark
                    ? 'bg-[#1e2027] hover:bg-[#282b36] border-[#2e313d] text-slate-200'
                    : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700 shadow-sm'
                }`}
              >
                <Navigation className={`w-3.5 h-3.5 text-[#FF007F] ${locatingDevice ? 'animate-spin' : ''}`} />
              </button>
            </form>

            {/* Autocomplete Dropdown List */}
            {showDropdown && suggestions.length > 0 && (
              <div className={`mt-1.5 border rounded-xl shadow-2xl overflow-hidden max-h-52 overflow-y-auto divide-y transition-colors ${
                isDark ? 'bg-[#1a1c23] border-[#2e313d] divide-[#282a33]' : 'bg-white border-slate-200 divide-slate-100'
              }`}>
                {suggestions.map((loc, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectLocation(loc)}
                    className={`w-full text-left px-3 py-2 flex items-center justify-between gap-2 text-xs transition-colors ${
                      isDark ? 'hover:bg-[#22252e] text-slate-200' : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <MapPin className="w-3 h-3 text-[#FF007F] shrink-0" />
                      <span className="truncate font-medium">{loc.displayName}</span>
                    </div>
                    <span className={`text-[10px] shrink-0 font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {loc.latitude.toFixed(1)}°, {loc.longitude.toFixed(1)}°
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Compact Mini Amalgamated Situation Pill */}
          {assessment && showAssessmentCard && (
            <div className={`mt-2 p-2.5 rounded-xl border shadow-xl backdrop-blur-md text-xs transition-all ${
              isDark 
                ? 'bg-[#121316]/95 border-[#2e313d] text-slate-300' 
                : 'bg-white/95 border-slate-200 text-slate-700'
            }`}>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-1.5 font-bold truncate">
                  <ShieldAlert className="w-3.5 h-3.5 text-[#FF007F] shrink-0" />
                  <span className="truncate">{assessment.locationName}</span>
                  {loadingAssessment && (
                    <Loader2 className="w-3 h-3 text-[#FF007F] animate-spin shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold font-mono bg-rose-500/15 text-rose-400 border border-rose-500/30">
                    Risk {assessment.localSeverityScore.toFixed(1)}/10
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAssessmentCard(false)}
                    className="text-slate-400 hover:text-slate-200 p-0.5"
                    title="Dismiss"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {assessment.weather && (
                <div className="text-[11px] text-slate-400 mb-2">
                  {assessment.weather.temperatureF.toFixed(0)}°F &bull; {assessment.weather.conditionText} &bull; Wind {assessment.weather.windSpeedMph.toFixed(0)}mph
                </div>
              )}

              {onOpenCocktail && (
                <button
                  onClick={() => {
                    onOpenCocktail(
                      assessment.cocktail || {},
                      `Amalgamated Protocol for ${assessment.locationName}`,
                      assessment.recommendedDrink,
                      assessment.localSeverityScore
                    );
                  }}
                  className="w-full py-1.5 px-3 bg-[#FF007F] hover:bg-[#E60072] text-white font-bold rounded-lg text-[11px] shadow-pink-glow-sm transition flex items-center justify-center gap-1.5"
                >
                  <Wine className="w-3 h-3" />
                  <span>Prescription: {assessment.recommendedDrink}</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Non-geospatial category banner */}
        {isNonGeospatialCategory && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-4 z-20 pointer-events-none">
            <div className={`px-4 py-2.5 rounded-xl border flex items-center gap-3 shadow-xl ${
              isDark ? 'bg-[#16171c]/95 border-[#282a33] text-slate-200' : 'bg-white/95 border-slate-200 text-slate-800'
            }`}>
              <Layers className="w-4 h-4 text-[#FF007F]" />
              <div className="text-xs">
                <span className="font-semibold text-[#FF007F]">Non-Geographical Category Active:</span>
                <span className="ml-1 text-slate-400">
                  {activeCategory === 'STOCK_MARKET' && 'Financial indices (VIX / Panic metrics) are tracked in the data board below.'}
                  {activeCategory === 'SPACE_WEATHER' && 'Solar & ionospheric events are orbital metrics tracked below.'}
                  {activeCategory === 'ASTEROID' && 'Near-Earth Object flybys are deep space orbital metrics tracked below.'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Interactive Threat Markers */}
        {mappedThreats.map((threat) => {
          const leftPct = (threat.mapX / 1000) * 100;
          const topPct = (threat.mapY / 500) * 100;
          const isHovered = hoveredThreatId === (threat.id || threat.title);
          const isHighSeverity = threat.severityScore >= 8.0;

          return (
            <button
              key={threat.id || threat.title}
              onClick={(e) => {
                e.stopPropagation();
                onSelectThreat(threat);
              }}
              onMouseEnter={() => setHoveredThreatId?.(threat.id || threat.title)}
              onMouseLeave={() => setHoveredThreatId?.(null)}
              className={`absolute transform -translate-x-1/2 -translate-y-1/2 group transition-transform ${
                isHovered ? 'z-30 scale-125' : 'z-10'
              } p-1 pointer-events-auto`}
              style={{ left: `${leftPct}%`, top: `${topPct}%` }}
              title={threat.title}
            >
              {(isHighSeverity || isHovered) && (
                <span className={`absolute -inset-1 rounded-full animate-ping opacity-60 ${
                  isHighSeverity ? 'bg-rose-500' : 'bg-[#FF007F]'
                }`} />
              )}

              <span className="relative flex h-3 w-3 items-center justify-center">
                <span className={`inline-flex rounded-full h-2.5 w-2.5 border shadow-sm transition-colors ${
                  isHovered
                    ? 'bg-[#FF007F] border-white'
                    : isHighSeverity
                    ? 'bg-rose-500 border-white'
                    : 'bg-amber-400 border-[#101114]'
                }`} />
              </span>

              {/* Tooltip Popup */}
              <div className={`${
                isHovered ? 'block' : 'hidden group-hover:block'
              } absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-xl shadow-2xl text-left whitespace-nowrap z-40 pointer-events-none border transition-all ${
                isDark
                  ? 'bg-[#1a1c23] border-[#2e313d] text-white'
                  : 'bg-white border-slate-200 text-slate-900'
              }`}>
                <div className="font-bold text-xs max-w-[220px] truncate">{threat.title}</div>
                <div className={`text-[10px] flex items-center gap-2 mt-1 ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}>
                  <span className="text-[#FF007F] font-bold">Severity {threat.severityScore.toFixed(1)}/10</span>
                  {threat.distanceKm !== undefined && (
                    <>
                      <span>&bull;</span>
                      <span className="text-amber-400 font-medium">{formatDistance(threat.distanceKm)}</span>
                    </>
                  )}
                </div>
              </div>
            </button>
          );
        })}

        {/* User Location Pin (Target Indicator) */}
        <div
          className="absolute transform -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none transition-all duration-300"
          style={{
            left: `${(userPinCoords.x / 1000) * 100}%`,
            top: `${(userPinCoords.y / 500) * 100}%`,
          }}
        >
          <div className="flex flex-col items-center">
            <div className="w-4 h-4 rounded-full bg-[#FF007F] border-2 border-white shadow-lg flex items-center justify-center animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-white" />
            </div>
            <div className="mt-1 bg-[#FF007F] text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-md whitespace-nowrap">
              {userLocation.cityName?.split(',')[0] || 'Selected Target'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


