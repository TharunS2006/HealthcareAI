/**
 * Legacy compatibility adapter redirecting to Maharashtra Rural Healthcare Facilities
 * @module lib/data/hospitals
 */

export * from './facilities';
export { MAHARASHTRA_FACILITIES as HOSPITALS } from './facilities';
export { getRecommendedFacility as getRecommendedHospital } from './facilities';

export function getResourceChecklist(injuryType: string): string[] {
    const lower = (injuryType || '').toLowerCase();
    if (lower.includes('pregnan') || lower.includes('matern') || lower.includes('labor') || lower.includes('eclampsia')) {
        return [
            '102 Janani Shishu Express Ambulance',
            'Inj Magnesium Sulfate 50% (4g IV / 10g IM)',
            'Tab Labetalol 100mg / Nifedipine 10mg',
            'Fetal Doppler / Stethoscope',
            'Suction & Oxygen Non-rebreather Mask'
        ];
    }
    if (lower.includes('child') || lower.includes('malnutrit') || lower.includes('fever') || lower.includes('pneumonia')) {
        return [
            '108 Advanced Life Support Ambulance',
            'Pediatric Oxygen Mask & Nebulizer',
            'Syp Amoxicillin / Inj Ceftriaxone',
            'F-75 / F-100 Starter Feeds & ORS',
            'Radiant Heat Warmer / Blanket'
        ];
    }
    if (lower.includes('diabet') || lower.includes('ulcer') || lower.includes('sugar')) {
        return [
            'Sterile Dressing & Debridement Kit',
            'Regular Insulin Vial / Syringes',
            'Blood Glucose Strips & Lancets',
            'Oral Broad Spectrum Antibiotics (Amox-Clav)'
        ];
    }
    if (lower.includes('tb') || lower.includes('cough') || lower.includes('sputum')) {
        return [
            'Sputum Collection Vials (Triple Packed)',
            'GeneXpert / CBNAAT Requisition Form',
            'N95 Masks & Sputum Disinfectant',
            'Nikshay Direct Benefit Transfer Portal Entry'
        ];
    }
    return [
        'Basic Emergency Primary Kit',
        'Normal Saline / Ringer Lactate 500ml',
        'Digital BP Monitor & Pulse Oximeter',
        'Paracetamol 500mg & ORS Sachet'
    ];
}
