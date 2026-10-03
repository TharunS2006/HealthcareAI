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
    return buildSmsUri(recipientNumber, compressPatientData(patient));
}

/**
 * Builds an `sms:` URI. iOS wants `&body=`, Android/others want `?body=`.
 */
export function buildSmsUri(recipientNumber: string, message: string): string {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : '';
    const isApple = ua.indexOf('iphone') > -1 || ua.indexOf('ipad') > -1;
    const separator = isApple ? '&' : '?';
    const cleanNumber = recipientNumber.replace(/[^\d+]/g, '');

    return `sms:${cleanNumber}${separator}body=${encodeURIComponent(message)}`;
}

/**
 * Hands the message off to the device's native SMS application.
 *
 * This is the genuine 2G / zero-data fallback: it works with no internet at all
 * because the carrier SMS channel is used, not an HTTP gateway. Returns false when
 * no SMS handler is available (e.g. desktop browsers), so callers can degrade.
 */
export function openSmsComposer(recipientNumber: string, message: string): boolean {
    if (typeof window === 'undefined') return false;

    const canSendSms = /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
    if (!canSendSms) return false;

    window.location.href = buildSmsUri(recipientNumber, message);
    return true;
}
