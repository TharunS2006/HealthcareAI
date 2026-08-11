/**
 * SMS Fallback Logic
 * Compresses vital patient data into a <160 char string for SMS transmission
 */

import { Patient } from '@/types/patient';

/**
 * Compresses patient data into a short code string
 * Format: [PRIORITY]-[LOC]-[VITALS]-[INJURY]
 * Example: RED-13.06,80.25-92,120,80/60,A-ChestTrauma
 */
export function compressPatientData(patient: Patient): string {
    const statusShort = patient.triageStatus;
    const locShort = `${patient.gps.lat.toFixed(2)},${patient.gps.lng.toFixed(2)}`;

    // Vitals: SpO2, Pulse, BP (Sys/Dia), AVPU
    const bp = patient.vitals.bloodPressure
        ? `${patient.vitals.bloodPressure.systolic}/${patient.vitals.bloodPressure.diastolic}`
        : 'N/A';

    const vitalsShort = `${patient.vitals.spo2},${patient.vitals.heartRate},${bp},${patient.vitals.consciousness?.charAt(0) || 'U'}`;

    // Injury: truncate to 15 chars, remove spaces
    const injuryShort = patient.vitals.injuryType
        .replace(/\s+/g, '')
        .substring(0, 15);

    return `NALAM:${statusShort}-${locShort}-${vitalsShort}-${injuryShort}`;
}

/**
 * Generates the SMS link for mobile devices
 */
export function generateSMSLink(patient: Patient, recipientNumber: string = '1234567890'): string {
    const message = compressPatientData(patient);
    // iOS and Android handle body separator differently sometimes, strictly using ?body=
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : '';
    const separator = ua.indexOf('iphone') > -1 || ua.indexOf('ipad') > -1 ? '&' : '?';

    return `sms:${recipientNumber}${separator}body=${encodeURIComponent(message)}`;
}
