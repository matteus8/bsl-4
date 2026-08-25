'use client';

import React from 'react';
import { ThreatRecord } from '@/types/threats';
import { 
  Activity, 
  Flame, 
  Orbit, 
  CloudLightning, 
  TrendingDown, 
  X, 
  MapPin, 
  Clock, 
  ShieldAlert, 
  Radio, 
  Layers
} from 'lucide-react';
import { formatDistance } from '@/lib/geo';

interface EventDetailModalProps {
  threat: ThreatRecord | null;
  onClose: () => void;
}

export default function EventDetailModal({ threat, onClose }: EventDetailModalProps) {
  if (!threat) return null;

  let metadata: Record<string, unknown> = {};
  try {
    if (typeof threat.metadata === 'string') {
      metadata = JSON.parse(threat.metadata);
    } else if (threat.metadata) {
      metadata = threat.metadata as unknown as Record<string, unknown>;
    }
  } catch {
    metadata = {};
  }

  const getCategoryDetails = (type: string) => {
    switch (type) {
      case 'EARTHQUAKE':
        return { label: 'Earthquake Hazard', icon: Activity, badge: 'text-rose-500 bg-rose-500/10 border-rose-500/20' };
      case 'SPACE_WEATHER':
        return { label: 'Space & Solar Activity', icon: Flame, badge: 'text-amber-500 bg-amber-500/10 border-amber-500/20' };
      case 'ASTEROID':
        return { label: 'Near-Earth Object (NEO)', icon: Orbit, badge: 'text-purple-500 bg-purple-500/10 border-purple-500/20' };
      case 'TERRESTRIAL_WEATHER':
        return { label: 'Atmospheric Weather Hazard', icon: CloudLightning, badge: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/20' };
      case 'STOCK_MARKET':
        return { label: 'Financial Market Panic', icon: TrendingDown, badge: 'text-red-500 bg-red-500/10 border-red-500/20' };
      default:
        return { label: 'Global Event', icon: Activity, badge: 'text-slate-400 bg-slate-500/10 border-slate-500/20' };
    }
  };

  const cat = getCategoryDetails(threat.threatType);
  const Icon = cat.icon;

  const lat = typeof metadata.latitude === 'number' ? metadata.latitude : typeof metadata.lat === 'number' ? metadata.lat : null;
  const lon = typeof metadata.longitude === 'number' ? metadata.longitude : typeof metadata.lon === 'number' ? metadata.lon : null;
  const place = typeof metadata.place === 'string' ? metadata.place : null;
  const depth = typeof metadata.depth_km === 'number' ? metadata.depth_km : null;
  const magnitude = typeof metadata.magnitude === 'number' ? metadata.magnitude : null;
  const tsunamiAlert = typeof metadata.tsunami_alert === 'number' ? metadata.tsunami_alert : null;
  const symbol = typeof metadata.symbol === 'string' ? metadata.symbol : null;
  const price = typeof metadata.price === 'number' ? metadata.price : null;
  const changePercent = typeof metadata.change_percent === 'number' ? metadata.change_percent : null;
  const dayHigh = typeof metadata.day_high === 'number' ? metadata.day_high : null;
  const dayLow = typeof metadata.day_low === 'number' ? metadata.day_low : null;
  const currency = typeof metadata.currency === 'string' ? metadata.currency : 'USD';
  const region = typeof metadata.region === 'string' ? metadata.region : null;
  const maxWidthMeters = typeof metadata.max_width_meters === 'number' ? metadata.max_width_meters : null;
  const hasSensorReadings = magnitude !== null || tsunamiAlert !== null || symbol !== null || changePercent !== null || maxWidthMeters !== null || price !== null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#16171c] border border-[#282a33] rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col text-slate-100 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#282a33] bg-[#121316]/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#FF007F]/10 text-[#FF007F] border border-[#FF007F]/20">
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${cat.badge}`}>
                  {cat.label}
                </span>
                <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  LIVE EVENT
                </span>
              </div>
              <h2 className="text-base font-bold text-white tracking-tight mt-0.5 max-w-sm truncate">
                {threat.title}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#20222a] text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto font-sans">
          {/* Threat Metric Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#101114] border border-[#282a33] p-3.5 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Hazard Severity</span>
                <span className="text-xl font-black text-[#FF007F] font-mono">
                  {threat.severityScore.toFixed(1)} <span className="text-xs text-slate-500">/ 10</span>
                </span>
              </div>
              <ShieldAlert className="w-6 h-6 text-[#FF007F]/40" />
            </div>

            <div className="bg-[#101114] border border-[#282a33] p-3.5 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Domain / Vector</span>
                <span className="text-sm font-bold text-white uppercase font-mono">
                  {threat.threatType.replace('_', ' ')}
                </span>
              </div>
              <Radio className="w-6 h-6 text-amber-400/40" />
            </div>
          </div>

          {/* Location / Coordinates Card */}
          <div className="bg-[#101114] border border-[#282a33] p-4 rounded-xl space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#FF007F]" />
              <span>Location & Proximity Telemetry</span>
            </div>

            {(place || region) && (
              <div className="text-sm font-semibold text-white">
                {place || `${region} Market Liquidity Pool`}
              </div>
            )}

            {lat !== null && lon !== null ? (
              <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-[#282a33]/60">
                <div>
                  <span className="text-slate-500 block text-[10px]">Coordinates:</span>
                  <span className="font-mono text-slate-300">{lat.toFixed(4)}°, {lon.toFixed(4)}°</span>
                </div>
                {depth !== null && (
                  <div>
                    <span className="text-slate-500 block text-[10px]">Hypocenter Depth:</span>
                    <span className="font-mono text-slate-300">{depth.toFixed(1)} km</span>
                  </div>
                )}
                {threat.distanceKm !== undefined && (
                  <div className="col-span-2">
                    <span className="text-slate-500 block text-[10px]">Distance to Your Location:</span>
                    <span className="font-bold text-amber-400 font-mono">{formatDistance(threat.distanceKm)}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-slate-400 flex items-center gap-2 pt-1 border-t border-[#282a33]/60">
                <Layers className="w-4 h-4 text-slate-500 shrink-0" />
                <span>Non-geospatial planetary / orbital domain (No fixed 2D ground coordinates).</span>
              </div>
            )}
          </div>

          {/* Specific Physical Sensor Metrics */}
          {hasSensorReadings && (
            <div className="bg-[#101114] border border-[#282a33] p-4 rounded-xl space-y-2 font-mono text-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-[#FF007F]" />
                <span>Sensor Instrument Readings</span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                {magnitude !== null && (
                  <div>
                    <span className="text-slate-500 block text-[10px]">Magnitude:</span>
                    <span className="text-rose-400 font-bold">M {magnitude.toFixed(1)} Richter</span>
                  </div>
                )}
                {tsunamiAlert !== null && (
                  <div>
                    <span className="text-slate-500 block text-[10px]">Tsunami Alert:</span>
                    <span className={tsunamiAlert ? 'text-red-400 font-bold' : 'text-slate-400'}>
                      {tsunamiAlert ? 'YES - ADVISORY ACTIVE' : 'NONE DETECTED'}
                    </span>
                  </div>
                )}
                {symbol !== null && (
                  <div>
                    <span className="text-slate-500 block text-[10px]">Ticker / Asset:</span>
                    <span className="text-white font-bold">{symbol}</span>
                  </div>
                )}
                {price !== null && (
                  <div>
                    <span className="text-slate-500 block text-[10px]">Current Price:</span>
                    <span className="text-white font-bold">{currency} {price.toLocaleString()}</span>
                  </div>
                )}
                {changePercent !== null && (
                  <div>
                    <span className="text-slate-500 block text-[10px]">24h Movement:</span>
                    <span className={`font-bold ${changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}%
                    </span>
                  </div>
                )}
                {dayHigh !== null && dayLow !== null && (
                  <div>
                    <span className="text-slate-500 block text-[10px]">Day Range:</span>
                    <span className="text-slate-300">{dayLow.toFixed(1)} - {dayHigh.toFixed(1)}</span>
                  </div>
                )}
                {maxWidthMeters !== null && (
                  <div>
                    <span className="text-slate-500 block text-[10px]">Estimated Diameter:</span>
                    <span className="text-purple-400 font-bold">{maxWidthMeters} m</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Description & Situation Narrative */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Hazard Incident Narrative
            </span>
            <p className="text-xs text-slate-300 leading-relaxed bg-[#101114] p-3.5 rounded-xl border border-[#282a33]">
              {threat.description}
            </p>
          </div>

          {/* Timestamp */}
          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>Logged: {new Date(threat.recordedAt).toLocaleString()}</span>
            </span>
            {threat.id && <span>Event ID: #{threat.id}</span>}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-[#282a33] flex justify-end bg-[#121316]/90">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#20222a] hover:bg-[#282a33] text-white font-semibold rounded-lg text-xs transition border border-[#282a33]"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
