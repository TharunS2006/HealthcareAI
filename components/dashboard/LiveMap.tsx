/**
 * Live Map Component — Real-time patient & facility visualization for Gadchiroli, Maharashtra
 * Uses Leaflet for offline-capable mapping with patient & facility pins
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { Patient } from '@/types/patient';
import { MAHARASHTRA_FACILITIES } from '@/lib/data/facilities';

interface LiveMapProps {
    patients: Patient[];
    className?: string;
}

export default function LiveMap({ patients, className = '' }: LiveMapProps) {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<any>(null);
    const markersRef = useRef<any[]>([]);
    const [mapReady, setMapReady] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined' || !mapRef.current || mapInstanceRef.current) return;

        import('leaflet').then((L) => {
            if (!mapRef.current) return;

            if ((mapRef.current as any)._leaflet_id) {
                (mapRef.current as any)._leaflet_id = null;
            }

            delete (L.Icon.Default.prototype as any)._getIconUrl;
            L.Icon.Default.mergeOptions({
                iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
                iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
            });

            // Center on Gadchiroli, Maharashtra
            const map = L.map(mapRef.current, {
                center: [19.6500, 80.2000],
                zoom: 10,
                zoomControl: false,
                attributionControl: false,
            });

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 18,
            }).addTo(map);

            L.control.zoom({ position: 'bottomright' }).addTo(map);

            // Add Maharashtra Facility markers
            MAHARASHTRA_FACILITIES.forEach((fac) => {
                const isDH = fac.type === 'DH';
                const isPHC = fac.type === 'PHC';

                const iconHtml = `
                    <div style="
                        width: ${isDH ? '36px' : isPHC ? '28px' : '24px'};
                        height: ${isDH ? '36px' : isPHC ? '28px' : '24px'};
                        background: ${isDH ? '#0E7D6B' : isPHC ? '#0284C7' : '#D97706'};
                        border: 2px solid #ffffff;
                        border-radius: 8px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        box-shadow: 0 3px 8px rgba(0,0,0,0.3);
                        color: white;
                        font-weight: bold;
                        font-size: ${isDH ? '16px' : '12px'};
                    ">
                        ${isDH ? '🏥' : isPHC ? '🩺' : '📍'}
                    </div>
                `;

                const icon = L.divIcon({
                    html: iconHtml,
                    className: 'facility-marker',
                    iconSize: [isDH ? 36 : 28, isDH ? 36 : 28],
                    iconAnchor: [isDH ? 18 : 14, isDH ? 18 : 14],
                });

                const marker = L.marker([fac.location.lat, fac.location.lng], { icon }).addTo(map);
                marker.bindPopup(`
                    <div style="font-family: sans-serif; padding: 4px;">
                        <strong style="font-size: 13px; color: #064e3b;">${fac.name}</strong>
                        <div style="font-size: 11px; color: #6b7280; margin: 2px 0;">Tier: <strong>${fac.type}</strong> • ${fac.district}</div>
                        <div style="font-size: 11px; color: #047857;">Beds: ${fac.beds.occupied}/${fac.beds.total} • Ambulances: ${fac.ambulanceAvailable}</div>
                    </div>
                `);
            });

            mapInstanceRef.current = map;
            setMapReady(true);
        });

        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
        };
    }, []);

    // Update patient pins
    useEffect(() => {
        if (!mapReady || !mapInstanceRef.current) return;

        import('leaflet').then((L) => {
            markersRef.current.forEach(m => m.remove());
            markersRef.current = [];

            patients.forEach((patient) => {
                if (!patient.gps || patient.gps.lat === 0) return;

                const color = patient.triageStatus === 'RED' ? '#EF4444' :
                              patient.triageStatus === 'YELLOW' ? '#F59E0B' : '#10B981';

                const patientHtml = `
                    <div style="
                        width: 20px;
                        height: 20px;
                        background: ${color};
                        border: 2px solid #ffffff;
                        border-radius: 50%;
                        box-shadow: 0 0 10px ${color};
                        animation: pulse 2s infinite;
                    "></div>
                `;

                const icon = L.divIcon({
                    html: patientHtml,
                    className: 'patient-pin',
                    iconSize: [20, 20],
                    iconAnchor: [10, 10],
                });

                const marker = L.marker([patient.gps.lat, patient.gps.lng], { icon }).addTo(mapInstanceRef.current);
                marker.bindPopup(`
                    <div style="font-family: sans-serif; padding: 4px;">
                        <strong style="font-size: 12px; color: #111827;">${patient.name}</strong>
                        <div style="font-size: 10px; color: #6b7280;">Village: ${patient.village} • Age: ${patient.age}</div>
                        <div style="font-size: 11px; font-weight: bold; color: ${color}; margin-top: 2px;">
                            ${patient.triageStatus} Priority (${patient.vitals.spo2}% SpO2)
                        </div>
                    </div>
                `);
                markersRef.current.push(marker);
            });
        });
    }, [patients, mapReady]);

    return (
        <div className={`relative w-full h-full rounded-2xl overflow-hidden ${className}`}>
            <div ref={mapRef} className="w-full h-full" />
            <div className="absolute top-3 right-3 z-[1000] bg-white/90 backdrop-blur px-2.5 py-1 rounded-lg border text-[10px] font-bold text-emerald-deep shadow-sm">
                Gadchiroli District Map
            </div>
        </div>
    );
}
