'use client';

import React from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';

const GithubIcon = ({ className = 'w-3.5 h-3.5' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

interface FooterProps {
  isDark?: boolean;
}

export default function Footer({ isDark = true }: FooterProps) {
  return (
    <footer className={`border-t transition-colors mt-12 py-5 text-xs ${
      isDark 
        ? 'border-[#232733] bg-[#101116] text-slate-400' 
        : 'border-slate-200 bg-white text-slate-600'
    }`}>
      <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 font-mono text-xs">
        <div className="flex items-center gap-2.5">
          <div className="px-2 py-0.5 rounded bg-[#FF007F]/10 border border-[#FF007F]/25 text-[#FF007F] font-black text-xs">
            BSL-4
          </div>
          <span>&copy; {new Date().getFullYear()} BSL-4</span>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/data-access"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition font-mono text-xs ${
              isDark
                ? 'bg-[#181a22] hover:bg-[#222530] border-[#2c3040] text-slate-300 hover:text-white'
                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 hover:text-slate-900'
            }`}
          >
            REST API Hub
          </Link>

          <a
            href="https://github.com/matteus8/bsl-4/tree/main"
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border transition ${
              isDark
                ? 'bg-[#181a22] hover:bg-[#222530] border-[#2c3040] text-slate-300 hover:text-white'
                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 hover:text-slate-900'
            }`}
          >
            <GithubIcon className="w-3.5 h-3.5" />
            <span>GitHub</span>
            <ExternalLink className="w-3 h-3 text-slate-500" />
          </a>
        </div>
      </div>
    </footer>
  );
}
