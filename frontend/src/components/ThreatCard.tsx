'use client';

import React from 'react';
import { ThreatRecord } from '@/types/threats';
import { 
  Activity, 
  Flame, 
  Orbit, 
  CloudLightning, 
  TrendingDown, 
  Wine, 
  ChevronRight,
  MapPin
} from 'lucide-react';
import { formatDistance } from '@/lib/geo';

interface EventTableProps {
  threats: ThreatRecord[];
  onSelectThreat: (threat: ThreatRecord) => void;
  isDark?: boolean;
}

export default function EventTable({ threats, onSelectThreat, isDark = true }: EventTableProps) {
  const getCategoryDetails = (type: string) => {
    switch (type) {
      case 'EARTHQUAKE':
        return { label: 'Earthquake', icon: Activity, badge: 'text-rose-500 bg-rose-500/10 border-rose-500/20' };
      case 'SPACE_WEATHER':
        return { label: 'Space Weather', icon: Flame, badge: 'text-amber-500 bg-amber-500/10 border-amber-500/20' };
      case 'ASTEROID':
        return { label: 'Asteroid', icon: Orbit, badge: 'text-purple-500 bg-purple-500/10 border-purple-500/20' };
      case 'TERRESTRIAL_WEATHER':
        return { label: 'Weather Alert', icon: CloudLightning, badge: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/20' };
      case 'STOCK_MARKET':
        return { label: 'Market Volatility', icon: TrendingDown, badge: 'text-red-500 bg-red-500/10 border-red-500/20' };
      default:
        return { label: 'Event', icon: Activity, badge: 'text-slate-400 bg-slate-500/10 border-slate-500/20' };
    }
  };

  const getEventLocation = (threat: ThreatRecord) => {
    try {
      const meta = typeof threat.metadata === 'string' ? JSON.parse(threat.metadata) : threat.metadata;
      if (meta?.place) return meta.place;
      if (threat.distanceKm !== undefined) return formatDistance(threat.distanceKm);
      if (threat.threatType === 'ASTEROID') return 'Near-Earth Orbit';
      if (threat.threatType === 'SPACE_WEATHER') return 'Solar Activity';
      if (threat.threatType === 'STOCK_MARKET') return 'Global Financial Markets';
    } catch {
      // Ignored
    }
    return threat.distanceKm !== undefined ? formatDistance(threat.distanceKm) : 'Global';
  };

  return (
    <div className={`border rounded-2xl overflow-hidden shadow-sm transition-colors ${
      isDark ? 'bg-[#16171c] border-[#282a33]' : 'bg-white border-slate-200'
    }`}>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className={`border-b font-semibold uppercase text-[11px] tracking-wider ${
              isDark
                ? 'border-[#282a33] bg-[#121316]/90 text-slate-400'
                : 'border-slate-200 bg-slate-50 text-slate-500'
            }`}>
              <th className="py-3.5 px-4">Event</th>
              <th className="py-3.5 px-4">Category</th>
              <th className="py-3.5 px-4 text-center">Activity Level</th>
              <th className="py-3.5 px-4">Location</th>
              <th className="py-3.5 px-4">Drink Pairing</th>
              <th className="py-3.5 px-4 text-right">Recipe</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isDark ? 'divide-[#282a33]' : 'divide-slate-200'}`}>
            {threats.map((threat) => {
              const cat = getCategoryDetails(threat.threatType);
              const Icon = cat.icon;
              const locationStr = getEventLocation(threat);

              return (
                <tr
                  key={threat.id || threat.title}
                  onClick={() => onSelectThreat(threat)}
                  className={`transition-colors cursor-pointer group ${
                    isDark ? 'hover:bg-[#1c1e24]' : 'hover:bg-slate-50'
                  }`}
                >
                  {/* Event Title & Summary */}
                  <td className="py-3.5 px-4 max-w-xs">
                    <div className={`font-semibold group-hover:text-[#FF007F] transition-colors text-sm ${
                      isDark ? 'text-white' : 'text-slate-900'
                    }`}>
                      {threat.title}
                    </div>
                    <div className={`text-[11px] truncate max-w-sm ${
                      isDark ? 'text-slate-400' : 'text-slate-500'
                    }`}>
                      {threat.description}
                    </div>
                  </td>

                  {/* Category */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border ${cat.badge}`}>
                      <Icon className="w-3 h-3" />
                      {cat.label}
                    </span>
                  </td>

                  {/* Intensity Score */}
                  <td className="py-3.5 px-4 text-center whitespace-nowrap">
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[#FF007F]/10 text-[#FF007F] border border-[#FF007F]/25">
                      {threat.severityScore.toFixed(1)} <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>/ 10</span>
                    </span>
                  </td>

                  {/* Location / Proximity */}
                  <td className={`py-3.5 px-4 whitespace-nowrap ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#FF007F] shrink-0" />
                      <span className="truncate max-w-[170px]">{locationStr}</span>
                    </div>
                  </td>

                  {/* Drink Recommendation */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <div className={`flex items-center gap-1.5 font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>
                      <Wine className="w-3.5 h-3.5 text-[#FF007F] shrink-0" />
                      <span>{threat.recommendedDrink}</span>
                    </div>
                  </td>

                  {/* Action Button */}
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectThreat(threat);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-[#FF007F]/15 hover:bg-[#FF007F] text-[#FF007F] hover:text-white rounded-lg text-xs font-semibold transition"
                    >
                      <span>Recipe</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
