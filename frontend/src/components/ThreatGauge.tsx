'use client';

import { Flame, Activity, Zap } from 'lucide-react';

interface ThreatGaugeProps {
  maxSeverity: number;
  averageSeverity: number;
  activeCount: number;
  criticalCount: number;
}

export default function ThreatGauge({
  maxSeverity,
  averageSeverity,
  activeCount,
  criticalCount,
}: ThreatGaugeProps) {
  const percentage = Math.min(Math.max((maxSeverity / 10) * 100, 0), 100);

  const getThreatStatus = (score: number) => {
    if (score >= 8.5) return { label: 'EXTINCTION CLASS PROTOCOL', color: 'text-pink animate-pulse', border: 'border-pink' };
    if (score >= 7.0) return { label: 'CRITICAL MULTI-VECTOR CRISIS', color: 'text-red-400', border: 'border-red-500' };
    if (score >= 5.0) return { label: 'ELEVATED REGIONAL HAZARD', color: 'text-amber-400', border: 'border-amber-500' };
    return { label: 'SURVEILLANCE / NOMINAL', color: 'text-emerald-400', border: 'border-emerald-500' };
  };

  const status = getThreatStatus(maxSeverity);

  return (
    <div className="bg-surface-card border border-surface-border rounded-xl p-5 relative overflow-hidden shadow-lg">
      {/* Background Hot Pink Glow */}
      <div className="absolute -top-24 -right-24 w-60 h-60 bg-pink/10 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Left: Score Gauge */}
        <div className="flex items-center gap-5">
          <div className="relative flex items-center justify-center w-24 h-24 rounded-full border-4 border-surface-border bg-surface shadow-inner">
            {/* SVG Circular Ring */}
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="40"
                stroke="currentColor"
                strokeWidth="8"
                fill="transparent"
                className="text-surface-border"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                stroke="currentColor"
                strokeWidth="8"
                fill="transparent"
                strokeDasharray={251.2}
                strokeDashoffset={251.2 - (percentage / 100) * 251.2}
                className="text-pink transition-all duration-1000 ease-out drop-shadow-[0_0_8px_rgba(255,0,127,0.8)]"
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-2xl font-black text-white font-mono">{maxSeverity.toFixed(1)}</span>
              <span className="text-[9px] uppercase tracking-wider text-pink font-bold">MAX SEV</span>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono uppercase tracking-widest text-slate-400">
                GLOBAL THREAT MATRIX INDEX
              </span>
            </div>
            <h2 className={`text-base sm:text-lg font-black tracking-wide uppercase font-mono ${status.color}`}>
              {status.label}
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-md font-mono">
              Aggregated from 5 real-time streams: NASA DONKI & Asteroids, USGS Earthquakes, NWS Weather, and Volatility Indices.
            </p>
          </div>
        </div>

        {/* Right: Quick Stat Metrics */}
        <div className="grid grid-cols-3 gap-3 w-full md:w-auto font-mono text-center">
          <div className="bg-surface/80 border border-surface-border p-2.5 rounded-lg">
            <div className="text-[10px] text-slate-500 uppercase flex items-center justify-center gap-1">
              <Activity className="w-3 h-3 text-pink" /> Active
            </div>
            <div className="text-xl font-bold text-white mt-0.5">{activeCount}</div>
            <div className="text-[9px] text-slate-400">Events Logged</div>
          </div>

          <div className="bg-surface/80 border border-surface-border p-2.5 rounded-lg">
            <div className="text-[10px] text-slate-500 uppercase flex items-center justify-center gap-1">
              <Flame className="w-3 h-3 text-red-400" /> Critical
            </div>
            <div className="text-xl font-bold text-pink mt-0.5">{criticalCount}</div>
            <div className="text-[9px] text-slate-400">Sev &ge; 7.0</div>
          </div>

          <div className="bg-surface/80 border border-surface-border p-2.5 rounded-lg">
            <div className="text-[10px] text-slate-500 uppercase flex items-center justify-center gap-1">
              <Zap className="w-3 h-3 text-amber-400" /> Avg Score
            </div>
            <div className="text-xl font-bold text-amber-400 mt-0.5">{averageSeverity.toFixed(1)}</div>
            <div className="text-[9px] text-slate-400">Danger Rating</div>
          </div>
        </div>
      </div>
    </div>
  );
}
