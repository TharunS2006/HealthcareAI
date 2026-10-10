/**
 * Citizen Authentication & Consent Portal — Module 0
 *
 * ABHA login is real: the ABDM sandbox texts an OTP to the mobile number linked
 * to the ABHA number and checks it (lib/abha/client.ts → server/relay/abha.ts).
 * Mobile OTP has no SMS gateway: it exists on evaluation builds only, labelled a
 * demo, and a production build offers ABHA alone.
 *
 * There used to be three consent checkboxes here, all ticked in advance and
 * stored nowhere. A pre-ticked box is not consent under the DPDP Act, and a
 * choice that is not recorded binds nobody, so they are replaced by a plain
 * notice of what this page does and does not do with the citizen's data. */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from '@/components/gov/Icon';
import toast from 'react-hot-toast';
import { requestAbhaOtp, verifyAbhaOtp } from '@/lib/abha/client';
import { PRODUCTION } from '@/lib/config/mode';

export default function LoginPage() {
    const router = useRouter();
    const [loginMethod, setLoginMethod] = useState<'PHONE_OTP' | 'ABHA'>('ABHA');
    const [phone, setPhone] = useState('');
    const [otpSent, setOtpSent] = useState(false);
    const [otp, setOtp] = useState('');
    const [abhaId, setAbhaId] = useState('');
    const [abhaTxn, setAbhaTxn] = useState<string | null>(null);
    const [abhaOtp, setAbhaOtp] = useState('');
    const [abhaNote, setAbhaNote] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
    const [busy, setBusy] = useState(false);

    const handleSendOTP = (e: React.FormEvent) => {
        e.preventDefault();
        if (phone.length < 10) {
            toast.error('Please enter a valid 10-digit mobile number');
            return;
        }
        setOtpSent(true);
        toast.success(`OTP 4821 sent to +91-${phone} (Mock Gateway)`, { icon: <Icon name="sms" className="w-4 h-4" /> });
    };

    const handleVerify = (e: React.FormEvent) => {
        e.preventDefault();
        toast.success('Signed in (demo) — mobile OTP is not verified in this build', { icon: <Icon name="check-circle" className="w-4 h-4" /> });
        router.push('/');
    };

    const sendAbhaOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        setAbhaNote(null);
        const answer = await requestAbhaOtp(abhaId);
        setBusy(false);
        if (!answer.ok) {
            setAbhaNote({ tone: 'error', text: answer.message });
            return;
        }
        setAbhaTxn(answer.value.txnId);
        setAbhaOtp('');
        setAbhaNote({ tone: 'info', text: answer.value.message });
    };

    const confirmAbhaOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!abhaTxn) return;
        setBusy(true);
        setAbhaNote(null);
        const answer = await verifyAbhaOtp(abhaTxn, abhaOtp);
        setBusy(false);
        if (!answer.ok) {
            setAbhaNote({ tone: 'error', text: answer.message });
            return;
        }
        toast.success(`ABHA verified — welcome, ${answer.value.name} (${answer.value.abhaNumber})`, { icon: <Icon name="check-circle" className="w-4 h-4" />, duration: 6000 });
        router.push('/');
    };

    return (
        <div className="max-w-md mx-auto px-4 py-12">
            <div className="surface-card p-6 sm:p-8 space-y-6">
                <div className="text-center">
                    <div className="w-12 h-12 bg-gov-navy text-white rounded flex items-center justify-center mx-auto mb-3">
                        <Icon name="government" className="w-6 h-6" />
                    </div>
                    <h1 className="text-xl font-bold text-gov-navy">Citizen Health Login</h1>
                    <p className="text-xs text-txt-secondary mt-1">
                        Ayushman Bharat Digital Mission (ABDM) • Ministry of Health & Family Welfare
                    </p>
                </div>

                {/* Login Method Tabs — the mobile OTP demo only on evaluation builds */}
                {!PRODUCTION && (
                <div className="flex border-b border-border-subtle text-xs font-bold">
                    <button
                        type="button"
                        onClick={() => { setLoginMethod('PHONE_OTP'); setOtpSent(false); }}
                        className={`flex-1 py-2 text-center border-b-2 transition-colors ${
                            loginMethod === 'PHONE_OTP'
                                ? 'border-gov-navy text-gov-navy'
                                : 'border-transparent text-txt-secondary hover:text-gov-navy'
                        }`}
                    >
                        Mobile OTP (demo)
                    </button>
                    <button
                        type="button"
                        onClick={() => { setLoginMethod('ABHA'); setOtpSent(false); }}
                        className={`flex-1 py-2 text-center border-b-2 transition-colors ${
                            loginMethod === 'ABHA'
                                ? 'border-gov-navy text-gov-navy'
                                : 'border-transparent text-txt-secondary hover:text-gov-navy'
                        }`}
                    >
                        ABHA ID / Number
                    </button>
                </div>
                )}

                {loginMethod === 'PHONE_OTP' && !PRODUCTION ? (
                    <form onSubmit={otpSent ? handleVerify : handleSendOTP} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-1">
                                Mobile Number (linked to Aadhaar/ABHA)
                            </label>
                            <div className="flex">
                                <span className="inline-flex items-center px-3 text-xs font-bold bg-gray-100 border border-r-0 border-border-subtle rounded-l-xl text-txt-secondary">
                                    +91
                                </span>
                                <input
                                    type="tel"
                                    maxLength={10}
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                                    placeholder="9876543210"
                                    className="flex-1 px-3 py-2 text-sm bg-white border border-border-subtle rounded-r-xl focus:ring-2 focus:ring-gov-navy focus:outline-none"
                                    required
                                />
                            </div>
                        </div>

                        {otpSent && (
                            <div className="space-y-2 animate-fade-in">
                                <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider">
                                    Enter 4-Digit OTP (Mock: 4821)
                                </label>
                                <input
                                    type="text"
                                    maxLength={6}
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value)}
                                    placeholder="4821"
                                    className="w-full px-3 py-2 text-center tracking-widest text-lg font-mono bg-white border border-border-subtle rounded-xl focus:ring-2 focus:ring-gov-navy focus:outline-none"
                                    required
                                />
                                <span className="text-[11px] text-txt-muted block text-right">
                                    Resend OTP in 28s
                                </span>
                            </div>
                        )}

                        <button
                            type="submit"
                            className="gov-btn gov-btn-primary w-full text-sm font-bold py-2.5"
                        >
                            {otpSent ? 'Verify OTP & Continue' : 'Send OTP via SMS'}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={abhaTxn ? confirmAbhaOtp : sendAbhaOtp} className="space-y-4">
                        <div>
                            <label htmlFor="abha" className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-1">
                                14-Digit ABHA Number
                            </label>
                            <input
                                id="abha"
                                type="text"
                                inputMode="numeric"
                                value={abhaId}
                                onChange={(e) => { setAbhaId(e.target.value.replace(/[^\d-]/g, '')); setAbhaTxn(null); }}
                                placeholder="91-XXXX-XXXX-XXXX"
                                maxLength={17}
                                className="w-full px-3 py-2 text-sm bg-white border border-border-subtle rounded-xl focus:ring-2 focus:ring-gov-navy focus:outline-none font-mono"
                                required
                            />
                            <span className="text-[11px] text-txt-muted block mt-1">
                                Verified with the ABDM sandbox: an OTP is sent to the mobile number linked to this ABHA.
                            </span>
                        </div>

                        {abhaTxn && (
                            <div className="space-y-2 animate-fade-in">
                                <label htmlFor="abha-otp" className="block text-xs font-bold text-txt-secondary uppercase tracking-wider">
                                    6-Digit OTP
                                </label>
                                <input
                                    id="abha-otp"
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="one-time-code"
                                    maxLength={6}
                                    value={abhaOtp}
                                    onChange={(e) => setAbhaOtp(e.target.value.replace(/\D/g, ''))}
                                    className="w-full px-3 py-2 text-center tracking-widest text-lg font-mono bg-white border border-border-subtle rounded-xl focus:ring-2 focus:ring-gov-navy focus:outline-none"
                                    required
                                />
                            </div>
                        )}

                        {abhaNote && (
                            <p role={abhaNote.tone === 'error' ? 'alert' : 'status'}
                                className={`px-3 py-2 text-xs rounded border ${abhaNote.tone === 'error' ? 'bg-red-50 border-red-300 text-red-800' : 'bg-emerald-50 border-emerald-300 text-emerald-900'}`}>
                                {abhaNote.text}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={busy}
                            className="gov-btn gov-btn-primary w-full text-sm font-bold py-2.5 disabled:opacity-50"
                        >
                            {busy ? 'Contacting ABDM…' : abhaTxn ? 'Verify OTP & Continue' : 'Send OTP to ABHA-linked mobile'}
                        </button>
                    </form>
                )}

                {/* What this page does with a citizen's data — a notice, not pre-ticked consent. */}
                <div className="pt-3 border-t border-border-subtle space-y-2 text-xs text-txt-secondary">
                    <span className="font-bold text-gov-navy block uppercase text-[10px] tracking-wider">
                        How your information is used (DPDP Act, 2023)
                    </span>
                    <ul className="list-disc pl-4 space-y-1">
                        <li>Your ABHA number and OTP are checked by the Ayushman Bharat Digital Mission. This portal does not keep a citizen account or store them.</li>
                        <li>Records made about you at a government health centre are seen by its staff, by the facility you are referred to (so it can prepare before you arrive), and by the district health officers who oversee care.</li>
                        <li>This portal sends no SMS reminders.</li>
                    </ul>
                    <Link href="/privacy" className="font-bold text-gov-navy hover:underline">Privacy policy →</Link>
                </div>

                <div className="pt-2 text-center">
                    <Link href="/staff/login" className="text-xs font-bold text-gov-navy hover:underline">
                        Are you a Healthcare Staff / MO? Staff Login →
                    </Link>
                </div>
            </div>
        </div>
    );
}
