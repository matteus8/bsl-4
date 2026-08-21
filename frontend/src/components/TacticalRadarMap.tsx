'use client';

import React, { useMemo } from 'react';
import { ThreatRecord, UserLocation } from '@/types/threats';
import { MapPin } from 'lucide-react';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import worldAtlasData from 'world-atlas/land-110m.json';

interface SimpleFlatMapProps {
  threats: ThreatRecord[];
  userLocation: UserLocation;
  onSelectThreat: (threat: ThreatRecord) => void;
  isDark?: boolean;
}

export default function SimpleFlatMap({
  threats,
  userLocation,
  onSelectThreat,
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

  // Compute user zip pin coordinates on real map
  const userPinCoords = useMemo(() => {
    const pt = projection([userLocation.longitude, userLocation.latitude]);
    return pt ? { x: pt[0], y: pt[1] } : { x: 200, y: 150 };
  }, [projection, userLocation]);

  // Extract real coordinates for events
  const mappedThreats = useMemo(() => {
    return threats.map((t, idx) => {
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

      // If no explicit coordinates, provide realistic regional hub distribution
      if (lat === null || lon === null) {
        const titleLower = t.title.toLowerCase();
        if (titleLower.includes('california') || titleLower.includes('san andreas')) { lat = 34.05; lon = -118.24; }
        else if (titleLower.includes('oregon') || titleLower.includes('cascadia')) { lat = 44.52; lon = -124.50; }
        else if (titleLower.includes('alaska') || titleLower.includes('aleutian')) { lat = 61.21; lon = -149.90; }
        else if (titleLower.includes('hawaii')) { lat = 19.89; lon = -155.58; }
        else if (titleLower.includes('japan') || titleLower.includes('honshu')) { lat = 35.68; lon = 139.76; }
        else if (titleLower.includes('indonesia') || titleLower.includes('java')) { lat = -6.20; lon = 106.84; }
        else if (titleLower.includes('chile')) { lat = -33.44; lon = -70.66; }
        else if (titleLower.includes('mexico')) { lat = 19.43; lon = -99.13; }
        else if (titleLower.includes('pacific-antarctic') || titleLower.includes('antarctic')) { lat = -55.0; lon = -135.0; }
        else if (titleLower.includes('fiji') || titleLower.includes('tonga')) { lat = -18.14; lon = 178.44; }
        else if (titleLower.includes('iceland')) { lat = 64.14; lon = -21.94; }
        else if (titleLower.includes('greece') || titleLower.includes('turkey') || titleLower.includes('mediterranean')) { lat = 37.98; lon = 23.72; }
        else if (t.threatType === 'STOCK_MARKET') {
          // Major financial hubs
          const hubs = [
            [-74.006, 40.712], // NYC
            [-0.127, 51.507],  // London
            [139.691, 35.689], // Tokyo
            [8.541, 47.376],   // Zurich
            [114.169, 22.319], // Hong Kong
          ];
          const hub = hubs[idx % hubs.length];
          lon = hub[0];
          lat = hub[1];
        } else if (t.threatType === 'TERRESTRIAL_WEATHER') {
          const weatherLocs = [
            [-95.369, 29.760], // Gulf Coast
            [-80.191, 25.761], // Florida
            [-97.516, 35.467], // Tornado Alley
            [-87.629, 41.878], // Great Lakes
          ];
          const w = weatherLocs[idx % weatherLocs.length];
          lon = w[0];
          lat = w[1];
        } else if (t.threatType === 'SPACE_WEATHER') {
          // Auroral / solar monitoring stations
          const stations = [
            [-18.0, 65.0],   // Arctic/Iceland
            [-147.7, 64.8],  // Fairbanks
            [18.9, 69.6],    // Tromso
            [-155.5, 19.8],  // Mauna Kea
          ];
          const st = stations[idx % stations.length];
          lon = st[0];
          lat = st[1];
        } else if (t.threatType === 'ASTEROID') {
          // Deep space tracking observatories
          const dsn = [
            [-116.8, 35.3],  // Goldstone
            [148.9, -35.4],  // Canberra
            [-4.2, 40.4],    // Madrid
            [-70.7, -29.2],  // La Silla Chile
            [138.6, -34.9],  // Adelaide
          ];
          const obs = dsn[idx % dsn.length];
          lon = obs[0];
          lat = obs[1];
        }
      }

      if (lat === null || lon === null) return null;

      const pt = projection([lon, lat]);
      if (!pt) return null;

      return {
        ...t,
        mapX: pt[0],
        mapY: pt[1],
      };
    }).filter((t): t is ThreatRecord & { mapX: number; mapY: number } => t !== null);
  }, [threats, projection]);

  return (
    <div className={`border rounded-2xl p-5 shadow-sm transition-colors ${
      isDark ? 'bg-[#16171c] border-[#282a33]' : 'bg-white border-slate-200'
    } space-y-3`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-[#FF007F]" />
          <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Global Activity Map
          </h3>
        </div>
        <div className={`flex items-center gap-3 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF007F]" />
            <span>{userLocation.cityName?.split(' (')[0] || 'Your Region'}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span>{mappedThreats.length} Active Events</span>
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

        {/* HTML Interactive Marker Layer */}
        {mappedThreats.map((threat) => {
          const leftPct = (threat.mapX / 1000) * 100;
          const topPct = (threat.mapY / 500) * 100;

          return (
            <button
              key={threat.id || threat.title}
              onClick={() => onSelectThreat(threat)}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 group z-10 p-1"
              style={{ left: `${leftPct}%`, top: `${topPct}%` }}
              title={threat.title}
            >
              {/* Solid Static Event Dot */}
              <span className="relative flex h-2.5 w-2.5 items-center justify-center">
                <span className={`inline-flex rounded-full h-2 w-2 bg-amber-400 border shadow-sm ${
                  isDark ? 'border-[#101114]' : 'border-white'
                }`} />
              </span>

              {/* Hover Tooltip Popup */}
              <div className={`hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-3 py-1.5 rounded-lg shadow-xl text-left whitespace-nowrap z-30 pointer-events-none border transition-all ${
                isDark
                  ? 'bg-[#1a1c23] border-[#2e313d] text-white'
                  : 'bg-white border-slate-200 text-slate-900'
              }`}>
                <div className="font-bold text-xs max-w-[200px] truncate">{threat.title}</div>
                <div className={`text-[10px] flex items-center gap-2 mt-0.5 ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}>
                  <span className="text-[#FF007F] font-bold">Lvl {threat.severityScore.toFixed(1)}</span>
                  <span>&bull;</span>
                  <span className="truncate max-w-[130px]">{threat.recommendedDrink}</span>
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
