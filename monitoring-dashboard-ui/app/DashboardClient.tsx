'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
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

function getColorForCause(causeName: string): string {
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

    const [fromDate, setFromDate] = useState(today);
    const [toDate, setToDate] = useState(today);
    const [equipe, setEquipe] = useState<'1' | '2' | '3'>('1');

    const [dailyRows, setDailyRows] = useState<DailyStopsRow[]>([]);
    const [loadingDaily, setLoadingDaily] = useState(false);

    const [selectedDay, setSelectedDay] = useState<string | null>(today);
    const [analyticsData, setAnalyticsData] = useState<AnalyticsData[]>([]);
    const [loadingAnalytics, setLoadingAnalytics] = useState(false);

    const [causes, setCauses] = useState<CauseOption[]>([]);
    const [err, setErr] = useState<string | null>(null);

    const analyticsKeyRef = useRef<string>('');

    const dailyQuery = useMemo(() => {
        const p = new URLSearchParams();
        if (fromDate) p.set('from', fromDate);
        if (toDate) p.set('to', toDate);
        p.set('equipe', equipe);
        return `?${p.toString()}`;
    }, [fromDate, toDate, equipe]);

    // Load causes once
    useEffect(() => {
        apiFetch<{ items: CauseOption[] }>(`/api/causes?limit=1000`)
            .then(res => setCauses(res.items ?? []))
            .catch(() => setCauses([]));
    }, []);

    // Handle filter changes
    useEffect(() => {
        if (fromDate && toDate && fromDate === toDate) {
            setSelectedDay(fromDate);
        } else {
            setSelectedDay(null);
        }
        setAnalyticsData([]);
        analyticsKeyRef.current = '';
    }, [fromDate, toDate, equipe]);

    async function loadDaily() {
        setLoadingDaily(true);
        setErr(null);
        try {
            const res = await apiFetch<DailyStopsRow[]>(`/api/stops/analytics/daily${dailyQuery}`);
            setDailyRows(res);
        } catch (e: any) {
            setErr(e?.message ?? 'Erreur chargement données quotidiennes');
            setDailyRows([]);
        } finally {
            setLoadingDaily(false);
        }
    }

    useEffect(() => { loadDaily(); }, [dailyQuery]);

    async function loadAnalytics(day: string) {
        const key = `${day}|${equipe}`;
        if (analyticsKeyRef.current === key) return;
        analyticsKeyRef.current = key;
        setLoadingAnalytics(true);
        try {
            const p = new URLSearchParams({ from: day, to: day, equipe });
            const res = await apiFetch<AnalyticsData[]>(`/api/stops/analytics/downtime?${p.toString()}`);
            setAnalyticsData(res);
        } catch (e: any) {
            setErr(e?.message ?? 'Erreur chargement analytiques');
            setAnalyticsData([]);
        } finally {
            setLoadingAnalytics(false);
        }
    }

    useEffect(() => {
        if (selectedDay) {
            loadAnalytics(selectedDay);
        }
    }, [selectedDay, equipe]);

    function onSelectDay(day: string) {
        const d = day.split('T')[0];
        setSelectedDay(d);
    }

    // KPI aggregates over the visible period
    const kpis = useMemo(() => {
        if (dailyRows.length === 0) return null;
        const totalStops = dailyRows.reduce((s, r) => s + r.stopsCount, 0);
        const totalDowntime = dailyRows.reduce((s, r) => s + r.totalDowntimeSeconds, 0);
        const avgTrs = (() => {
            let trsSum = 0, count = 0;
            for (const row of dailyRows) {
                const avail = calculateAvailableTime(row.day, equipe);
                const refSeconds = 8 * 3600;
                const downTRS = Number(row.trsDowntimeSeconds || 0);
                if (avail > 0) { trsSum += Math.max(0, ((avail - downTRS) / refSeconds) * 100); count++; }
            }
            return count > 0 ? trsSum / count : 0;
        })();
        return { totalStops, totalDowntime, avgTrs, days: dailyRows.length };
    }, [dailyRows, equipe]);

    // Chart series for the selected day
    const chartSeries = useMemo(() => {
        if (causes.length === 0) return analyticsData;
        const map = new Map<number, number>();
        for (const a of analyticsData) map.set(a.causeId, a.totalDowntimeSeconds);
        const merged = causes.map(c => ({
            causeId: c.id,
            causeName: c.name,
            totalDowntimeSeconds: map.get(c.id) ?? 0,
        }));
        merged.sort((a, b) => b.totalDowntimeSeconds - a.totalDowntimeSeconds || a.causeId - b.causeId);
        return merged;
    }, [causes, analyticsData]);

    const maxDuration = useMemo(() =>
        chartSeries.length ? Math.max(...chartSeries.map(d => d.totalDowntimeSeconds)) : 0,
        [chartSeries]);
    const useSeconds = maxDuration < 60;

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
                            Période de visualisation
                        </label>
                        <div className="flex items-center gap-2 bg-slate-800/50 p-1.5 rounded-xl border border-slate-700/50">
                            <div className="flex flex-col px-2">
                                <span className="text-[10px] text-slate-400">Début</span>
                                <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                                    className="bg-transparent text-white text-xs focus:outline-none dark:[color-scheme:dark]" />
                            </div>
                            <div className="w-px h-8 bg-slate-700" />
                            <div className="flex flex-col px-2">
                                <span className="text-[10px] text-slate-400">Fin</span>
                                <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                                    className="bg-transparent text-white text-xs focus:outline-none dark:[color-scheme:dark]" />
                            </div>
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

            {/* Main content: daily table + chart */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

                {/* Daily summary table */}
                <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
                    <div className="p-5 border-b border-slate-700/50 bg-slate-800/20">
                        <h2 className="text-base font-bold text-white">Résumé Journalier</h2>
                        <p className="text-xs text-slate-400 mt-0.5">Cliquez sur un jour pour voir le graphique</p>
                    </div>

                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700/50 bg-slate-800/40">
                                    <th className="px-4 py-3">Date</th>
                                    <th className="px-4 py-3">Arrêt Total</th>
                                    <th className="px-4 py-3">TRS</th>
                                    <th className="px-4 py-3 text-right">Nb Arrêts</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/30 text-xs">
                                {loadingDaily && dailyRows.length === 0 && (
                                    <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">Chargement...</td></tr>
                                )}
                                {!loadingDaily && dailyRows.length === 0 && (
                                    <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">Aucune donnée trouvée.</td></tr>
                                )}
                                {dailyRows.map(row => {
                                    const isSelected = selectedDay === row.day;
                                    const avail = calculateAvailableTime(row.day, equipe);
                                    const refSeconds = 8 * 3600;
                                    const downTRS = Number(row.trsDowntimeSeconds || 0);
                                    const trsValue = avail > 0 ? Math.max(0, ((avail - downTRS) / refSeconds) * 100) : 0;

                                    return (
                                        <tr key={row.day} onClick={() => onSelectDay(row.day)}
                                            className={`cursor-pointer transition-colors ${isSelected
                                                ? 'bg-indigo-500/20 border-l-2 border-indigo-500'
                                                : 'hover:bg-slate-800/40 border-l-2 border-transparent'}`}>
                                            <td className="px-4 py-3 font-medium text-slate-200">{formatDayFR(row.day)}</td>
                                            <td className="px-4 py-3 text-slate-300 font-mono">{formatHMS(row.totalDowntimeSeconds)}</td>
                                            <td className="px-4 py-3">
                                                <span className={`font-bold ${trsColor(trsValue)}`}>{trsValue.toFixed(1)}%</span>
                                            </td>
                                            <td className="px-4 py-3 text-right font-semibold text-slate-200">{row.stopsCount}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Analytics chart for selected day */}
                <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl p-6 flex flex-col min-h-[360px] relative">
                    {!selectedDay ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 gap-3">
                            <div className="w-14 h-14 bg-slate-800/60 rounded-full flex items-center justify-center">
                                <Icons.Search />
                            </div>
                            <p className="text-sm font-medium">Sélectionnez un jour</p>
                            <p className="text-xs opacity-60">Cliquez sur une ligne du tableau pour voir le graphique</p>
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
                                        Répartition par cause — {formatDayFR(selectedDay)}
                                    </p>
                                </div>
                            </div>

                            <div className="flex-1 min-h-[260px]">
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
