/**
 * Live Demo Mode Controller
 * Auto-generates simulated patient flow (RED, YELLOW, GREEN) every 8 seconds
 * Triggers live socket sync, real-time map updates, and audio alerts for RED patients
 */

import { v4 as uuidv4 } from 'uuid';
import { Patient, TriageStatus } from '@/types/patient';
import { usePatientStore } from '@/stores/patientStore';
import toast from 'react-hot-toast';

let demoInterval: NodeJS.Timeout | null = null;

const DEMO_PRESETS = [
    {
        triageStatus: 'RED' as TriageStatus,
        vitals: { spo2: 84, heartRate: 142, bloodPressure: { systolic: 82, diastolic: 54 }, consciousness: 'UNRESPONSIVE' as const, injuryType: 'Severe Chest Trauma & Hypoxia' },
        gpsOffset: { lat: 0.012, lng: -0.008 },
    },
    {
        triageStatus: 'YELLOW' as TriageStatus,
        vitals: { spo2: 92, heartRate: 114, bloodPressure: { systolic: 110, diastolic: 72 }, consciousness: 'VOICE' as const, injuryType: 'Fractured Femur & Moderate Bleeding' },
        gpsOffset: { lat: -0.015, lng: 0.018 },
    },
    {
        triageStatus: 'GREEN' as TriageStatus,
        vitals: { spo2: 98, heartRate: 76, bloodPressure: { systolic: 120, diastolic: 80 }, consciousness: 'ALERT' as const, injuryType: 'Minor Lacerations & Abrasions' },
        gpsOffset: { lat: 0.008, lng: 0.022 },
    },
    {
        triageStatus: 'RED' as TriageStatus,
        vitals: { spo2: 81, heartRate: 158, bloodPressure: { systolic: 190, diastolic: 115 }, consciousness: 'PAIN' as const, injuryType: 'Acute Cardiac Event' },
        gpsOffset: { lat: -0.006, lng: -0.014 },
    },
];

let presetIndex = 0;

export function startDemoMode(onPatientGenerated?: (p: Patient) => void) {
    if (demoInterval) return;

    toast('⚡ Live Demo Mode Activated! Auto-generating patient stream...', {
        icon: '🚀',
        duration: 4000,
        style: { background: '#0E4D45', color: '#fff', fontWeight: 'bold' },
    });

    // Helper to generate next patient
    const generatePatient = async () => {
        const preset = DEMO_PRESETS[presetIndex % DEMO_PRESETS.length];
        presetIndex++;

        // Base location: Chennai center
        const baseLat = 13.0827;
        const baseLng = 80.2707;

        const patient: Patient = {
            id: uuidv4(),
            vitals: preset.vitals,
            triageStatus: preset.triageStatus,
            gps: {
                lat: baseLat + preset.gpsOffset.lat + (Math.random() * 0.004 - 0.002),
                lng: baseLng + preset.gpsOffset.lng + (Math.random() * 0.004 - 0.002),
                accuracy: 12,
            },
            timestamp: new Date(),
            isSynced: false,
        };

        // Add to Zustand patient store & IDB
        await usePatientStore.getState().addPatient(patient);

        if (onPatientGenerated) onPatientGenerated(patient);

        // Sound alert for RED patients
        if (patient.triageStatus === 'RED') {
            toast.error(`🚨 EMERGENCY ALERT: RED Patient #${patient.id.slice(0, 6)} (${patient.vitals.injuryType})`, {
                duration: 5000,
            });
            try {
                const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1bW2NtdH+MmJmNfnF0e4eLjId+d3N1fIaRlpKIe3R0eYOOk5KNhXl0dXuFj5STjoJ4dHZ8hpCUk42BeHR2fIaQlJONgXh0dnyGkJSTjYF4dHZ8hpCUk42BeHR2fIaQlJON');
                audio.volume = 0.4;
                audio.play().catch(() => {});
            } catch {}
        } else {
            toast.success(`⚡ Live Demo: New ${patient.triageStatus} patient triaged`, {
                duration: 3000,
            });
        }
    };

    // Immediately trigger first patient
    generatePatient();

    // Repeat every 8 seconds
    demoInterval = setInterval(generatePatient, 8000);
}

export function stopDemoMode() {
    if (demoInterval) {
        clearInterval(demoInterval);
        demoInterval = null;
        toast('Demo Mode Stopped', { icon: '⏹️' });
    }
}

export function isDemoRunning(): boolean {
    return demoInterval !== null;
}
