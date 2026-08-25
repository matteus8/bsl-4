'use client';

import React, { useMemo } from 'react';
import { ThreatRecord } from '@/types/threats';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Activity, 
  Orbit, 
  TrendingDown, 
  Loader2 
} from 'lucide-react';
import { EditorialVerdictResponse } from '@/lib/api';

interface AIVerdictBannerProps {
  threats: ThreatRecord[];
  storedVerdict?: EditorialVerdictResponse | null;
  loading?: boolean;
  isDark?: boolean;
}

export default function AIVerdictBanner({
  threats,
  storedVerdict,
  loading = false,
  isDark = true,
}: AIVerdictBannerProps) {
  // Compute fallback or blend with stored verdict
  const verdict = useMemo(() => {
    if (loading) return null;
    if (storedVerdict && storedVerdict.verdictText) {
      const panicScore = typeof storedVerdict.panicIndex === 'number' ? storedVerdict.panicIndex : 1.8;
      const isSafe = panicScore < 4.0;
      const statusTag = isSafe ? 'GLOBAL STATUS: NOMINAL' : panicScore < 7.0 ? 'GLOBAL STATUS: ELEVATED' : 'GLOBAL STATUS: ALERT';

      let maxQuakeMag = 0;
      let highestSolarClass = 'Quiet';
      let marketVolatilitySpike = 0;

      threats.forEach((t) => {
        if (t.threatType === 'EARTHQUAKE' && t.severityScore > maxQuakeMag) {
          maxQuakeMag = t.severityScore;
        }
        if (t.threatType === 'STOCK_MARKET' && t.severityScore > marketVolatilitySpike) {
          marketVolatilitySpike = t.severityScore;
        }
        if (t.threatType === 'SPACE_WEATHER' && t.title) {
          if (t.title.includes('X-Class')) highestSolarClass = 'X-Class Flare';
          else if (t.title.includes('M-Class') && highestSolarClass !== 'X-Class Flare') highestSolarClass = 'M-Class Flare';
          else if (t.title.includes('C-Class') && highestSolarClass === 'Quiet') highestSolarClass = 'C-Class Flare';
        }
      });

      return {
        panicScore,
        narrative: storedVerdict.verdictText,
        isSafe,
        statusTag,
        maxQuakeMag,
        highestSolarClass,
        marketVolatilitySpike,
      };
    }

    if (!threats || threats.length === 0) {
      return null;
    }

    // Heuristic assessment when stored verdict is loading
    let maxQuakeMag = 0;
    let nearestQuakeKm = 99999;
    let highestSolarClass = 'Quiet';
    let marketVolatilitySpike = 0;
    let marketDip = 0;

    threats.forEach((t) => {
      if (t.threatType === 'EARTHQUAKE') {
        if (t.severityScore > maxQuakeMag) maxQuakeMag = t.severityScore;
        if (t.distanceKm !== undefined && t.distanceKm < nearestQuakeKm) {
          nearestQuakeKm = t.distanceKm;
        }
      }
      if (t.threatType === 'STOCK_MARKET') {
        let meta: Record<string, unknown> = {};
        try {
          if (typeof t.metadata === 'string') meta = JSON.parse(t.metadata);
          else if (t.metadata) meta = t.metadata as unknown as Record<string, unknown>;
        } catch {
          meta = {};
        }
        const change = typeof meta.change_percent === 'number' ? meta.change_percent : 0;
        if (t.severityScore > marketVolatilitySpike) marketVolatilitySpike = t.severityScore;
        if (change < marketDip) marketDip = change;
      }
      if (t.threatType === 'SPACE_WEATHER' && t.title) {
        if (t.title.includes('X-Class')) highestSolarClass = 'X-Class Flare';
        else if (t.title.includes('M-Class') && highestSolarClass !== 'X-Class Flare') highestSolarClass = 'M-Class Flare';
        else if (t.title.includes('C-Class') && highestSolarClass === 'Quiet') highestSolarClass = 'C-Class Flare';
      }
    });

    let panicScore = 1.8;
    if (maxQuakeMag >= 7.0) panicScore += 2.5;
    else if (maxQuakeMag >= 5.5) panicScore += 1.2;
    if (highestSolarClass.includes('X-Class')) panicScore += 2.0;
    else if (highestSolarClass.includes('M-Class')) panicScore += 0.8;
    if (marketVolatilitySpike > 4.0 || marketDip < -2.5) panicScore += 1.5;
    panicScore = Math.min(10.0, Math.round(panicScore * 10) / 10);

    let narrative = `Global panic index is at ${panicScore.toFixed(1)}. `;
    if (marketVolatilitySpike > 2.0 || marketDip < -1.0) {
      narrative += `Markets are experiencing routine intraday movements, `;
    } else {
      narrative += `Financial markets remain orderly, `;
    }

    if (highestSolarClass.includes('Quiet')) {
      narrative += `solar radiation flux is baseline, `;
    } else {
      narrative += `the sun produced a minor ${highestSolarClass}, `;
    }

    if (nearestQuakeKm > 1000) {
      narrative += `and tectonic plates are stable. Physical baseline is normal.`;
    } else {
      narrative += `and regional seismic sensors show nominal background levels.`;
    }

    const isSafe = panicScore < 4.0;
    const statusTag = isSafe ? 'GLOBAL STATUS: NOMINAL' : panicScore < 7.0 ? 'GLOBAL STATUS: ELEVATED' : 'GLOBAL STATUS: MULTI-VECTOR ALERT';

    return {
      panicScore,
      narrative,
      isSafe,
      statusTag,
      maxQuakeMag,
      highestSolarClass,
      marketVolatilitySpike,
    };
  }, [threats, storedVerdict, loading]);

  // Clean loading state without flashing or glow
  if (!verdict) {
    return (
      <section className={`border rounded-2xl p-5 sm:p-6 transition-colors shadow-sm ${
        isDark 
          ? 'bg-[#12141a] border-[#232733]' 
          : 'bg-white border-slate-200'
      }`}>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="space-y-2.5 flex-1">
            <div className="flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
              <span className="text-xs font-mono text-slate-400">Loading daily assessment...</span>
            </div>
            <div className={`h-5 w-3/4 rounded ${isDark ? 'bg-[#1a1d26]' : 'bg-slate-100'}`} />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={`border rounded-2xl p-5 sm:p-6 transition-colors shadow-sm ${
      isDark 
        ? 'bg-[#12141a] border-[#232733]' 
        : 'bg-white border-slate-200'
    }`}>
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        {/* Left: Assessment Narrative */}
        <div className="space-y-3 flex-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-semibold">
              {verdict.statusTag}
            </span>
          </div>

          <blockquote className={`text-base sm:text-lg font-medium tracking-tight leading-relaxed ${
            isDark ? 'text-slate-100' : 'text-slate-900'
          }`}>
            &ldquo;{verdict.narrative}&rdquo;
          </blockquote>

          {/* Understated Baseline Chips */}
          <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
            <div className={`px-2.5 py-1 rounded-lg border flex items-center gap-1.5 ${
              isDark ? 'bg-[#0d0e12] border-[#232733] text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}>
              <Activity className="w-3 h-3 text-rose-400" />
              <span>Tectonics: {verdict.maxQuakeMag > 0 ? `Max M ${verdict.maxQuakeMag.toFixed(1)}` : 'Stable'}</span>
            </div>

            <div className={`px-2.5 py-1 rounded-lg border flex items-center gap-1.5 ${
              isDark ? 'bg-[#0d0e12] border-[#232733] text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}>
              <Orbit className="w-3 h-3 text-purple-400" />
              <span>Orbit: Zero Collision Threats</span>
            </div>

            <div className={`px-2.5 py-1 rounded-lg border flex items-center gap-1.5 ${
              isDark ? 'bg-[#0d0e12] border-[#232733] text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}>
              <TrendingDown className="w-3 h-3 text-amber-400" />
              <span>Markets: Standard Range</span>
            </div>

            <button
              type="button"
              onClick={() => {
                const text = `BSL-4 Global Assessment: Panic Index at ${verdict.panicScore.toFixed(1)} / 10\n\n"${verdict.narrative}"\n\nPlanetary sensor telemetry: https://platformstaq.com`;
                window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
              }}
              className={`px-2.5 py-1 rounded-lg border flex items-center gap-1.5 transition text-slate-300 hover:text-white ${
                isDark ? 'bg-[#181a22] border-[#2c3040] hover:bg-[#222530]' : 'bg-slate-900 border-slate-700 text-white hover:bg-black'
              }`}
            >
              <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              <span>Share on 𝕏</span>
            </button>
          </div>
        </div>

        {/* Right: Panic Index Score */}
        <div className={`p-3.5 rounded-xl border flex items-center gap-3.5 shrink-0 ${
          isDark ? 'bg-[#0d0e12] border-[#232733]' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="p-2 rounded-lg bg-[#FF007F]/10 text-[#FF007F]">
            {verdict.isSafe ? (
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-[#FF007F]" />
            )}
          </div>
          <div>
            <span className="text-[9px] font-mono uppercase font-bold text-slate-400 block tracking-wider">
              PANIC INDEX
            </span>
            <div className="flex items-baseline gap-1 font-mono">
              <span className="text-2xl font-bold text-white">
                {verdict.panicScore.toFixed(1)}
              </span>
              <span className="text-xs text-slate-500 font-normal">/ 10</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
