import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Download } from 'lucide-react';

interface ExcelExportButtonProps {
    data?: any[];
    fetchAllData?: () => Promise<any[]>;
    fileName: string;
    sheetName?: string;
    label?: string;
    className?: string;
    headers?: Record<string, string>; // map raw key -> display header
    formatters?: Record<string, (value: any) => any>; // map raw key -> format fn
    columnOrder?: string[]; // ordered list of keys to include
}

export default function ExcelExportButton({
    data,
    fetchAllData,
    fileName,
    sheetName = 'Sheet1',
    label = 'Export Excel',
    className,
    headers,
    formatters,
    columnOrder,
}: ExcelExportButtonProps) {
    const [loading, setLoading] = useState(false);

    const handleExport = async () => {
        setLoading(true);
        try {
            // Use fetchAllData if provided (fetches ALL rows), otherwise fall back to data prop
            let rawData = data || [];
            if (fetchAllData) {
                rawData = await fetchAllData();
            }

            if (!rawData || rawData.length === 0) {
                alert('Aucune donnée à exporter');
                return;
            }

            // Determine which keys to export and in what order
            const keys = columnOrder || Object.keys(rawData[0]);

            // Build formatted rows with display headers
            const formattedRows = rawData.map((row) => {
                const out: Record<string, any> = {};
                for (const key of keys) {
                    const displayName = headers?.[key] ?? key;
                    const formatter = formatters?.[key];
                    out[displayName] = formatter ? formatter(row[key]) : row[key];
                }
                return out;
            });

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(formattedRows);

            // Auto-size columns
            const displayKeys = keys.map(k => headers?.[k] ?? k);
            ws['!cols'] = displayKeys.map((header) => {
                // Find max content length in this column
                let maxLen = header.length;
                for (const row of formattedRows) {
                    const val = String(row[header] ?? '');
                    if (val.length > maxLen) maxLen = val.length;
                }
                return { wch: Math.min(maxLen + 3, 40) };
            });

            XLSX.utils.book_append_sheet(wb, ws, sheetName);
            XLSX.writeFile(wb, `${fileName}.xlsx`);
        } catch (e) {
            console.error('Export error:', e);
            alert('Erreur lors de l\'export');
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handleExport}
            disabled={loading}
            className={`flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 disabled:cursor-wait text-white rounded-xl shadow-lg shadow-emerald-500/20 transition-all font-medium text-xs ${className}`}
            title="Télécharger en Excel"
        >
            <Download size={14} />
            {loading ? 'Export en cours...' : label}
        </button>
    );
}
