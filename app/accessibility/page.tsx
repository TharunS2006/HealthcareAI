import type { Metadata } from 'next';
import PolicyPage from '@/components/gov/PolicyPage';

export const metadata: Metadata = {
    title: 'Accessibility Statement | NalamMesh',
    description: 'Accessibility Statement — Department of Public Health, Government of Maharashtra.',
};

export default function Page() {
    return <PolicyPage slug="accessibility" />;
}
