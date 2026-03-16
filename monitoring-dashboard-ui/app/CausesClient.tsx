'use client';

import { useEffect, useMemo, useState } from 'react';
import ExcelExportButton from '../components/ExcelExportButton';

// --- Types ---
type Cause = {
    id: number;
    name: string;
    description: string | null;
    affectTRS: boolean;
    isActive: boolean;
};

type PagedResponse = {
    items: Cause[];
    total: number;
    page: number;
    limit: number;
};

// --- API Helper ---
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

// --- Icons (Inline SVGs) ---
const Icons = {
    Search: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
    ),
    Refresh: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 4v6h-6"></path>
            <path d="M1 20v-6h6"></path>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
        </svg>
    ),
    Plus: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
    ),
    Alert: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
    ),
    Check: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="#4ade80" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
    ),
    Close: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
    )
};

// --- Main Component ---
export default function CausesClient() {
    const [data, setData] = useState<PagedResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const [search, setSearch] = useState('');
    const [includeInactive, setIncludeInactive] = useState(false);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Form State
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [affectTRS, setAffectTRS] = useState(true);
    const [isActive, setIsActive] = useState(true);

    const queryString = useMemo(() => {
        const params = new URLSearchParams();
        if (search.trim()) params.set('search', search.trim());
        if (!includeInactive) params.set('isActive', 'true');
        params.set('limit', '1000');
        return params.toString();
    }, [search, includeInactive]);

    async function load() {
        setLoading(true);
        setErr(null);
        try {
            const res = await apiFetch<PagedResponse>(`/api/causes?${queryString}`);
            setData(res);
        } catch (e: any) {
            setErr(e?.message ?? 'Erreur lors du chargement des causes');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [queryString]);

    async function onCreate(e: React.FormEvent) {
        e.preventDefault();
        setErr(null);

        const trimmedName = name.trim();
        const trimmedDesc = description.trim();

        if (!trimmedName) {
            setErr('Le nom est obligatoire.');
            return;
        }
        if (trimmedName.length > 80) {
            setErr('Le nom doit être ≤ 80 caractères.');
            return;
        }
        if (trimmedDesc && trimmedDesc.length > 100) {
            setErr('La description doit être ≤ 100 caractères.');
            return;
        }

        try {
            await apiFetch<Cause>('/api/causes', {
                method: 'POST',
                body: JSON.stringify({
                    name: trimmedName,
                    description: trimmedDesc || null,
                    affectTRS,
                    isActive,
                }),
            });

            // Reset & Close
            setName('');
            setDescription('');
            setAffectTRS(true);
            setIsActive(true);
            setIsModalOpen(false);

            await load();
        } catch (e: any) {
            setErr(e?.message ?? 'La création a échoué');
        }
    }

    async function toggleActive(c: Cause) {
        try {
            await apiFetch<Cause>(`/api/causes/${c.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ isActive: !c.isActive }),
            });
            await load();
        } catch (e: any) {
            setErr(e?.message ?? 'La mise à jour a échoué');
        }
    }

    return (
        <div className="text-sm">
            <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl">

                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-center p-5 border-b border-slate-700/50 gap-4">

                    <div className="flex items-center gap-6 w-full md:w-auto">
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl font-medium shadow-lg shadow-indigo-600/20 transition-all hover:scale-105 active:scale-95 text-xs uppercase tracking-wide"
                        >
                            <Icons.Plus /> Nouvelle Cause
                        </button>

                        <label className="flex items-center gap-2 text-slate-300 cursor-pointer select-none text-xs">
                            <input
                                type="checkbox"
                                checked={includeInactive}
                                onChange={(e) => setIncludeInactive(e.target.checked)}
                                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-slate-900"
                            />
                            Inclure Inactifs
                        </label>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="relative group flex-1 md:w-64">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                                <Icons.Search />
                            </div>
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Rechercher causes..."
                                className="w-full bg-slate-800/50 border border-slate-700 text-slate-200 pl-10 pr-4 py-2 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-600 text-xs"
                            />
                        </div>

                        <button
                            onClick={load}
                            disabled={loading}
                            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl border border-slate-700 transition-all"
                            title="Actualiser"
                        >
                            <Icons.Refresh />
                        </button>

                        <ExcelExportButton
                            data={data?.items || []}
                            fileName="causes_export"
                            sheetName="Causes"
                            label="Exporter excel"
                        />

                        <div className="text-slate-500 font-medium whitespace-nowrap px-2 text-xs">
                            Total: <span className="text-slate-200">{data?.total ?? 0}</span>
                        </div>
                    </div>
                </div>

                {/* Error */}
                {err && (
                    <div className="bg-red-500/10 border-l-4 border-red-500 p-4 m-4 text-red-400">
                        <strong>Erreur:</strong> {err}
                    </div>
                )}

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700/50 bg-slate-800/30">
                                <th className="px-6 py-4">ID</th>
                                <th className="px-6 py-4 w-1/2">Raison</th>
                                <th className="px-6 py-4">Affecte TRS</th>
                                <th className="px-6 py-4">Statut</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-700/50 text-xs">
                            {loading && !data && (
                                <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">Chargement...</td></tr>
                            )}

                            {!loading && data?.items.length === 0 && (
                                <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">Aucune cause trouvée.</td></tr>
                            )}

                            {data?.items.map((cause) => (
                                <tr key={cause.id} className="group hover:bg-slate-800/40 transition-colors">
                                    <td className="px-6 py-4 font-mono text-slate-300 group-hover:text-white transition-colors font-medium">
                                        {cause.id}
                                    </td>

                                    <td className="px-6 py-4">
                                        <div className="font-semibold text-slate-200">{cause.name}</div>
                                        {cause.description && (
                                            <div className="text-[10px] text-slate-500 mt-0.5 max-w-xs truncate">{cause.description}</div>
                                        )}
                                    </td>

                                    <td className="px-6 py-4">
                                        {cause.affectTRS ? (
                                            <div className="flex items-center gap-2 text-amber-400 font-semibold text-[10px]">
                                                <Icons.Alert /> OUI
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-[10px]">
                                                <Icons.Check /> NON
                                            </div>
                                        )}
                                    </td>

                                    <td className="px-6 py-4">
                                        {cause.isActive ? (
                                            <div className="flex items-center gap-2 text-emerald-400 text-[10px] font-medium">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"></span>
                                                Actif
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 text-slate-500 text-[10px] font-medium">
                                                <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                                                Inactif
                                            </div>
                                        )}
                                    </td>

                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => toggleActive(cause)}
                                            className={`text-[10px] px-3 py-1.5 rounded-lg border transition-all ${cause.isActive
                                                ? 'border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 hover:border-slate-600'
                                                : 'border-emerald-900/50 text-emerald-400 bg-emerald-900/20 hover:bg-emerald-900/40'
                                                }`}
                                        >
                                            {cause.isActive ? 'Désactiver' : 'Activer'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {!loading && data && (
                    <div className="px-6 py-4 border-t border-slate-700/50 flex justify-between items-center bg-slate-800/20">
                        <div className="text-[10px] text-slate-500 uppercase tracking-wide">
                            Affichage de {data.items.length} sur {data.total} entrées
                        </div>
                    </div>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                        onClick={() => setIsModalOpen(false)}
                    />

                    <div className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
                            <h3 className="text-lg font-semibold text-white">Nouvelle Cause</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-700 transition">
                                <Icons.Close />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto">
                            <form id="createForm" onSubmit={onCreate} className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-slate-400">Nom</label>
                                    <input
                                        required
                                        maxLength={80}
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-xs"
                                        placeholder="Nom court de la cause"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-slate-400">Description</label>
                                    <textarea
                                        maxLength={100}
                                        value={description}
                                        onChange={e => setDescription(e.target.value)}
                                        className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all h-20 resize-none text-xs"
                                        placeholder="Optionnel (≤ 100 caractères)"
                                    />
                                </div>

                                <div className="flex gap-6 pt-2">
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <div className="relative flex items-center">
                                            <input type="checkbox" checked={affectTRS} onChange={e => setAffectTRS(e.target.checked)} className="peer sr-only" />
                                            <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                                        </div>
                                        <span className="text-sm text-slate-300 group-hover:text-white">Affecte TRS</span>
                                    </label>

                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <div className="relative flex items-center">
                                            <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="peer sr-only" />
                                            <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                                        </div>
                                        <span className="text-sm text-slate-300 group-hover:text-white">Actif</span>
                                    </label>
                                </div>
                            </form>
                        </div>

                        <div className="px-6 py-4 border-t border-slate-700 bg-slate-800/50 flex justify-end gap-3">
                            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors text-xs uppercase font-medium">
                                Annuler
                            </button>
                            <button form="createForm" type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-lg shadow-indigo-600/20 font-medium transition-transform active:scale-95 text-xs uppercase tracking-wide">
                                Créer Cause
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
