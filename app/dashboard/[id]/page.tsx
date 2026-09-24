import { Suspense } from 'react';
import PatientDetailClient from '@/components/dashboard/PatientDetailClient';

export function generateStaticParams() {
    return [{ id: 'demo' }];
}

export default function PatientDetailPage() {
    return (
        <Suspense fallback={null}>
            <PatientDetailClient />
        </Suspense>
    );
}
