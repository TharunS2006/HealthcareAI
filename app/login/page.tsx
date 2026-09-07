/**
 * Citizen Authentication & Consent Portal — Module 0 (SIH PS#26133)
 * Implements OTP / ABHA authentication with DPDP Act & ABDM consent flags.
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from '@/components/gov/Icon';
import toast from 'react-hot-toast';

export default function LoginPage() {
    const router = useRouter();
    const [loginMethod, setLoginMethod] = useState<'PHONE_OTP' | 'ABHA'>('PHONE_OTP');
    const [phone, setPhone] = useState('9876543210');
    const [otpSent, setOtpSent] = useState(false);
    const [otp, setOtp] = useState('');
    const [abhaId, setAbhaId] = useState('91-8842-1002-4912');
    const [consentRecordSharing, setConsentRecordSharing] = useState(true);
    const [consentSmsReminders, setConsentSmsReminders] = useState(true);
    const [consentTeleconsult, setConsentTeleconsult] = useState(true);

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
        toast.success('Citizen authenticated successfully via ABHA Sandbox', { icon: <Icon name="check-circle" className="w-4 h-4" /> });
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

                {/* Login Method Tabs */}
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
                        Mobile OTP
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

                {loginMethod === 'PHONE_OTP' ? (
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
                    <form onSubmit={handleVerify} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-txt-secondary uppercase tracking-wider mb-1">
                                14-Digit ABHA ID or ABHA Address
                            </label>
                            <input
                                type="text"
                                value={abhaId}
                                onChange={(e) => setAbhaId(e.target.value)}
                                placeholder="91-8842-1002-4912 or user@abdm"
                                className="w-full px-3 py-2 text-sm bg-white border border-border-subtle rounded-xl focus:ring-2 focus:ring-gov-navy focus:outline-none font-mono"
                                required
                            />
                            <span className="text-[11px] text-txt-muted block mt-1">
                                Example: 91-8842-1002-4912 or sunita@abdm
                            </span>
                        </div>

                        <button
                            type="submit"
                            className="gov-btn gov-btn-primary w-full text-sm font-bold py-2.5"
                        >
                            Authenticate via ABDM Sandbox
                        </button>
                    </form>
                )}

                {/* DPDP Consent Flags */}
                <div className="pt-3 border-t border-border-subtle space-y-2.5 text-xs text-txt-secondary">
                    <span className="font-bold text-gov-navy block uppercase text-[10px] tracking-wider">
                        Patient Consent Preferences (DPDP Act, 2023)
                    </span>

                    <label className="flex items-start gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={consentRecordSharing}
                            onChange={(e) => setConsentRecordSharing(e.target.checked)}
                            className="mt-0.5 rounded border-gray-300 text-gov-navy focus:ring-gov-navy"
                        />
                        <span>Share health records across Government facilities (SC → PHC → CHC → DH)</span>
                    </label>

                    <label className="flex items-start gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={consentSmsReminders}
                            onChange={(e) => setConsentSmsReminders(e.target.checked)}
                            className="mt-0.5 rounded border-gray-300 text-gov-navy focus:ring-gov-navy"
                        />
                        <span>Receive SMS reminders for follow-ups, immunization & diagnostic results</span>
                    </label>

                    <label className="flex items-start gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={consentTeleconsult}
                            onChange={(e) => setConsentTeleconsult(e.target.checked)}
                            className="mt-0.5 rounded border-gray-300 text-gov-navy focus:ring-gov-navy"
                        />
                        <span>Consent for assisted teleconsultation with District Hospital specialists</span>
                    </label>
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
