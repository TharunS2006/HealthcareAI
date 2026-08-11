/**
 * Live Map Component — Real-time patient & hospital visualization
 * Uses Leaflet for offline-capable mapping with patient pins
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { Patient } from '@/types/patient';
import { HOSPITALS, Hospital } from '@/lib/data/hospitals';

interface LiveMapProps {
    patients: Patient[];
    className?: string;
}

export default function LiveMap({ patients, className = '' }: LiveMapProps) {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<any>(null);
    const observerRef = useRef<ResizeObserver | null>(null);
    const markersRef = useRef<any[]>([]);
    const [mapReady, setMapReady] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined' || !mapRef.current || mapInstanceRef.current) return;

        // Dynamic import of leaflet (client-side only)
        import('leaflet').then((L) => {
            if (!mapRef.current) return;

            // Prevent "Map container is already initialized" error
            if ((mapRef.current as any)._leaflet_id) {
                (mapRef.current as any)._leaflet_id = null;
            }

            // Fix default icon paths
            delete (L.Icon.Default.prototype as any)._getIconUrl;
            L.Icon.Default.mergeOptions({
                iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
                iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
            });

            // Center on Chennai (default)
            const map = L.map(mapRef.current, {
                center: [13.0827, 80.2707],
                zoom: 13,
                zoomControl: false,
                attributionControl: false,
            });

            // Add tile layer — using OpenStreetMap (works with local caching)
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 18,
            }).addTo(map);

            // Add zoom control to bottom-right
            L.control.zoom({ position: 'bottomright' }).addTo(map);

            // Add hospital markers
            HOSPITALS.forEach((hospital: Hospital) => {
                const availableICU = hospital.capacity.icu.total - hospital.capacity.icu.occupied;
                const hospitalIcon = L.divIcon({
                    className: 'custom-hospital-marker',
                    html: `<div style="
                        background: white;
                        border: 3px solid #0E4D45;
                        border-radius: 12px;
                        padding: 4px 8px;
                        font-size: 11px;
                        font-weight: bold;
                        color: #0E4D45;
                        white-space: nowrap;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                        display: flex;
                        align-items: center;
                        gap: 4px;
                    ">🏥 ${hospital.name.split(' ')[0]} <span style="color: ${availableICU < 5 ? '#E53E3E' : '#38A169'}; font-size: 10px;">(${availableICU} ICU)</span></div>`,
                    iconSize: [0, 0],
                    iconAnchor: [0, 0],
                });

                L.marker([hospital.location.lat, hospital.location.lng], { icon: hospitalIcon })
                    .addTo(map)
                    .bindPopup(`
                        <div style="font-family: system-ui; min-width: 200px;">
                            <h3 style="margin: 0 0 8px; font-size: 14px; color: #0E4D45;">${hospital.name}</h3>
                            <p style="margin: 0 0 4px; font-size: 11px; color: #718096;">${hospital.location.address}</p>
                            <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 8px 0;">
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 11px;">
                                <div><strong>ICU:</strong> ${availableICU} free</div>
                                <div><strong>ER:</strong> ${hospital.capacity.emergency.total - hospital.capacity.emergency.occupied} free</div>
                                <div><strong>Doctors:</strong> ${hospital.resources_available.doctors}</div>
                                <div><strong>Ambulances:</strong> ${hospital.resources_available.ambulances}</div>
                            </div>
                        </div>
                    `);
            });

            mapInstanceRef.current = map;
            setMapReady(true);

            // Safe ResizeObserver
            if (typeof ResizeObserver !== 'undefined' && mapRef.current) {
                const observer = new ResizeObserver(() => {
                    try {
                        if (mapInstanceRef.current && (mapInstanceRef.current as any)._container) {
                            mapInstanceRef.current.invalidateSize();
                        }
                    } catch (e) {
                        // Safe catch during unmount
                    }
                });
                observer.observe(mapRef.current);
                observerRef.current = observer;
            }
        });

        return () => {
            if (observerRef.current) {
                observerRef.current.disconnect();
                observerRef.current = null;
            }
            if (mapInstanceRef.current) {
                try {
                    mapInstanceRef.current.remove();
                } catch (e) {
                    // Safe cleanup catch
                }
                mapInstanceRef.current = null;
            }
        };
    }, []);

    // Update patient markers when patients change
    useEffect(() => {
        if (!mapReady || !mapInstanceRef.current) return;

        import('leaflet').then((L) => {
            const map = mapInstanceRef.current;

            // Clear old patient markers
            markersRef.current.forEach(m => map.removeLayer(m));
            markersRef.current = [];

            // Add patient markers
            patients.forEach((patient) => {
                if (patient.gps.lat === 0 && patient.gps.lng === 0) return; // Skip mock GPS

                const statusConfig = {
                    RED: { color: '#E53E3E', pulse: 'animation: pulse 1s infinite;', label: 'CRITICAL' },
                    YELLOW: { color: '#D69E2E', pulse: 'animation: pulse 2s infinite;', label: 'URGENT' },
                    GREEN: { color: '#38A169', pulse: '', label: 'STABLE' },
                };
                const config = statusConfig[patient.triageStatus];

                const icon = L.divIcon({
                    className: 'custom-patient-marker',
                    html: `<div style="
                        position: relative;
                        width: 28px;
                        height: 28px;
                    ">
                        <div style="
                            position: absolute;
                            inset: 0;
                            background: ${config.color};
                            border-radius: 50%;
                            opacity: 0.3;
                            ${config.pulse}
                        "></div>
                        <div style="
                            position: absolute;
                            inset: 4px;
                            background: ${config.color};
                            border: 2px solid white;
                            border-radius: 50%;
                            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                        "></div>
                    </div>
                    <style>
                        @keyframes pulse {
                            0%, 100% { transform: scale(1); opacity: 0.3; }
                            50% { transform: scale(1.5); opacity: 0.1; }
                        }
                    </style>`,
                    iconSize: [28, 28],
                    iconAnchor: [14, 14],
                });

                const marker = L.marker([patient.gps.lat, patient.gps.lng], { icon })
                    .addTo(map)
                    .bindPopup(`
                        <div style="font-family: system-ui; min-width: 180px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                                <span style="font-weight: bold; color: #0E4D45;">Patient #${patient.id.slice(0, 6)}</span>
                                <span style="
                                    background: ${config.color}20;
                                    color: ${config.color};
                                    padding: 2px 8px;
                                    border-radius: 8px;
                                    font-size: 10px;
                                    font-weight: bold;
                                ">${config.label}</span>
                            </div>
                            <div style="font-size: 12px; color: #718096;">
                                <div>SpO2: <strong>${patient.vitals.spo2}%</strong> | HR: <strong>${patient.vitals.heartRate}</strong></div>
                                <div style="margin-top: 2px;">${patient.vitals.injuryType || 'Unspecified injury'}</div>
                                <div style="margin-top: 4px; font-size: 10px; color: #A0AEC0;">
                                    ${new Date(patient.timestamp).toLocaleTimeString()}
                                </div>
                            </div>
                        </div>
                    `);

                markersRef.current.push(marker);
            });

            // Fit bounds to show all markers if we have patients with real GPS
            const validPatients = patients.filter(p => p.gps.lat !== 0);
            if (validPatients.length > 0) {
                const bounds = L.latLngBounds(
                    validPatients.map(p => [p.gps.lat, p.gps.lng] as [number, number])
                );
                // Include hospitals
                HOSPITALS.forEach(h => bounds.extend([h.location.lat, h.location.lng]));
                map.fitBounds(bounds.pad(0.3));
            }
        });
    }, [patients, mapReady]);

    return (
        <div className={`relative rounded-2xl overflow-hidden ${className}`}>
            <div ref={mapRef} className="w-full h-full min-h-[350px]" />
            {!mapReady && (
                <div className="absolute inset-0 bg-bg-page flex items-center justify-center">
                    <div className="text-center">
                        <div className="w-10 h-10 border-3 border-teal-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                        <p className="text-sm text-txt-muted">Loading map...</p>
                    </div>
                </div>
            )}
            {/* Legend overlay */}
            <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur rounded-lg px-3 py-2 shadow-lg z-[1000] flex items-center gap-3 text-[10px] font-bold">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-status-red" /> Critical</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-status-yellow" /> Urgent</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-status-green" /> Stable</span>
                <span className="flex items-center gap-1">🏥 Hospital</span>
            </div>
        </div>
    );
}
