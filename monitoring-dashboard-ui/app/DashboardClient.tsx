'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
} from 'recharts';

// --- Types ---
type AnalyticsData = {
    causeId: number;
    causeName: string;
    totalDowntimeSeconds: number;
};

type DailyStopsRow = {
    day: string;
    totalWorkSeconds: number;
    totalDowntimeSeconds: number;
    stopsCount: number;
    trsDowntimeSeconds?: number;
};

type CauseOption = {
    id: number;
    name: string;
};

// --- Helpers ---
function calculateAvailableTime(day: string, equipe?: string): number {
    const SHIFT_HOURS = 8;
    const refSeconds = SHIFT_HOURS * 3600;
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    if (day < todayStr) return refSeconds;
    if (day > todayStr) return 0;
    let startHour = 0;
    if (equipe === '1') startHour = 6;
    else if (equipe === '2') startHour = 14;
    else if (equipe === '3') startHour = 22;
    const startTime = new Date(`${day}T00:00:00`);
    startTime.setHours(startHour, 0, 0, 0);
    let diff = (now.getTime() - startTime.getTime()) / 1000;
    if (diff < 0) return 0;
    if (diff > refSeconds) return refSeconds;
    return diff;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function apiFetch<T>(path: string): Promise<T> {
    const res = await fetch(`${API_URL}${path}`, {
        headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`${res.status} ${res.statusText} - ${text}`);
    }
    return (await res.json()) as T;
}

function pad2(n: number) { return String(n).padStart(2, '0'); }
function formatHMS(totalSeconds: number) {
    const sec = Math.max(0, Math.floor(totalSeconds));
    return `${pad2(Math.floor(sec / 3600))}:${pad2(Math.floor((sec % 3600) / 60))}:${pad2(sec % 60)}`;
}
function formatDuration(seconds: number) {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60), s = seconds % 60;
    if (m < 60) return `${m}m ${s}s`;
    return `${Math.floor(m / 60)}h ${m % 60}m ${s}s`;
}
function formatDayFR(day: string) {
    if (!day) return '';
    const [y, m, d] = day.split('T')[0].split('-');
    return `${d}/${m}/${y}`;
}

function getColorForCause(causeName?: string): string {
    if (!causeName) return '#94a3b8';
    const n = causeName.toLowerCase().trim();
    if (n.includes('panne')) return '#ef4444';
    if (n.includes('pause')) return '#10b981';
    if (n.includes('manque')) return '#8b5cf6';
    if (n.includes('changement')) return '#f59e0b';
    if (n.includes('chute')) return '#3b82f6';
    let hash = 0;
    for (let i = 0; i < causeName.length; i++) hash = causeName.charCodeAt(i) + ((hash << 5) - hash);
    const c = (hash & 0x00ffffff).toString(16).toUpperCase();
    return '#' + '00000'.substring(0, 6 - c.length) + c;
}

// --- KPI Card ---
function KpiCard({
    label,
    value,
    sub,
    color,
    icon,
}: {
    label: string;
    value: string;
    sub?: string;
    color: string;
    icon: React.ReactNode;
}) {
    return (
        <div className={`relative bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-5 shadow-xl overflow-hidden group hover:border-slate-600/70 transition-all duration-300`}>
            <div className={`absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-10 blur-xl ${color}`} />
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1">{label}</p>
                    <p className="text-2xl font-bold text-white leading-tight">{value}</p>
                    {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
                </div>
                <div className={`p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/50 text-slate-300 group-hover:scale-110 transition-transform duration-300`}>
                    {icon}
                </div>
            </div>
        </div>
    );
}

// --- SVG Icons ---
const Icons = {
    Clock: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
        </svg>
    ),
    Stop: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        </svg>
    ),
    Trs: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
    ),
    Calendar: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
        </svg>
    ),
    Refresh: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 4v6h-6" /><path d="M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
        </svg>
    ),
    Search: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
    ),
};

// ─────────────────────────────────────────────────────────────────────────────

