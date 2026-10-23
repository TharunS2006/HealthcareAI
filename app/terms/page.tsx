import type { Metadata } from 'next';
import PolicyPage from '@/components/gov/PolicyPage';

export const metadata: Metadata = {
    title: 'Terms of Use | NalamMesh',
    description: 'Terms of Use — Department of Public Health, Government of Maharashtra.',
};

export default function Page() {
    return <PolicyPage slug="terms" />;
}
