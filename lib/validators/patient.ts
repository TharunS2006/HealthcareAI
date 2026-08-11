/**
 * Input validation schemas using Zod
 * @module validators/patient
 */

import { z } from 'zod';

/**
 * Vitals validation schema
 */
export const VitalsSchema = z.object({
    spo2: z.number()
        .min(0, 'SpO2 cannot be negative')
        .max(100, 'SpO2 cannot exceed 100%')
        .int('SpO2 must be a whole number'),

    heartRate: z.number()
        .min(20, 'Heart rate too low (minimum 20 BPM)')
        .max(250, 'Heart rate too high (maximum 250 BPM)')
        .int('Heart rate must be a whole number'),

    injuryType: z.string()
        .min(3, 'Injury description must be at least 3 characters')
        .max(500, 'Injury description too long')
        .trim(),



    bloodPressure: z.object({
        systolic: z.number()
            .min(50, 'Systolic pressure too low')
            .max(250, 'Systolic pressure too high')
            .int(),
        diastolic: z.number()
            .min(30, 'Diastolic pressure too low')
            .max(150, 'Diastolic pressure too high')
            .int(),
    }).optional(),
}).strict();

/**
 * GPS location validation schema
 */
export const GPSLocationSchema = z.object({
    lat: z.number()
        .min(-90, 'Invalid latitude')
        .max(90, 'Invalid latitude'),

    lng: z.number()
        .min(-180, 'Invalid longitude')
        .max(180, 'Invalid longitude'),

    accuracy: z.number()
        .min(0)
        .optional(),
}).strict();

/**
 * Patient validation schema
 */
export const PatientSchema = z.object({
    id: z.string().uuid('Invalid patient ID'),

    abhaId: z.string()
        .regex(/^\d{2}-\d{4}-\d{4}-\d{4}$/, 'Invalid ABHA ID format')
        .optional(),

    vitals: VitalsSchema,

    triageStatus: z.enum(['RED', 'YELLOW', 'GREEN'] as const, {
        message: 'Invalid triage status',
    }),

    gps: GPSLocationSchema,

    isSynced: z.boolean(),

    timestamp: z.date(),

    chw_id: z.string().optional(),

    notes: z.string()
        .max(1000, 'Notes too long')
        .optional(),

    arScanUrl: z.string().url('Invalid AR scan URL').optional(),
}).strict();

/**
 * Type inference from schemas
 */
export type ValidatedVitals = z.infer<typeof VitalsSchema>;
export type ValidatedGPSLocation = z.infer<typeof GPSLocationSchema>;
export type ValidatedPatient = z.infer<typeof PatientSchema>;

/**
 * Validate vitals with detailed error messages
 */
export function validateVitals(data: unknown): ValidatedVitals {
    return VitalsSchema.parse(data);
}

/**
 * Validate patient with detailed error messages
 */
export function validatePatient(data: unknown): ValidatedPatient {
    return PatientSchema.parse(data);
}

/**
 * Safe validation that returns errors instead of throwing
 */
export function safeValidateVitals(data: unknown): {
    success: boolean;
    data?: ValidatedVitals;
    errors?: Record<string, string>;
} {
    const result = VitalsSchema.safeParse(data);

    if (result.success) {
        return { success: true, data: result.data };
    }

    const errors: Record<string, string> = {};
    result.error.issues.forEach(err => {
        const path = err.path.join('.');
        errors[path] = err.message;
    });

    return { success: false, errors };
}
