'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';
import ExcelExportButton from '../components/ExcelExportButton';

type DailyPoint = {
    day: string;      // YYYY-MM-DD
    avgSpeed: number;
    maxSpeed: number;
    samples: number;
};

type Summary = {
    from: string | null;
    to: string | null;
    avgSpeed: number;
    maxSpeed: number;
    samples: number;
};

type VitesseEntry = {
    id: string;
    recordedAt: string;
    speed: number;
    note: string | null;
};

type PagedResponse = {
    items: VitesseEntry[];
    total: number;
    page: number;
    limit: number;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${API_URL}${path}`, {
        ...init,
        headers: {
            'Content-Type': 'application/json',
            ...(init?.headers ?? {}),
        },
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`${res.status} ${res.statusText} - ${text}`);
    }
    return (await res.json()) as T;
}

function pad2(n: number) {
    return String(n).padStart(2, '0');
}
function toLocalDate(d: Date) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function formatDayFR(day: string) {
    if (!day) return '';
    const datePart = day.split('T')[0];
    const [y, m, d] = datePart.split('-');
    return `${d}/${m}/${y}`;
}
function formatDateTime(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

export default function VitesseClient() {
    const today = new Date();
    const sevenDaysAgo = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);

    // Filters (default last 7 days)
    const [from, setFrom] = useState<string>(toLocalDate(sevenDaysAgo));
    const [to, setTo] = useState<string>(toLocalDate(today));

    // Manual insert
    const [recordedAt, setRecordedAt] = useState<string>(''); // datetime-local
    const [speed, setSpeed] = useState<string>('0');
    const [note, setNote] = useState<string>('');

    const [daily, setDaily] = useState<DailyPoint[]>([]);
    const [summary, setSummary] = useState<Summary | null>(null);
    const [list, setList] = useState<PagedResponse | null>(null);

    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const [page, setPage] = useState(1);
    const LIMIT = 5;

    const queryString = useMemo(() => {
        const params = new URLSearchParams();
        if (from) params.set('from', from);
        if (to) params.set('to', to);
        return params.toString();
    }, [from, to]);

    async function load() {
        setLoading(true);
        setErr(null);
        try {
            const [dailyRes, summaryRes, listRes] = await Promise.all([
                apiFetch<DailyPoint[]>(`/api/vitesse/daily?${queryString}`),
                apiFetch<Summary>(`/api/vitesse/summary?${queryString}`),
                apiFetch<PagedResponse>(`/api/vitesse?${queryString}&page=${page}&limit=${LIMIT}`),
            ]);
            setDaily(dailyRes);
            setSummary(summaryRes);
            setList(listRes);
        } catch (e: any) {
            setErr(e?.message ?? 'Erreur lors du chargement des vitesses');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [queryString, page]); // Reload when query or page changes

    // Reset page when filters change
    useEffect(() => {
        setPage(1);
    }, [queryString]);

    async function onCreate(e: React.FormEvent) {
        e.preventDefault();
        setErr(null);

        const speedNum = Number(speed);
        if (Number.isNaN(speedNum) || speedNum < 0) {
            setErr('La vitesse doit être un nombre >= 0');
            return;
        }

        try {
            await apiFetch('/api/vitesse', {
                method: 'POST',
                body: JSON.stringify({
                    recordedAt: recordedAt || undefined,
                    speed: speedNum,
                    note: note || undefined,
                }),
            });

            setRecordedAt('');
            setSpeed('0');
            setNote('');
            await load();
        } catch (e: any) {
            setErr(e?.message ?? 'La création a échoué');
        }
    }

    return (
        <div className="text-sm">
            {err && (
                <div className="bg-red-500/10 border-l-4 border-red-500 p-4 mb-4 text-red-400 rounded-r-lg">
                    <strong>Erreur:</strong> {err}
                </div>
            )}

            {/* Chart Card */}
            <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl mb-8 p-6">
                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-4">
                    <div>
                        <h2 className="text-lg font-bold text-white">Vitesse de production par jour</h2>
                        <p className="text-xs text-slate-400 mt-1">Courbe journalière (Moyenne + Max)</p>
                    </div>

                    <div className="flex gap-3 items-end flex-wrap">
                        <label className="text-slate-400 text-xs font-semibold uppercase tracking-wide">
                            Début
                            <input
                                type="date"
                                value={from}
                                onChange={(e) => setFrom(e.target.value)}
                                className="mt-1 w-full bg-slate-800/50 border border-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs focus:outline-none focus:border-indigo-500 dark:[color-scheme:dark]"
                            />
                        </label>

                        <label className="text-slate-400 text-xs font-semibold uppercase tracking-wide">
                            Fin
                            <input
                                type="date"
                                value={to}
                                onChange={(e) => setTo(e.target.value)}
                                className="mt-1 w-full bg-slate-800/50 border border-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs focus:outline-none focus:border-indigo-500 dark:[color-scheme:dark]"
                            />
                        </label>

                        <button
                            onClick={load}
                            disabled={loading}
                            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition uppercase text-xs font-medium tracking-wide h-[34px]"
                        >
                            Actualiser
                        </button>

                        <ExcelExportButton
                            data={daily}
                            fileName="vitesse_journaliere_export"
                            sheetName="Vitesse"
                            label="Exporter excel"
                        />

                        <div className="flex gap-2">
                            <div className="bg-slate-800/40 border border-slate-700 rounded-lg px-3 py-1.5 min-w-[80px]">
                                <div className="text-indigo-300 text-[10px] uppercase font-bold tracking-wider">Moyenne</div>
                                <div className="text-white font-bold text-md leading-tight">
                                    {summary ? `${summary.avgSpeed.toFixed(2)}` : '—'}
                                </div>
                            </div>
                            <div className="bg-slate-800/40 border border-slate-700 rounded-lg px-3 py-1.5 min-w-[80px]">
                                <div className="text-emerald-400 text-[10px] uppercase font-bold tracking-wider">Max</div>
                                <div className="text-white font-bold text-md leading-tight">
                                    {summary ? `${summary.maxSpeed.toFixed(2)}` : '—'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="h-[320px] w-full">
                    {daily.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={daily} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                <XAxis
                                    dataKey="day"
                                    stroke="#94a3b8"
                                    fontSize={10}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(v) => formatDayFR(v)}
                                />
                                <YAxis
                                    stroke="#94a3b8"
                                    fontSize={10}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#0f172a',
                                        borderColor: '#334155',
                                        borderRadius: '12px',
                                        color: '#f8fafc',
                                        fontSize: '12px',
                                    }}
                                    formatter={(value: any, name: any) => [Number(value).toFixed(2), name === 'avgSpeed' ? 'Moyenne' : 'Max']}
                                    labelFormatter={(label: any) => `Jour: ${formatDayFR(label)}`}
                                />

                                {/* Avg line */}
                                <Line type="monotone" dataKey="avgSpeed" name="avgSpeed" stroke="#6366f1" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />

                                {/* Max line */}
                                <Line type="monotone" dataKey="maxSpeed" name="maxSpeed" stroke="#10b981" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex items-center justify-center text-slate-500 italic text-xs">
                            {loading ? 'Chargement...' : 'Aucune donnée sur la période.'}
                        </div>
                    )}
                </div>
            </div>

            {/* Manual Insert */}
            <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl p-6 mb-8">
                <h2 className="text-lg font-bold text-white mb-4">Ajouter un échantillon (manuel)</h2>

                <form onSubmit={onCreate} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <label className="text-slate-400 text-xs font-semibold uppercase tracking-wide">
                        Date/Heure (Optionnel)
                        <input
                            type="datetime-local"
                            value={recordedAt}
                            onChange={(e) => setRecordedAt(e.target.value)}
                            className="mt-1 w-full bg-slate-800/50 border border-slate-700 text-slate-200 px-3 py-2 rounded-lg focus:outline-none focus:border-indigo-500 dark:[color-scheme:dark]"
                        />
                    </label>

                    <label className="text-slate-400 text-xs font-semibold uppercase tracking-wide">
                        Vitesse
                        <input
                            type="number"
                            step="0.001"
                            min="0"
                            value={speed}
                            onChange={(e) => setSpeed(e.target.value)}
                            className="mt-1 w-full bg-slate-800/50 border border-slate-700 text-slate-200 px-3 py-2 rounded-lg focus:outline-none focus:border-indigo-500"
                        />
                    </label>

                    <label className="text-slate-400 text-xs font-semibold uppercase tracking-wide md:col-span-2">
                        Note (Optionnel)
                        <div className="flex gap-2 mt-1">
                            <input
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                maxLength={40}
                                className="w-full bg-slate-800/50 border border-slate-700 text-slate-200 px-3 py-2 rounded-lg focus:outline-none focus:border-indigo-500"
                                placeholder="ex: Essai 1..."
                            />
                            <button
                                type="submit"
                                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-lg shadow-indigo-600/20 font-bold uppercase tracking-wide text-xs transition-transform active:scale-95 whitespace-nowrap"
                            >
                                Ajouter
                            </button>
                        </div>
                    </label>
                </form>
            </div>

            {/* List */}
            <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl">
                <div className="flex justify-between items-center p-5 border-b border-slate-700/50">
                    <h2 className="text-lg font-bold text-white">Derniers échantillons</h2>
                    <div className="text-slate-500 font-medium whitespace-nowrap px-2 text-xs uppercase tracking-wide">
                        Total: <span className="text-slate-200">{list?.total ?? 0}</span>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700/50 bg-slate-800/30">
                                <th className="px-6 py-4">Enregistré le</th>
                                <th className="px-6 py-4">Vitesse</th>
                                <th className="px-6 py-4">Note</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50 text-xs">
                            {!loading && list?.items.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="px-6 py-8 text-center text-slate-500">
                                        Aucune donnée trouvée.
                                    </td>
                                </tr>
                            )}

                            {list?.items.map((v) => (
                                <tr key={v.id} className="group hover:bg-slate-800/40 transition-colors">
                                    <td className="px-6 py-4 font-mono text-slate-300 group-hover:text-white transition-colors">
                                        {formatDateTime(v.recordedAt)}
                                    </td>
                                    <td className="px-6 py-4 text-indigo-200 font-semibold">
                                        {Number(v.speed).toFixed(3)}
                                    </td>
                                    <td className="px-6 py-4 text-slate-400">
                                        {v.note ?? ''}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {!loading && list && (
                    <div className="px-6 py-4 border-t border-slate-700/50 flex justify-between items-center bg-slate-800/20">
                        <div className="text-[10px] text-slate-500 uppercase tracking-wide">
                            Affichage de {list.items.length} sur {list.total} entrées
                        </div>
                        {list.total > LIMIT && (
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 rounded border border-slate-700 text-xs"
                                >
                                    Précédent
                                </button>
                                <span className="text-xs text-slate-500 py-1">
                                    Page {page} / {Math.ceil(list.total / LIMIT)}
                                </span>
                                <button
                                    onClick={() => setPage(p => Math.min(Math.ceil(list.total / LIMIT), p + 1))}
                                    disabled={page >= Math.ceil(list.total / LIMIT)}
                                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 rounded border border-slate-700 text-xs"
                                >
                                    Suivant
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
