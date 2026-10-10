/**
 * QR Wristband — a printable patient tag that a scanner can read.
 *
 * The QR code holds the patient's record id (lib/qr.ts). A handheld scanner
 * types it into the OPD search box, which finds the record. The tag shows who
 * the patient is — name, age and sex, id, triage priority at registration —
 * so a nurse can check it against the patient. It no longer carries the
 * registration GPS position or a vitals snapshot: one is private, the other
 * is out of date by the next shift.
 */

'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Patient } from '@/types/patient';
import { qrSvg } from '@/lib/qr';

interface QRWristbandProps {
    patient: Patient;
}

const escapeHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export default function QRWristband({ patient }: QRWristbandProps) {
    const svg = useMemo(() => qrSvg(patient.id, 160), [patient.id]);
    const registered = new Date(patient.timestamp);
    const registeredText = Number.isFinite(registered.getTime()) ? registered.toLocaleString() : '';

    const handlePrint = () => {
        const printWindow = window.open('', '_blank', 'width=520,height=360');
        if (!printWindow) return;
        const statusColor = patient.triageStatus === 'RED' ? '#C53030' : patient.triageStatus === 'YELLOW' ? '#B7791F' : '#2F855A';
        // Every patient field is escaped: a name is typed by a person and goes
        // into markup here. No inline script — the page's Content Security
        // Policy carries over to this window — so printing is started from here.
        printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8">
            <title>Wristband — ${escapeHtml(patient.name)}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 0; padding: 16px; }
                .band { border: 2px dashed #333; padding: 12px; width: 440px; display: flex; gap: 14px; align-items: center; }
                .status { font-size: 20px; font-weight: bold; color: ${statusColor}; border: 3px solid ${statusColor}; padding: 2px 10px; border-radius: 6px; display: inline-block; }
                .name { font-size: 16px; font-weight: bold; margin-top: 6px; }
                .field { font-size: 11px; color: #444; margin-top: 3px; }
                .id { font-family: monospace; font-size: 11px; word-break: break-all; }
                @media print { .hint { display: none; } }
            </style></head><body>
            <p class="hint" style="font-size:12px;color:#666;margin:0 0 8px">Cut along the dashed line and attach to the patient.</p>
            <div class="band">
                <div>${svg}</div>
                <div>
                    <div class="status">${escapeHtml(patient.triageStatus)}</div>
                    <div class="name">${escapeHtml(patient.name)}</div>
                    <div class="field">${escapeHtml(String(patient.age))} y · ${escapeHtml(patient.gender)}</div>
                    <div class="field id">${escapeHtml(patient.id)}</div>
                    <div class="field">Registered ${escapeHtml(registeredText)}</div>
                </div>
            </div></body></html>`);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    };

    const statusColor = patient.triageStatus === 'RED' ? 'border-red-500 bg-red-50' :
        patient.triageStatus === 'YELLOW' ? 'border-yellow-500 bg-yellow-50' : 'border-green-500 bg-green-50';

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="surface-card p-6 overflow-hidden"
        >
            <h3 className="text-sm font-bold text-emerald-deep mb-4 uppercase tracking-wide">QR Wristband</h3>

            <div className={`border-2 border-dashed ${statusColor} rounded-xl p-4 flex items-center gap-4`}>
                {/* Generated from the module grid only (lib/qr.ts): no patient text in this markup. */}
                <div className="shrink-0 bg-white rounded-lg p-1 shadow-sm" dangerouslySetInnerHTML={{ __html: svg }} />

                <div className="min-w-0 space-y-1">
                    <div className={`inline-block px-3 py-1 rounded-lg text-sm font-bold ${
                        patient.triageStatus === 'RED' ? 'bg-red-100 text-red-800' :
                        patient.triageStatus === 'YELLOW' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                    }`}>
                        {patient.triageStatus}
                    </div>
                    <div className="text-sm font-bold text-emerald-deep">{patient.name}</div>
                    <div className="text-xs text-txt-muted">{patient.age} y · {patient.gender}</div>
                    <div className="text-[11px] text-txt-muted font-mono break-all">{patient.id}</div>
                </div>
            </div>
            <p className="mt-2 text-[11px] text-txt-muted">
                Scan with a handheld scanner into the OPD search box to open this record.
            </p>

            <button
                onClick={handlePrint}
                className="w-full mt-4 py-2.5 bg-white border-2 border-emerald-deep text-emerald-deep font-bold rounded-xl hover:bg-emerald-50 transition-colors flex items-center justify-center gap-2 text-sm"
            >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print Wristband
            </button>
        </motion.div>
    );
}
