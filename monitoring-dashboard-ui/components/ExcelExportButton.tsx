import React from 'react';
import * as XLSX from 'xlsx';
import { Download } from 'lucide-react';

interface ExcelExportButtonProps {
    data: any[];
    fileName: string;
    sheetName?: string;
    label?: string;
    className?: string;
}

export default function ExcelExportButton({
    data,
    fileName,
    sheetName = 'Sheet1',
    label = 'Export Excel',
    className,
}: ExcelExportButtonProps) {
    const handleExport = () => {
        if (!data || data.length === 0) {
            alert('No data to export');
            return;
        }

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);

        // Adjust column widths based on data (simple heuristic)
        const cols = Object.keys(data[0]).map((key) => ({ wch: Math.max(key.length + 2, 15) }));
        ws['!cols'] = cols;

        XLSX.utils.book_append_sheet(wb, ws, sheetName);
        XLSX.writeFile(wb, `${fileName}.xlsx`);
    };

    return (
        <button
            onClick={handleExport}
            className={`flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-500/20 transition-all font-medium text-xs ${className}`}
            title="Download as Excel"
        >
            <Download size={14} />
            {label}
        </button>
    );
}
