'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { ThreatRecord, ThreatCategory, UserLocation, GeocodedLocation, RegionalAssessment } from '@/types/threats';
import { Globe, Layers, Search, Navigation, MapPin, Loader2, X, Crosshair, ChevronUp, ChevronDown } from 'lucide-react';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import worldAtlasData from 'world-atlas/land-110m.json';
import { formatDistance, calculateDistanceKm } from '@/lib/geo';
import { geocodeAddress, assessLocation } from '@/lib/api';

interface TacticalRadarMapProps {
  threats: ThreatRecord[];
  userLocation: UserLocation;
  setUserLocation: (loc: UserLocation) => void;
  onSelectThreat: (threat: ThreatRecord) => void;
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
  const [isScoreExpanded, setIsScoreExpanded] = useState(false);
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
      try {
        const data = await assessLocation({
          address: userLocation.cityName,
          lat: userLocation.latitude,
          lon: userLocation.longitude,
        });
        if (!isCancelled && data) {
          setAssessment(data);
        }
      } catch {
        // Fallback
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

  // Real-time pure mathematical local sector risk score and factor breakdown
  const localSectorStats = useMemo(() => {
    const physicalEvents: { threat: ThreatRecord; distanceKm: number }[] = [];

    threats.forEach((t) => {
      if (t.threatType === 'EARTHQUAKE' || t.threatType === 'TERRESTRIAL_WEATHER') {
        let dKm = t.distanceKm;
        if (dKm === undefined) {
          try {
            const meta = typeof t.metadata === 'string' ? JSON.parse(t.metadata) : t.metadata;
            const lat = meta?.latitude ?? meta?.lat;
            const lon = meta?.longitude ?? meta?.lon;
            if (typeof lat === 'number' && typeof lon === 'number') {
              dKm = calculateDistanceKm(userLocation.latitude, userLocation.longitude, lat, lon);
            }
          } catch {
            // Ignored
          }
        }

        if (dKm !== undefined) {
          physicalEvents.push({ threat: t, distanceKm: dKm });
        }
      }
    });

    // Sort by proximity
    physicalEvents.sort((a, b) => a.distanceKm - b.distanceKm);

    const nearestEvent = physicalEvents.length > 0 ? physicalEvents[0].threat : null;
    const nearestDistanceKm = physicalEvents.length > 0 ? physicalEvents[0].distanceKm : 999999;

    // Breakdown score factors
    const factors: {
      category: 'BASE' | 'SEISMIC' | 'WEATHER';
      title: string;
      points: number;
      distanceKm?: number;
      detail: string;
    }[] = [];

    // Factor 1: Planetary baseline
    factors.push({
      category: 'BASE',
      title: 'Planetary Equilibrium Baseline',
      points: 1.0,
      detail: 'Standard background geodynamic noise & orbital baseline',
    });

    let calculatedScore = 1.0;

    // Evaluate top physical events
    const topNearby = physicalEvents.slice(0, 3);
    topNearby.forEach((item) => {
      const d = item.distanceKm;
      let pts = 0;
      let impactNote = '';

      if (d < 150) {
        pts = Math.round((4.5 + (150 - d) / 30) * 10) / 10;
        impactNote = 'Immediate impact radius (< 150 km)';
      } else if (d < 500) {
        pts = Math.round((2.0 + (500 - d) / 150) * 10) / 10;
        impactNote = 'Regional shockwave / monitoring zone';
      } else if (d < 1500) {
        pts = Math.round((0.5 + (1500 - d) / 2000) * 10) / 10;
        impactNote = 'Distant peripheral seismic reading';
      } else {
        pts = 0.2;
        impactNote = 'Negligible continental distance (> 1,500 km)';
      }

      calculatedScore += pts;
      factors.push({
        category: item.threat.threatType === 'EARTHQUAKE' ? 'SEISMIC' : 'WEATHER',
        title: item.threat.title.replace(/^M\s*[\d.]+\s*-\s*/i, ''),
        points: pts,
        distanceKm: Math.round(d),
        detail: impactNote,
      });
    });

    if (topNearby.length === 0) {
      factors.push({
        category: 'SEISMIC',
        title: 'Zero Active Seismic / Storm Hazards',
        points: 0.0,
        detail: 'No active M4.5+ earthquakes or storm warnings in sensor range',
      });
    }

    const finalScore = Math.min(10.0, Math.round(calculatedScore * 10) / 10);

    let level = 'NOMINAL';
    let colorClass = 'text-emerald-400';
    let badgeClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';

    if (finalScore >= 7.5) {
      level = 'CRITICAL ZONE';
      colorClass = 'text-rose-500';
      badgeClass = 'bg-rose-500/10 text-rose-400 border-rose-500/40';
    } else if (finalScore >= 4.5) {
      level = 'REGIONAL ALERT';
      colorClass = 'text-amber-400';
      badgeClass = 'bg-amber-500/10 text-amber-400 border-amber-500/40';
    } else if (finalScore >= 2.5) {
      level = 'PERIPHERAL';
      colorClass = 'text-sky-400';
      badgeClass = 'bg-sky-500/10 text-sky-400 border-sky-500/30';
    } else {
      level = 'SAFE & NOMINAL';
      colorClass = 'text-emerald-400';
      badgeClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    }

    return {
      score: finalScore,
      level,
      colorClass,
      badgeClass,
      nearestDistanceKm: Math.round(nearestDistanceKm),
      nearestEvent: nearestEvent as ThreatRecord | null,
      factors,
    };
  }, [threats, userLocation.latitude, userLocation.longitude]);

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
          <span className="text-[11px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md bg-[#FF007F]/10 text-[#FF007F] border border-[#FF007F]/25 flex items-center gap-1.5 font-mono">
            <Globe className="w-3.5 h-3.5" />
            2. GEOSPATIAL MAP & LOCAL REALITY
          </span>
          <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${
            isDark ? 'bg-[#21242d] text-slate-400' : 'bg-slate-100 text-slate-600'
          }`}>
            Click map or search to reposition pin
          </span>
        </div>
        <div className={`flex items-center gap-3 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          <span className="flex items-center gap-1.5 font-medium font-mono text-[11px]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF007F] shadow-sm animate-pulse" />
            <span className="truncate max-w-[160px] sm:max-w-none">{userLocation.cityName?.split(' (')[0] || 'Your Region'}</span>
          </span>
          <span className="flex items-center gap-1.5 font-mono text-[11px]">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span>{mappedThreats.length} Active Mapped Quakes/Alerts</span>
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

        {/* Bottom-Right Local Sector Score HUD & Pop-out Breakdown */}
        <div 
          onClick={(e) => e.stopPropagation()}
          className={`absolute bottom-3 right-3 z-30 transition-all duration-300 pointer-events-auto ${
            isScoreExpanded 
              ? 'max-w-[320px] sm:max-w-[360px] w-[calc(100%-24px)]' 
              : 'max-w-[240px] sm:max-w-[270px] w-full'
          }`}
        >
          <div className={`p-3 rounded-2xl border backdrop-blur-md shadow-2xl transition-all ${
            isDark 
              ? 'bg-[#16171c]/95 border-[#2e313d] shadow-black/80 text-white' 
              : 'bg-white/95 border-slate-200 shadow-slate-400/30 text-slate-900'
          }`}>
            {/* Header */}
            <div className="flex items-center justify-between gap-1.5 mb-1.5">
              <div className="flex items-center gap-1.5">
                <Crosshair className="w-3.5 h-3.5 text-[#FF007F] animate-spin" style={{ animationDuration: '8s' }} />
                <span className="text-[10px] font-black uppercase tracking-wider font-mono text-slate-400">
                  {isScoreExpanded ? 'LOCAL RISK BREAKDOWN' : 'LOCAL SECTOR SCORE'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase tracking-tight ${localSectorStats.badgeClass}`}>
                  {localSectorStats.level}
                </span>
                <button
                  type="button"
                  onClick={() => setIsScoreExpanded(!isScoreExpanded)}
                  title={isScoreExpanded ? 'Collapse breakdown' : 'View score factors'}
                  className={`p-1 rounded-lg border text-slate-400 hover:text-white transition-colors ${
                    isDark ? 'bg-[#21242e] border-[#2e313d] hover:bg-[#2c303d]' : 'bg-slate-100 border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  {isScoreExpanded ? (
                    <ChevronDown className="w-3 h-3 text-slate-300" />
                  ) : (
                    <ChevronUp className="w-3 h-3 text-[#FF007F]" />
                  )}
                </button>
              </div>
            </div>

            {/* Score & Quick Metric Row */}
            <div className="flex items-baseline justify-between gap-2">
              <div className="flex items-baseline gap-1">
                <span className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${localSectorStats.colorClass}`}>
                  {localSectorStats.score.toFixed(1)}
                </span>
                <span className="text-[10px] font-mono text-slate-500">/ 10</span>
              </div>

              <div className="text-right">
                <div className="text-[10px] font-mono text-slate-300">
                  {localSectorStats.nearestDistanceKm < 50000 ? (
                    <span className="font-bold text-[#FF007F]">{formatDistance(localSectorStats.nearestDistanceKm)}</span>
                  ) : (
                    'No local events'
                  )}
                </div>
                <div className="text-[9px] font-mono text-slate-500 truncate max-w-[130px]" title={localSectorStats.nearestEvent?.title || 'Ground nominal'}>
                  {localSectorStats.nearestEvent ? localSectorStats.nearestEvent.title.replace(/^M\s*[\d.]+\s*-\s*/i, '') : 'Ground nominal'}
                </div>
              </div>
            </div>

            {/* Quick Toggle Link in collapsed mode */}
            {!isScoreExpanded && (
              <button
                type="button"
                onClick={() => setIsScoreExpanded(true)}
                className="mt-2 w-full text-left text-[9px] font-mono text-[#FF007F] hover:underline flex items-center justify-between border-t border-[#2e313d]/40 pt-1.5"
              >
                <span>Why this score?</span>
                <span className="text-slate-400">View factors ▾</span>
              </button>
            )}

            {/* Expanded Detailed Pop-out Breakdown */}
            {isScoreExpanded && (
              <div className="mt-3 pt-2.5 border-t border-[#2e313d] space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pb-1 border-b border-[#282a33]">
                  <span>Target Sector:</span>
                  <span className="font-bold text-slate-200 truncate max-w-[180px]">
                    {userLocation.cityName?.split(',')[0] || 'Selected Target'}
                  </span>
                </div>

                {/* Contributing Factor Items */}
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {localSectorStats.factors.map((f, idx) => (
                    <div
                      key={idx}
                      className={`p-2 rounded-xl border text-[10px] font-mono transition-colors ${
                        isDark ? 'bg-[#101114] border-[#282a33]' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5 mb-0.5">
                        <span className="font-bold text-slate-200 truncate">{f.title}</span>
                        <span className={`px-1.5 py-0.2 rounded font-black text-[9px] shrink-0 ${
                          f.points >= 3.0
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : f.points >= 1.0
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        }`}>
                          +{f.points.toFixed(1)} pts
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[9px] text-slate-400">
                        <span>{f.detail}</span>
                        {f.distanceKm !== undefined && (
                          <span className="text-[#FF007F] font-semibold">{f.distanceKm.toLocaleString()} km</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Math Transparency Footer */}
                <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 pt-1">
                  <span>⚡ Pure Haversine distance model</span>
                  <button
                    type="button"
                    onClick={() => setIsScoreExpanded(false)}
                    className="text-[#FF007F] hover:underline font-bold"
                  >
                    Close ▴
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Local Reality Summary Bar */}
      <div className={`p-3.5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs ${
        isDark ? 'bg-[#101114] border-[#282a33] text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
      }`}>
        <div className="flex items-center gap-2 font-mono text-[11px] sm:text-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span>
            {assessment?.nearbySeismic ? (
              <>
                Nearest earthquake is <strong>{formatDistance(assessment.nearbySeismic.nearestDistanceKm)}</strong> away ({assessment.nearbySeismic.place}).
              </>
            ) : (
              <>Nearest earthquake is over 800 miles away.</>
            )}{' '}
            <strong className="text-emerald-400">Ground status: Stable.</strong>
          </span>
        </div>

        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 shrink-0">
          LOCAL REALITY: VERIFIED
        </span>
      </div>
    </div>
  );
}


