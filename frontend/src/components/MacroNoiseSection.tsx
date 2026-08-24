'use client';

import React, { useState, useMemo } from 'react';
import { ThreatRecord, SocialHysteriaItem } from '@/types/threats';
import { 
  TrendingDown, 
  TrendingUp, 
  Flame, 
  CheckCircle2,
  ThumbsUp
} from 'lucide-react';

interface MacroNoiseSectionProps {
  threats: ThreatRecord[];
  onSelectThreat: (threat: ThreatRecord) => void;
  hoveredThreatId?: number | string | null;
  setHoveredThreatId?: (id: number | string | null) => void;
  isDark?: boolean;
}

const MOCK_SOCIAL_HYSTERIA: SocialHysteriaItem[] = [
  {
    id: 'soc-1',
    platform: 'TikTok',
    author: 'DoomsdayGeology',
    handle: '@caldera_watch_2026',
    claim: 'Yellowstone supervolcano magma chamber is swelling 400% faster! Imminent eruption within 48 hours!',
    realityCheck: 'USGS borehole tiltmeters record 0.0 mm ground uplift. The magma reservoir is ~90% solid crystalline mush; geysers are doing standard hydrothermal venting.',
    hysteriaLevel: 9.4,
    reach: '3.8M views',
    timeAgo: '4h ago',
    verifiedDebunk: true,
    categoryTag: 'VOLCANO'
  },
  {
    id: 'soc-2',
    platform: 'Twitter/X',
    author: 'CosmicTruthSeeker',
    handle: '@astral_alignments',
    claim: 'Planetary alignment this Friday will disrupt all satellite GPS and cause rolling power grid collapses!',
    realityCheck: 'The combined tidal gravitational pull of Mars, Jupiter, and Venus on Earth is weaker than a passenger jet flying overhead. Physics confirms zero electromagnetic coupling.',
    hysteriaLevel: 8.7,
    reach: '840K impressions',
    timeAgo: '6h ago',
    verifiedDebunk: true,
    categoryTag: 'COSMIC'
  },
  {
    id: 'soc-3',
    platform: 'YouTube',
    author: 'Apocalypse Preparedness Daily',
    handle: '@bunker_chronicles',
    claim: 'Solar storm about to wipe out the global digital banking system! Buy freeze-dried rice immediately!',
    realityCheck: 'NOAA Space Weather Prediction Center registers Kp index 2.0 (nominal quiet field). High frequency marine radio is crystal clear.',
    hysteriaLevel: 9.1,
    reach: '1.2M views',
    timeAgo: '12h ago',
    verifiedDebunk: true,
    categoryTag: 'WEATHER'
  },
  {
    id: 'soc-4',
    platform: 'Reddit',
    author: 'u/deep_crust_theorist',
    handle: 'r/conspiracy',
    claim: 'Massive unrecorded tectonic fault fissure cracking beneath the Midwest US after mystery boom sound.',
    realityCheck: 'USGS seismic array detected a shallow frost quake (cryoseism) from sub-zero temperature snap. Zero structural danger.',
    hysteriaLevel: 7.8,
    reach: '4.5k upvotes',
    timeAgo: '1d ago',
    verifiedDebunk: true,
    categoryTag: 'CONSPIRACY'
  },
  {
    id: 'soc-5',
    platform: 'Instagram',
    author: 'MacroFearAlerts',
    handle: '@macro_collapse_tracker',
    claim: 'Global fiat currency liquidity freeze starting Monday due to sovereign bond yield anomaly!',
    realityCheck: 'Overnight repo operations and central bank swap lines are operating with abundant liquidity reserves. Routine bond repricing.',
    hysteriaLevel: 8.2,
    reach: '620K reach',
    timeAgo: '1d ago',
    verifiedDebunk: true,
    categoryTag: 'ECONOMIC'
  }
];

