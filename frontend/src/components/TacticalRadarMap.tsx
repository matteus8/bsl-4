'use client';

import React, { useMemo } from 'react';
import { ThreatRecord, ThreatCategory, UserLocation } from '@/types/threats';
import { Globe, Layers } from 'lucide-react';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import worldAtlasData from 'world-atlas/land-110m.json';
import { formatDistance } from '@/lib/geo';

interface SimpleFlatMapProps {
  threats: ThreatRecord[];
  userLocation: UserLocation;
  onSelectThreat: (threat: ThreatRecord) => void;
  hoveredThreatId?: number | string | null;
  setHoveredThreatId?: (id: number | string | null) => void;
  activeCategory?: ThreatCategory;
  isDark?: boolean;
}

export default function SimpleFlatMap({
  threats,
  userLocation,
  onSelectThreat,
  hoveredThreatId,
  setHoveredThreatId,
  activeCategory = 'ALL',
  isDark = true,
}: SimpleFlatMapProps) {
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

  // Extract only genuine physical coordinates (Earthquakes, localized Weather alerts)
  // Non-geographical threats (Stock Market, Space Weather, Asteroids) do NOT have map pins
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

        // Strictly require verified latitude and longitude
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
    <div className={`border rounded-2xl p-5 shadow-sm transition-colors ${
      isDark ? 'bg-[#16171c] border-[#282a33]' : 'bg-white border-slate-200'
    } space-y-3`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-[#FF007F]" />
          <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Hazard Map
          </h3>
          <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${
            isDark ? 'bg-[#21242d] text-slate-400' : 'bg-slate-100 text-slate-600'
          }`}>
            Geospatial Events Only
          </span>
        </div>
        <div className={`flex items-center gap-3 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF007F]" />
            <span>{userLocation.cityName?.split(' (')[0] || 'Your Region'}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span>{mappedThreats.length} Mapped Hazards</span>
          </span>
        </div>
      </div>

      {/* SVG Map Container */}
      <div className={`relative w-full aspect-[2/1] border rounded-xl overflow-hidden flex items-center justify-center select-none ${
        isDark ? 'bg-[#101114] border-[#282a33]' : 'bg-[#f1f5f9] border-slate-200'
      }`}>
        <svg
          className="w-full h-full"
          viewBox="0 0 1000 500"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Latitude & Longitude Reference Grid */}
          <line x1="0" y1="250" x2="1000" y2="250" stroke={isDark ? '#282a33' : '#cbd5e1'} strokeDasharray="3 3" strokeWidth="1" />
          <line x1="500" y1="0" x2="500" y2="500" stroke={isDark ? '#282a33' : '#cbd5e1'} strokeDasharray="3 3" strokeWidth="1" />
          <line x1="250" y1="0" x2="250" y2="500" stroke={isDark ? '#1f2128' : '#e2e8f0'} strokeDasharray="2 2" strokeWidth="0.8" />
          <line x1="750" y1="0" x2="750" y2="500" stroke={isDark ? '#1f2128' : '#e2e8f0'} strokeDasharray="2 2" strokeWidth="0.8" />

          {/* Real Geographical World Map Path */}
          <path
            d={landPath}
            fill={isDark ? '#21242d' : '#cbd5e1'}
            stroke={isDark ? '#323642' : '#94a3b8'}
            strokeWidth="0.8"
            strokeLinejoin="round"
          />
        </svg>

        {/* Non-geospatial category overlay banner */}
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

        {/* HTML Interactive Marker Layer */}
        {mappedThreats.map((threat) => {
          const leftPct = (threat.mapX / 1000) * 100;
          const topPct = (threat.mapY / 500) * 100;
          const isHovered = hoveredThreatId === (threat.id || threat.title);
          const isHighSeverity = threat.severityScore >= 8.0;

          return (
            <button
              key={threat.id || threat.title}
              onClick={() => onSelectThreat(threat)}
              onMouseEnter={() => setHoveredThreatId?.(threat.id || threat.title)}
              onMouseLeave={() => setHoveredThreatId?.(null)}
              className={`absolute transform -translate-x-1/2 -translate-y-1/2 group transition-transform ${
                isHovered ? 'z-30 scale-125' : 'z-10'
              } p-1`}
              style={{ left: `${leftPct}%`, top: `${topPct}%` }}
              title={threat.title}
            >
              {/* Pulsing ring for high severity or hovered event */}
              {(isHighSeverity || isHovered) && (
                <span className={`absolute -inset-1 rounded-full animate-ping opacity-60 ${
                  isHighSeverity ? 'bg-rose-500' : 'bg-[#FF007F]'
                }`} />
              )}

              {/* Solid Marker Dot */}
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

        {/* User Location Pin (Static) */}
        <div
          className="absolute transform -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none"
          style={{
            left: `${(userPinCoords.x / 1000) * 100}%`,
            top: `${(userPinCoords.y / 500) * 100}%`,
          }}
        >
          <div className="flex flex-col items-center">
            {/* Static Sharp Pin */}
            <div className="w-3.5 h-3.5 rounded-full bg-[#FF007F] border-2 border-white shadow-md flex items-center justify-center">
              <span className="w-1 h-1 rounded-full bg-white" />
            </div>
            {/* Label */}
            <div className="mt-1 bg-[#FF007F] text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-md whitespace-nowrap">
              {userLocation.cityName?.split(',')[0] || 'Your Location'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

