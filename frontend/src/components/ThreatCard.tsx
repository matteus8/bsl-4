'use client';

import React, { useState } from 'react';
import { ThreatRecord } from '@/types/threats';
import { 
  Activity, 
  Flame, 
  Orbit, 
  CloudLightning, 
  TrendingDown, 
  MapPin,
  Compass, 
  Layers,
  Clock,
  ChevronLeft,
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import { formatDistance } from '@/lib/geo';

interface EventTableProps {
  threats: ThreatRecord[];
  onSelectThreat: (threat: ThreatRecord) => void;
  hoveredThreatId?: number | string | null;
  setHoveredThreatId?: (id: number | string | null) => void;
  isDark?: boolean;
  onSync?: () => void;
  isSyncing?: boolean;
}

export default function EventTable({ 
  threats, 
  onSelectThreat, 
  hoveredThreatId, 
  setHoveredThreatId, 
  isDark = true,
  onSync,
  isSyncing = false
}: EventTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  const totalPages = Math.ceil(threats.length / pageSize) || 1;
  const paginatedThreats = threats.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const formatEventDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHours / 24);

      let relative = '';
      if (diffHours < 1) {
        relative = 'Just now';
      } else if (diffHours < 24) {
        relative = `${diffHours}h ago`;
      } else if (diffDays === 1) {
        relative = 'Yesterday';
      } else {
        relative = `${diffDays}d ago`;
      }

      const formattedDate = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });

      return { relative, formattedDate };
    } catch {
      return { relative: 'Logged', formattedDate: dateStr };
    }
  };

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

  const renderLocationInfo = (threat: ThreatRecord) => {
    let place = '';
    let isPhysical = false;

    try {
      const meta = typeof threat.metadata === 'string' ? JSON.parse(threat.metadata) : threat.metadata;
      if (meta && typeof meta.latitude === 'number' && typeof meta.longitude === 'number') {
        isPhysical = true;
        place = meta.place || `${meta.latitude.toFixed(2)}°, ${meta.longitude.toFixed(2)}°`;
      } else if (meta && typeof meta.lat === 'number' && typeof meta.lon === 'number') {
        isPhysical = true;
        place = meta.place || `${meta.lat.toFixed(2)}°, ${meta.lon.toFixed(2)}°`;
      }
    } catch {
      // Ignored
    }

    if (threat.threatType === 'STOCK_MARKET') {
      let symbol = '';
      let region = 'Global';
      let changePct: number | null = null;
      try {
        const meta = typeof threat.metadata === 'string' ? JSON.parse(threat.metadata) : threat.metadata;
        if (meta) {
          symbol = meta.symbol || '';
          region = meta.region || 'Global';
          if (typeof meta.change_percent === 'number') changePct = meta.change_percent;
        }
      } catch {
        // Ignored
      }
      return (
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="truncate max-w-[170px] font-medium">{region}</span>
          </div>
          {symbol && (
            <div className="text-[10px] font-mono pl-5 flex items-center gap-1">
              <span className="text-slate-400">{symbol}</span>
              {changePct !== null && (
                <span className={changePct >= 0 ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                  {changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%
                </span>
              )}
            </div>
          )}
        </div>
      );
    }

    if (threat.threatType === 'SPACE_WEATHER') {
      return (
        <div className="flex items-center gap-1.5 text-slate-400">
          <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="text-[11px] font-mono">Solar / Ionospheric</span>
        </div>
      );
    }

    if (threat.threatType === 'ASTEROID') {
      return (
        <div className="flex items-center gap-1.5 text-slate-400">
          <Orbit className="w-3.5 h-3.5 text-purple-400 shrink-0" />
          <span className="text-[11px] font-mono">Near-Earth Orbit</span>
        </div>
      );
    }

    if (isPhysical || threat.threatType === 'EARTHQUAKE' || threat.threatType === 'TERRESTRIAL_WEATHER') {
      return (
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-[#FF007F] shrink-0" />
            <span className="truncate max-w-[170px] font-medium">{place || 'Active Zone'}</span>
          </div>
          {threat.distanceKm !== undefined && (
            <div className={`text-[10px] pl-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {formatDistance(threat.distanceKm)}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1.5 text-slate-400">
        <Compass className="w-3.5 h-3.5 shrink-0" />
        <span className="text-[11px]">Global Telemetry</span>
      </div>
    );
  };

  return (
    <div className={`border rounded-2xl overflow-hidden shadow-sm transition-colors ${
      isDark ? 'bg-[#16171c] border-[#282a33]' : 'bg-white border-slate-200'
    }`}>
      {/* Table Header Bar with Event Registry & Sync Button */}
      <div className={`px-4 py-3 border-b flex items-center justify-between gap-3 text-xs ${
        isDark ? 'border-[#282a33] bg-[#121316]/90 text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-600'
      }`}>
        <div className="flex items-center gap-2">
          <span className="font-semibold tracking-wide uppercase text-[11px] text-slate-400">
            Threat Event Registry
          </span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
            isDark ? 'bg-[#21242d] text-slate-300' : 'bg-slate-200 text-slate-700'
          }`}>
            {threats.length} Events
          </span>
        </div>

        {onSync && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSync();
            }}
            disabled={isSyncing}
            className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-semibold transition disabled:opacity-50 ${
              isDark
                ? 'bg-[#16171c] hover:bg-[#20222a] border-[#282a33] text-slate-200 hover:text-white'
                : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700 hover:text-slate-900 shadow-sm'
            }`}
            title="Sync telemetry directly with backend data sources"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-[#FF007F]' : 'text-[#FF007F]'}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Telemetry'}</span>
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className={`border-b font-semibold uppercase text-[11px] tracking-wider ${
              isDark
                ? 'border-[#282a33] bg-[#121316]/90 text-slate-400'
                : 'border-slate-200 bg-slate-50 text-slate-500'
            }`}>
              <th className="py-3.5 px-4">Hazard Event</th>
              <th className="py-3.5 px-4">Category</th>
              <th className="py-3.5 px-4 text-center">Threat Level</th>
              <th className="py-3.5 px-4">Location / Domain</th>
              <th className="py-3.5 px-4">Recorded</th>
              <th className="py-3.5 px-4 text-right">Telemetry</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isDark ? 'divide-[#282a33]' : 'divide-slate-200'}`}>
            {paginatedThreats.map((threat) => {
              const cat = getCategoryDetails(threat.threatType);
              const Icon = cat.icon;
              const isHovered = hoveredThreatId === (threat.id || threat.title);
              const { relative, formattedDate } = formatEventDate(threat.recordedAt);

              return (
                <tr
                  key={threat.id || threat.title}
                  onClick={() => onSelectThreat(threat)}
                  onMouseEnter={() => setHoveredThreatId?.(threat.id || threat.title)}
                  onMouseLeave={() => setHoveredThreatId?.(null)}
                  className={`transition-colors cursor-pointer group ${
                    isHovered 
                      ? isDark ? 'bg-[#232733]' : 'bg-pink-50/70'
                      : isDark ? 'hover:bg-[#1c1e24]' : 'hover:bg-slate-50'
                  }`}
                >
                  {/* Event Title & Summary */}
                  <td className="py-3.5 px-4 max-w-sm">
                    <div className={`font-semibold group-hover:text-[#FF007F] transition-colors text-sm ${
                      isDark ? 'text-white' : 'text-slate-900'
                    }`}>
                      {threat.title}
                    </div>
                    <div className={`text-[11px] truncate max-w-md ${
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

                  {/* Location / Domain */}
                  <td className={`py-3.5 px-4 whitespace-nowrap ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                    {renderLocationInfo(threat)}
                  </td>

                  {/* Timestamp & Age */}
                  <td className={`py-3.5 px-4 whitespace-nowrap ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1 font-mono text-[11px]">
                        <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="font-semibold">{relative}</span>
                      </div>
                      <div className={`text-[10px] font-mono pl-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        {formattedDate}
                      </div>
                    </div>
                  </td>

                  {/* Telemetry Status / Action */}
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>LOGGED</span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination & Row Count Footer */}
      <div className={`px-4 py-3 border-t flex flex-col sm:flex-row items-center justify-between gap-3 text-xs ${
        isDark ? 'border-[#282a33] bg-[#121316]/70 text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-600'
      }`}>
        <div className="font-mono text-[11px]">
          Showing <span className="font-bold text-[#FF007F]">{threats.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}</span> to <span className="font-bold text-[#FF007F]">{Math.min(currentPage * pageSize, threats.length)}</span> of <span className="font-bold text-white">{threats.length}</span> filtered events
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className={`p-1.5 rounded-lg border transition disabled:opacity-30 disabled:cursor-not-allowed ${
                isDark ? 'border-[#282a33] hover:bg-[#1f222b] text-white' : 'border-slate-200 hover:bg-slate-100 text-slate-800'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-mono text-[11px]">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className={`p-1.5 rounded-lg border transition disabled:opacity-30 disabled:cursor-not-allowed ${
                isDark ? 'border-[#282a33] hover:bg-[#1f222b] text-white' : 'border-slate-200 hover:bg-slate-100 text-slate-800'
              }`}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

