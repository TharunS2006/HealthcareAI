import type { Metadata } from 'next';
import PolicyPage from '@/components/gov/PolicyPage';

export const metadata: Metadata = {
    title: 'Grievance Redressal | NalamMesh',
    description: 'Grievance Redressal — Department of Public Health, Government of Maharashtra.',
};

export default function Page() {
    return <PolicyPage slug="feedback" />;
}
