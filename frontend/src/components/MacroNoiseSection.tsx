'use client';

import React, { useMemo } from 'react';
import { ThreatRecord } from '@/types/threats';
import { TrendingDown, TrendingUp, DollarSign } from 'lucide-react';

interface MacroNoiseSectionProps {
  threats: ThreatRecord[];
  onSelectThreat: (threat: ThreatRecord) => void;
  hoveredThreatId?: number | string | null;
  setHoveredThreatId?: (id: number | string | null) => void;
  isDark?: boolean;
}

export default function MacroNoiseSection({
  threats,
  onSelectThreat,
  hoveredThreatId,
  setHoveredThreatId,
  isDark = true,
}: MacroNoiseSectionProps) {
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
    <section className={`border rounded-2xl p-5 sm:p-6 transition-all shadow-sm ${
      isDark ? 'bg-[#12141a] border-[#232733]' : 'bg-white border-slate-200'
    }`}>
      {/* Minimal Header */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#232733]">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <DollarSign className="w-3.5 h-3.5" />
          </div>
          <h2 className="text-xs font-bold uppercase tracking-wider font-mono text-rose-300">
            GLOBAL FINANCIAL VOLATILITY
          </h2>
        </div>

        <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          30m Ingestion ({marketThreats.length} Assets)
        </span>
      </div>

      {/* Markets Grid (2 Columns) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-3.5">
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
                    <div className="font-bold text-xs flex items-center gap-2">
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
          <div className="col-span-2 p-6 rounded-xl border border-[#282a33] text-center font-mono text-xs text-slate-400 bg-[#101114]">
            No financial volatility spikes active in current filter window.
          </div>
        )}
      </div>
    </section>
  );
}
