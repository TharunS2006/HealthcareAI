/**
 * /dashboard/[id] — Prerendered patient record pages.
 *
 * `output: 'export'` means ONLY the ids returned below get an HTML file. Patients
 * created at runtime must use /record?id=<patientId>, which is statically exportable
 * and works for any id. These entries exist so seeded demo deep links keep working.
 */

import { Suspense } from 'react';
import PatientDetailClient from '@/components/dashboard/PatientDetailClient';
import { SEED_PATIENTS } from '@/lib/data/facilities';

export function generateStaticParams() {
    return [{ id: 'demo' }, ...SEED_PATIENTS.map((p) => ({ id: p.id }))];
}

export default function PatientDetailPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-[60vh] flex items-center justify-center">
                    <div className="w-16 h-16 border-4 border-teal-accent border-t-transparent rounded-full animate-spin" />
                </div>
            }
        >
            <PatientDetailClient />
        </Suspense>
    );
}
