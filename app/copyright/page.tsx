import type { Metadata } from 'next';
import PolicyPage from '@/components/gov/PolicyPage';

export const metadata: Metadata = {
    title: 'Copyright Policy | NalamMesh',
    description: 'Copyright Policy — Department of Public Health, Government of India.',
};

export default function Page() {
    return <PolicyPage slug="copyright" />;
}
