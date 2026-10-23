/**
 * /record?id=<patientId> — Longitudinal Health Record (LHR)
 *
 * Why a query parameter instead of /dashboard/<id>:
 * next.config.js uses `output: 'export'`, so dynamic segments can only be served for
 * ids enumerated in generateStaticParams() at build time. Patients registered at
 * runtime (the actual demo flow) have no prerendered page and would 404 on refresh
 * or deep-link. A single static /record page with ?id= works for every patient.
 */

import { Suspense } from 'react';
import PatientDetailClient from '@/components/dashboard/PatientDetailClient';

export const metadata = {
    title: 'Longitudinal Health Record | NalamMesh',
    description: 'Patient longitudinal health record, vitals, referral journey and ABDM/FHIR R4 bundle.',
};

function RecordFallback() {
    return (
        <div className="min-h-[60vh] flex items-center justify-center">
            <div className="text-center space-y-4">
                <div className="w-16 h-16 border-4 border-teal-accent border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-txt-secondary text-sm">Loading patient record…</p>
            </div>
        </div>
    );
}

export default function RecordPage() {
    return (
        <Suspense fallback={<RecordFallback />}>
            <PatientDetailClient />
        </Suspense>
    );
}
