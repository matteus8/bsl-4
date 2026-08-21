'use client';

import React from 'react';
import { ThreatRecord, CocktailMetadata } from '@/types/threats';
import { Wine, X, Check, GlassWater } from 'lucide-react';

interface CocktailModalProps {
  threat: ThreatRecord | null;
  onClose: () => void;
}

export default function CocktailModal({ threat, onClose }: CocktailModalProps) {
  if (!threat) return null;

  let cocktailData: CocktailMetadata | null = null;
  try {
    const meta = typeof threat.metadata === 'string' ? JSON.parse(threat.metadata) : threat.metadata;
    if (meta && (meta as { cocktail?: CocktailMetadata }).cocktail) {
      cocktailData = (meta as { cocktail: CocktailMetadata }).cocktail;
    }
  } catch {
    cocktailData = null;
  }

  const drinkName = cocktailData?.drink_name || threat.recommendedDrink || 'Curated Cocktail';
  const instructions = cocktailData?.instructions || 'Pour into a chilled glass and serve with ice.';
  const glass = cocktailData?.glass || 'Cocktail glass';
  const thumbUrl = cocktailData?.thumb_url || 'https://www.thecocktaildb.com/images/media/drink/5noda61589575158.jpg';
  const ingredients: string[] = cocktailData?.ingredients || [
    '2 oz Spirit of choice',
    '1 oz Fresh Citrus Juice',
    'Ice'
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="bg-[#16171c] border border-[#282a33] rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col text-slate-100 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#282a33] bg-[#121316]/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#FF007F]/10 text-[#FF007F]">
              <Wine className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-[#FF007F] font-bold uppercase tracking-wider block">
                Recommended Drink Pairing
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
          {/* Context Banner */}
          <div className="bg-[#121316] border border-[#282a33] rounded-xl p-3.5 flex items-center justify-between text-xs">
            <div className="truncate mr-2">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Paired Event:</span>
              <span className="font-semibold text-white truncate">{threat.title}</span>
            </div>
            <div className="text-right shrink-0">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Activity Level:</span>
              <span className="font-bold text-[#FF007F]">{threat.severityScore.toFixed(1)} / 10</span>
            </div>
          </div>

          {/* Photo & Glassware */}
          <div className="flex gap-4 items-center bg-[#121316] p-3 rounded-xl border border-[#282a33]">
            <div className="w-20 h-20 rounded-lg overflow-hidden bg-[#1c1e24] shrink-0 flex items-center justify-center">
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
              <span className="text-xs text-slate-400 block">Recommended Glass:</span>
              <span className="text-sm font-semibold text-white">{glass}</span>
            </div>
          </div>

          {/* Ingredients */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Ingredients
            </h3>
            <div className="space-y-1.5">
              {ingredients.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 text-xs text-slate-200 bg-[#121316] px-3 py-2 rounded-lg border border-[#282a33]"
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
              Preparation
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed bg-[#121316] p-3.5 rounded-lg border border-[#282a33]">
              {instructions}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#282a33] flex justify-end bg-[#121316]">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#FF007F] hover:bg-[#E60072] text-white font-bold rounded-lg text-xs transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
