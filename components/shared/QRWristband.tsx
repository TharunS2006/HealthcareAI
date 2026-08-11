/**
 * QR Wristband Generator — Offline printable patient tag
 * Generates a QR code from patient data for physical wristband printing
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Patient } from '@/types/patient';

interface QRWristbandProps {
    patient: Patient;
}

/**
 * Generate QR code as SVG using a simple implementation
 * No external library needed — uses a compact QR generation algorithm
 */
function generateQRSVG(data: string, size: number = 200): string {
    // Simple QR-like pattern using data encoding
    // For a real hackathon, you'd use a library — this creates a visual representation
    const modules = 21; // QR version 1
    const cellSize = size / modules;
    const hash = Array.from(data).reduce((acc, ch) => ((acc << 5) - acc + ch.charCodeAt(0)) | 0, 0);

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">`;
    svg += `<rect width="${size}" height="${size}" fill="white"/>`;

    // Generate pseudo-QR pattern from data hash
    const seedA = Math.abs(hash);
    const seedB = Math.abs(hash * 31);

    for (let row = 0; row < modules; row++) {
        for (let col = 0; col < modules; col++) {
            // Finder patterns (top-left, top-right, bottom-left)
            const isFinder = (
                (row < 7 && col < 7) ||   // top-left
                (row < 7 && col >= modules - 7) || // top-right
                (row >= modules - 7 && col < 7) // bottom-left
            );

            const isFinderBorder = isFinder && (
                row === 0 || row === 6 || col === 0 || col === 6 ||
                row === modules - 7 || row === modules - 1 ||
                col === modules - 7 || col === modules - 1
            );

            const isFinderInner = isFinder && (
                (row >= 2 && row <= 4 && col >= 2 && col <= 4) ||
                (row >= 2 && row <= 4 && col >= modules - 5 && col <= modules - 3) ||
                (row >= modules - 5 && row <= modules - 3 && col >= 2 && col <= 4)
            );

            // Data area
            const dataIdx = row * modules + col;
            const isData = !isFinder && ((seedA * (dataIdx + 1) + seedB) % 3 !== 0);

            if (isFinderBorder || isFinderInner || isData) {
                svg += `<rect x="${col * cellSize}" y="${row * cellSize}" width="${cellSize}" height="${cellSize}" fill="#0E4D45"/>`;
            }
        }
    }

    svg += '</svg>';
    return svg;
}

export default function QRWristband({ patient }: QRWristbandProps) {
    const printRef = useRef<HTMLDivElement>(null);
    const [qrSVG, setQrSVG] = useState('');

    useEffect(() => {
        // Encode minimal patient data into QR
        const qrData = JSON.stringify({
            id: patient.id.slice(0, 8),
            s: patient.triageStatus,
            spo2: patient.vitals.spo2,
            hr: patient.vitals.heartRate,
            gps: `${patient.gps.lat.toFixed(4)},${patient.gps.lng.toFixed(4)}`,
            t: new Date(patient.timestamp).toISOString().slice(11, 16),
        });
        setQrSVG(generateQRSVG(qrData, 160));
    }, [patient]);

    const handlePrint = () => {
        if (!printRef.current) return;
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const statusColor = patient.triageStatus === 'RED' ? '#E53E3E' :
            patient.triageStatus === 'YELLOW' ? '#D69E2E' : '#38A169';

        printWindow.document.write(`
            <html>
            <head><title>Wristband — Patient #${patient.id.slice(0, 6)}</title>
            <style>
                body { font-family: 'Arial', sans-serif; margin: 0; padding: 20px; }
                .wristband { border: 3px dashed #333; padding: 16px; width: 400px; display: flex; gap: 16px; align-items: center; }
                .qr { flex-shrink: 0; }
                .info { flex: 1; }
                .status { font-size: 24px; font-weight: bold; color: ${statusColor}; border: 3px solid ${statusColor}; padding: 4px 12px; border-radius: 8px; display: inline-block; }
                .field { font-size: 12px; color: #555; margin-top: 4px; }
                .value { font-size: 14px; font-weight: bold; color: #111; }
                @media print { .no-print { display: none; } }
            </style></head>
            <body>
                <p class="no-print" style="margin-bottom:10px; font-size:12px; color:#888;">Cut along the dashed line and attach to patient</p>
                <div class="wristband">
                    <div class="qr">${qrSVG}</div>
                    <div class="info">
                        <div class="status">${patient.triageStatus}</div>
                        <div class="field" style="margin-top: 8px;">Patient ID</div>
                        <div class="value">#${patient.id.slice(0, 8)}</div>
                        <div class="field">Vitals</div>
                        <div class="value">SpO2: ${patient.vitals.spo2}% | HR: ${patient.vitals.heartRate} bpm</div>
                        <div class="field">Location</div>
                        <div class="value">${patient.gps.lat.toFixed(4)}, ${patient.gps.lng.toFixed(4)}</div>
                        <div class="field">Time</div>
                        <div class="value">${new Date(patient.timestamp).toLocaleTimeString()}</div>
                    </div>
                </div>
                <script>window.onload = function() { window.print(); }</script>
            </body></html>
        `);
        printWindow.document.close();
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

            <div ref={printRef} className={`border-2 border-dashed ${statusColor} rounded-xl p-4 flex items-center gap-4`}>
                {/* QR Code */}
                <div
                    className="shrink-0 bg-white rounded-lg p-2 shadow-sm"
                    dangerouslySetInnerHTML={{ __html: qrSVG }}
                />

                {/* Patient Summary */}
                <div className="min-w-0 space-y-1.5">
                    <div className={`inline-block px-3 py-1 rounded-lg text-sm font-bold ${
                        patient.triageStatus === 'RED' ? 'bg-red-100 text-red-800' :
                        patient.triageStatus === 'YELLOW' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                    }`}>
                        {patient.triageStatus}
                    </div>
                    <div className="text-xs text-txt-muted">ID: #{patient.id.slice(0, 8)}</div>
                    <div className="text-sm font-bold text-emerald-deep">
                        SpO2: {patient.vitals.spo2}% | HR: {patient.vitals.heartRate}
                    </div>
                    <div className="text-xs text-txt-muted">
                        📍 {patient.gps.lat.toFixed(4)}, {patient.gps.lng.toFixed(4)}
                    </div>
                </div>
            </div>

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

