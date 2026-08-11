/**
 * ABDM / FHIR R4 Health Record Generator
 * Converts NalamMesh Patient records into standard Ayushman Bharat / FHIR R4 JSON Bundles
 */

import { Patient } from '@/types/patient';

export interface FHIRBundle {
    resourceType: 'Bundle';
    id: string;
    meta: {
        lastUpdated: string;
        profile: string[];
    };
    type: 'collection';
    timestamp: string;
    entry: Array<{
        fullUrl: string;
        resource: Record<string, any>;
    }>;
}

/**
 * Generate a compliant FHIR R4 Resource Bundle for India ABDM integration
 */
export function generateFHIRBundle(patient: Patient): FHIRBundle {
    const patientUrl = `urn:uuid:${patient.id}`;
    const timestamp = new Date(patient.timestamp).toISOString();

    const bundle: FHIRBundle = {
        resourceType: 'Bundle',
        id: `abdm-bundle-${patient.id.slice(0, 8)}`,
        meta: {
            lastUpdated: timestamp,
            profile: ['https://nrces.in/ndhm/fhir/r4/StructureDefinition/DocumentBundle'],
        },
        type: 'collection',
        timestamp,
        entry: [
            // 1. Patient Demographics & ABDM Identity
            {
                fullUrl: patientUrl,
                resource: {
                    resourceType: 'Patient',
                    id: patient.id,
                    identifier: [
                        {
                            system: 'https://healthid.ndhm.gov.in',
                            value: `ABHA-${patient.id.slice(0, 4)}-${patient.id.slice(4, 8)}`,
                        },
                    ],
                    name: [
                        {
                            text: `Emergency Patient #${patient.id.slice(0, 6)}`,
                        },
                    ],
                    gender: 'unknown',
                    active: true,
                },
            },
            // 2. Encounter Resource (Field Triage Incident)
            {
                fullUrl: `urn:uuid:encounter-${patient.id}`,
                resource: {
                    resourceType: 'Encounter',
                    id: `encounter-${patient.id.slice(0, 8)}`,
                    status: 'in-progress',
                    class: {
                        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
                        code: 'EMER',
                        display: 'emergency',
                    },
                    subject: { reference: patientUrl },
                    period: { start: timestamp },
                    location: [
                        {
                            location: {
                                display: `GPS Coordinate [${patient.gps.lat.toFixed(4)}, ${patient.gps.lng.toFixed(4)}]`,
                            },
                        },
                    ],
                },
            },
            // 3. Observation: SpO2
            {
                fullUrl: `urn:uuid:obs-spo2-${patient.id}`,
                resource: {
                    resourceType: 'Observation',
                    id: `obs-spo2-${patient.id.slice(0, 8)}`,
                    status: 'final',
                    category: [
                        {
                            coding: [
                                {
                                    system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                                    code: 'vital-signs',
                                    display: 'Vital Signs',
                                },
                            ],
                        },
                    ],
                    code: {
                        coding: [
                            {
                                system: 'http://loinc.org',
                                code: '59408-5',
                                display: 'Oxygen saturation in Arterial blood by Pulse oximetry',
                            },
                        ],
                        text: 'SpO2',
                    },
                    subject: { reference: patientUrl },
                    effectiveDateTime: timestamp,
                    valueQuantity: {
                        value: patient.vitals.spo2,
                        unit: '%',
                        system: 'http://unitsofmeasure.org',
                        code: '%',
                    },
                },
            },
            // 4. Observation: Heart Rate
            {
                fullUrl: `urn:uuid:obs-hr-${patient.id}`,
                resource: {
                    resourceType: 'Observation',
                    id: `obs-hr-${patient.id.slice(0, 8)}`,
                    status: 'final',
                    category: [
                        {
                            coding: [
                                {
                                    system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                                    code: 'vital-signs',
                                    display: 'Vital Signs',
                                },
                            ],
                        },
                    ],
                    code: {
                        coding: [
                            {
                                system: 'http://loinc.org',
                                code: '8867-4',
                                display: 'Heart rate',
                            },
                        ],
                        text: 'Pulse Rate',
                    },
                    subject: { reference: patientUrl },
                    effectiveDateTime: timestamp,
                    valueQuantity: {
                        value: patient.vitals.heartRate,
                        unit: 'beats/min',
                        system: 'http://unitsofmeasure.org',
                        code: '/min',
                    },
                },
            },
            // 5. Condition: Triage Priority Status
            {
                fullUrl: `urn:uuid:cond-triage-${patient.id}`,
                resource: {
                    resourceType: 'Condition',
                    id: `cond-triage-${patient.id.slice(0, 8)}`,
                    clinicalStatus: {
                        coding: [
                            {
                                system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
                                code: 'active',
                            },
                        ],
                    },
                    verificationStatus: {
                        coding: [
                            {
                                system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
                                code: 'confirmed',
                            },
                        ],
                    },
                    severity: {
                        coding: [
                            {
                                system: 'http://snomed.info/sct',
                                code: patient.triageStatus === 'RED' ? '24484000' : patient.triageStatus === 'YELLOW' ? '6736007' : '255324004',
                                display: patient.triageStatus === 'RED' ? 'Severe / Critical' : patient.triageStatus === 'YELLOW' ? 'Moderate / Urgent' : 'Mild / Stable',
                            },
                        ],
                        text: `${patient.triageStatus} Triage Category`,
                    },
                    code: {
                        text: patient.vitals.injuryType || `Emergency Triage Category: ${patient.triageStatus}`,
                    },
                    subject: { reference: patientUrl },
                    recordedDate: timestamp,
                },
            },
        ],
    };

    return bundle;
}

/**
 * Trigger browser download of FHIR JSON Bundle file
 */
export function downloadFHIRRecord(patient: Patient): void {
    const bundle = generateFHIRBundle(patient);
    const jsonStr = JSON.stringify(bundle, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `abdm-fhir-record-${patient.id.slice(0, 8)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
