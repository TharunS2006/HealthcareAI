import type { Metadata } from 'next';
import PolicyPage from '@/components/gov/PolicyPage';

export const metadata: Metadata = {
    title: 'Hyperlinking Policy | NalamMesh',
    description: 'Hyperlinking Policy — Department of Public Health, Government of Maharashtra.',
};

export default function Page() {
    return <PolicyPage slug="hyperlinking" />;
}
