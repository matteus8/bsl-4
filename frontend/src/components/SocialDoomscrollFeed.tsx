'use client';

import React, { useState } from 'react';
import { Radio, Flame, ShieldCheck, Copy, Check, ExternalLink } from 'lucide-react';
import { SocialDoomscrollItem } from '@/lib/api';

interface SocialDoomscrollFeedProps {
  socialItems?: SocialDoomscrollItem[];
  isDark?: boolean;
}

const DEFAULT_POSTS: SocialDoomscrollItem[] = [
  {
    author: 'Orbital Panic Watch',
    handle: '@CosmicDoomAlerts',
    postText: 'ALERT: Massive asteroid 2005 EG94 just skimmed past Earth! NASA is keeping quiet about how close it really was... Are we safe?! ☄️😱 #Asteroid#EndTimes',
    sanityCheck: 'It missed us by 12.3 million kilometers—dinosaurs would be furious at your definition of a close call.',
    hysteriaScore: 9.2,
    verified: true,
  },
  {
    author: 'Space Weather Collapse',
    handle: '@SolarFlareDoomer',
    postText: 'TRIPLE CME SOLAR EVENT DETECTED! The sun is burping plasma directly at us. Prepare for total power grid collapse tonight! ☀️⚡️ Carrington Event 2.0!',
    sanityCheck: 'Standard solar coronal activity resulting in auroras over high latitudes, not grid collapse.',
    hysteriaScore: 8.8,
    verified: false,
  },
  {
    author: 'Market Meltdown Daily',
    handle: '@MacroDeathSpiral',
    postText: 'VIX IS SPIKING (+2.7%) AND THE HANG SENG IS DOWN NEARLY 2%! THE GLOBAL LIQUIDITY CRUNCH IS HERE. CASH OUT NOW! 📉🚨💥',
    sanityCheck: 'Routine market rebalancing; equity indices are stable and core banking liquidity is operating normally.',
    hysteriaScore: 8.4,
    verified: true,
  },
];

export function SocialDoomscrollFeed({
  socialItems,
  isDark = true,
}: SocialDoomscrollFeedProps) {
  const posts = socialItems && socialItems.length > 0 ? socialItems : DEFAULT_POSTS;
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const handleCopyFactCheck = (post: SocialDoomscrollItem, idx: number) => {
    const text = post.postText || post.post_text || '';
    const check = post.sanityCheck || post.sanity_check || '';
    const handle = post.handle || '@viral';
    
    const formatted = `Claim by ${handle}: "${text}"\n\nFact Check: ${check}\n\nVia BSL-4: https://platformstaq.com`;
    navigator.clipboard.writeText(formatted);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const handleTweetFactCheck = (post: SocialDoomscrollItem) => {
    const text = post.postText || post.post_text || '';
    const check = post.sanityCheck || post.sanity_check || '';
    const handle = post.handle || '@viral';

    const tweet = `Fact check on ${handle}:\n"${text.slice(0, 100)}..."\n\nReality: ${check}\n\nTelemetry: https://platformstaq.com`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweet)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <section className={`border rounded-2xl p-5 sm:p-6 transition-all ${
      isDark
        ? 'bg-[#12141a] border-[#232733] text-white shadow-sm'
        : 'bg-white border-slate-200 text-slate-900 shadow-sm'
    }`}>
      {/* Minimal Header */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#232733]">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Radio className="w-3.5 h-3.5" />
          </div>
          <h2 className="text-xs font-bold tracking-wider uppercase font-mono text-cyan-300">
            SOCIAL MEDIA HYSTERIA & FACT CHECKS
          </h2>
        </div>

        {/* Overreaction Index Pill */}
        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-[10px] font-mono font-medium text-rose-400">
          <Flame className="w-3 h-3 text-rose-400" />
          <span>Hysteria Index: 4.8x</span>
        </div>
      </div>

      {/* Social Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3.5">
        {posts.map((post, idx) => {
          const text = post.postText || post.post_text || '';
          const check = post.sanityCheck || post.sanity_check || '';
          const score = post.hysteriaScore || post.hysteria_score || 8.5;
          const isCopied = copiedIdx === idx;

          return (
            <div
              key={idx}
              className={`rounded-xl border p-4 flex flex-col justify-between transition-colors ${
                isDark
                  ? 'bg-[#0d0e12] border-[#232733] hover:border-slate-600'
                  : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
              }`}
            >
              <div className="space-y-3">
                {/* Post Author / Handle Header */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-mono font-bold text-xs text-slate-300">
                      {post.author ? post.author[0].toUpperCase() : 'X'}
                    </div>
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-semibold truncate max-w-[110px]">{post.author}</span>
                        {post.verified && (
                          <span className="w-3.5 h-3.5 rounded-full bg-blue-500 text-white flex items-center justify-center text-[8px] font-bold">
                            ✓
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">{post.handle}</span>
                    </div>
                  </div>

                  {/* Hysteria Score Badge */}
                  <span className="px-2 py-0.5 rounded text-[9px] font-mono font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20 shrink-0">
                    {score.toFixed(1)}/10
                  </span>
                </div>

                {/* Viral Post Content (The Panic Claim) */}
                <div className={`p-3 rounded-lg border text-xs leading-relaxed italic ${
                  isDark ? 'bg-[#12141a] border-[#232733] text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}>
                  &ldquo;{text}&rdquo;
                </div>

                {/* Reality Check */}
                <div className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
                  isDark ? 'bg-[#0b1410] border-emerald-900/40 text-slate-200' : 'bg-emerald-50/50 border-emerald-200 text-slate-800'
                }`}>
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="text-[10px] uppercase font-bold text-emerald-400 font-mono block">
                      Physical Reality:
                    </span>
                    <p className="text-[11px] leading-relaxed text-slate-300">
                      {check}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-2 pt-3 mt-3 border-t border-[#232733]">
                <button
                  type="button"
                  onClick={() => handleCopyFactCheck(post, idx)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono transition ${
                    isCopied
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : isDark
                      ? 'bg-[#181a22] text-slate-400 hover:text-slate-200 border border-[#2c3040]'
                      : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200'
                  }`}
                >
                  {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{isCopied ? 'Copied' : 'Copy'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTweetFactCheck(post)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono bg-black hover:bg-slate-900 text-white border border-slate-700 transition"
                >
                  <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                  <span>Tweet Fact-Check</span>
                  <ExternalLink className="w-2.5 h-2.5 text-slate-400" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
