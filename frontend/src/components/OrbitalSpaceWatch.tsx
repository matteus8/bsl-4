'use client';

import React, { useState, useMemo } from 'react';
import { ThreatRecord } from '@/types/threats';
import { Orbit, Flame, ChevronDown, ChevronUp } from 'lucide-react';

interface OrbitalSpaceWatchProps {
  threats: ThreatRecord[];
  onSelectThreat: (threat: ThreatRecord) => void;
  hoveredThreatId?: number | string | null;
  setHoveredThreatId?: (id: number | string | null) => void;
  isDark?: boolean;
}

export default function OrbitalSpaceWatch({
  threats,
  onSelectThreat,
  hoveredThreatId,
  setHoveredThreatId,
  isDark = true,
}: OrbitalSpaceWatchProps) {
  const [showAllAsteroids, setShowAllAsteroids] = useState(false);
  const [showAllSolar, setShowAllSolar] = useState(false);

  // Filter for orbital & solar threats
  const orbitalEvents = useMemo(() => {
    return threats.filter(
      (t) => t.threatType === 'ASTEROID' || t.threatType === 'SPACE_WEATHER'
    );
  }, [threats]);

  // Sort asteroids by closest miss distance (nearest approaches first)
  const asteroidEvents = useMemo(() => {
    return orbitalEvents
      .filter((t) => t.threatType === 'ASTEROID')
      .sort((a, b) => {
        let metaA: Record<string, unknown> = {};
        let metaB: Record<string, unknown> = {};
        try { metaA = typeof a.metadata === 'string' ? JSON.parse(a.metadata) : ((a.metadata as unknown as Record<string, unknown>) || {}); } catch { metaA = {}; }
        try { metaB = typeof b.metadata === 'string' ? JSON.parse(b.metadata) : ((b.metadata as unknown as Record<string, unknown>) || {}); } catch { metaB = {}; }
        
        const missA = typeof metaA.miss_distance_km === 'number' ? metaA.miss_distance_km : 999999999;
        const missB = typeof metaB.miss_distance_km === 'number' ? metaB.miss_distance_km : 999999999;
        if (missA !== missB) return missA - missB;
        return b.severityScore - a.severityScore;
      });
  }, [orbitalEvents]);

  // Sort space weather by newest date / highest severity
  const spaceWeatherEvents = useMemo(() => {
    return orbitalEvents
      .filter((t) => t.threatType === 'SPACE_WEATHER')
      .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
  }, [orbitalEvents]);

  const displayedAsteroids = showAllAsteroids ? asteroidEvents : asteroidEvents.slice(0, 4);
  const displayedSolar = showAllSolar ? spaceWeatherEvents : spaceWeatherEvents.slice(0, 4);

  const getAsteroidWittyVerdict = (threat: ThreatRecord) => {
    let meta: Record<string, unknown> = {};
    try {
      if (typeof threat.metadata === 'string') meta = JSON.parse(threat.metadata);
      else if (threat.metadata) meta = threat.metadata as unknown as Record<string, unknown>;
    } catch {
      meta = {};
    }

    const isHazardous = meta.is_hazardous === true;
    const missKm = typeof meta.miss_distance_km === 'number' ? meta.miss_distance_km : 4200000;
    const lunarDist = missKm / 384400;
    
    if (lunarDist > 50) {
      return `Deep-space safe pass (${(missKm / 1e6).toFixed(1)}M km / ${lunarDist.toFixed(0)}x Moon distance). ${isHazardous ? 'PHA orbit geometry but zero threat at this range.' : 'Harmless orbital flyby.'}`;
    }
    if (lunarDist > 10) {
      return `Passed at comfortable planetary distance (${(missKm / 1e6).toFixed(1)}M km). Dinosaurs would have been jealous. Planetary defense nominal.`;
    }
    if (lunarDist > 2) {
      return `Regional radar tracking pass (${lunarDist.toFixed(1)} Lunar Distances). Clean trajectory with zero atmospheric entry risk.`;
    }
    if (lunarDist > 0.5) {
      return `Close lunar-bracket approach (${lunarDist.toFixed(1)} LD). Active surveillance by Goldstone Deep Space radar.`;
    }
    return `Immediate orbital proximity (${lunarDist.toFixed(2)} LD). Monitored under planetary defense alert.`;
  };

  const getSpaceWeatherWittyVerdict = (threat: ThreatRecord) => {
    const t = threat.title || '';
    if (t.includes('X-Class') || (t.includes('X') && t.includes('Flare'))) {
      return 'Strong solar flare. High-frequency radio static over sunlit oceans; magnificent auroras in high latitudes. Power grids intact.';
    }
    if (t.includes('M-Class') || (t.includes('M') && t.includes('Flare'))) {
      return 'Moderate solar puff. Aurora likely visible in Alaska, Canada, and Scandinavia. Zero ground hazard.';
    }
    if (t.includes('C-Class') || (t.includes('C') && t.includes('Flare'))) {
      return 'Minor solar flare ionization. Normal upper atmospheric background excitation; zero ground disruption.';
    }
    if (t.includes('Geomagnetic') || t.includes('GST')) {
      return 'Geomagnetic disturbance in upper atmosphere. Spectacular northern lights possible; power and GPS systems stable.';
    }
    if (t.includes('CME') || t.includes('Coronal Mass Ejection')) {
      return 'Coronal plasma wave traveling through interplanetary space. Earth magnetosphere absorbing kinetic stream normally.';
    }
    if (t.includes('RBE') || t.includes('Radiation Belt')) {
      return 'Elevated Van Allen radiation belt electron flux. Satellite operators monitoring charging; zero ground impact.';
    }
    if (t.includes('SEP') || t.includes('Particle')) {
      return 'Solar proton flux detected by orbital monitors. High-latitude aviation communications notified; no surface risk.';
    }
    if (t.includes('HSS') || t.includes('High Speed')) {
      return 'Fast solar wind stream impacting Earth magnetosphere. Mild auroral brightening at poles.';
    }
    return 'Minor solar energetic particle flux. Satellite operators notified; no human surface effects.';
  };

  return (
    <section className={`border rounded-2xl p-5 sm:p-6 transition-all ${
      isDark
        ? 'bg-[#12141a] border-[#232733] text-white shadow-sm'
        : 'bg-white border-slate-200 text-slate-900 shadow-sm'
    }`}>
      {/* 2-Column Grid: Asteroids (Left) & Solar Weather (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Column 1: Near-Earth Asteroid Feed */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1 pb-1 border-b border-purple-500/20">
            <div className="flex items-center gap-2 text-xs font-bold font-mono uppercase tracking-wider text-purple-400">
              <Orbit className="w-3.5 h-3.5" />
              <span>NASA NeoWs Asteroids</span>
            </div>
            <span className="text-[10px] font-mono text-slate-400">
              Closest Flybys ({displayedAsteroids.length} of {asteroidEvents.length})
            </span>
          </div>

          <div className="space-y-2.5">
            {displayedAsteroids.map((threat, idx) => {
              const isHovered = hoveredThreatId === (threat.id || threat.title);
              let meta: Record<string, unknown> = {};
              try {
                if (typeof threat.metadata === 'string') meta = JSON.parse(threat.metadata);
                else if (threat.metadata) meta = threat.metadata as unknown as Record<string, unknown>;
              } catch {
                meta = {};
              }

              const width = typeof meta.max_width_meters === 'number' ? meta.max_width_meters.toFixed(0) : '120';
              const missKm = typeof meta.miss_distance_km === 'number' ? (meta.miss_distance_km / 1000000).toFixed(1) : '4.2';
              const lunarDist = typeof meta.miss_distance_km === 'number' ? (meta.miss_distance_km / 384400).toFixed(1) : '10.9';
              const isHazard = meta.is_hazardous === true;
              const verdictText = getAsteroidWittyVerdict(threat);

              return (
                <div
                  key={threat.id || threat.title || idx}
                  onClick={() => onSelectThreat(threat)}
                  onMouseEnter={() => setHoveredThreatId?.(threat.id || threat.title)}
                  onMouseLeave={() => setHoveredThreatId?.(null)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    isHovered
                      ? isDark ? 'bg-[#181b24] border-purple-500 shadow-lg' : 'bg-white border-purple-400 shadow-md'
                      : isDark ? 'bg-[#12141c]/90 border-[#222736] hover:border-purple-500/50' : 'bg-white border-slate-200 hover:border-purple-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 font-mono text-[10px] font-bold">
                        #{idx + 1}
                      </span>
                      <div>
                        <div className="font-bold text-xs flex items-center gap-1.5">
                          <span>Asteroid {threat.title}</span>
                          {isHazard && (
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
                              PHA
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                          Miss Distance: <strong className="text-purple-300">{missKm}M km ({lunarDist}x Lunar)</strong> &bull; Size: ~{width}m
                        </div>
                      </div>
                    </div>

                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 font-bold shrink-0">
                      Sev {threat.severityScore.toFixed(1)}
                    </span>
                  </div>

                  {/* Witty Reality Takeaway */}
                  <p className={`text-[11px] mt-2 italic pl-2 border-l-2 border-purple-500/40 ${
                    isDark ? 'text-slate-300' : 'text-slate-600'
                  }`}>
                    &bull; {verdictText}
                  </p>
                </div>
              );
            })}

            {asteroidEvents.length > 4 && (
              <button
                onClick={() => setShowAllAsteroids(!showAllAsteroids)}
                className={`w-full py-2 px-3 rounded-lg border text-xs font-mono font-medium transition flex items-center justify-center gap-1.5 ${
                  isDark
                    ? 'bg-[#141620] hover:bg-[#1c1f2e] border-[#222736] text-purple-300'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-purple-700 shadow-sm'
                }`}
              >
                {showAllAsteroids ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5" />
                    <span>Show Top 4 Approaches Only</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" />
                    <span>View All {asteroidEvents.length} Ranked Asteroid Approaches</span>
                  </>
                )}
              </button>
            )}

            {asteroidEvents.length === 0 && (
              <div className={`p-6 rounded-xl border text-center font-mono text-xs ${
                isDark ? 'bg-[#12141c] border-[#222736] text-slate-400' : 'bg-white border-slate-200 text-slate-500'
              }`}>
                No near-Earth asteroid approaches in current window.
              </div>
            )}
          </div>
        </div>

        {/* Column 2: Space Weather / Solar Telemetry */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1 pb-1 border-b border-amber-500/20">
            <div className="flex items-center gap-2 text-xs font-bold font-mono uppercase tracking-wider text-amber-400">
              <Flame className="w-3.5 h-3.5" />
              <span>NASA DONKI Solar Alerts</span>
            </div>
            <span className="text-[10px] font-mono text-slate-400">
              Solar Activity ({displayedSolar.length} of {spaceWeatherEvents.length})
            </span>
          </div>

          <div className="space-y-2.5">
            {displayedSolar.map((threat, idx) => {
              const isHovered = hoveredThreatId === (threat.id || threat.title);
              const verdictText = getSpaceWeatherWittyVerdict(threat);

              return (
                <div
                  key={threat.id || threat.title || idx}
                  onClick={() => onSelectThreat(threat)}
                  onMouseEnter={() => setHoveredThreatId?.(threat.id || threat.title)}
                  onMouseLeave={() => setHoveredThreatId?.(null)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    isHovered
                      ? isDark ? 'bg-[#181b24] border-amber-500 shadow-lg' : 'bg-white border-amber-400 shadow-md'
                      : isDark ? 'bg-[#12141c]/90 border-[#222736] hover:border-amber-500/50' : 'bg-white border-slate-200 hover:border-amber-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <Flame className="w-3.5 h-3.5" />
                      </span>
                      <div>
                        <div className="font-bold text-xs">
                          {threat.title}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                          {new Date(threat.recordedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} &bull; Solar Activity Stream
                        </div>
                      </div>
                    </div>

                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold shrink-0">
                      Sev {threat.severityScore.toFixed(1)}
                    </span>
                  </div>

                  {/* Witty Reality Takeaway */}
                  <p className={`text-[11px] mt-2 italic pl-2 border-l-2 border-amber-500/40 ${
                    isDark ? 'text-slate-300' : 'text-slate-600'
                  }`}>
                    &bull; {verdictText}
                  </p>
                </div>
              );
            })}

            {spaceWeatherEvents.length > 4 && (
              <button
                onClick={() => setShowAllSolar(!showAllSolar)}
                className={`w-full py-2 px-3 rounded-lg border text-xs font-mono font-medium transition flex items-center justify-center gap-1.5 ${
                  isDark
                    ? 'bg-[#141620] hover:bg-[#1c1f2e] border-[#222736] text-amber-300'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-amber-700 shadow-sm'
                }`}
              >
                {showAllSolar ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5" />
                    <span>Show Recent 4 Only</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" />
                    <span>View All {spaceWeatherEvents.length} Solar Events</span>
                  </>
                )}
              </button>
            )}

            {spaceWeatherEvents.length === 0 && (
              <div className={`p-6 rounded-xl border text-center font-mono text-xs ${
                isDark ? 'bg-[#12141c] border-[#222736] text-slate-400' : 'bg-white border-slate-200 text-slate-500'
              }`}>
                Sun is nominal. No high-energy solar storms detected.
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
