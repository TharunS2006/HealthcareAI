/**
 * Live Demo Mode Controller — NalamMesh (Maharashtra Rural Public Health)
 * Auto-generates simulated patient flow (RED, YELLOW, GREEN) in Gadchiroli
 * Triggers live socket sync, real-time map updates, and audio alerts for RED patients
 */

import { v4 as uuidv4 } from 'uuid';
import { Patient, TriageStatus, TriagePriority } from '@/types/patient';
import { usePatientStore } from '@/stores/patientStore';
import toast from 'react-hot-toast';

let demoInterval: NodeJS.Timeout | null = null;

const DEMO_PRESETS = [
    {
        name: 'Savita Rama Madavi',
        age: 24,
        gender: 'F' as const,
        village: 'Kothi',
        triageStatus: 'RED' as TriageStatus,
        triagePriority: 'EMERGENCY' as TriagePriority,
        vitals: {
            spo2: 92,
            heartRate: 118,
            bloodPressure: { systolic: 165, diastolic: 108 },
            temperature: 99.4,
            consciousness: 'ALERT' as const,
            isPregnant: true,
            gestationalWeeks: 34,
            injuryType: 'High-Risk Maternal: Severe Eclampsia with Hyperreflexia & Visual Blurring',
        },
        gpsOffset: { lat: 0.012, lng: -0.008 },
    },
    {
        name: 'Bandu Soma Atram',
        age: 48,
        gender: 'M' as const,
        village: 'Govindpur',
        triageStatus: 'YELLOW' as TriageStatus,
        triagePriority: 'URGENT' as TriagePriority,
        vitals: {
            spo2: 95,
            heartRate: 92,
            bloodPressure: { systolic: 146, diastolic: 92 },
            bloodGlucose: 240,
            temperature: 101.2,
            consciousness: 'ALERT' as const,
            injuryType: 'Sickle Cell Anemia Crisis with Joint Pain & Fever (RDT Positive)',
        },
        gpsOffset: { lat: -0.015, lng: 0.018 },
    },
    {
        name: 'Baby Anaya (s/o Radha)',
        age: 2,
        gender: 'F' as const,
        village: 'Perimili',
        triageStatus: 'RED' as TriageStatus,
        triagePriority: 'EMERGENCY' as TriagePriority,
        vitals: {
            spo2: 89,
            heartRate: 145,
            bloodPressure: { systolic: 80, diastolic: 50 },
            respiratoryRate: 52,
            temperature: 103.0,
            consciousness: 'ALERT' as const,
            childAgeMonths: 24,
            injuryType: 'Severe Acute Malnutrition (SAM) with Pneumonia & Chest Indrawing',
        },
        gpsOffset: { lat: -0.006, lng: -0.014 },
    },
    {
        name: 'Ganesh Devrao Gawde',
        age: 38,
        gender: 'M' as const,
        village: 'Bhamragad',
        triageStatus: 'GREEN' as TriageStatus,
        triagePriority: 'ROUTINE' as TriagePriority,
        vitals: {
            spo2: 98,
            heartRate: 74,
            bloodPressure: { systolic: 120, diastolic: 80 },
            temperature: 98.6,
            consciousness: 'ALERT' as const,
            injuryType: 'Routine NCD Screening: Blood Pressure & Sugar Normal',
        },
        gpsOffset: { lat: 0.008, lng: 0.022 },
    },
];

let presetIndex = 0;

export function startDemoMode(onPatientGenerated?: (p: Patient) => void) {
    if (demoInterval) return;

    toast('Maharashtra Rural Public Health Live Demo Mode Activated', {
        duration: 4000,
        style: { background: '#0E7D6B', color: '#fff', fontWeight: 'bold' },
    });

    const generatePatient = async () => {
        const preset = DEMO_PRESETS[presetIndex % DEMO_PRESETS.length];
        presetIndex++;

        // Base location: Gadchiroli, Maharashtra
        const baseLat = 19.4678;
        const baseLng = 80.3789;

        const patient: Patient = {
            id: `p-demo-${uuidv4().slice(0, 6)}`,
            abhaId: `ABHA-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`,
            name: preset.name,
            age: preset.age,
            gender: preset.gender,
            village: preset.village,
            tehsil: 'Bhamragad',
            district: 'Gadchiroli',
            state: 'Maharashtra',
            vitals: preset.vitals,
            triageStatus: preset.triageStatus,
            triagePriority: preset.triagePriority,
            gps: {
                lat: baseLat + preset.gpsOffset.lat + (Math.random() * 0.004 - 0.002),
                lng: baseLng + preset.gpsOffset.lng + (Math.random() * 0.004 - 0.002),
                accuracy: 10,
            },
            timestamp: new Date().toISOString(),
            isSynced: true,
            chw_name: 'Lakshmi Netam (ASHA)',
            notes: 'Auto-generated via NalamMesh Maharashtra Demonstration Engine',
        };

        await usePatientStore.getState().addPatient(patient);

        if (onPatientGenerated) onPatientGenerated(patient);

        if (patient.triageStatus === 'RED') {
            toast.error(`EMERGENCY: ${patient.name} (${patient.vitals.injuryType})`, {
                duration: 5000,
            });
        } else {
            toast.success(`Live Demo: New ${patient.triageStatus} patient triaged at ${patient.village}`, {
                duration: 3000,
            });
        }
    };

    generatePatient();
    demoInterval = setInterval(generatePatient, 10000);
}

export function stopDemoMode() {
    if (demoInterval) {
        clearInterval(demoInterval);
        demoInterval = null;
        toast('Demo Mode Stopped');
    }
}

export function isDemoRunning(): boolean {
    return demoInterval !== null;
}
