/**
 * Real-world Hospital Data & Triage Logic
 * Covers: Apollo Greams Road, Rajiv Gandhi GH, Stanley Medical College
 */

export interface Hospital {
    id: string;
    name: string;
    type: 'GOVT' | 'PRIVATE';
    location: { lat: number; lng: number; address: string };
    contact: string;
    capacity: {
        total: number;
        icu: { total: number; occupied: number };
        emergency: { total: number; occupied: number };
        general: { total: number; occupied: number };
    };
    specialties: string[];
    resources: string[]; // e.g., "Ventilator", "Burn Unit"
    resources_available: {
        doctors: number;
        nurses: number;
        ambulances: number;
        oxygen_cylinders: number;
        blood_units: number;
    };
}

export const HOSPITALS: Hospital[] = [
    {
        id: 'apollo-greams',
        name: 'Apollo Hospital (Greams Road)',
        type: 'PRIVATE',
        location: {
            lat: 13.0629,
            lng: 80.2565,
            address: '21, Greams Lane, Off Greams Road, Chennai',
        },
        contact: '+91-44-2829-3333',
        capacity: {
            total: 560,
            icu: { total: 45, occupied: 42 }, // Critical: <3 beds
            emergency: { total: 30, occupied: 25 },
            general: { total: 485, occupied: 400 },
        },
        specialties: ['Cardiology', 'Neurology', 'Trauma', 'Critical Care'],
        resources: ['Ecmo', 'Cath Lab', 'Stroke Unit', 'Helipad'],
        resources_available: {
            doctors: 45,
            nurses: 120,
            ambulances: 8,
            oxygen_cylinders: 150,
            blood_units: 320,
        },
    },
    {
        id: 'rajiv-gandhi-gh',
        name: 'Rajiv Gandhi Govt General Hospital',
        type: 'GOVT',
        location: {
            lat: 13.0827,
            lng: 80.2754,
            address: 'E.V.R Periyar Salai, Park Town, Chennai',
        },
        contact: '+91-44-2530-5000',
        capacity: {
            total: 2500,
            icu: { total: 120, occupied: 110 },
            emergency: { total: 100, occupied: 85 },
            general: { total: 2280, occupied: 2100 },
        },
        specialties: ['General Medicine', 'Polytrauma', 'Toxicology', 'Burns'],
        resources: ['Burn Unit', 'Dialysis', 'Poison Control', 'Blood Bank'],
        resources_available: {
            doctors: 120,
            nurses: 350,
            ambulances: 15,
            oxygen_cylinders: 500,
            blood_units: 800,
        },
    },
    {
        id: 'stanley-medical',
        name: 'Stanley Medical College Hospital',
        type: 'GOVT',
        location: {
            lat: 13.1075,
            lng: 80.2878,
            address: 'Old Jail Rd, George Town, Chennai',
        },
        contact: '+91-44-2528-1347',
        capacity: {
            total: 1800,
            icu: { total: 80, occupied: 65 },
            emergency: { total: 60, occupied: 40 },
            general: { total: 1660, occupied: 1500 },
        },
        specialties: ['Hand Surgery', 'Plastic Surgery', 'Gastroenterology'],
        resources: ['Hand Transplant Unit', 'Pediatric ICU', 'Lithotripsy'],
        resources_available: {
            doctors: 90,
            nurses: 280,
            ambulances: 10,
            oxygen_cylinders: 300,
            blood_units: 450,
        },
    },
];

/**
 * Recommends the best hospital based on patient status and availability
 */
export function getRecommendedHospital(
    triageStatus: 'RED' | 'YELLOW' | 'GREEN',
    requiredResources?: string[]
): Hospital {
    // 1. For RED status, prioritize closest ICU availability (Simple logic: prioritize Apollo if ICU space exists, else RGGH)
    if (triageStatus === 'RED') {
        const availableICU = HOSPITALS.filter(
            (h) => h.capacity.icu.total - h.capacity.icu.occupied > 0
        );
        // Sort by 'distance' (mock: just return the first available private, then govt)
        return availableICU.find((h) => h.type === 'PRIVATE') || availableICU[0] || HOSPITALS[0];
    }

    // 2. For YELLOW/GREEN, prioritize Govt hospitals to save costs if resources match
    return HOSPITALS.find((h) => h.type === 'GOVT') || HOSPITALS[0];
}

/**
 * Returns a checklist of medicines/equipment based on injury type
 */
export function getResourceChecklist(injuryType: string): string[] {
    const lowerInjury = injuryType.toLowerCase();

    if (lowerInjury.includes('chest') || lowerInjury.includes('breath')) {
        return [
            'Epinephrine 1mg IV',
            'Chest Tube Kit (28-32 Fr)',
            'Portable Suction',
            'Oxygen (Non-rebreather mask)',
        ];
    }

    if (lowerInjury.includes('bleed') || lowerInjury.includes('hemorrhage') || lowerInjury.includes('cut')) {
        return [
            'Tourniquet / Pressure Bandage',
            'Tranexamic Acid (TXA) 1g',
            'IV Fluids (Warm Lactated Ringer\'s)',
            'Gauze Packs',
        ];
    }

    if (lowerInjury.includes('burn') || lowerInjury.includes('fire')) {
        return [
            'Cool Saline Irrigation',
            'Silver Sulfadiazine Cream',
            'IV Fluids (Parkland Formula)',
            'Clean Sterile Sheets',
        ];
    }

    if (lowerInjury.includes('head') || lowerInjury.includes('concussion') || lowerInjury.includes('unconscious')) {
        return [
            'C-Collar & Spine Board',
            'Hypertonic Saline (if herniation signs)',
            'Intubation Kit (RSI capable)',
            'Pupil Torch',
        ];
    }

    if (lowerInjury.includes('shock') || lowerInjury.includes('low bp')) {
        return [
            'Large Bore IV Access (14G/16G)',
            'Norepinephrine Drip',
            'Warm Fluids',
            'Blankets',
        ];
    }

    // Default Critical Care Kit
    return [
        'IV Access Kit',
        'Normal Saline 500ml',
        'Monitor (SpO2/ECG/BP)',
        'Analgesics (Morphine/Fentanyl if stable)',
    ];
}