export default function DashboardClient() {
    const today = new Date().toISOString().split('T')[0];

    const [filterMode, setFilterMode] = useState<'single' | 'period'>('single');
    const [fromDate, setFromDate] = useState(today);
    const [toDate, setToDate] = useState(today);
    const [equipe, setEquipe] = useState<'1' | '2' | '3'>('1');

    const [dailyRows, setDailyRows] = useState<DailyStopsRow[]>([]);
    const [analyticsData, setAnalyticsData] = useState<AnalyticsData[]>([]);
    const [loading, setLoading] = useState(false);

    const [causes, setCauses] = useState<CauseOption[]>([]);
    const [err, setErr] = useState<string | null>(null);

    // Load causes list once on mount
    useEffect(() => {
        apiFetch<{ items: CauseOption[] }>(`/api/causes`)
            .then(res => setCauses(res.items ?? []))
            .catch(() => setCauses([]));
    }, []);

    // Single combined fetch — fires both requests in parallel via Promise.all.
    // A 300 ms debounce prevents redundant requests while the user is still
    // typing into a date field (each keystroke would otherwise trigger a fetch).
    useEffect(() => {
        if (!fromDate || !toDate) return;

        const params = new URLSearchParams({ from: fromDate, to: toDate, equipe });
        const qs = params.toString();

        const timer = setTimeout(async () => {
            setLoading(true);
            setErr(null);
            try {
                const [daily, analytics] = await Promise.all([
                    apiFetch<DailyStopsRow[]>(`/api/stops/analytics/daily?${qs}`),
                    apiFetch<AnalyticsData[]>(`/api/stops/analytics/downtime?${qs}`),
                ]);
                setDailyRows(daily);
                setAnalyticsData(analytics);
            } catch (e: any) {
                setErr(e?.message ?? 'Erreur de chargement');
                setDailyRows([]);
                setAnalyticsData([]);
            } finally {
                setLoading(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [fromDate, toDate, equipe]);

    async function loadDaily() {
        if (!fromDate || !toDate) return;
        const params = new URLSearchParams({ from: fromDate, to: toDate, equipe });
        const qs = params.toString();
        setLoading(true);
        setErr(null);
        try {
            const [daily, analytics] = await Promise.all([
                apiFetch<DailyStopsRow[]>(`/api/stops/analytics/daily?${qs}`),
                apiFetch<AnalyticsData[]>(`/api/stops/analytics/downtime?${qs}`),
            ]);
            setDailyRows(daily);
            setAnalyticsData(analytics);
        } catch (e: any) {
            setErr(e?.message ?? 'Erreur de chargement');
        } finally {
            setLoading(false);
        }
    }

    // KPI aggregates over the visible period
    const { kpis, trendData } = useMemo(() => {
        if (dailyRows.length === 0) return { kpis: null, trendData: [] };
        let totalStops = 0, totalDowntime = 0, trsSum = 0, count = 0;
        
        const data = dailyRows.map(row => {
            totalStops += row.stopsCount;
            totalDowntime += row.totalDowntimeSeconds;
            
            const avail = calculateAvailableTime(row.day, equipe);
            const refSeconds = 8 * 3600;
            const downTRS = Number(row.trsDowntimeSeconds || 0);
            let trsVal = 0;
            if (avail > 0) { 
                trsVal = Math.max(0, ((avail - downTRS) / refSeconds) * 100);
                trsSum += trsVal; 
                count++; 
            }
            return {
                dayRaw: row.day,
                dayStr: formatDayFR(row.day),
                stops: row.stopsCount,
                downtimeMin: Math.round(row.totalDowntimeSeconds / 60),
                workMin: Math.round((row.totalWorkSeconds || 0) / 60),
                trs: Number(trsVal.toFixed(1))
            };
        });
        
        const sortedData = [...data].sort((a, b) => a.dayRaw.localeCompare(b.dayRaw));

        const avgTrs = count > 0 ? trsSum / count : 0;
        return { 
            kpis: { totalStops, totalDowntime, avgTrs, days: dailyRows.length },
            trendData: sortedData
        };
    }, [dailyRows, equipe]);

    // Chart series — only causes that actually have downtime (> 0) in the period.
    // Filtering out zero-downtime causes avoids rendering dozens of invisible bars
    // in Recharts, which re-layouts the SVG for every bar regardless of height.
    const chartSeries = useMemo(() => {
        const source = analyticsData.length > 0 ? analyticsData : [];
        if (causes.length > 0) {
            const map = new Map<number, number>();
            for (const a of source) map.set(a.causeId, a.totalDowntimeSeconds);
            const merged = causes
                .map(c => ({
                    causeId: c.id,
                    causeName: c.name,
                    totalDowntimeSeconds: map.get(c.id) ?? 0,
                }))
                .filter(d => d.totalDowntimeSeconds > 0);
            merged.sort((a, b) => b.totalDowntimeSeconds - a.totalDowntimeSeconds);
            return merged;
        }
        return source.filter(d => d.totalDowntimeSeconds > 0);
    }, [causes, analyticsData]);

    const maxDuration = useMemo(() =>
        chartSeries.length ? Math.max(...chartSeries.map(d => d.totalDowntimeSeconds)) : 0,
        [chartSeries]);
    const useSeconds = maxDuration < 60;

    const loadingDaily = loading;
    const loadingAnalytics = loading;
    const trsColor = (v: number) => v >= 85 ? 'text-emerald-400' : v >= 50 ? 'text-amber-400' : 'text-red-400';

    return (
        <div className="text-sm pb-12">

            {/* Page Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white tracking-tight">Vue d'ensemble</h1>
                <p className="text-slate-400 text-sm mt-1">Tableau de bord de production · Arrêts &amp; Analytique</p>
            </div>

            {err && (
                <div className="bg-red-500/10 border-l-4 border-red-500 p-4 mb-6 text-red-400 rounded-r-lg">
                    <strong>Erreur:</strong> {err}
                </div>
            )}

            {/* Filters */}
            <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-5 mb-6 shadow-xl">
                <div className="flex flex-wrap items-end gap-4">
                    <div className="flex flex-col">
                        <label className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1 px-1">
                            Mode de visualisation
                        </label>
                        <div className="flex items-center bg-slate-800/50 p-1 rounded-xl border border-slate-700/50">
                            <button
                                onClick={() => { setFilterMode('single'); setToDate(fromDate); }}
                                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${filterMode === 'single' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
                            >
                                Jour unique
                            </button>
                            <button
                                onClick={() => setFilterMode('period')}
                                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${filterMode === 'period' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
                            >
                                Période
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col">
                        <label className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1 px-1">
                            {filterMode === 'single' ? 'Date' : 'Période'}
                        </label>
                        <div className="flex items-center gap-2 bg-slate-800/50 p-1.5 rounded-xl border border-slate-700/50">
                            <div className="flex flex-col px-2">
                                <span className="text-[10px] text-slate-400">{filterMode === 'single' ? 'Jour' : 'Début'}</span>
                                <input type="date" value={fromDate} onChange={e => {
                                    setFromDate(e.target.value);
                                    if (filterMode === 'single') setToDate(e.target.value);
                                }}
                                    className="bg-transparent text-white text-xs focus:outline-none dark:[color-scheme:dark]" />
                            </div>
                            {filterMode === 'period' && (
                                <>
                                    <div className="w-px h-8 bg-slate-700" />
                                    <div className="flex flex-col px-2">
                                        <span className="text-[10px] text-slate-400">Fin</span>
                                        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                                            className="bg-transparent text-white text-xs focus:outline-none dark:[color-scheme:dark]" />
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col">
                        <label className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1 px-1">Equipe</label>
                        <select value={equipe} onChange={e => setEquipe(e.target.value as any)}
                            className="bg-slate-800/50 border border-slate-700/50 text-white px-4 py-2.5 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none min-w-[120px]">
                            <option value="1">Equipe 1</option>
                            <option value="2">Equipe 2</option>
                            <option value="3">Equipe 3</option>
                        </select>
                    </div>

                    <div className="flex gap-2 ml-auto">
                        <button onClick={() => { setFromDate(''); setToDate(''); }}
                            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl border border-slate-700/50 transition-all text-xs font-medium uppercase tracking-wide">
                            Effacer
                        </button>
                        <button onClick={loadDaily} disabled={loadingDaily}
                            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-600/20 transition-all text-xs font-bold uppercase tracking-wide flex items-center gap-2">
                            <Icons.Refresh />Actualiser
                        </button>
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <KpiCard
                    label="Nombre d'arrêts"
                    value={kpis ? String(kpis.totalStops) : '—'}
                    sub={kpis ? `Sur ${kpis.days} jour(s)` : 'Chargement...'}
                    color="bg-indigo-500"
                    icon={<Icons.Stop />}
                />
                <KpiCard
                    label="Temps d'arrêt total"
                    value={kpis ? formatHMS(kpis.totalDowntime) : '—'}
                    sub="Cumulé sur la période"
                    color="bg-red-500"
                    icon={<Icons.Clock />}
                />
                <KpiCard
                    label="TRS Moyen"
                    value={kpis ? `${kpis.avgTrs.toFixed(1)}%` : '—'}
                    sub="Taux de rendement synthétique"
                    color="bg-emerald-500"
                    icon={<Icons.Trs />}
                />
                <KpiCard
                    label="Jours analysés"
                    value={kpis ? String(kpis.days) : '—'}
                    sub={`${fromDate ? formatDayFR(fromDate) : '…'} → ${toDate ? formatDayFR(toDate) : '…'}`}
                    color="bg-amber-500"
                    icon={<Icons.Calendar />}
                />
            </div>

            {/* Main content: chart */}
            <div className="mb-8">
                {/* Analytics chart for selected period */}
                <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl p-6 flex flex-col min-h-[360px] relative">
                    {!fromDate || !toDate ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 gap-3">
                            <div className="w-14 h-14 bg-slate-800/60 rounded-full flex items-center justify-center">
                                <Icons.Search />
                            </div>
                            <p className="text-sm font-medium">Sélectionnez une période</p>
                        </div>
                    ) : (
                        <>
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h2 className="text-base font-bold text-white">
                                        Durée Arrêts par Cause ({useSeconds ? 'sec' : 'min'})
                                        {loadingAnalytics && (
                                            <span className="inline-block ml-2 w-3 h-3 border-2 border-slate-600 border-t-indigo-400 rounded-full animate-spin align-middle" />
                                        )}
                                    </h2>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        Répartition par cause — {filterMode === 'single' ? formatDayFR(fromDate) : `${formatDayFR(fromDate)} au ${formatDayFR(toDate)}`}
                                    </p>
                                </div>
                            </div>

                            <div className="h-[300px] w-full mt-2">
                                {chartSeries.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={chartSeries} margin={{ top: 10, right: 20, left: 0, bottom: 24 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                            <XAxis dataKey="causeName" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} interval={0}
                                                tick={({ x, y, payload }) => (
                                                    <g transform={`translate(${x},${y})`}>
                                                        <text x={0} y={0} dy={16} textAnchor="middle" fill="#94a3b8" fontSize={10} transform="rotate(-15)">
                                                            {String(payload.value).length > 14 ? String(payload.value).substring(0, 14) + '…' : String(payload.value)}
                                                        </text>
                                                    </g>
                                                )} />
                                            <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false}
                                                tickFormatter={val => useSeconds ? `${val}s` : `${Math.round(val / 60)}m`} />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#f8fafc', fontSize: '12px' }}
                                                itemStyle={{ color: '#818cf8' }}
                                                cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }}
                                                formatter={(value: any) => [formatDuration(Number(value) || 0), 'Temps arrêt']}
                                                labelStyle={{ color: '#cbd5e1', marginBottom: '0.5rem' }} />
                                            <Bar dataKey="totalDowntimeSeconds" radius={[4, 4, 0, 0]} barSize={38}>
                                                {chartSeries.map((entry) => (
                                                    <Cell key={`cell-${entry.causeId}`} fill={getColorForCause(entry.causeName)} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-slate-500 italic text-sm">
                                        {loadingAnalytics ? 'Chargement...' : 'Aucune donnée pour ce jour.'}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Detailed Full-size Trend Charts */}
            {trendData.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                    {/* Graph: Nombre d'arrêts */}
                    <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl p-6 flex flex-col min-h-[300px]">
                        <div className="mb-4">
                            <h2 className="text-base font-bold text-white">Évolution: Nombre d'arrêts</h2>
                            <p className="text-xs text-slate-400 mt-0.5">Tendance sur la période sélectionnée</p>
                        </div>
                        <div className="h-[250px] w-full mt-2">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                    <XAxis dataKey="dayStr" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc', fontSize: '12px' }}
                                        itemStyle={{ color: '#818cf8' }}
                                        cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }}
                                        labelStyle={{ color: '#cbd5e1', marginBottom: '4px' }}
                                    />
                                    <Bar dataKey="stops" fill="#818cf8" radius={[4, 4, 0, 0]} barSize={38} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Graph: Temps d'arrêt */}
                    <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl p-6 flex flex-col min-h-[300px]">
                        <div className="mb-4">
                            <h2 className="text-base font-bold text-white">Évolution: Temps (Arrêt vs Travail)</h2>
                            <p className="text-xs text-slate-400 mt-0.5">Comparaison journalière en minutes</p>
                        </div>
                        <div className="h-[250px] w-full mt-2">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                    <XAxis dataKey="dayStr" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc', fontSize: '12px' }}
                                        itemStyle={{ color: '#f87171' }}
                                        cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }}
                                        labelStyle={{ color: '#cbd5e1', marginBottom: '4px' }}
                                        formatter={(value: any, name: any) => [`${value} min`, name === 'workMin' ? 'Temps Travail' : 'Temps Arrêt']}
                                    />
                                    <Bar dataKey="workMin" fill="#34d399" radius={[4, 4, 0, 0]} barSize={20} />
                                    <Bar dataKey="downtimeMin" fill="#f87171" radius={[4, 4, 0, 0]} barSize={20} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Graph: TRS Moyen */}
                    <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl p-6 flex flex-col min-h-[300px]">
                        <div className="mb-4">
                            <h2 className="text-base font-bold text-white">Évolution: TRS</h2>
                            <p className="text-xs text-slate-400 mt-0.5">Taux de rendement (%)</p>
                        </div>
                        <div className="h-[250px] w-full mt-2">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                    <XAxis dataKey="dayStr" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} domain={[0, 100]} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc', fontSize: '12px' }}
                                        itemStyle={{ color: '#3b82f6' }}
                                        cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }}
                                        labelStyle={{ color: '#cbd5e1', marginBottom: '4px' }}
                                        formatter={(value: any) => [`${value}%`, 'TRS']}
                                    />
                                    <Bar dataKey="trs" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={38} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}

            {/* Placeholder section for future metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                    { label: 'Métrage', desc: 'Indicateurs de métrage à venir', color: 'from-violet-900/30 to-slate-900/0' },
                    { label: 'Vitesse', desc: 'Indicateurs de vitesse à venir', color: 'from-cyan-900/30 to-slate-900/0' },
                    { label: 'Qualité', desc: 'Indicateurs qualité à venir', color: 'from-rose-900/30 to-slate-900/0' },
                ].map(item => (
                    <div key={item.label}
                        className={`bg-gradient-to-br ${item.color} border border-slate-700/40 rounded-2xl p-6 flex flex-col gap-2 opacity-60`}>
                        <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">{item.label}</span>
                        <span className="text-slate-400 text-xs italic">{item.desc}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
