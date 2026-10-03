import type { Metadata } from 'next';
import PolicyPage from '@/components/gov/PolicyPage';

export const metadata: Metadata = {
    title: 'Right to Information (RTI 2005) | NalamMesh',
    description: 'Right to Information (RTI 2005) — Department of Public Health, Government of Maharashtra.',
};

export default function Page() {
    return <PolicyPage slug="rti" />;
}
