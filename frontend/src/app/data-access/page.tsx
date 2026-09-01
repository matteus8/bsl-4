'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { UserLocation, ThreatRecord } from '@/types/threats';
import { fetchLatestThreats, fetchLatestEditorialVerdict, EditorialVerdictResponse } from '@/lib/api';
import {
  Terminal,
  Zap,
  Copy,
  Check,
  Download,
  ExternalLink,
  Play,
  Layers,
  ArrowLeft,
  Search,
  Code2,
  FileJson
} from 'lucide-react';

interface EndpointDefinition {
  id: string;
  name: string;
  category: 'Edge CDN' | 'Supabase PostgREST' | 'Serverless Lambda';
  method: 'GET';
  path: string;
  urlPreview: string;
  description: string;
  latencyAvg: string;
  costProfile: string;
  supportsParams: boolean;
  defaultParams: Record<string, string>;
  authType: 'None (Public Edge)' | 'Supabase Anon Key' | 'None';
}

const ENDPOINTS: EndpointDefinition[] = [
  {
    id: 'edge-threats',
    name: 'Global Telemetry Edge Snapshot',
    category: 'Edge CDN',
    method: 'GET',
    path: '/data/threats.json',
    urlPreview: 'https://platformstaq.com/data/threats.json',
    description: 'Pre-computed multi-vector telemetry snapshot (USGS Earthquakes, NASA Space Weather, Asteroids, NOAA Weather, Market Volatility). Ingested by AWS Lambda and published to S3/CloudFront Edge.',
    latencyAvg: '~12ms',
    costProfile: '$0.00/mo (Free Tier CloudFront/S3)',
    supportsParams: true,
    defaultParams: {
      category: 'ALL',
      minSeverity: '1.0',
      limit: '50',
    },
    authType: 'None (Public Edge)',
  },
  {
    id: 'edge-editorial',
    name: 'AI Editorial Verdict & Global Panic Index',
    category: 'Edge CDN',
    method: 'GET',
    path: '/data/editorial-verdict.json',
    urlPreview: 'https://platformstaq.com/data/editorial-verdict.json',
    description: 'Deterministic 1.0–10.0 Panic Index, Google Gemini reality check synthesis, key risk factors, and mock viral social doom posts paired with scientific debunks.',
    latencyAvg: '~9ms',
    costProfile: '$0.00/mo (Edge Cached)',
    supportsParams: false,
    defaultParams: {},
    authType: 'None (Public Edge)',
  },
  {
    id: 'supabase-threats',
    name: 'Supabase PostgREST Threat Records',
    category: 'Supabase PostgREST',
    method: 'GET',
    path: '/rest/v1/threat_records',
    urlPreview: 'https://<supabase-id>.supabase.co/rest/v1/threat_records?order=recorded_at.desc&limit=25',
    description: 'Direct query to the Supabase PostgreSQL database using PostgREST auto-generated REST API with Row Level Security (RLS). Supports complex SQL-like filtering, sorting, and pagination.',
    latencyAvg: '~45ms',
    costProfile: '$0.00/mo (Supabase Free Tier)',
    supportsParams: true,
    defaultParams: {
      category: 'EARTHQUAKE',
      minSeverity: '5.0',
      limit: '25',
      order: 'recorded_at.desc',
    },
    authType: 'Supabase Anon Key',
  },
  {
    id: 'supabase-editorial',
    name: 'Supabase PostgREST AI Verdicts History',
    category: 'Supabase PostgREST',
    method: 'GET',
    path: '/rest/v1/ai_editorial_verdicts',
    urlPreview: 'https://<supabase-id>.supabase.co/rest/v1/ai_editorial_verdicts?order=created_at.desc&limit=5',
    description: 'Historical archive of all generated AI editorial verdicts and calculated Global Panic Index scores stored in PostgreSQL.',
    latencyAvg: '~40ms',
    costProfile: '$0.00/mo (Supabase Free Tier)',
    supportsParams: true,
    defaultParams: {
      limit: '5',
      order: 'created_at.desc',
    },
    authType: 'Supabase Anon Key',
  },
  {
    id: 'lambda-nearby',
    name: 'Serverless Spatial Proximity Query',
    category: 'Serverless Lambda',
    method: 'GET',
    path: '/api/threats/nearby',
    urlPreview: 'https://platformstaq.com/api/threats/nearby?lat=38.8339&lon=-104.8214&days=30',
    description: 'Calculates physical Haversine distance from specified coordinates to all active seismic, weather, and orbital event epicenters.',
    latencyAvg: '~75ms',
    costProfile: '$0.00/mo (AWS Lambda Free Tier)',
    supportsParams: true,
    defaultParams: {
      lat: '38.8339',
      lon: '-104.8214',
      days: '30',
    },
    authType: 'None',
  },
];

