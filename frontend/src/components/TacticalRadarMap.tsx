'use client';

import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { ThreatRecord, ThreatCategory, UserLocation, GeocodedLocation, RegionalAssessment } from '@/types/threats';
import { 
  Globe, 
  Layers, 
  Search, 
  Navigation, 
  MapPin, 
  Loader2, 
  X, 
  Crosshair, 
  ChevronUp, 
  ChevronDown, 
  Plus, 
  Minus, 
  RotateCcw 
} from 'lucide-react';
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

  // Pan & Zoom State
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const dragInitialPanRef = useRef({ x: 0, y: 0 });
  const hasMovedRef = useRef(false);
  const touchStartDistRef = useRef(0);
  const touchStartZoomRef = useRef(1);

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

  // Compute user pin coordinates on base map
  const userPinCoords = useMemo(() => {
    const pt = projection([userLocation.longitude, userLocation.latitude]);
    return pt ? { x: pt[0], y: pt[1] } : { x: 500, y: 250 };
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

  // Zoom controls
  const handleZoomIn = () => setZoom((prev) => Math.min(8, prev * 1.4));
  const handleZoomOut = () => {
    setZoom((prev) => {
      const next = Math.max(1, prev / 1.4);
      if (next === 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };
  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Convert screen click to geographical pin placement accounting for pan & zoom
  const dropPinAtScreenPoint = useCallback((clientX: number, clientY: number) => {
    if (!mapContainerRef.current) return;
    const rect = mapContainerRef.current.getBoundingClientRect();
    const rawX = ((clientX - rect.left) / rect.width) * 1000;
    const rawY = ((clientY - rect.top) / rect.height) * 500;

    // Invert zoom and pan matrix: mapX = (rawX - 500 - pan.x) / zoom + 500
    const mapX = (rawX - 500 - pan.x) / zoom + 500;
    const mapY = (rawY - 250 - pan.y) / zoom + 250;

    const coords = projection.invert?.([mapX, mapY]);
    if (coords && !isNaN(coords[0]) && !isNaN(coords[1])) {
      const lon = Math.round(coords[0] * 100) / 100;
      const lat = Math.round(coords[1] * 100) / 100;
      setUserLocation({
        latitude: lat,
        longitude: lon,
        cityName: `Map Pin (${lat.toFixed(1)}°, ${lon.toFixed(1)}°)`,
        isAutoDetected: false,
      });
      setQuery('');
    }
  }, [pan.x, pan.y, zoom, projection, setUserLocation]);

  // Mouse Drag / Pan Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    dragInitialPanRef.current = { ...pan };
    hasMovedRef.current = false;
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    if (Math.hypot(dx, dy) > 4) {
      hasMovedRef.current = true;
    }
    setPan({
      x: dragInitialPanRef.current.x + dx,
      y: dragInitialPanRef.current.y + dy,
    });
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!hasMovedRef.current && isDragging) {
      dropPinAtScreenPoint(e.clientX, e.clientY);
    }
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  // Wheel Zoom Handler - only intercepts if ctrl or meta key is held (standard map behavior)
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.18 : 0.85;
      setZoom((prev) => {
        const next = Math.min(8, Math.max(1, prev * factor));
        if (next === 1) setPan({ x: 0, y: 0 });
        return next;
      });
    }
  };

  // Touch Handlers for Mobile Pan & Pinch Zoom
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      dragStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      dragInitialPanRef.current = { ...pan };
      hasMovedRef.current = false;
      setIsDragging(true);
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartDistRef.current = dist;
      touchStartZoomRef.current = zoom;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDragging) {
      const dx = e.touches[0].clientX - dragStartRef.current.x;
      const dy = e.touches[0].clientY - dragStartRef.current.y;
      if (Math.hypot(dx, dy) > 6) {
        hasMovedRef.current = true;
      }
      setPan({
        x: dragInitialPanRef.current.x + dx,
        y: dragInitialPanRef.current.y + dy,
      });
    } else if (e.touches.length === 2 && touchStartDistRef.current > 0) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = dist / touchStartDistRef.current;
      setZoom(Math.min(8, Math.max(1, touchStartZoomRef.current * ratio)));
      hasMovedRef.current = true;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length === 0) {
      if (!hasMovedRef.current && isDragging && e.changedTouches.length > 0) {
        dropPinAtScreenPoint(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
      }
      setIsDragging(false);
      touchStartDistRef.current = 0;
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
        impactNote = 'Immediate shockwave radius (< 150 km)';
      } else if (d < 500) {
        pts = Math.round((2.0 + (500 - d) / 150) * 10) / 10;
        impactNote = 'Regional monitoring zone (150 – 500 km)';
      } else if (d < 1500) {
        pts = Math.round((0.5 + (1500 - d) / 2000) * 10) / 10;
        impactNote = 'Distant peripheral reading (500 – 1,500 km)';
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
            Drag to pan &bull; Zoom controls (+ / -) &bull; Click to set target pin
          </span>
        </div>
        <div className={`flex items-center gap-3 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          <span className="flex items-center gap-1.5 font-medium font-mono text-[11px]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF007F] shadow-sm" />
            <span className="truncate max-w-[160px] sm:max-w-none">{userLocation.cityName?.split(' (')[0] || 'Your Region'}</span>
          </span>
          <span className="flex items-center gap-1.5 font-mono text-[11px]">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span>{mappedThreats.length} Active Mapped Quakes/Alerts</span>
          </span>
        </div>
      </div>

      {/* SVG Map Container with Pan, Zoom & HUD Overlay */}
      <div 
        ref={mapContainerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`relative w-full aspect-[2/1] min-h-[320px] sm:min-h-[440px] border rounded-xl overflow-hidden flex items-center justify-center select-none cursor-pointer ${
          isDark ? 'bg-[#101114] border-[#282a33]' : 'bg-[#f1f5f9] border-slate-200'
        }`}
      >
        {/* Real Geographical World Map SVG with Pan/Zoom Transform */}
        <svg
          className="w-full h-full pointer-events-none"
          viewBox="0 0 1000 500"
          preserveAspectRatio="xMidYMid meet"
        >
          <g transform={`translate(${500 + pan.x}, ${250 + pan.y}) scale(${zoom}) translate(-500, -250)`}>
            {/* Latitude & Longitude Reference Grid */}
            <line x1="0" y1="250" x2="1000" y2="250" stroke={isDark ? '#282a33' : '#cbd5e1'} strokeDasharray="3 3" strokeWidth="0.8" opacity="0.6" />
            <line x1="500" y1="0" x2="500" y2="500" stroke={isDark ? '#282a33' : '#cbd5e1'} strokeDasharray="3 3" strokeWidth="0.8" opacity="0.6" />
            <line x1="250" y1="0" x2="250" y2="500" stroke={isDark ? '#1f2128' : '#e2e8f0'} strokeDasharray="2 2" strokeWidth="0.6" opacity="0.4" />
            <line x1="750" y1="0" x2="750" y2="500" stroke={isDark ? '#1f2128' : '#e2e8f0'} strokeDasharray="2 2" strokeWidth="0.6" opacity="0.4" />

            {/* Landmass Outlines */}
            <path
              d={landPath}
              fill={isDark ? '#21242d' : '#cbd5e1'}
              stroke={isDark ? '#323642' : '#94a3b8'}
              strokeWidth="0.7"
              strokeLinejoin="round"
            />

            {/* Simple Minimal Micro-Dots on Vector Map */}
            {mappedThreats.map((threat) => {
              const isHovered = hoveredThreatId === (threat.id || threat.title);
              const isHighSeverity = threat.severityScore >= 8.0;
              const radius = isHighSeverity ? 2.8 : 2.0;

              return (
                <g 
                  key={threat.id || threat.title} 
                  className="pointer-events-auto cursor-pointer"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <circle
                    cx={threat.mapX}
                    cy={threat.mapY}
                    r={radius}
                    fill={isHovered ? '#FF007F' : isHighSeverity ? '#f43f5e' : '#f59e0b'}
                    fillOpacity={1}
                    stroke={isHighSeverity ? '#b91c1c' : '#78350f'}
                    strokeWidth={0.5}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectThreat(threat);
                    }}
                    onMouseEnter={() => setHoveredThreatId?.(threat.id || threat.title)}
                    onMouseLeave={() => setHoveredThreatId?.(null)}
                  />
                </g>
              );
            })}

            {/* User Target Pin Marker: Minimalist pinpoint */}
            <g
              transform={`translate(${userPinCoords.x}, ${userPinCoords.y})`}
              className="pointer-events-none transition-all duration-300"
            >
              <circle cx="0" cy="0" r="3" fill="#FF007F" stroke="#ffffff" strokeWidth="1" />
            </g>
          </g>
        </svg>

        {/* --------------------------------------------------------------- */}
        {/* FLOATING LOCATION SEARCH OVERLAY (Top-Left)                     */}
        {/* --------------------------------------------------------------- */}
        <div 
          className="absolute top-3 left-3 z-30 max-w-[280px] sm:max-w-xs w-full pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
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
                  placeholder="Search city, address, or region..."
                  className={`w-full pl-9 pr-8 py-1.5 text-xs rounded-xl border focus:outline-none focus:border-[#FF007F] transition-colors ${
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
                title="Detect device GPS location"
                className={`p-1.5 border rounded-xl transition flex items-center justify-center shrink-0 ${
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
              <div className={`mt-1.5 border rounded-xl shadow-2xl overflow-hidden max-h-48 overflow-y-auto divide-y transition-colors ${
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

        {/* --------------------------------------------------------------- */}
        {/* ZOOM & VIEW CONTROL TOOLBAR (Top-Right)                         */}
        {/* --------------------------------------------------------------- */}
        <div 
          className="absolute top-3 right-3 z-30 flex flex-col gap-1 pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={handleZoomIn}
            title="Zoom In (+)"
            className={`p-1.5 rounded-xl border backdrop-blur-md transition-all shadow-md flex items-center justify-center ${
              isDark 
                ? 'bg-[#16171c]/90 hover:bg-[#22252e] border-[#2e313d] text-slate-200' 
                : 'bg-white/90 hover:bg-slate-100 border-slate-200 text-slate-800'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            title="Zoom Out (-)"
            className={`p-1.5 rounded-xl border backdrop-blur-md transition-all shadow-md flex items-center justify-center ${
              isDark 
                ? 'bg-[#16171c]/90 hover:bg-[#22252e] border-[#2e313d] text-slate-200' 
                : 'bg-white/90 hover:bg-slate-100 border-slate-200 text-slate-800'
            }`}
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          {(zoom > 1 || pan.x !== 0 || pan.y !== 0) && (
            <button
              type="button"
              onClick={handleResetView}
              title="Reset Map View"
              className={`p-1.5 rounded-xl border backdrop-blur-md transition-all shadow-md flex items-center justify-center text-[#FF007F] ${
                isDark 
                  ? 'bg-[#16171c]/90 hover:bg-[#22252e] border-[#2e313d]' 
                  : 'bg-white/90 hover:bg-slate-100 border-slate-200'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Non-geospatial category notice */}
        {isNonGeospatialCategory && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-4 z-20 pointer-events-none">
            <div className={`px-4 py-2.5 rounded-xl border flex items-center gap-3 shadow-xl ${
              isDark ? 'bg-[#16171c]/95 border-[#282a33] text-slate-200' : 'bg-white/95 border-slate-200 text-slate-800'
            }`}>
              <Layers className="w-4 h-4 text-[#FF007F]" />
              <div className="text-xs">
                <span className="font-semibold text-[#FF007F]">Non-Geographical Category Active:</span>
                <span className="ml-1 text-slate-400">
                  {activeCategory === 'STOCK_MARKET' && 'Financial indices (VIX / Panic metrics) are tracked in Section 4 below.'}
                  {activeCategory === 'SPACE_WEATHER' && 'Solar & ionospheric events are orbital metrics tracked in Section 3 below.'}
                  {activeCategory === 'ASTEROID' && 'Near-Earth Object flybys are orbital metrics tracked in Section 3 below.'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* --------------------------------------------------------------- */}
        {/* CLEAN MINIMAL BOTTOM-RIGHT HUD & EXPANDABLE POP-OUT CARD        */}
        {/* --------------------------------------------------------------- */}
        <div 
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          className={`absolute bottom-3 right-3 z-30 transition-all duration-300 pointer-events-auto ${
            isScoreExpanded 
              ? 'max-w-[310px] sm:max-w-[340px] w-[calc(100%-24px)]' 
              : 'max-w-[190px] sm:max-w-[210px] w-auto'
          }`}
        >
          <div className={`rounded-2xl border backdrop-blur-md shadow-2xl transition-all ${
            isDark 
              ? 'bg-[#16171c]/95 border-[#2e313d] shadow-black/80 text-white' 
              : 'bg-white/95 border-slate-200 shadow-slate-400/30 text-slate-900'
          }`}>
            {/* COLLAPSED STATE: Ultra-clean, minimal HUD pill */}
            {!isScoreExpanded ? (
              <button
                type="button"
                onClick={() => setIsScoreExpanded(true)}
                className="w-full px-3 py-1.5 flex items-center justify-between gap-2 hover:opacity-90 transition-opacity text-left"
              >
                <div className="flex items-center gap-1.5">
                  <Crosshair className="w-3.5 h-3.5 text-[#FF007F] shrink-0" />
                  <div className="flex items-baseline gap-1 font-mono">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">SECTOR:</span>
                    <span className={`text-sm font-black ${localSectorStats.colorClass}`}>
                      {localSectorStats.score.toFixed(1)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <span className={`text-[8px] font-mono font-bold px-1 py-0.5 rounded border uppercase tracking-tight ${localSectorStats.badgeClass}`}>
                    {localSectorStats.level}
                  </span>
                  <ChevronUp className="w-3 h-3 text-slate-400 shrink-0" />
                </div>
              </button>
            ) : (
              /* EXPANDED STATE: Full Breakdown & Integrated Local Reality Ground Status */
              <div className="p-3 space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between gap-1.5 pb-1 border-b border-[#2e313d]">
                  <div className="flex items-center gap-1.5">
                    <Crosshair className="w-3.5 h-3.5 text-[#FF007F]" />
                    <span className="text-[10px] font-black uppercase tracking-wider font-mono text-slate-300">
                      LOCAL SECTOR TELEMETRY
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsScoreExpanded(false)}
                    className={`p-1 rounded-lg border text-slate-400 hover:text-white transition-colors ${
                      isDark ? 'bg-[#21242e] border-[#2e313d]' : 'bg-slate-100 border-slate-200'
                    }`}
                  >
                    <ChevronDown className="w-3 h-3 text-slate-300" />
                  </button>
                </div>

                {/* Score & Target Summary Row */}
                <div className="flex items-center justify-between gap-2 font-mono">
                  <div className="flex items-baseline gap-1">
                    <span className={`text-xl font-black ${localSectorStats.colorClass}`}>
                      {localSectorStats.score.toFixed(1)}
                    </span>
                    <span className="text-[10px] text-slate-500">/ 10</span>
                    <span className={`ml-1.5 text-[8px] font-bold px-1.5 py-0.2 rounded border uppercase ${localSectorStats.badgeClass}`}>
                      {localSectorStats.level}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 truncate max-w-[120px]" title={userLocation.cityName}>
                    {userLocation.cityName?.split(',')[0] || 'Target'}
                  </span>
                </div>

                {/* Integrated Ground Reality & Nearest Earthquake Status */}
                <div className={`p-2 rounded-xl border flex items-start gap-1.5 text-[9px] font-mono leading-relaxed ${
                  isDark ? 'bg-[#101114] border-[#282a33] text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 mt-1" />
                  <div>
                    {assessment?.nearbySeismic ? (
                      <>
                        Nearest earthquake: <strong className="text-white">{formatDistance(assessment.nearbySeismic.nearestDistanceKm)}</strong> ({assessment.nearbySeismic.place}).
                      </>
                    ) : localSectorStats.nearestDistanceKm < 50000 ? (
                      <>
                        Nearest seismic epicenter: <strong className="text-white">{formatDistance(localSectorStats.nearestDistanceKm)}</strong>.
                      </>
                    ) : (
                      <>Nearest seismic epicenter is over 1,500 km away.</>
                    )}{' '}
                    <strong className="text-emerald-400">Ground status: Stable.</strong>
                  </div>
                </div>

                {/* Itemized Contributing Factors List - Fits without scrolling */}
                <div className="space-y-1">
                  {localSectorStats.factors.slice(0, 3).map((f, idx) => (
                    <div
                      key={idx}
                      className={`p-1.5 rounded-xl border text-[9px] font-mono ${
                        isDark ? 'bg-[#101114] border-[#282a33]' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="font-bold text-slate-200 truncate max-w-[180px]">{f.title}</span>
                        <span className={`px-1 rounded font-black text-[8px] shrink-0 ${
                          f.points >= 3.0
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : f.points >= 1.0
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        }`}>
                          +{f.points.toFixed(1)} pts
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[8px] text-slate-400">
                        <span className="truncate max-w-[160px]">{f.detail}</span>
                        {f.distanceKm !== undefined && (
                          <span className="text-[#FF007F] font-semibold shrink-0">{f.distanceKm.toLocaleString()} km</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between text-[8px] font-mono text-slate-500 pt-0.5">
                  <span>⚡ Pure Haversine distance model</span>
                  <button
                    type="button"
                    onClick={() => setIsScoreExpanded(false)}
                    className="text-[#FF007F] hover:underline font-bold"
                  >
                    Minimize ▴
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
