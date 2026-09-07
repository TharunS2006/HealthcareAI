/**
 * Staff Command Center — NalamMesh Rural Public Healthcare Platform
 * Role-Based Healthcare Cadre Workspace — Government of Maharashtra
 */

'use client';

import Link from 'next/link';
import Icon, { IconName } from '@/components/gov/Icon';

export default function StaffHome() {
    const todaysTasks: { label: string; value: string; icon: IconName; color: string }[] = [
        { label: 'OPD Patients Seen Today', value: '24', icon: 'stethoscope', color: 'border-l-emerald-deep' },
        { label: '108 / 102 In Transit', value: '3 Active', icon: 'ambulance', color: 'border-l-amber-500' },
        { label: 'Overdue ANC / SAM Recalls', value: '7 Due', icon: 'warning', color: 'border-l-rose-500' },
        { label: 'Teleconsults Scheduled', value: '2 Scheduled', icon: 'video', color: 'border-l-teal-600' },
    ];

    const quickLinks: { href: string; label: string; icon: IconName; desc: string }[] = [
        { href: '/opd', label: 'Start OPD Intake & AI Triage', icon: 'stethoscope', desc: 'Register new patient & assess emergency symptoms' },
        { href: '/teleconsult', label: 'Launch Teleconsult Room', icon: 'video', desc: 'Connect with District Hospital specialist doctor' },
        { href: '/referrals', label: 'Emergency Referral Pipeline', icon: 'ambulance', desc: 'Refer patient with real-time 108/102 tracking' },
        { href: '/followup', label: 'High-Risk Follow-Up Engine', icon: 'clipboard', desc: 'ANC, infant malnutrition & NCD cohort recalls' },
        { href: '/diagnostics', label: 'Diagnostic Lab Network', icon: 'flask', desc: 'Order laboratory tests & track sample lifecycle' },
        { href: '/medicine', label: 'Essential Medicine Stock', icon: 'pill', desc: 'Facility inventory & emergency reorder requisitions' },
        { href: '/queue', label: 'OPD Live Queue Board', icon: 'ticket', desc: 'Manage facility token queue & call next patient' },
        { href: '/facilities', label: '4-Tier Health Directory', icon: 'hospital', desc: 'Sub-Centre → PHC → CHC → DH locator' },
        { href: '/dashboard', label: 'District Health Command', icon: 'chart-bar', desc: 'Executive scorecards, bed census & KPI analytics' },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <div className="flex items-center gap-2 mb-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-deep animate-pulse" />
                    <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                        Government of Maharashtra • Public Health Department | Medical Officer Workspace
                    </span>
                </div>
                <h1 className="text-2xl md:text-3xl font-extrabold text-emerald-deep tracking-tight">
                    NalamMesh Staff Command Center
                </h1>
                <p className="text-xs text-txt-secondary mt-0.5">
                    Dr. Suresh Atram (Medical Officer In-Charge) • Primary Health Centre, Bhamragad (Aheri Division, Gadchiroli)
                </p>
            </div>

            {/* Today's Operational Summary */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {todaysTasks.map((stat) => (
                    <div key={stat.label} className={`surface-card p-4 border-l-4 ${stat.color} flex items-center justify-between`}>
                        <div>
                            <span className="text-[10px] font-black text-txt-muted uppercase tracking-wider block">
                                {stat.label}
                            </span>
                            <span className="text-xl md:text-2xl font-black text-emerald-deep mt-0.5 block">
                                {stat.value}
                            </span>
                        </div>
                        <Icon name={stat.icon} className="w-6 h-6 text-txt-muted flex-shrink-0" />
                    </div>
                ))}
            </div>

            {/* Quick Actions Grid */}
            <div>
                <h2 className="text-xs font-black text-emerald-deep uppercase tracking-wider mb-3">
                    Operational Clinical & Public Health Modules
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {quickLinks.map((link) => (
                        <Link key={link.href} href={link.href} className="group block">
                            <div className="surface-card p-4.5 hover:shadow-card transition-all h-full flex items-start gap-3 bg-white">
                                <Icon name={link.icon} className="w-6 h-6 flex-shrink-0 text-emerald-deep" />
                                <div>
                                    <h3 className="text-sm font-bold text-emerald-deep group-hover:text-teal-700 transition-colors">
                                        {link.label}
                                    </h3>
                                    <p className="text-xs text-txt-secondary mt-0.5 leading-relaxed">{link.desc}</p>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>

            {/* Active Clinical Alerts */}
            <div className="surface-card border-l-4 border-l-rose-600 bg-rose-50/30 p-5">
                <div className="flex items-center gap-2 mb-2">
                    <Icon name="warning" className="w-5 h-5 text-rose-700" />
                    <h3 className="text-sm font-bold text-rose-900">Priority Clinical & Supply Alerts</h3>
                </div>
                <ul className="space-y-1.5 text-xs text-txt-secondary">
                    <li>• <strong>3 referrals</strong> unacknowledged &gt; 24 hours — auto-escalated to District Health Officer (DHO).</li>
                    <li>• <strong>Paracetamol 500mg IP</strong> low stock (42 tabs remaining, threshold: 100) — requisition auto-drafted.</li>
                    <li>• <strong>2 High-Risk ANC Mothers</strong> overdue for blood pressure monitoring in Kothi sub-centre.</li>
                </ul>
            </div>
        </div>
    );
}
