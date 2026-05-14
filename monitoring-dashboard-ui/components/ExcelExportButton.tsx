'use client';

import React, { useState } from 'react';
import { Download } from 'lucide-react';

// ─── Theme ────────────────────────────────────────────────────────────────────
const C = {
    titleBg:       '0F172A', // slate-900
    titleFont:     'E2E8F0', // slate-200
    headerBg:      '1E3A5F', // dark navy
    headerFont:    'FFFFFF',
    altRowBg:      'EFF6FF', // blue-50
    defaultFont:   '1E293B', // slate-800
    border:        'CBD5E1', // slate-300
    headerBorder:  '334155', // slate-700
};

export type ConditionalStyle = {
    bgColor?: string;   // hex without #
    fontColor?: string; // hex without #
    bold?: boolean;
};

interface ExcelExportButtonProps {
    data?: any[];
    fetchAllData?: () => Promise<any[]>;
    fileName: string;
    sheetName?: string;
    label?: string;
    className?: string;
    headers?: Record<string, string>;
    formatters?: Record<string, (value: any) => any>;
    columnOrder?: string[];
    /** Optional branded title row at the top of the sheet */
    title?: string;
    /** Per-column conditional cell styling based on the formatted value */
    conditionalStyles?: Record<string, (formattedValue: any, rawValue: any) => ConditionalStyle | null>;
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
    title,
    conditionalStyles,
}: ExcelExportButtonProps) {
    const [loading, setLoading] = useState(false);

    const handleExport = async () => {
        setLoading(true);
        try {
            // 1. Fetch data
            let rawData = data || [];
            if (fetchAllData) rawData = await fetchAllData();
            if (!rawData || rawData.length === 0) {
                alert('Aucune donnée à exporter');
                return;
            }

            // 2. Lazy-load ExcelJS (browser-safe dynamic import)
            const ExcelJS = (await import('exceljs')).default;
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'Monitoring Dashboard';
            workbook.created = new Date();

            const frozenRows = title ? 2 : 1;
            const worksheet = workbook.addWorksheet(sheetName, {
                views: [{ state: 'frozen', ySplit: frozenRows }],
                pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
            });

            const keys = columnOrder || Object.keys(rawData[0]);
            const displayHeaders = keys.map(k => headers?.[k] ?? k);

            // Pre-format every row
            const formattedRows = rawData.map(row =>
                keys.map(key => {
                    const val = row[key];
                    const fmt = formatters?.[key];
                    return fmt ? fmt(val) : (val ?? '');
                })
            );

            // ── Title row ──────────────────────────────────────────────────
            if (title) {
                const titleRow = worksheet.addRow([title, ...Array(keys.length - 1).fill('')]);
                worksheet.mergeCells(1, 1, 1, keys.length);
                const cell = titleRow.getCell(1);
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${C.titleBg}` } };
                cell.font = { color: { argb: `FF${C.titleFont}` }, bold: true, size: 14, name: 'Calibri' };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                titleRow.height = 34;
            }

            // ── Header row ─────────────────────────────────────────────────
            const headerRow = worksheet.addRow(displayHeaders);
            headerRow.eachCell(cell => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${C.headerBg}` } };
                cell.font = { color: { argb: `FF${C.headerFont}` }, bold: true, size: 11, name: 'Calibri' };
                cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                cell.border = {
                    top:    { style: 'thin',   color: { argb: `FF${C.headerBorder}` } },
                    left:   { style: 'thin',   color: { argb: `FF${C.headerBorder}` } },
                    bottom: { style: 'medium', color: { argb: `FF${C.headerBorder}` } },
                    right:  { style: 'thin',   color: { argb: `FF${C.headerBorder}` } },
                };
            });
            headerRow.height = 28;

            // ── Data rows ──────────────────────────────────────────────────
            formattedRows.forEach((rowData, rowIndex) => {
                const rawRow = rawData[rowIndex];
                const isAlt = rowIndex % 2 === 1;
                const defaultBg = isAlt ? `FF${C.altRowBg}` : 'FFFFFFFF';

                const excelRow = worksheet.addRow(rowData);
                excelRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                    const key = keys[colNumber - 1];
                    const rawVal  = rawRow[key];
                    const fmtVal  = rowData[colNumber - 1];

                    let bg        = defaultBg;
                    let fontColor = `FF${C.defaultFont}`;
                    let bold      = false;

                    const cond = conditionalStyles?.[key]?.(fmtVal, rawVal);
                    if (cond) {
                        if (cond.bgColor)   bg        = `FF${cond.bgColor}`;
                        if (cond.fontColor) fontColor = `FF${cond.fontColor}`;
                        if (cond.bold)      bold      = true;
                    }

                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
                    cell.font = { color: { argb: fontColor }, size: 10, name: 'Calibri', bold };
                    cell.alignment = { vertical: 'middle' };
                    cell.border = {
                        top:    { style: 'thin', color: { argb: `FF${C.border}` } },
                        left:   { style: 'thin', color: { argb: `FF${C.border}` } },
                        bottom: { style: 'thin', color: { argb: `FF${C.border}` } },
                        right:  { style: 'thin', color: { argb: `FF${C.border}` } },
                    };
                });
                excelRow.height = 22;
            });

            // ── Auto-size columns ──────────────────────────────────────────
            keys.forEach((_, i) => {
                const col = worksheet.getColumn(i + 1);
                let maxLen = displayHeaders[i].length;
                formattedRows.forEach(row => {
                    const val = String(row[i] ?? '');
                    if (val.length > maxLen) maxLen = val.length;
                });
                col.width = Math.min(Math.max(maxLen + 4, 12), 50);
            });

            // ── Download ───────────────────────────────────────────────────
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${fileName}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

        } catch (e) {
            console.error('Export error:', e);
            alert("Erreur lors de l'export");
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
