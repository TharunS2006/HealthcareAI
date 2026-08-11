import PatientDetailClient from '@/components/dashboard/PatientDetailClient';

export function generateStaticParams() {
    return [{ id: 'demo' }];
}

export default function PatientDetailPage() {
    return <PatientDetailClient />;
}
