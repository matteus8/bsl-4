'use client';

import React from 'react';
import { CocktailMetadata } from '@/types/threats';
import { Wine, X, Check, GlassWater, ShieldAlert, MapPin } from 'lucide-react';

export interface AmalgamatedCountermeasureData {
  title?: string;
  drinkName: string;
  severity: number;
  locationName: string;
  summary?: string;
  cocktailData?: CocktailMetadata | Record<string, unknown>;
}

interface CocktailModalProps {
  data: AmalgamatedCountermeasureData | null;
  onClose: () => void;
}

export default function CocktailModal({ data, onClose }: CocktailModalProps) {
  if (!data) return null;

  const cocktail = data.cocktailData as CocktailMetadata | undefined;
  const drinkName = cocktail?.drink_name || data.drinkName || 'Panic Button Martini';
  const instructions = cocktail?.instructions || 'Stir with ice until chillingly cold. Strain into a chilled glass and serve immediately.';
  const glass = cocktail?.glass || 'Cocktail glass';
  const thumbUrl = cocktail?.thumb_url || 'https://www.thecocktaildb.com/images/media/drink/hbkfsh1589574990.jpg';
  const ingredients: string[] = cocktail?.ingredients || [
    '2 oz Spirit of choice',
    '1 oz Fresh Citrus Juice',
    'Chilled Ice'
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#16171c] border border-[#282a33] rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col text-slate-100 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#282a33] bg-[#121316]/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#FF007F]/10 text-[#FF007F] border border-[#FF007F]/20">
              <Wine className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-[#FF007F] font-bold uppercase tracking-wider block">
                Amalgamated Liquid Countermeasure
              </span>
              <h2 className="text-lg font-bold text-white tracking-tight">
                {drinkName}
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

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Location & Amalgamated Threat Matrix Banner */}
          <div className="bg-[#101114] border border-[#282a33] rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 font-bold text-white truncate mr-2">
                <MapPin className="w-3.5 h-3.5 text-[#FF007F] shrink-0" />
                <span className="truncate">{data.locationName}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <ShieldAlert className="w-3.5 h-3.5 text-[#FF007F]" />
                <span className="font-bold text-[#FF007F] font-mono">{data.severity.toFixed(1)} / 10</span>
              </div>
            </div>

            {data.summary && (
              <p className="text-xs text-slate-400 leading-relaxed pt-1 border-t border-[#282a33]/60">
                {data.summary}
              </p>
            )}
          </div>

          {/* Photo & Glassware */}
          <div className="flex gap-4 items-center bg-[#101114] p-3 rounded-xl border border-[#282a33]">
            <div className="w-20 h-20 rounded-lg overflow-hidden bg-[#1c1e24] shrink-0 flex items-center justify-center border border-[#282a33]">
              {thumbUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={thumbUrl}
                  alt={drinkName}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <GlassWater className="w-8 h-8 text-[#FF007F]" />
              )}
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block uppercase font-semibold">Prescribed Glassware</span>
              <span className="text-sm font-bold text-white mt-0.5 block">{glass}</span>
              <span className="text-[10px] text-emerald-400 font-mono mt-1 inline-block">
                PROTOCOL ZERO CERTIFIED
              </span>
            </div>
          </div>

          {/* Ingredients */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Required Ingredients
            </h3>
            <div className="space-y-1.5">
              {ingredients.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 text-xs text-slate-200 bg-[#101114] px-3 py-2 rounded-lg border border-[#282a33]"
                >
                  <Check className="w-3.5 h-3.5 text-[#FF007F] shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Instructions */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Preparation Protocol
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed bg-[#101114] p-3.5 rounded-lg border border-[#282a33]">
              {instructions}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-[#282a33] flex justify-end bg-[#121316]/90">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#FF007F] hover:bg-[#E60072] text-white font-bold rounded-lg text-xs transition shadow-pink-glow-sm"
          >
            Acknowledge & Close
          </button>
        </div>
      </div>
    </div>
  );
}

