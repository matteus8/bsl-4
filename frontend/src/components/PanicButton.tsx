'use client';

import React, { useState } from 'react';
import { Skull, AlertOctagon, Loader2, GlassWater } from 'lucide-react';
import { playEmergencySiren, playDispenseChime } from '@/lib/audio';

interface PanicButtonProps {
  onTriggerProtocolZero: () => Promise<void>;
  onOpenEmergencyDrink: () => void;
  audioEnabled: boolean;
  isLoading: boolean;
}

export default function PanicButton({
  onTriggerProtocolZero,
  onOpenEmergencyDrink,
  audioEnabled,
  isLoading,
}: PanicButtonProps) {
  const [isActivating, setIsActivating] = useState(false);

  const handleClick = async () => {
    if (isLoading || isActivating) return;
    setIsActivating(true);

    if (audioEnabled) {
      playEmergencySiren();
    }

    try {
      await onTriggerProtocolZero();
      if (audioEnabled) {
        setTimeout(playDispenseChime, 800);
      }
      onOpenEmergencyDrink();
    } finally {
      setIsActivating(false);
    }
  };

  return (
    <div className="relative group">
      {/* Outer Pulse Rings */}
      <div className="absolute -inset-1 bg-gradient-to-r from-pink to-rose-600 rounded-xl blur opacity-70 group-hover:opacity-100 transition duration-500 group-hover:duration-200 animate-pulse" />

      <button
        onClick={handleClick}
        disabled={isLoading || isActivating}
        className="relative w-full flex items-center justify-between gap-4 px-6 py-4 bg-gradient-to-r from-surface-card to-surface border-2 border-pink rounded-xl text-white font-mono font-bold uppercase tracking-wider transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] shadow-pink-glow disabled:opacity-50"
      >
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 rounded-lg bg-pink text-white shadow-pink-glow animate-bounce">
            {isLoading || isActivating ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <Skull className="w-6 h-6" />
            )}
          </div>
          <div className="text-left">
            <div className="text-xs text-pink-300 font-extrabold flex items-center gap-1.5 tracking-widest">
              <AlertOctagon className="w-3.5 h-3.5 text-pink animate-pulse" />
              EMERGENCY INTERVENTION
            </div>
            <div className="text-base sm:text-lg font-black text-white tracking-wider flex items-center gap-2">
              EXECUTE PROTOCOL ZERO
            </div>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-pink/20 border border-pink/60 text-pink text-xs font-black shadow-pink-glow-sm">
          <GlassWater className="w-4 h-4 text-pink" />
          <span>PRESCRIBE RECOVERY DRINK</span>
        </div>
      </button>
    </div>
  );
}
