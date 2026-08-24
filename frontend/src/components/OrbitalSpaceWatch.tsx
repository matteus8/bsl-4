'use client';

import React, { useMemo } from 'react';
import { ThreatRecord } from '@/types/threats';
import { Orbit, Flame, ShieldCheck } from 'lucide-react';

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
  // Filter for orbital & solar threats
  const orbitalEvents = useMemo(() => {
    return threats.filter(
      (t) => t.threatType === 'ASTEROID' || t.threatType === 'SPACE_WEATHER'
    );
  }, [threats]);

  const asteroidEvents = useMemo(() => orbitalEvents.filter((t) => t.threatType === 'ASTEROID'), [orbitalEvents]);
  const spaceWeatherEvents = useMemo(() => orbitalEvents.filter((t) => t.threatType === 'SPACE_WEATHER'), [orbitalEvents]);

  const getAsteroidWittyVerdict = (threat: ThreatRecord) => {
    let meta: Record<string, unknown> = {};
    try {
      if (typeof threat.metadata === 'string') meta = JSON.parse(threat.metadata);
      else if (threat.metadata) meta = threat.metadata as unknown as Record<string, unknown>;
    } catch {
      meta = {};
    }

    const isHazardous = meta.is_hazardous === true;
    const width = typeof meta.max_width_meters === 'number' ? meta.max_width_meters : 120;
    
    if (isHazardous) {
      return 'Classified potentially hazardous by orbit, but passing millions of kilometers away. Zero atmospheric entry trajectory.';
    }
    if (width > 500) {
      return `Passed at comfortable planetary distance (~4M+ km). Dinosaurs would have been jealous. Dinosaurs safe.`;
    }
    return `Passed harmlessly outside the lunar orbit. Less gravitational effect than a passing cloud.`;
  };

  const getSpaceWeatherWittyVerdict = (threat: ThreatRecord) => {
    if (threat.title.includes('X-Class')) {
      return 'Strong solar flare. High-frequency radio static over sunlit oceans; magnificent auroras in high latitudes. Power grids intact.';
    }
    if (threat.title.includes('M-Class')) {
      return 'Moderate solar puff. Aurora likely visible in Alaska, Canada, and Scandinavia. Zero ground hazard.';
    }
    if (threat.title.includes('CME')) {
      return 'Coronal plasma wave traveling through interplanetary space. Earth magnetosphere absorbing kinetic stream normally.';
    }
    return 'Minor solar energetic particle flux. Satellite operators notified; no human surface effects.';
  };

  return (
    <section className={`border rounded-2xl p-5 sm:p-6 relative overflow-hidden transition-all ${
      isDark
        ? 'bg-[#0e1017] border-[#252a38] text-white shadow-xl'
        : 'bg-[#f8fafc] border-slate-200 text-slate-900 shadow-sm'
    }`}>
      {/* Subtle Starry / Radar Grid Background Pattern */}
      <div 
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(${isDark ? '#a855f7' : '#9333ea'} 1px, transparent 1px), radial-gradient(${isDark ? '#38bdf8' : '#0284c7'} 1px, transparent 1px)`,
          backgroundSize: '32px 32px',
          backgroundPosition: '0 0, 16px 16px',
        }}
      />
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#282a33]/80">
        <div className="flex items-center gap-2.5">
          <span className="text-[11px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md bg-purple-500/15 text-purple-400 border border-purple-500/30 flex items-center gap-1.5 font-mono">
            <Orbit className="w-3.5 h-3.5" />
            3. ORBITAL & SPACE WATCH
          </span>
          <span className={`text-[11px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Cosmic & Solar Domain &bull; Zero Impact Trajectories
          </span>
        </div>

        <div className="flex items-center gap-2 font-mono text-[11px]">
          <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            PLANETARY DEFENSE: SECURE
          </span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] ${
            isDark ? 'bg-[#1a1d27] text-purple-300 border border-purple-500/20' : 'bg-purple-100 text-purple-700'
          }`}>
            {orbitalEvents.length} Tracked
          </span>
        </div>
      </div>

      {/* 2-Column Grid: Asteroids (Left) & Solar Weather (Right) */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-4 pt-4">
        {/* Column 1: Near-Earth Asteroid Feed */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2 text-xs font-bold font-mono uppercase tracking-wider text-purple-400">
              <Orbit className="w-4 h-4" />
              <span>NASA NeoWs Asteroid Flybys</span>
            </div>
            <span className="text-[10px] font-mono text-slate-500">
              {asteroidEvents.length} Recorded in 30D Window
            </span>
          </div>

          <div className="space-y-2.5">
            {asteroidEvents.slice(0, 4).map((threat) => {
              const isHovered = hoveredThreatId === (threat.id || threat.title);
              let meta: Record<string, unknown> = {};
              try {
                if (typeof threat.metadata === 'string') meta = JSON.parse(threat.metadata);
                else if (threat.metadata) meta = threat.metadata as unknown as Record<string, unknown>;
              } catch {
                meta = {};
              }

              const width = typeof meta.max_width_meters === 'number' ? meta.max_width_meters.toFixed(0) : '120';
              const isHazard = meta.is_hazardous === true;
              const verdictText = getAsteroidWittyVerdict(threat);

              return (
                <div
                  key={threat.id || threat.title}
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
                      <span className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                        <Orbit className="w-3.5 h-3.5" />
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
                        <div className="text-[10px] font-mono text-slate-400">
                          Estimated Size: <strong className="text-purple-300">{width} meters</strong> &bull; Close Flyby
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

            {asteroidEvents.length === 0 && (
              <div className={`p-6 rounded-xl border text-center font-mono text-xs ${
                isDark ? 'bg-[#12141c] border-[#222736] text-slate-400' : 'bg-white border-slate-200 text-slate-500'
              }`}>
                No near-Earth asteroid approaches in current filter window.
              </div>
            )}
          </div>
        </div>

        {/* Column 2: Space Weather / Solar Telemetry */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2 text-xs font-bold font-mono uppercase tracking-wider text-amber-400">
              <Flame className="w-4 h-4" />
              <span>NASA DONKI Solar & Space Weather</span>
            </div>
            <span className="text-[10px] font-mono text-slate-500">
              {spaceWeatherEvents.length} Recorded in 30D Window
            </span>
          </div>

          <div className="space-y-2.5">
            {spaceWeatherEvents.slice(0, 4).map((threat) => {
              const isHovered = hoveredThreatId === (threat.id || threat.title);
              const verdictText = getSpaceWeatherWittyVerdict(threat);

              return (
                <div
                  key={threat.id || threat.title}
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
                        <div className="text-[10px] font-mono text-slate-400">
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
