/**
 * Patient detail route for the static export / native apps.
 * Uses `/patient?id=<uuid>` because `output: 'export'` can only pre-render
 * known dynamic segments, so `/dashboard/<uuid>` would 404 in the build.
 */

import { Suspense } from 'react';
import PatientDetailClient from '@/components/dashboard/PatientDetailClient';

export default function PatientPage() {
    return (
        <Suspense fallback={null}>
            <PatientDetailClient />
        </Suspense>
    );
}