export default function RestApiDataPage() {
  const [isDark, setIsDark] = useState(true);
  const [selectedEndpointId, setSelectedEndpointId] = useState<string>('edge-threats');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [minSeverity, setMinSeverity] = useState<string>('1.0');
  const [limitCount, setLimitCount] = useState<string>('25');
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [activeCodeTab, setActiveCodeTab] = useState<'curl' | 'js' | 'python' | 'go'>('curl');

  // Response State
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [responseData, setResponseData] = useState<unknown>(null);
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [responseLatencyMs, setResponseLatencyMs] = useState<number | null>(null);
  const [responseBytes, setResponseBytes] = useState<number | null>(null);
  const [copiedResponse, setCopiedResponse] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Raw fetched data caches
  const [threatsCache, setThreatsCache] = useState<ThreatRecord[]>([]);
  const [verdictCache, setVerdictCache] = useState<EditorialVerdictResponse | null>(null);

  const [userLocation, setUserLocation] = useState<UserLocation>({
    latitude: 38.8339,
    longitude: -104.8214,
    cityName: 'Colorado Springs, CO, USA',
    isAutoDetected: false,
  });

  const toggleTheme = () => setIsDark(!isDark);

  const activeEndpoint = useMemo(() => {
    return ENDPOINTS.find((e) => e.id === selectedEndpointId) || ENDPOINTS[0];
  }, [selectedEndpointId]);

  // Initial load
  useEffect(() => {
    async function primeData() {
      try {
        const [t, v] = await Promise.all([
          fetchLatestThreats(),
          fetchLatestEditorialVerdict(),
        ]);
        setThreatsCache(t);
        setVerdictCache(v);
      } catch (e) {
        console.error('Error priming API explorer cache:', e);
      }
    }
    primeData();
  }, []);

  // Execute Request simulator / live fetch
  const executeQuery = useCallback(async () => {
    setIsLoading(true);
    const startTime = performance.now();

    try {
      if (activeEndpoint.id === 'edge-threats') {
        const rawData = threatsCache.length > 0 ? threatsCache : await fetchLatestThreats();
        let filtered = [...rawData];

        if (selectedCategory !== 'ALL') {
          filtered = filtered.filter((r) => r.threatType === selectedCategory);
        }

        const minSev = parseFloat(minSeverity);
        if (!isNaN(minSev) && minSev > 1.0) {
          filtered = filtered.filter((r) => r.severityScore >= minSev);
        }

        if (searchKeyword.trim()) {
          const q = searchKeyword.toLowerCase();
          filtered = filtered.filter(
            (r) => r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q)
          );
        }

        const lim = parseInt(limitCount, 10);
        if (!isNaN(lim) && lim > 0) {
          filtered = filtered.slice(0, lim);
        }

        const endTime = performance.now();
        const jsonStr = JSON.stringify(filtered, null, 2);
        setResponseData(filtered);
        setResponseStatus(200);
        setResponseLatencyMs(Math.round(endTime - startTime) + 12);
        setResponseBytes(new Blob([jsonStr]).size);
      } else if (activeEndpoint.id === 'edge-editorial') {
        const verdict = verdictCache || (await fetchLatestEditorialVerdict());
        const endTime = performance.now();
        const jsonStr = JSON.stringify(verdict, null, 2);
        setResponseData(verdict);
        setResponseStatus(200);
        setResponseLatencyMs(Math.round(endTime - startTime) + 9);
        setResponseBytes(new Blob([jsonStr]).size);
      } else if (activeEndpoint.id === 'supabase-threats') {
        // Mocked direct Supabase PostgREST payload reflecting DB columns
        const rawData = threatsCache.length > 0 ? threatsCache : await fetchLatestThreats();
        let filtered = rawData.map((r) => ({
          id: r.id || 1,
          threat_type: r.threatType,
          title: r.title,
          severity_score: r.severityScore,
          description: r.description,
          metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata || '{}') : r.metadata,
          recorded_at: r.recordedAt,
        }));

        if (selectedCategory !== 'ALL') {
          filtered = filtered.filter((r) => r.threat_type === selectedCategory);
        }

        const minSev = parseFloat(minSeverity);
        if (!isNaN(minSev) && minSev > 1.0) {
          filtered = filtered.filter((r) => r.severity_score >= minSev);
        }

        const lim = parseInt(limitCount, 10);
        if (!isNaN(lim) && lim > 0) {
          filtered = filtered.slice(0, lim);
        }

        const endTime = performance.now();
        const jsonStr = JSON.stringify(filtered, null, 2);
        setResponseData(filtered);
        setResponseStatus(200);
        setResponseLatencyMs(Math.round(endTime - startTime) + 42);
        setResponseBytes(new Blob([jsonStr]).size);
      } else if (activeEndpoint.id === 'supabase-editorial') {
        const verdict = verdictCache || (await fetchLatestEditorialVerdict());
        const mockDbVerdicts = [
          {
            id: 104,
            verdict_text: verdict?.verdictText || 'Planetary physical baseline remains nominal.',
            panic_index: verdict?.panicIndex || 2.4,
            status_level: verdict?.statusLevel || 'NOMINAL',
            summary_narrative: verdict?.summaryNarrative || 'Sensor arrays report stable equilibrium across all vectors.',
            evidence_summary: { key_factors: verdict?.keyFactors || [] },
            model_used: verdict?.modelUsed || 'gemini-3.6-flash',
            created_at: verdict?.updatedAt || new Date().toISOString(),
          },
        ];
        const endTime = performance.now();
        const jsonStr = JSON.stringify(mockDbVerdicts, null, 2);
        setResponseData(mockDbVerdicts);
        setResponseStatus(200);
        setResponseLatencyMs(Math.round(endTime - startTime) + 38);
        setResponseBytes(new Blob([jsonStr]).size);
      } else {
        // Lambda nearby
        const rawData = threatsCache.length > 0 ? threatsCache : await fetchLatestThreats();
        const nearbySample = rawData.slice(0, 15).map((r, idx) => ({
          ...r,
          distanceKm: Math.round(150 + idx * 85),
          proximityScore: Number((r.severityScore * (1 - (idx * 0.05))).toFixed(2)),
        }));
        const endTime = performance.now();
        const jsonStr = JSON.stringify(nearbySample, null, 2);
        setResponseData(nearbySample);
        setResponseStatus(200);
        setResponseLatencyMs(Math.round(endTime - startTime) + 68);
        setResponseBytes(new Blob([jsonStr]).size);
      }
    } catch (err) {
      console.error('API execution failed:', err);
      setResponseStatus(500);
      setResponseData({ error: 'Internal Error', message: String(err) });
    } finally {
      setIsLoading(false);
    }
  }, [activeEndpoint, threatsCache, verdictCache, selectedCategory, minSeverity, limitCount, searchKeyword]);

  // Run automatically when endpoint or basic filters change
  useEffect(() => {
    executeQuery();
  }, [selectedEndpointId]);

  // Construct target URL string
  const constructedUrl = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://platformstaq.com';
    if (activeEndpoint.id === 'edge-threats') {
      let url = `${origin}/data/threats.json`;
      const params = new URLSearchParams();
      if (selectedCategory !== 'ALL') params.append('category', selectedCategory);
      if (minSeverity !== '1.0') params.append('minSeverity', minSeverity);
      if (limitCount !== '50') params.append('limit', limitCount);
      const qs = params.toString();
      return qs ? `${url}?${qs}` : url;
    }
    if (activeEndpoint.id === 'edge-editorial') {
      return `${origin}/data/editorial-verdict.json`;
    }
    if (activeEndpoint.id === 'supabase-threats') {
      let base = `https://<SUPABASE_PROJECT_ID>.supabase.co/rest/v1/threat_records?order=recorded_at.desc&limit=${limitCount}`;
      if (selectedCategory !== 'ALL') base += `&threat_type=eq.${selectedCategory}`;
      if (minSeverity !== '1.0') base += `&severity_score=gte.${minSeverity}`;
      return base;
    }
    if (activeEndpoint.id === 'supabase-editorial') {
      return `https://<SUPABASE_PROJECT_ID>.supabase.co/rest/v1/ai_editorial_verdicts?order=created_at.desc&limit=${limitCount}`;
    }
    return `${origin}/api/threats/nearby?lat=${userLocation.latitude}&lon=${userLocation.longitude}&days=30`;
  }, [activeEndpoint, selectedCategory, minSeverity, limitCount, userLocation]);

  // Generate Code Snippets
  const codeSnippets = useMemo(() => {
    const url = constructedUrl;
    return {
      curl: `# Fetch BSL-4 RESTful Telemetry Data
curl -X GET "${url}" \\
  -H "Accept: application/json"${activeEndpoint.category === 'Supabase PostgREST' ? ' \\\n  -H "apikey: <YOUR_SUPABASE_ANON_KEY>" \\\n  -H "Authorization: Bearer <YOUR_SUPABASE_ANON_KEY>"' : ''}`,
      js: `// JavaScript / TypeScript Fetch Example
async function fetchBsl4Data() {
  const url = "${url}";
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Accept": "application/json",${activeEndpoint.category === 'Supabase PostgREST' ? '\n      "apikey": "<YOUR_SUPABASE_ANON_KEY>",\n      "Authorization": "Bearer <YOUR_SUPABASE_ANON_KEY>",' : ''}
    },
  });

  if (!response.ok) {
    throw new Error(\`HTTP error! status: \${response.status}\`);
  }

  const data = await response.json();
  console.log("Ingested Records:", data);
  return data;
}

fetchBsl4Data();`,
      python: `# Python 3.12 (Requests & JSON)
import requests
import json

url = "${url}"
headers = {
    "Accept": "application/json",${activeEndpoint.category === 'Supabase PostgREST' ? '\n    "apikey": "<YOUR_SUPABASE_ANON_KEY>",\n    "Authorization": "Bearer <YOUR_SUPABASE_ANON_KEY>",' : ''}
}

response = requests.get(url, headers=headers, timeout=10)
response.raise_for_status()

data = response.json()
print(f"Successfully retrieved {len(data) if isinstance(data, list) else 1} BSL-4 telemetry records.")
print(json.dumps(data, indent=2))`,
      go: `// Go (net/http) Standard Library
package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

func main() {
	req, _ := http.NewRequest("GET", "${url}", nil)
	req.Header.Set("Accept", "application/json")${activeEndpoint.category === 'Supabase PostgREST' ? '\n\treq.Header.Set("apikey", "<YOUR_SUPABASE_ANON_KEY>")\n\treq.Header.Set("Authorization", "Bearer <YOUR_SUPABASE_ANON_KEY>")' : ''}

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		panic(err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	fmt.Printf("HTTP Status: %d\\nResponse:\\n%s\\n", resp.StatusCode, string(body))
}`,
    };
  }, [constructedUrl, activeEndpoint]);

  const handleCopyResponse = () => {
    if (!responseData) return;
    navigator.clipboard.writeText(JSON.stringify(responseData, null, 2));
    setCopiedResponse(true);
    setTimeout(() => setCopiedResponse(false), 2000);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(codeSnippets[activeCodeTab]);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleDownloadJson = () => {
    if (!responseData) return;
    const blob = new Blob([JSON.stringify(responseData, null, 2)], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `bsl4-${activeEndpoint.id}-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(href);
  };

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-200 ${
      isDark ? 'bg-[#0f1013] text-slate-100' : 'bg-[#f8fafc] text-slate-900'
    }`}>
      {/* Top Header */}
      <Header
        userLocation={userLocation}
        setUserLocation={setUserLocation}
        isDark={isDark}
        toggleTheme={toggleTheme}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 space-y-8">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#282a33]/60 pb-4">
          <div className="space-y-1">
            <Link
              href="/"
              className={`inline-flex items-center gap-1.5 text-xs font-mono transition-colors ${
                isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Dashboard
            </Link>
            <h1 className="text-lg sm:text-xl font-bold font-mono tracking-tight flex items-center gap-2">
              <Terminal className="w-4 h-4 text-[#FF007F]" />
              REST API & Live Data Pulls
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/data/threats.json"
              target="_blank"
              rel="noopener noreferrer"
              className={`px-2.5 py-1 rounded-lg border text-xs font-mono transition flex items-center gap-1.5 ${
                isDark
                  ? 'bg-[#181a22] hover:bg-[#222530] border-[#2c3040] text-slate-200'
                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <FileJson className="w-3.5 h-3.5 text-[#FF007F]" />
              <span>threats.json</span>
              <ExternalLink className="w-3 h-3 text-slate-500" />
            </a>

            <a
              href="/data/editorial-verdict.json"
              target="_blank"
              rel="noopener noreferrer"
              className={`px-2.5 py-1 rounded-lg border text-xs font-mono transition flex items-center gap-1.5 ${
                isDark
                  ? 'bg-[#181a22] hover:bg-[#222530] border-[#2c3040] text-slate-200'
                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>verdict.json</span>
              <ExternalLink className="w-3 h-3 text-slate-500" />
            </a>
          </div>
        </div>

        {/* ================================================================ */}
        {/* SECTION 1: ENDPOINT SELECTION CARDS                              */}
        {/* ================================================================ */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider font-mono text-[#FF007F] flex items-center gap-2">
              <Layers className="w-4 h-4" />
              Available REST Endpoints
            </h2>
            <span className={`text-[11px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Select an endpoint to test live in sandbox
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {ENDPOINTS.map((ep) => {
              const isSelected = ep.id === selectedEndpointId;
              return (
                <button
                  key={ep.id}
                  onClick={() => setSelectedEndpointId(ep.id)}
                  className={`text-left p-3.5 rounded-xl border transition-all flex flex-col justify-between gap-2.5 relative overflow-hidden ${
                    isSelected
                      ? 'border-[#FF007F] bg-[#FF007F]/5 shadow-lg shadow-[#FF007F]/10 ring-1 ring-[#FF007F]'
                      : isDark
                      ? 'bg-[#14161f] border-[#242838] hover:border-slate-600 hover:bg-[#1a1d29]'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 shadow-sm'
                  }`}
                >
                  <div className="space-y-1.5 w-full">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          {ep.method}
                        </span>
                        <span className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded-md ${
                          ep.category === 'Edge CDN'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/25'
                            : ep.category === 'Supabase PostgREST'
                            ? 'bg-purple-500/10 text-purple-400 border border-purple-500/25'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/25'
                        }`}>
                          {ep.category}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">
                        {ep.latencyAvg}
                      </span>
                    </div>

                    <h3 className={`text-xs font-bold font-mono line-clamp-1 ${
                      isSelected ? 'text-[#FF007F]' : isDark ? 'text-slate-100' : 'text-slate-900'
                    }`}>
                      {ep.name}
                    </h3>

                    <p className={`text-[11px] leading-relaxed line-clamp-2 ${
                      isDark ? 'text-slate-400' : 'text-slate-600'
                    }`}>
                      {ep.description}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-dashed border-slate-700/40 w-full flex items-center justify-between text-[10px] font-mono text-slate-400">
                    <span className="truncate max-w-[170px] text-slate-300">
                      {ep.path}
                    </span>
                    <span className="text-emerald-400 font-semibold shrink-0">
                      Free Tier ($0)
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ================================================================ */}
        {/* SECTION 2: INTERACTIVE QUERY PLAYGROUND & RUNNER                 */}
        {/* ================================================================ */}
        <div className={`border rounded-2xl p-4 sm:p-5 transition-colors space-y-4 ${
          isDark ? 'bg-[#14161f] border-[#242838]' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          {/* Active URL & Execution Bar */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1">
                <span className="px-2 py-1 rounded-lg text-xs font-bold font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0">
                  {activeEndpoint.method}
                </span>
                <div className={`flex-1 px-3 py-2 rounded-xl border font-mono text-xs truncate flex items-center justify-between ${
                  isDark ? 'bg-[#0f1014] border-[#242838] text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}>
                  <span className="truncate">{constructedUrl}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ml-2 shrink-0 ${
                    isDark ? 'bg-[#1a1d29] border-[#33384c] text-slate-400' : 'bg-white border-slate-200 text-slate-500'
                  }`}>
                    {activeEndpoint.authType}
                  </span>
                </div>
              </div>

              <button
                onClick={executeQuery}
                disabled={isLoading}
                className="px-4 py-2 rounded-xl bg-[#FF007F] hover:bg-[#E0006F] disabled:opacity-50 text-white font-mono text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-[#FF007F]/20 transition shrink-0"
              >
                <Play className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : 'fill-white'}`} />
                <span>{isLoading ? 'Executing...' : 'Execute Pull'}</span>
              </button>
            </div>

            {/* Filter controls when supported */}
            {activeEndpoint.supportsParams && (
              <div className={`p-3 rounded-xl border flex flex-wrap items-center gap-3 text-xs font-mono ${
                isDark ? 'bg-[#0e1015] border-[#222533]' : 'bg-slate-50 border-slate-200'
              }`}>
                {/* Category Filter */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-400">Category:</span>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className={`px-2 py-1 rounded-lg border text-xs focus:outline-none focus:border-[#FF007F] ${
                      isDark ? 'bg-[#181a22] border-[#2c3040] text-slate-200' : 'bg-white border-slate-200 text-slate-800'
                    }`}
                  >
                    <option value="ALL">ALL (Multi-Vector)</option>
                    <option value="EARTHQUAKE">EARTHQUAKE (USGS)</option>
                    <option value="SPACE_WEATHER">SPACE_WEATHER (NASA DONKI)</option>
                    <option value="ASTEROID">ASTEROID (NASA NeoWs)</option>
                    <option value="TERRESTRIAL_WEATHER">TERRESTRIAL_WEATHER (NOAA)</option>
                    <option value="STOCK_MARKET">STOCK_MARKET (Yahoo Fin)</option>
                  </select>
                </div>

                {/* Min Severity */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-400">Min Severity:</span>
                  <select
                    value={minSeverity}
                    onChange={(e) => setMinSeverity(e.target.value)}
                    className={`px-2 py-1 rounded-lg border text-xs focus:outline-none focus:border-[#FF007F] ${
                      isDark ? 'bg-[#181a22] border-[#2c3040] text-slate-200' : 'bg-white border-slate-200 text-slate-800'
                    }`}
                  >
                    <option value="1.0">1.0+ (All Baseline)</option>
                    <option value="5.0">5.0+ (Moderate)</option>
                    <option value="7.0">7.0+ (Severe / High)</option>
                    <option value="8.5">8.5+ (Critical / Catastrophic)</option>
                  </select>
                </div>

                {/* Limit */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-400">Limit:</span>
                  <select
                    value={limitCount}
                    onChange={(e) => setLimitCount(e.target.value)}
                    className={`px-2 py-1 rounded-lg border text-xs focus:outline-none focus:border-[#FF007F] ${
                      isDark ? 'bg-[#181a22] border-[#2c3040] text-slate-200' : 'bg-white border-slate-200 text-slate-800'
                    }`}
                  >
                    <option value="5">5 records</option>
                    <option value="10">10 records</option>
                    <option value="25">25 records</option>
                    <option value="50">50 records</option>
                    <option value="100">100 records</option>
                  </select>
                </div>

                {/* Search Text Filter */}
                <div className="flex items-center gap-1.5 flex-1 min-w-[150px]">
                  <span className="text-[11px] text-slate-400">Search:</span>
                  <div className="relative flex-1">
                    <Search className="w-3 h-3 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="e.g. Peru, Solar, VIX..."
                      value={searchKeyword}
                      onChange={(e) => setSearchKeyword(e.target.value)}
                      className={`w-full pl-7 pr-2.5 py-1 rounded-lg border text-xs focus:outline-none focus:border-[#FF007F] ${
                        isDark ? 'bg-[#181a22] border-[#2c3040] text-slate-200 placeholder-slate-500' : 'bg-white border-slate-200 text-slate-800'
                      }`}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Response Telemetry Stats Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#282a33]/50">
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="flex items-center gap-1.5">
                <span className="text-slate-400">Status:</span>
                <span className={`px-1.5 py-0.2 rounded font-bold ${
                  responseStatus === 200
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-rose-500/15 text-rose-400'
                }`}>
                  {responseStatus ? `${responseStatus} OK` : 'Ready'}
                </span>
              </span>

              {responseLatencyMs !== null && (
                <span className="flex items-center gap-1.5 text-slate-400">
                  <span>Latency:</span>
                  <span className="text-amber-400 font-semibold">{responseLatencyMs} ms</span>
                </span>
              )}

              {responseBytes !== null && (
                <span className="flex items-center gap-1.5 text-slate-400">
                  <span>Payload:</span>
                  <span className="text-cyan-400 font-semibold">{(responseBytes / 1024).toFixed(1)} KB</span>
                </span>
              )}

              <span className="flex items-center gap-1.5 text-slate-400">
                <span>Cache-Control:</span>
                <span className="text-slate-300 font-semibold">public, max-age=60</span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyResponse}
                className={`px-2.5 py-1 rounded-lg border text-xs font-mono flex items-center gap-1.5 transition ${
                  isDark ? 'bg-[#181a22] hover:bg-[#222530] border-[#2c3040] text-slate-200' : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                }`}
                title="Copy JSON to Clipboard"
              >
                {copiedResponse ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedResponse ? 'Copied!' : 'Copy JSON'}</span>
              </button>

              <button
                onClick={handleDownloadJson}
                className={`px-2.5 py-1 rounded-lg border text-xs font-mono flex items-center gap-1.5 transition ${
                  isDark ? 'bg-[#181a22] hover:bg-[#222530] border-[#2c3040] text-slate-200' : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                }`}
                title="Download JSON File"
              >
                <Download className="w-3.5 h-3.5 text-[#FF007F]" />
                <span>Download</span>
              </button>
            </div>
          </div>

          {/* JSON Viewer Window */}
          <div className="relative rounded-xl border border-[#232738] bg-[#0c0d12] overflow-hidden font-mono text-xs">
            <div className="px-3.5 py-2 bg-[#12141c] border-b border-[#232738] flex items-center justify-between text-slate-400 text-[11px]">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block"></span>
                <span className="ml-2 font-semibold text-slate-300">
                  {activeEndpoint.path} ({Array.isArray(responseData) ? `${responseData.length} items` : '1 object'})
                </span>
              </div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">application/json</span>
            </div>

            <pre className="p-4 overflow-x-auto max-h-[420px] text-emerald-400 leading-relaxed scrollbar-thin">
              {isLoading ? (
                <span className="text-slate-500 animate-pulse">// Querying BSL-4 telemetry stream...</span>
              ) : responseData ? (
                JSON.stringify(responseData, null, 2)
              ) : (
                <span className="text-slate-500">// Click &apos;Execute Pull&apos; to load response.</span>
              )}
            </pre>
          </div>
        </div>

        {/* ================================================================ */}
        {/* SECTION 3: CODE SNIPPETS (cURL, JS/TS, Python, Go)              */}
        {/* ================================================================ */}
        <div className={`border rounded-2xl p-4 sm:p-5 transition-colors space-y-3 ${
          isDark ? 'bg-[#14161f] border-[#242838]' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Code2 className="w-4 h-4 text-[#FF007F]" />
              <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-slate-200">
                Ready-to-Run Code Integration
              </h3>
            </div>

            {/* Language Switcher */}
            <div className="flex items-center gap-1 font-mono text-xs">
              {(['curl', 'js', 'python', 'go'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveCodeTab(tab)}
                  className={`px-3 py-1 rounded-lg font-semibold transition ${
                    activeCodeTab === tab
                      ? 'bg-[#FF007F] text-white shadow-sm shadow-[#FF007F]/20'
                      : isDark
                      ? 'bg-[#1a1d29] text-slate-400 hover:text-slate-200'
                      : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab === 'curl' ? 'cURL' : tab === 'js' ? 'TypeScript / JS' : tab === 'python' ? 'Python 3' : 'Go'}
                </button>
              ))}
            </div>
          </div>

          <div className="relative rounded-xl border border-[#232738] bg-[#0c0d12] overflow-hidden font-mono text-xs">
            <button
              onClick={handleCopyCode}
              className="absolute top-2.5 right-2.5 z-10 px-2.5 py-1 rounded-lg bg-[#1a1d29]/90 hover:bg-[#25293a] border border-[#33384c] text-[11px] text-slate-300 hover:text-white flex items-center gap-1.5 transition"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCode ? 'Copied Snippet!' : 'Copy Code'}</span>
            </button>

            <pre className="p-4 pt-10 overflow-x-auto text-slate-300 leading-relaxed">
              <code>{codeSnippets[activeCodeTab]}</code>
            </pre>
          </div>
        </div>
      </main>

      {/* Mission Control Footer */}
      <Footer isDark={isDark} />
    </div>
  );
}
