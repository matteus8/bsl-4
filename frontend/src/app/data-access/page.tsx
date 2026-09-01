'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { UserLocation, ThreatRecord } from '@/types/threats';
import { fetchLatestThreats, fetchLatestEditorialVerdict, EditorialVerdictResponse } from '@/lib/api';
import {
  Copy,
  Check,
  Download,
  ExternalLink,
  ArrowLeft,
  Code2,
  FileJson
} from 'lucide-react';

interface Endpoint {
  id: 'threats' | 'verdict';
  name: string;
  path: string;
  description: string;
}

const ENDPOINTS: Endpoint[] = [
  {
    id: 'threats',
    name: 'Threat Telemetry Feed',
    path: '/data/threats.json',
    description: 'Real-time multi-vector threat snapshot (Earthquakes, Solar Flares, Asteroids, Weather, Markets).',
  },
  {
    id: 'verdict',
    name: 'AI Verdict & Panic Index',
    path: '/data/editorial-verdict.json',
    description: 'Deterministic 1.0–10.0 Panic Index, Gemini AI reality checks, and social claim debunks.',
  },
];

export default function RestApiDataPage() {
  const [isDark, setIsDark] = useState(true);
  const [selectedEndpoint, setSelectedEndpoint] = useState<'threats' | 'verdict'>('threats');
  const [activeCodeTab, setActiveCodeTab] = useState<'curl' | 'js' | 'python'>('curl');
  const [timeFormat, setTimeFormat] = useState<'iso' | 'epoch'>('iso');

  // Copy States
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedResponse, setCopiedResponse] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Cache
  const [threatsCache, setThreatsCache] = useState<ThreatRecord[]>([]);
  const [verdictCache, setVerdictCache] = useState<EditorialVerdictResponse | null>(null);

  const [userLocation, setUserLocation] = useState<UserLocation>({
    latitude: 38.8339,
    longitude: -104.8214,
    cityName: 'Colorado Springs, CO, USA',
    isAutoDetected: false,
  });

  const toggleTheme = () => setIsDark(!isDark);

  useEffect(() => {
    async function init() {
      try {
        const [t, v] = await Promise.all([
          fetchLatestThreats(),
          fetchLatestEditorialVerdict(),
        ]);
        if (t && t.length > 0) setThreatsCache(t);
        if (v) setVerdictCache(v);
      } catch {
        // Handled
      }
    }
    init();
  }, []);

  const endpointUrl = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://platformstaq.com';
    return selectedEndpoint === 'threats'
      ? `${origin}/data/threats.json`
      : `${origin}/data/editorial-verdict.json`;
  }, [selectedEndpoint]);

  const rawData = useMemo(() => {
    if (selectedEndpoint === 'threats') {
      return threatsCache.length > 0 ? threatsCache.slice(0, 10) : [
        {
          id: 1,
          threatType: 'EARTHQUAKE',
          title: 'M 4.2 - 12km NE of Pahala, Hawaii',
          severityScore: 4.2,
          description: 'Depth: 31.8km. USGS Seismic Network monitoring regional volcanic faults.',
          metadata: '{"mag":4.2,"depth":31.8,"latitude":19.28,"longitude":-155.39}',
          recordedAt: new Date().toISOString(),
          recordedAtEpoch: Math.floor(Date.now() / 1000)
        }
      ];
    }
    return verdictCache || {
      id: 1,
      panicIndex: 2.1,
      statusLevel: 'NOMINAL',
      verdictText: 'Global panic index is at 2.1. Financial markets are experiencing routine noise, but cosmic and tectonic sensors report stable physical baseline. You are fine.',
      summaryNarrative: 'Planetary sensor arrays confirm equilibrium. No hazardous orbital, seismic, or geomagnetic vectors detected.',
      keyFactors: [
        'Tectonics: Baseline background activity only',
        'Orbital: Zero atmospheric collision threats',
        'Macro: Standard intraday volatility'
      ],
      modelUsed: 'gemini-3.6-flash',
      updatedAt: new Date().toISOString(),
      updatedAtEpoch: Math.floor(Date.now() / 1000)
    };
  }, [selectedEndpoint, threatsCache, verdictCache]);

  const formattedResponseData = useMemo(() => {
    if (!rawData) return null;
    if (timeFormat === 'epoch') {
      if (Array.isArray(rawData)) {
        return rawData.map((item: any) => {
          const recAt = item.recordedAt as string;
          const epochSec = (item.recordedAtEpoch as number) || (recAt ? Math.floor(new Date(recAt).getTime() / 1000) : Math.floor(Date.now() / 1000));
          return {
            ...item,
            recordedAtEpoch: epochSec,
          };
        });
      }
      if (typeof rawData === 'object' && rawData !== null) {
        const obj = rawData as any;
        const upAt = (obj.updatedAt || obj.createdAt) as string;
        const epochSec = (obj.updatedAtEpoch as number) || (upAt ? Math.floor(new Date(upAt).getTime() / 1000) : Math.floor(Date.now() / 1000));
        return {
          ...obj,
          updatedAtEpoch: epochSec,
        };
      }
    }
    return rawData;
  }, [rawData, timeFormat]);

  const codeSnippets = useMemo(() => {
    const isVerdict = selectedEndpoint === 'verdict';

    if (timeFormat === 'epoch') {
      if (isVerdict) {
        return {
          curl: `curl -s "${endpointUrl}" | jq '{id, panicIndex, statusLevel, verdictText, updatedAtEpoch}'`,
          js: `// Fetch AI Verdict and inspect Unix Epoch timestamp
const res = await fetch("${endpointUrl}");
const verdict = await res.json();

const epochSec = verdict.updatedAtEpoch || Math.floor(new Date(verdict.updatedAt).getTime() / 1000);
console.log(\`Panic Index: \${verdict.panicIndex} / 10 (Timestamp Epoch: \${epochSec})\`);
console.log(\`Verdict: \${verdict.verdictText}\`);`,
          python: `# Fetch AI Verdict with Unix Epoch timestamp
import requests

verdict = requests.get("${endpointUrl}").json()
epoch = verdict.get("updatedAtEpoch")
print(f"Panic Index: {verdict.get('panicIndex')} / 10 (Timestamp Epoch: {epoch})")
print(f"Verdict: {verdict.get('verdictText')}")`,
        };
      }

      return {
        curl: `curl -s "${endpointUrl}" | jq '.[] | {id, title, severityScore, recordedAtEpoch}'`,
        js: `// Fetch Telemetry feed and parse Unix Epoch timestamps
const res = await fetch("${endpointUrl}");
const threats = await res.json();

threats.forEach(t => {
  const epochSec = t.recordedAtEpoch || Math.floor(new Date(t.recordedAt).getTime() / 1000);
  console.log(\`\${t.title} -> Epoch: \${epochSec}\`);
});`,
        python: `# Fetch Telemetry feed with Unix Epoch timestamps
import requests

threats = requests.get("${endpointUrl}").json()
for t in threats:
    epoch = t.get("recordedAtEpoch")
    print(f"{t.get('title')}: {epoch}")`,
      };
    }

    if (isVerdict) {
      return {
        curl: `curl -s "${endpointUrl}" | jq .`,
        js: `// Fetch AI Verdict JSON feed
const res = await fetch("${endpointUrl}");
const verdict = await res.json();
console.log(verdict);`,
        python: `# Fetch AI Verdict JSON feed
import requests

verdict = requests.get("${endpointUrl}").json()
print(verdict)`,
      };
    }

    return {
      curl: `curl -s "${endpointUrl}"`,
      js: `// Fetch Telemetry JSON feed
const res = await fetch("${endpointUrl}");
const data = await res.json();
console.log(data);`,
      python: `# Fetch Telemetry JSON feed
import requests

data = requests.get("${endpointUrl}").json()
print(data)`,
    };
  }, [endpointUrl, selectedEndpoint, timeFormat]);

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(endpointUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleCopy = () => {
    if (!formattedResponseData) return;
    navigator.clipboard.writeText(JSON.stringify(formattedResponseData, null, 2));
    setCopiedResponse(true);
    setTimeout(() => setCopiedResponse(false), 2000);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(codeSnippets[activeCodeTab]);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleDownload = () => {
    if (!formattedResponseData) return;
    const blob = new Blob([JSON.stringify(formattedResponseData, null, 2)], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = `${selectedEndpoint}-${timeFormat}.json`;
    a.click();
    URL.revokeObjectURL(href);
  };

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-200 ${
      isDark ? 'bg-[#0f1013] text-slate-100' : 'bg-[#f8fafc] text-slate-900'
    }`}>
      <Header
        userLocation={userLocation}
        setUserLocation={setUserLocation}
        isDark={isDark}
        toggleTheme={toggleTheme}
      />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 space-y-6">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-[#232733] pb-4">
          <div className="space-y-1">
            <Link
              href="/"
              className={`inline-flex items-center gap-1.5 text-xs font-mono transition-colors ${
                isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Dashboard
            </Link>
            <h1 className="text-lg font-bold font-mono">REST API Endpoints</h1>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            <a
              href="/data/threats.json"
              target="_blank"
              rel="noopener noreferrer"
              className={`px-2.5 py-1 rounded border flex items-center gap-1.5 transition ${
                isDark ? 'bg-[#181a20] border-[#272a34] text-slate-300 hover:text-white' : 'bg-white border-slate-200 text-slate-700'
              }`}
            >
              <FileJson className="w-3 h-3" />
              <span>threats.json</span>
              <ExternalLink className="w-3 h-3 text-slate-500" />
            </a>

            <a
              href="/data/editorial-verdict.json"
              target="_blank"
              rel="noopener noreferrer"
              className={`px-2.5 py-1 rounded border flex items-center gap-1.5 transition ${
                isDark ? 'bg-[#181a20] border-[#272a34] text-slate-300 hover:text-white' : 'bg-white border-slate-200 text-slate-700'
              }`}
            >
              <span>verdict.json</span>
              <ExternalLink className="w-3 h-3 text-slate-500" />
            </a>
          </div>
        </div>

        {/* Minimal Endpoint Switcher Tabs */}
        <div className="flex items-center gap-2 border-b border-[#232733] pb-3 text-xs font-mono">
          {ENDPOINTS.map((ep) => (
            <button
              key={ep.id}
              onClick={() => setSelectedEndpoint(ep.id)}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                selectedEndpoint === ep.id
                  ? isDark
                    ? 'bg-[#232733] text-white font-semibold'
                    : 'bg-slate-200 text-slate-900 font-semibold'
                  : isDark
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {ep.name}
            </button>
          ))}
        </div>

        {/* Request Bar */}
        <div className={`border rounded-lg p-3.5 space-y-3 ${
          isDark ? 'bg-[#12141a] border-[#232733]' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold shrink-0">
              GET
            </span>
            <div className={`flex-1 px-3 py-1.5 rounded border truncate text-xs ${
              isDark ? 'bg-[#0b0c10] border-[#1e222c] text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}>
              {endpointUrl}
            </div>
            <button
              onClick={handleCopyUrl}
              className={`px-2.5 py-1.5 rounded border font-mono text-xs flex items-center gap-1.5 transition shrink-0 ${
                isDark
                  ? 'bg-[#1e222c] hover:bg-[#282d3b] border-[#2e3444] text-slate-200'
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
              }`}
            >
              {copiedUrl ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedUrl ? 'Copied' : 'Copy URL'}</span>
            </button>
          </div>

          <p className="text-xs text-slate-400">
            {ENDPOINTS.find((e) => e.id === selectedEndpoint)?.description}
          </p>
        </div>

        {/* Code Snippets */}
        <div className={`border rounded-lg p-3.5 space-y-2 text-xs font-mono ${
          isDark ? 'bg-[#12141a] border-[#232733]' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-slate-400">
              <Code2 className="w-3.5 h-3.5" />
              <span>Example Request</span>
            </div>

            <div className="flex items-center gap-1">
              {(['curl', 'js', 'python'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveCodeTab(tab)}
                  className={`px-2 py-0.5 rounded text-[11px] transition ${
                    activeCodeTab === tab
                      ? isDark
                        ? 'bg-[#232733] text-white'
                        : 'bg-slate-200 text-slate-900'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {tab === 'curl' ? 'cURL' : tab === 'js' ? 'JavaScript' : 'Python'}
                </button>
              ))}
            </div>
          </div>

          <div className="relative rounded bg-[#0b0c10] border border-[#1e222c] p-3 text-slate-300 overflow-x-auto">
            <button
              onClick={handleCopyCode}
              className="absolute top-2 right-2 px-2 py-0.5 rounded bg-[#1e222c] hover:bg-[#282d3b] text-[11px] text-slate-300 flex items-center gap-1 transition"
            >
              {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedCode ? 'Copied' : 'Copy'}</span>
            </button>
            <pre className="pt-2 text-xs">
              <code>{codeSnippets[activeCodeTab]}</code>
            </pre>
          </div>
        </div>

        {/* Response Preview */}
        <div className={`border rounded-lg p-3.5 space-y-2 text-xs font-mono ${
          isDark ? 'bg-[#12141a] border-[#232733]' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3 text-slate-400">
              <span className="font-semibold text-slate-300">Response Preview</span>
              <span className="text-emerald-400 font-semibold">200 OK</span>
              <span>~12ms</span>
            </div>

            <div className="flex items-center gap-2">
              {/* Epoch / ISO Timestamp Option */}
              <div className="flex items-center gap-1 border border-[#272a34] rounded px-1 py-0.5 text-[11px]">
                <span className="text-slate-500 mr-0.5">Time:</span>
                <button
                  onClick={() => setTimeFormat('iso')}
                  className={`px-1.5 py-0.2 rounded transition ${
                    timeFormat === 'iso'
                      ? isDark ? 'bg-[#232733] text-white font-semibold' : 'bg-slate-200 text-slate-900 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  ISO 8601
                </button>
                <button
                  onClick={() => setTimeFormat('epoch')}
                  className={`px-1.5 py-0.2 rounded transition ${
                    timeFormat === 'epoch'
                      ? isDark ? 'bg-[#232733] text-white font-semibold' : 'bg-slate-200 text-slate-900 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Unix Epoch
                </button>
              </div>

              <button
                onClick={handleCopy}
                className="px-2 py-0.5 rounded bg-[#1e222c] hover:bg-[#282d3b] text-[11px] text-slate-300 flex items-center gap-1 transition"
              >
                {copiedResponse ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedResponse ? 'Copied' : 'Copy'}</span>
              </button>

              <button
                onClick={handleDownload}
                className="px-2 py-0.5 rounded bg-[#1e222c] hover:bg-[#282d3b] text-[11px] text-slate-300 flex items-center gap-1 transition"
              >
                <Download className="w-3 h-3" />
                <span>Download</span>
              </button>
            </div>
          </div>

          <div className="rounded bg-[#0b0c10] border border-[#1e222c] p-3 max-h-64 overflow-y-auto scrollbar-thin text-emerald-400">
            <pre className="text-xs">
              {formattedResponseData
                ? JSON.stringify(formattedResponseData, null, 2)
                : '// Loading preview...'}
            </pre>
          </div>
        </div>
      </main>

      <Footer isDark={isDark} />
    </div>
  );
}

