'use client';

import React, { useMemo } from 'react';
import { ThreatRecord } from '@/types/threats';
import { ShieldCheck, ShieldAlert, Sparkles, Activity, Orbit, TrendingDown, Loader2 } from 'lucide-react';

interface AIVerdictBannerProps {
  threats: ThreatRecord[];
  storedVerdict?: {
    panicIndex?: number;
    verdictText?: string;
    statusLevel?: string;
    summaryNarrative?: string;
    createdAt?: string;
  } | null;
  loading?: boolean;
  isDark?: boolean;
}

export default function AIVerdictBanner({ threats, storedVerdict, loading = false, isDark = true }: AIVerdictBannerProps) {
  // Dynamically calculate the Global Panic Index & Verdict Narrative (fallback if no stored verdict)
  const verdict = useMemo(() => {
    if (storedVerdict && typeof storedVerdict.panicIndex === 'number' && storedVerdict.verdictText) {
      const isSafe = storedVerdict.panicIndex < 4.0;
      const statusTag = isSafe ? 'REALITY: SAFE & NOMINAL' : storedVerdict.panicIndex < 7.0 ? 'REALITY: ELEVATED HYSTERIA' : 'REALITY: MULTI-VECTOR ALERT';
      
      let maxQuakeMag = 0;
      let highestSolarClass = 'Quiet';
      let marketVolatilitySpike = 0;

      threats.forEach((t) => {
        let meta: Record<string, unknown> = {};
        try {
          if (typeof t.metadata === 'string') meta = JSON.parse(t.metadata);
          else if (t.metadata) meta = t.metadata as unknown as Record<string, unknown>;
        } catch {
          meta = {};
        }
        if (t.threatType === 'EARTHQUAKE') {
          const mag = typeof meta.magnitude === 'number' ? meta.magnitude : 0;
          if (mag > maxQuakeMag) maxQuakeMag = mag;
        } else if (t.threatType === 'SPACE_WEATHER') {
          const msgType = typeof meta.message_type === 'string' ? meta.message_type : '';
          if (msgType.includes('X') || t.title.includes('X-Class')) highestSolarClass = 'X-Class Flare';
          else if (msgType.includes('M') || t.title.includes('M-Class')) highestSolarClass = 'M-Class Flare';
        } else if (t.threatType === 'STOCK_MARKET') {
          const change = typeof meta.change_percent === 'number' ? meta.change_percent : 0;
          const sym = typeof meta.symbol === 'string' ? meta.symbol : '';
          if (sym.includes('VIX') && change > marketVolatilitySpike) marketVolatilitySpike = change;
        }
      });

      return {
        panicScore: storedVerdict.panicIndex,
        narrative: storedVerdict.verdictText,
        isSafe,
        statusTag,
        maxQuakeMag,
        highestSolarClass,
        marketVolatilitySpike,
      };
    }

    if (threats.length === 0) {
      return null;
    }

    let maxQuakeMag = 0;
    let nearestQuakeKm = 999999;
    let closestAsteroidMissKm = 99999999;
    let highestSolarClass = 'Quiet';
    let marketDip = 0;
    let marketVolatilitySpike = 0;

    threats.forEach((t) => {
      let meta: Record<string, unknown> = {};
      try {
        if (typeof t.metadata === 'string') meta = JSON.parse(t.metadata);
        else if (t.metadata) meta = t.metadata as unknown as Record<string, unknown>;
      } catch {
        meta = {};
      }

      if (t.threatType === 'EARTHQUAKE') {
        const mag = typeof meta.magnitude === 'number' ? meta.magnitude : 0;
        if (mag > maxQuakeMag) maxQuakeMag = mag;
        if (t.distanceKm !== undefined && t.distanceKm < nearestQuakeKm) {
          nearestQuakeKm = t.distanceKm;
        }
      } else if (t.threatType === 'ASTEROID') {
        const miss = typeof meta.miss_distance_km === 'number' ? meta.miss_distance_km : 4200000;
        if (miss < closestAsteroidMissKm) closestAsteroidMissKm = miss;
      } else if (t.threatType === 'SPACE_WEATHER') {
        const msgType = typeof meta.message_type === 'string' ? meta.message_type : '';
        if (msgType.includes('X') || t.title.includes('X-Class')) highestSolarClass = 'X-Class Flare';
        else if (msgType.includes('M') || t.title.includes('M-Class')) highestSolarClass = 'M-Class Flare';
      } else if (t.threatType === 'STOCK_MARKET') {
        const change = typeof meta.change_percent === 'number' ? meta.change_percent : 0;
        const sym = typeof meta.symbol === 'string' ? meta.symbol : '';
        if (sym.includes('VIX') && change > marketVolatilitySpike) marketVolatilitySpike = change;
        if (!sym.includes('VIX') && change < marketDip) marketDip = change;
      }
    });

    // Compute composite panic index (1.0 to 10.0 scale)
    let panicScore = 1.8;
    if (maxQuakeMag >= 7.0) panicScore += 1.5;
    else if (maxQuakeMag >= 5.5) panicScore += 0.8;
    else if (maxQuakeMag >= 4.5) panicScore += 0.3;

    if (highestSolarClass.includes('X-Class')) panicScore += 1.2;
    else if (highestSolarClass.includes('M-Class')) panicScore += 0.4;

    if (marketVolatilitySpike > 10.0) panicScore += 1.0;
    else if (marketVolatilitySpike > 3.0) panicScore += 0.5;

    panicScore = Math.min(Math.max(panicScore, 1.2), 9.9);

    // Formulate the human-readable reality synthesis
    let narrative = `Global panic index is at ${panicScore.toFixed(1)}. `;
    if (marketVolatilitySpike > 2.0 || marketDip < -1.0) {
      narrative += `Wall Street is sweating over algorithmic ripples, `;
    } else {
      narrative += `Financial markets are idling quietly, `;
    }

    if (highestSolarClass.includes('Quiet')) {
      narrative += `the stars are quiet, `;
    } else {
      narrative += `the sun puffed a harmless ${highestSolarClass}, `;
    }

    if (nearestQuakeKm > 1000) {
      narrative += `and tectonic plates near you are asleep. You're fine.`;
    } else {
      narrative += `and seismic sensors show nominal background tremors. You're fine.`;
    }

    const isSafe = panicScore < 4.0;
    const statusTag = isSafe ? 'REALITY: SAFE & NOMINAL' : panicScore < 7.0 ? 'REALITY: ELEVATED HYSTERIA' : 'REALITY: MULTI-VECTOR ALERT';

    return {
      panicScore,
      narrative,
      isSafe,
      statusTag,
      maxQuakeMag,
      highestSolarClass,
      marketVolatilitySpike,
    };
  }, [threats, storedVerdict]);

  // Loading skeleton state to prevent 1.8 flash on initial page load / refresh
  if (loading || !verdict) {
    return (
      <section className={`border rounded-2xl p-5 sm:p-6 relative overflow-hidden transition-colors shadow-sm ${
        isDark 
          ? 'bg-[#16171c] border-[#282a33]' 
          : 'bg-white border-slate-200'
      }`}>
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#FF007F]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          {/* Left: Loading Skeleton */}
          <div className="space-y-3 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md bg-[#FF007F]/10 text-[#FF007F] border border-[#FF007F]/25 flex items-center gap-1.5 font-mono">
                <Sparkles className="w-3.5 h-3.5" />
                1. THE AI VERDICT
              </span>
              <span className="text-[11px] font-mono text-cyan-400 font-semibold flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
                SYNTHESIZING TELEMETRY...
              </span>
            </div>

            <div className="space-y-2 py-1">
              <div className={`h-5 w-11/12 rounded-md animate-pulse ${isDark ? 'bg-[#21242e]' : 'bg-slate-200'}`} />
              <div className={`h-4 w-3/4 rounded-md animate-pulse ${isDark ? 'bg-[#1a1d26]' : 'bg-slate-100'}`} />
            </div>

            {/* Skeleton Chips */}
            <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-[11px]">
              <div className={`px-2.5 py-1 rounded-lg border flex items-center gap-1.5 animate-pulse ${
                isDark ? 'bg-[#101114] border-[#282a33] text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-400'
              }`}>
                <Activity className="w-3 h-3 text-slate-500" />
                <span>Tectonics: Ingesting...</span>
              </div>
              <div className={`px-2.5 py-1 rounded-lg border flex items-center gap-1.5 animate-pulse ${
                isDark ? 'bg-[#101114] border-[#282a33] text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-400'
              }`}>
                <Orbit className="w-3 h-3 text-slate-500" />
                <span>Orbit: Ingesting...</span>
              </div>
              <div className={`px-2.5 py-1 rounded-lg border flex items-center gap-1.5 animate-pulse ${
                isDark ? 'bg-[#101114] border-[#282a33] text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-400'
              }`}>
                <TrendingDown className="w-3 h-3 text-slate-500" />
                <span>Macro: Ingesting...</span>
              </div>
            </div>
          </div>

          {/* Right: Score Gauge Skeleton */}
          <div className={`p-4 rounded-xl border flex items-center gap-4 shrink-0 min-w-[190px] ${
            isDark ? 'bg-[#101114] border-[#282a33]' : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="p-3 rounded-full bg-[#FF007F]/10 border border-[#FF007F]/20 text-[#FF007F] animate-pulse">
              <Sparkles className="w-7 h-7 text-[#FF007F]" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase font-bold text-slate-500 block">
                GLOBAL PANIC INDEX
              </span>
              <div className="flex items-baseline gap-1 font-mono">
                <span className="text-2xl font-black text-slate-500 animate-pulse">
                  --.-
                </span>
                <span className="text-xs text-slate-600 font-semibold">/ 10</span>
              </div>
              <span className="text-[10px] font-mono text-cyan-400 font-medium">
                STATUS: COMPUTING
              </span>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={`border rounded-2xl p-5 sm:p-6 relative overflow-hidden transition-colors shadow-sm ${
      isDark 
        ? 'bg-[#16171c] border-[#282a33]' 
        : 'bg-white border-slate-200'
    }`}>
      {/* Subtle Background Glow */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-[#FF007F]/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        {/* Left: Section Header & AI Verdict Synthesis */}
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md bg-[#FF007F]/10 text-[#FF007F] border border-[#FF007F]/25 flex items-center gap-1.5 font-mono">
              <Sparkles className="w-3.5 h-3.5" />
              1. THE AI VERDICT
            </span>
            <span className="text-[11px] font-mono text-emerald-400 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {verdict.statusTag}
            </span>
          </div>

          <blockquote className={`text-base sm:text-lg font-semibold tracking-tight leading-relaxed italic ${
            isDark ? 'text-slate-100' : 'text-slate-900'
          }`}>
            &ldquo;{verdict.narrative}&rdquo;
          </blockquote>

          {/* Reality Check Chips */}
          <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-[11px]">
            <div className={`px-2.5 py-1 rounded-lg border flex items-center gap-1.5 ${
              isDark ? 'bg-[#101114] border-[#282a33] text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}>
              <Activity className="w-3 h-3 text-rose-400" />
              <span>Tectonics: {verdict.maxQuakeMag > 0 ? `Max M ${verdict.maxQuakeMag.toFixed(1)}` : 'Asleep'}</span>
            </div>

            <div className={`px-2.5 py-1 rounded-lg border flex items-center gap-1.5 ${
              isDark ? 'bg-[#101114] border-[#282a33] text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}>
              <Orbit className="w-3 h-3 text-purple-400" />
              <span>Orbit: Zero Impact Threats</span>
            </div>

            <div className={`px-2.5 py-1 rounded-lg border flex items-center gap-1.5 ${
              isDark ? 'bg-[#101114] border-[#282a33] text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}>
              <TrendingDown className="w-3 h-3 text-amber-400" />
              <span>Macro: Mild Hysteria Only</span>
            </div>
          </div>
        </div>

        {/* Right: Panic Index Score Gauge */}
        <div className={`p-4 rounded-xl border flex items-center gap-4 shrink-0 min-w-[190px] ${
          isDark ? 'bg-[#101114] border-[#282a33]' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="p-3 rounded-full bg-[#FF007F]/10 border border-[#FF007F]/20 text-[#FF007F]">
            {verdict.isSafe ? (
              <ShieldCheck className="w-7 h-7 text-emerald-400" />
            ) : (
              <ShieldAlert className="w-7 h-7 text-[#FF007F]" />
            )}
          </div>
          <div>
            <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block">
              GLOBAL PANIC INDEX
            </span>
            <div className="flex items-baseline gap-1 font-mono">
              <span className="text-2xl font-black text-[#FF007F]">
                {verdict.panicScore.toFixed(1)}
              </span>
              <span className="text-xs text-slate-500 font-semibold">/ 10</span>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 font-medium">
              STATUS: NOMINAL
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
