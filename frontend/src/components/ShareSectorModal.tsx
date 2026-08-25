'use client';

import React, { useState } from 'react';
import { X, Check, Copy, Shield, ExternalLink } from 'lucide-react';
import { UserLocation } from '@/types/threats';

interface ShareSectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  userLocation: UserLocation;
  localScore: number;
  localLevel: string;
  isDark?: boolean;
  verdictSnippet?: string;
}

export const ShareSectorModal: React.FC<ShareSectorModalProps> = ({
  isOpen,
  onClose,
  userLocation,
  localScore,
  localLevel,
  isDark = true,
  verdictSnippet
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const cityName = userLocation.cityName?.split(',')[0] || 'Target Coordinates';
  const coordsStr = `${userLocation.latitude.toFixed(2)}°N, ${Math.abs(userLocation.longitude).toFixed(2)}°W`;

  const tweetText = `🚨 BSL-4 PROTOCOL ZERO // CITIZEN THREAT CLEARANCE
📍 Sector: ${cityName} (${coordsStr})
📊 Local Threat Score: ${localScore.toFixed(1)} / 10 • [${localLevel}]
🛡️ Physical Status: Ground Stable • Dinosaurs Safe
${verdictSnippet ? `💬 AI Reality Check: "${verdictSnippet}"\n` : ''}
Check your local sector telemetry: https://platformstaq.com`;

  const handleShareToX = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(tweetText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden transition-all animate-in zoom-in-95 duration-200 ${
          isDark
            ? 'bg-[#12141c] border-[#2a2f3f] text-white shadow-black/80'
            : 'bg-white border-slate-200 text-slate-900 shadow-slate-400/40'
        }`}
      >
        {/* Header */}
        <div className={`p-4 border-b flex items-center justify-between ${
          isDark ? 'border-[#222736] bg-[#161822]' : 'border-slate-100 bg-slate-50'
        }`}>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-black text-white border border-slate-700 flex items-center justify-center">
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">Share Sector Clearance</h3>
              <p className="text-[10px] font-mono text-slate-400">Broadcast your local threat telemetry on 𝕏</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4">
          {/* Card Preview Box */}
          <div className={`p-4 rounded-xl border font-mono text-xs relative overflow-hidden ${
            isDark
              ? 'bg-[#0b0c10] border-[#1e2230] text-slate-200'
              : 'bg-slate-50 border-slate-200 text-slate-800'
          }`}>
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-700/40">
              <div className="flex items-center gap-1.5 text-[10px] text-[#FF007F] font-bold uppercase tracking-wider">
                <Shield className="w-3.5 h-3.5" />
                <span>BSL-4 Protocol Zero // Clearance</span>
              </div>
              <span className="text-[10px] text-slate-400">{cityName}</span>
            </div>

            <div className="space-y-1.5 text-[11px] leading-relaxed">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Sector Threat Score:</span>
                <span className="font-bold text-[#00F0FF]">{localScore.toFixed(1)} / 10 ({localLevel})</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Coordinates:</span>
                <span className="text-slate-300">{coordsStr}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Planetary Safety:</span>
                <span className="text-emerald-400 font-bold">Ground Stable • Dinosaurs Safe</span>
              </div>
              {verdictSnippet && (
                <div className="pt-2 border-t border-slate-700/30 text-[10px] italic text-slate-400">
                  &ldquo;{verdictSnippet}&rdquo;
                </div>
              )}
            </div>

            <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-[9px] text-slate-500">
              <span>Verified at platformstaq.com</span>
              <span className="text-[#FF007F] font-bold">PROTOCOL ZERO</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            {/* Share to X (Twitter) */}
            <button
              onClick={handleShareToX}
              className="py-2.5 px-4 rounded-xl bg-black hover:bg-zinc-900 border border-zinc-700 text-white font-mono text-xs font-bold flex items-center justify-center gap-2 shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              <span>Post on 𝕏</span>
              <ExternalLink className="w-3 h-3 text-slate-400 ml-0.5" />
            </button>

            {/* Copy Text */}
            <button
              onClick={handleCopy}
              className={`py-2.5 px-4 rounded-xl border font-mono text-xs font-bold flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] ${
                copied
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                  : isDark
                  ? 'bg-[#1a1d27] border-[#2b3042] text-slate-200 hover:bg-[#232736]'
                  : 'bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Copied Report!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Text</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