export default function MacroNoiseSection({
  threats,
  onSelectThreat,
  hoveredThreatId,
  setHoveredThreatId,
  isDark = true,
}: MacroNoiseSectionProps) {
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'MARKETS' | 'SOCIAL'>('ALL');
  const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>({});

  const toggleDebunkVote = (id: string) => {
    setLikedPosts(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Extract financial market threats from live ingested telemetry
  const marketThreats = useMemo(() => {
    return threats.filter((t) => t.threatType === 'STOCK_MARKET');
  }, [threats]);

  const getMarketPanicCommentary = (sym: string, change: number) => {
    if (sym.includes('VIX')) {
      if (change > 5.0) return 'VIX fear index spiked. Hedge fund algorithmic quants having an existential crisis.';
      if (change < -5.0) return 'Volatility collapsed. Traders too numb to panic.';
      return 'Volatility index hovering normally. Mild macroeconomic nervous chatter.';
    }
    if (sym.includes('GSPC')) {
      if (change < -1.5) return 'S&P 500 slipped into the red. Financial news screaming about a 3-day correction.';
      return 'US equities trading inside normal statistical deviation band. Wall Street coffee consumption nominal.';
    }
    if (sym.includes('FTSE') || sym.includes('N225') || sym.includes('HSI')) {
      return 'International index trading across global time zones. Routine portfolio rebalancing.';
    }
    if (sym.includes('GC=F')) {
      return 'Gold futures holding firm. Doomsday preppers nodding approvingly to their safe.';
    }
    if (sym.includes('BTC')) {
      return 'Crypto oscillating on speculative leverage. Discord moderators debating monetary philosophy.';
    }
    return 'Asset tracking nominal market liquidity.';
  };

  return (
    <section className={`border rounded-2xl p-5 sm:p-6 relative overflow-hidden transition-all shadow-sm ${
      isDark ? 'bg-[#16171c] border-[#282a33]' : 'bg-white border-slate-200'
    }`}>
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#282a33]/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/25 flex items-center gap-1.5 font-mono">
              <TrendingDown className="w-3.5 h-3.5" />
              4. THE MACRO NOISE
            </span>
            <span className={`text-[11px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Markets, Economy & Social Media Hysteria
            </span>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl border bg-[#101114] border-[#282a33]">
          <button
            onClick={() => setActiveFilter('ALL')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold font-mono transition ${
              activeFilter === 'ALL'
                ? 'bg-[#FF007F] text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Macro Noise
          </button>
          <button
            onClick={() => setActiveFilter('MARKETS')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold font-mono transition ${
              activeFilter === 'MARKETS'
                ? 'bg-[#FF007F] text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Markets ({marketThreats.length})
          </button>
          <button
            onClick={() => setActiveFilter('SOCIAL')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold font-mono transition ${
              activeFilter === 'SOCIAL'
                ? 'bg-[#FF007F] text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Social Hysteria ({MOCK_SOCIAL_HYSTERIA.length})
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-4">
        {/* ============================================================== */}
        {/* SUBSECTION A: REAL FINANCIAL MARKET TELEMETRY (YAHOO FINANCE)  */}
        {/* ============================================================== */}
        {(activeFilter === 'ALL' || activeFilter === 'MARKETS') && (
          <div className={`space-y-3 ${activeFilter === 'MARKETS' ? 'lg:col-span-2' : ''}`}>
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2 text-xs font-bold font-mono uppercase tracking-wider text-rose-400">
                <TrendingDown className="w-4 h-4" />
                <span>Yahoo Finance Global Telemetry</span>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                30m Ingestion Active
              </span>
            </div>

            <div className="space-y-2.5">
              {marketThreats.map((threat) => {
                const isHovered = hoveredThreatId === (threat.id || threat.title);
                let meta: Record<string, unknown> = {};
                try {
                  if (typeof threat.metadata === 'string') meta = JSON.parse(threat.metadata);
                  else if (threat.metadata) meta = threat.metadata as unknown as Record<string, unknown>;
                } catch {
                  meta = {};
                }

                const sym = typeof meta.symbol === 'string' ? meta.symbol : '';
                const change = typeof meta.change_percent === 'number' ? meta.change_percent : 0;
                const price = typeof meta.price === 'number' ? meta.price : null;
                const currency = typeof meta.currency === 'string' ? meta.currency : 'USD';
                const commentary = getMarketPanicCommentary(sym, change);

                return (
                  <div
                    key={threat.id || threat.title}
                    onClick={() => onSelectThreat(threat)}
                    onMouseEnter={() => setHoveredThreatId?.(threat.id || threat.title)}
                    onMouseLeave={() => setHoveredThreatId?.(null)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      isHovered
                        ? isDark ? 'bg-[#1f222b] border-[#FF007F] shadow-md' : 'bg-white border-[#FF007F] shadow-md'
                        : isDark ? 'bg-[#101114] border-[#282a33] hover:border-slate-600' : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className={`p-2 rounded-lg border font-mono font-bold text-xs ${
                          change >= 0 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}>
                          {change >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                        </div>
                        <div>
                          <div className="font-bold text-xs text-white flex items-center gap-2">
                            <span>{threat.title}</span>
                            <span className="text-[10px] font-mono text-slate-400 font-normal">
                              ({sym})
                            </span>
                          </div>
                          {price !== null && (
                            <div className="text-[11px] font-mono text-slate-300 mt-0.5">
                              {currency === 'JPY' ? '¥' : currency === 'GBP' ? '£' : '$'}
                              {price.toLocaleString()}
                              <span className={`ml-2 font-bold ${change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#FF007F]/10 text-[#FF007F] border border-[#FF007F]/20 font-bold shrink-0">
                        Sev {threat.severityScore.toFixed(1)}
                      </span>
                    </div>

                    {/* Witty Market Panic Commentary */}
                    <p className={`text-[11px] mt-2 italic pl-2 border-l-2 border-slate-600 ${
                      isDark ? 'text-slate-400' : 'text-slate-600'
                    }`}>
                      &bull; {commentary}
                    </p>
                  </div>
                );
              })}

              {marketThreats.length === 0 && (
                <div className="p-6 rounded-xl border border-[#282a33] text-center font-mono text-xs text-slate-400 bg-[#101114]">
                  No financial volatility spikes active in current filter window.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* SUBSECTION B: SOCIAL MEDIA HYSTERIA & REALITY CHECK DEBUNKS     */}
        {/* ============================================================== */}
        {(activeFilter === 'ALL' || activeFilter === 'SOCIAL') && (
          <div className={`space-y-3 ${activeFilter === 'SOCIAL' ? 'lg:col-span-2' : ''}`}>
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2 text-xs font-bold font-mono uppercase tracking-wider text-amber-400">
                <Flame className="w-4 h-4" />
                <span>Internet Hysteria vs. Physical Reality</span>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                Debunk Engine &bull; Sensor Cross-Referenced
              </span>
            </div>

            <div className="space-y-3">
              {MOCK_SOCIAL_HYSTERIA.map((item) => {
                const isLiked = !!likedPosts[item.id];

                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-xl border transition-all ${
                      isDark ? 'bg-[#101114] border-[#282a33]' : 'bg-slate-50 border-slate-200'
                    } space-y-2.5`}
                  >
                    {/* Top Row: Platform, Author, Reach, Hysteria Index */}
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                          item.platform === 'TikTok' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' :
                          item.platform === 'Twitter/X' ? 'bg-slate-500/10 text-slate-200 border border-slate-500/20' :
                          item.platform === 'YouTube' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                          'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {item.platform}
                        </span>
                        <span className="font-semibold text-slate-300 truncate max-w-[140px] sm:max-w-none">
                          {item.author}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {item.handle} &bull; {item.reach}
                        </span>
                      </div>

                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0">
                        Hysteria {item.hysteriaLevel}/10
                      </span>
                    </div>

                    {/* Viral Claim */}
                    <div className="text-xs font-semibold text-rose-300 leading-snug">
                      &ldquo;{item.claim}&rdquo;
                    </div>

                    {/* Physics Reality Check */}
                    <div className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
                      isDark ? 'bg-[#161821] border-[#2c3244] text-slate-200' : 'bg-white border-slate-200 text-slate-800'
                    }`}>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <span className="text-[10px] uppercase font-bold text-emerald-400 font-mono block">
                          Physics & Sensor Reality Check:
                        </span>
                        <p className="text-[11px] leading-relaxed text-slate-300">
                          {item.realityCheck}
                        </p>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500 font-mono">
                      <span>Posted {item.timeAgo}</span>
                      <button
                        onClick={() => toggleDebunkVote(item.id)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] transition ${
                          isLiked 
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 font-bold' 
                            : 'hover:bg-[#1a1c24] border-[#282a33] text-slate-400 hover:text-white'
                        }`}
                      >
                        <ThumbsUp className="w-3 h-3" />
                        <span>{isLiked ? 'Debunk Verified (+1)' : 'Confirm Debunk'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
