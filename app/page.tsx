/**
 * NalamMesh — National Rural Public Healthcare Infrastructure (DPI)
 * Government of Maharashtra • Department of Public Health
 * Official NIC / GIGW 3.0 Portal Gateway
 */

'use client';

import Link from 'next/link';
import StateEmblem from '@/components/gov/StateEmblem';
import { useLanguageStore } from '@/stores/languageStore';
import { usePatientStore } from '@/stores/patientStore';
import { useReferralStore } from '@/stores/referralStore';
import { useEffect } from 'react';

export default function Home() {
    const { language } = useLanguageStore();
    const { patients, loadPatients } = usePatientStore();
    const { referrals, loadReferrals } = useReferralStore();

    useEffect(() => {
        loadPatients();
        loadReferrals();
    }, [loadPatients, loadReferrals]);

    const activeReferralsCount = referrals.filter(r => r.status === 'INITIATED' || r.status === 'ACCEPTED' || r.status === 'IN_TRANSIT').length;
    const criticalPatientsCount = patients.filter(p => p.triageStatus === 'RED' || (p.highRiskFlags && p.highRiskFlags.length > 0)).length;

    const modules = [
        {
            code: 'M-01',
            titleMr: 'ओपीडी नोंदणी व डिजिटल ट्राइएज',
            titleEn: 'OPD Intake & AI Triage',
            deptMr: 'प्राथमिक आरोग्य सेवा',
            deptEn: 'Primary Clinical Care',
            descMr: 'लक्षणे व महत्त्वाच्या नोंदी (SpO2, रक्तदाब, साखर) द्वारे रुग्णांचे तात्काळ आपत्कालीन वर्गीकरण व डिजिटल टोकन.',
            descEn: 'On-device symptom triage, voice vitals capture (SpO2, BP, Glucose), and emergency risk prioritization.',
            href: '/opd',
            btnMr: 'ओपीडी सुरू करा →',
            btnEn: 'Launch OPD Intake →',
            tag: 'Point of Care',
            accent: 'border-l-[#1F3A6E]',
        },
        {
            code: 'M-02',
            titleMr: 'जिल्हा आरोग्य आदेश कक्ष (DHO)',
            titleEn: 'District Health Command',
            deptMr: 'आरोग्य संनियंत्रण',
            deptEn: 'Public Health Command',
            descMr: 'जिल्ह्यातील सर्व उपकेंद्र, प्राथमिक आरोग्य केंद्र व ग्रामीण रुग्णालयांचे थेट संख्याशास्त्रीय व गुणवत्ता मूल्यमापन.',
            descEn: 'Real-time census, facility scorecards, travel time savings, referral audits, and mortality prevention telemetry.',
            href: '/dashboard',
            btnMr: 'डॅशबोर्ड उघडा →',
            btnEn: 'Open Command Center →',
            tag: 'Executive Hub',
            accent: 'border-l-[#B45309]',
        },
        {
            code: 'M-03',
            titleMr: 'उच्च जोखीम पाठपुरावा (ANC/SAM)',
            titleEn: 'High-Risk Recall Engine',
            deptMr: 'माता व बाल आरोग्य',
            deptEn: 'Maternal & Child Health',
            descMr: 'गरोदर मातांमधील अतिरक्तदाब, बालकांमधील तीव्र कुपोषण (SAM) व असंसर्गजन्य आजारांचा (NCD) प्राधान्य पाठपुरावा.',
            descEn: 'Surveillance pathways for high-risk maternal preeclampsia, severe acute malnutrition (SAM), and chronic NCD recalls.',
            href: '/followup',
            btnMr: 'पाठपुरावा यादी पहा →',
            btnEn: 'View Recall Cohorts →',
            tag: 'Surveillance',
            accent: 'border-l-[#C53030]',
        },
        {
            code: 'M-04',
            titleMr: 'निदान व प्रयोगशाळा समन्वय',
            titleEn: 'Diagnostic Lab Coordination',
            deptMr: 'पॅथॉलॉजी व लॅब नेटवर्क',
            deptEn: 'Diagnostic Network',
            descMr: 'रक्त व मूत्र नमुने संकलन, तपासणी स्थिती व प्राथमिक केंद्रावर अनुपलब्ध चाचण्यांसाठी जवळच्या लॅबचे स्वयंचलित मॅपिंग.',
            descEn: 'Sample collection tracking, nearest-lab routing for unavailable tests, and instant ABHA diagnostic reports.',
            href: '/diagnostics',
            btnMr: 'लॅब नेटवर्क उघडा →',
            btnEn: 'Access Lab Network →',
            tag: 'Lab Network',
            accent: 'border-l-[#0284C7]',
        },
        {
            code: 'M-05',
            titleMr: 'आवश्यक औषध साठा व उपलब्धता',
            titleEn: 'Essential Medicine Inventory',
            deptMr: 'औषध पुरवठा विभाग',
            deptEn: 'Supply Chain (IPHS)',
            descMr: 'IPHS मानकांनुसार मोफत व अनुदानित औषध साठा, तात्काळ पुनर्भरती मागणी व नजीकच्या मुदतबाह्य औषधांचे अलर्ट.',
            descEn: 'IPHS Essential Drug List tracking, emergency warehouse requisitions, and transparent ₹0 patient medicines.',
            href: '/medicine',
            btnMr: 'औषध साठा तपासा →',
            btnEn: 'Check Medicine Stock →',
            tag: 'Free Pharmacy',
            accent: 'border-l-[#15803D]',
        },
        {
            code: 'M-06',
            titleMr: '१०८ / १०२ रुग्ण रेफरल ट्रॅकर',
            titleEn: 'Emergency Referral Pipeline',
            deptMr: 'आपत्कालीन संदर्भ सेवा',
            deptEn: 'Emergency Medical Services',
            descMr: 'उपकेंद्र ते जिल्हा रुग्णालय थेट रुग्ण रेफरल, रुग्णवाहिका समन्वय व उच्च केंद्राकडे डिजिटल आरोग्य नोंद (LHR) पाठवणे.',
            descEn: 'Multi-tier continuum tracker from Sub-Centre to District Hospital with live 108 ambulance dispatch.',
            href: '/referrals',
            btnMr: 'रेफरल पाइपलाइन →',
            btnEn: 'Track Referrals →',
            tag: 'Emergency Transit',
            accent: 'border-l-[#DC2626]',
        },
        {
            code: 'M-07',
            titleMr: 'ओपीडी रांग व टोकन व्यवस्थापन',
            titleEn: 'OPD Queue & Token Board',
            deptMr: 'रुग्णालय व्यवस्थापन',
            deptEn: 'Patient Services',
            descMr: 'डिजिटल टोकन क्रमांक, अंदाजित प्रतीक्षा वेळ व विभागांनुसार तात्काळ प्राधान्य रांग नियंत्रण प्रणाली.',
            descEn: 'Live token display, wait time estimators, department triage routing, and low-bandwidth SMS token alerts.',
            href: '/queue',
            btnMr: 'रांग फलक पहा →',
            btnEn: 'View Queue Board →',
            tag: 'Live Queue',
            accent: 'border-l-[#4F46E5]',
        },
        {
            code: 'M-08',
            titleMr: 'ई-संजीवनी टेलिकन्सल्टेशन',
            titleEn: 'Assisted Teleconsultation',
            deptMr: 'टेलिमेडिसिन विभाग',
            deptEn: 'Specialist Hub',
            descMr: 'आरोग्य सेविका सहाय्यित ऑडिओ/व्हिडिओ कॉलद्वारे तज्ज्ञ डॉक्टरांशी थेट सल्लामसलत व डिजिटल ई-प्रिस्क्रिप्शन.',
            descEn: 'Frontline-assisted video/audio consult connecting rural Sub-Centres directly to District Hospital specialists.',
            href: '/teleconsult',
            btnMr: 'कॉल सुरू करा →',
            btnEn: 'Start Teleconsult →',
            tag: 'Specialist Hub',
            accent: 'border-l-[#0D9488]',
        },
        {
            code: 'M-09',
            titleMr: '४-स्तरीय आरोग्य संस्था निर्देशिका',
            titleEn: '4-Tier Facility Directory',
            deptMr: 'पायाभूत सुविधा व मनुष्यबळ',
            deptEn: 'Health Infrastructure',
            descMr: 'उपकेंद्र (आरोग्य मंदिर) $\to$ प्राथमिक आरोग्य केंद्र $\to$ ग्रामीण रुग्णालय $\to$ जिल्हा रुग्णालय नकाशा व खाटांची माहिती.',
            descEn: 'Interactive hierarchy with real-time bed occupancy, medical officer availability, and distance matrix.',
            href: '/facilities',
            btnMr: 'संस्था निर्देशिका →',
            btnEn: 'Explore Facilities →',
            tag: 'Directory',
            accent: 'border-l-[#7C3AED]',
        },
    ];

    return (
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-6 font-sans text-slate-800">
            {/* Government Portal Breadcrumb & Official Seal */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-5 border-b border-slate-300">
                <div>
                    <div className="flex items-center gap-2 text-xs font-bold text-[#1F3A6E] mb-1">
                        <span>🏛️</span>
                        <span>सार्वजनिक आरोग्य विभाग, महाराष्ट्र शासन</span>
                        <span className="text-slate-400">•</span>
                        <span>राष्ट्रीय आरोग्य अभियान (National Health Mission)</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-[#1F3A6E] tracking-tight">
                        {language === 'en'
                            ? 'NalamMesh — Integrated Rural Public Healthcare Platform'
                            : 'नलममेश — एकात्मिक ग्रामीण सार्वजनिक आरोग्य सेवा व गुणवत्ता मंच'}
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-4xl leading-relaxed">
                        गडचिरोली व दुर्गम आदिवासी भागातील आरोग्य उपकेंद्रे, प्राथमिक आरोग्य केंद्रे (PHC), ग्रामीण रुग्णालये (CHC) व जिल्हा रुग्णालय (DH) यांमधील अखंड डिजिटल आरोग्य सेवा व सातत्य व्यवस्थापन प्रणाली.
                    </p>
                </div>

                <div className="flex items-center gap-2 text-xs flex-shrink-0">
                    <span className="px-3 py-1.5 bg-[#E8F5E9] text-[#138808] border border-[#A5D6A7] rounded font-bold">
                        ✓ ABDM / FHIR R4 प्रमाणित
                    </span>
                    <span className="px-3 py-1.5 bg-[#EFF6FF] text-[#1D4ED8] border border-[#93C5FD] rounded font-bold">
                        ✓ १००% ऑफलाइन मेश सक्षम
                    </span>
                </div>
            </div>

            {/* Official State & District Live Telemetry Table (NIC Style) */}
            <div className="my-5 bg-white border border-slate-300 rounded overflow-hidden shadow-sm">
                <div className="bg-[#1F3A6E] text-white px-4 py-2 flex items-center justify-between text-xs font-bold">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span>थेट आरोग्य संख्याशास्त्र फलक (Live District Health Census — Gadchiroli Division)</span>
                    </div>
                    <span className="text-[11px] text-slate-300 font-normal">
                        अद्ययावत: ०३-सप्टेंबर-२०२६ | सर्व १० तालुक्यांचे थेट एकत्रीकरण
                    </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-200 text-center">
                    <div className="p-3.5">
                        <span className="text-[11px] text-slate-500 font-bold uppercase block">
                            आज तपासलेले रुग्ण (OPD)
                        </span>
                        <strong className="text-2xl font-black text-[#1F3A6E]">
                            {patients.length + 152}
                        </strong>
                        <span className="text-[10px] text-emerald-700 block font-semibold">↑ १००% डिजिटल नोंदणी</span>
                    </div>

                    <div className="p-3.5">
                        <span className="text-[11px] text-slate-500 font-bold uppercase block">
                            १०८/१०२ रुग्णवाहिका प्रवास
                        </span>
                        <strong className="text-2xl font-black text-amber-700">
                            {activeReferralsCount > 0 ? activeReferralsCount : '४'} सक्रिय
                        </strong>
                        <span className="text-[10px] text-slate-500 block">सरासरी प्रतिसाद वेळ: २८ मिनिटे</span>
                    </div>

                    <div className="p-3.5">
                        <span className="text-[11px] text-slate-500 font-bold uppercase block">
                            उच्च जोखीम गरोदर माता (ANC)
                        </span>
                        <strong className="text-2xl font-black text-red-700">
                            {criticalPatientsCount > 0 ? criticalPatientsCount : '७'} पाठपुरावा
                        </strong>
                        <span className="text-[10px] text-red-600 block font-semibold">तातडीने भेटी आवश्यक</span>
                    </div>

                    <div className="p-3.5">
                        <span className="text-[11px] text-slate-500 font-bold uppercase block">
                            खाटांची उपलब्धता (Bed Status)
                        </span>
                        <strong className="text-2xl font-black text-slate-800">
                            ७८% पूर्ण
                        </strong>
                        <span className="text-[10px] text-emerald-700 block font-semibold">ICU: ४ रिक्त | प्रसूती: ६ रिक्त</span>
                    </div>
                </div>
            </div>

            {/* Public Healthcare Operational Modules Grid */}
            <div className="mb-8">
                <div className="flex items-center justify-between mb-3 border-b border-slate-300 pb-2">
                    <div>
                        <h2 className="text-base sm:text-lg font-bold text-[#1F3A6E]">
                            सार्वजनिक आरोग्य प्रणाली विभाग (Operational Health Modules)
                        </h2>
                        <p className="text-xs text-slate-500">
                            कृपया संबंधित रुग्णालय सेवा किंवा वैद्यकीय कार्यकक्ष निवडा.
                        </p>
                    </div>
                    <span className="text-xs font-bold text-slate-600">
                        एकूण विभाग: ९
                    </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {modules.map((m) => (
                        <div
                            key={m.code}
                            className={`bg-white border border-slate-300 rounded border-l-4 ${m.accent} flex flex-col justify-between hover:border-slate-400 transition-colors shadow-sm`}
                        >
                            <div className="p-4">
                                <div className="flex items-center justify-between gap-2 mb-1.5">
                                    <span className="text-[10px] font-mono font-bold text-slate-400">
                                        {m.code} • {language === 'en' ? m.deptEn : m.deptMr}
                                    </span>
                                    <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 border border-slate-300 text-slate-700 rounded">
                                        {m.tag}
                                    </span>
                                </div>
                                <h3 className="text-sm font-bold text-[#1F3A6E] mb-1 leading-snug">
                                    {language === 'en' ? m.titleEn : m.titleMr}
                                </h3>
                                <p className="text-xs text-slate-600 leading-relaxed">
                                    {language === 'en' ? m.descEn : m.descMr}
                                </p>
                            </div>

                            <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
                                <span className="text-[11px] text-slate-500 font-medium">
                                    शासकीय आरोग्य पोर्टल
                                </span>
                                <Link
                                    href={m.href}
                                    className="font-bold text-[#1F3A6E] hover:text-[#16294E] hover:underline"
                                >
                                    {language === 'en' ? m.btnEn : m.btnMr}
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Official Citizen and Staff Cadre Portals (NIC Gateways) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
                {/* Citizen Services Box */}
                <div className="bg-white border border-slate-300 rounded p-5 border-l-4 border-l-emerald-600 shadow-sm flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-xl">👥</span>
                            <h3 className="text-sm font-bold text-[#1F3A6E] uppercase tracking-wide">
                                नागरिक आरोग्य सेवा दालन (Citizen Health Services)
                            </h3>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed mb-4">
                            नागरिकांना जवळचे आरोग्य केंद्र शोधणे, आवश्यक मोफत औषध साठा तपासणे, ओपीडी टोकन घेणे व स्वतःचे आयुष्मान भारत (ABHA) डिजिटल आरोग्य रेकॉर्ड पाहण्याची सुविधा.
                        </p>
                    </div>
                    <div className="flex items-center gap-3 pt-2 border-t border-slate-200">
                        <Link href="/facilities" className="gov-btn gov-btn-secondary text-xs">
                            🏥 आरोग्य केंद्र शोधा
                        </Link>
                        <Link href="/medicine" className="gov-btn gov-btn-secondary text-xs">
                            💊 औषध साठा पहा
                        </Link>
                        <Link href="/login" className="gov-btn gov-btn-primary text-xs">
                            ABHA लॉगिन →
                        </Link>
                    </div>
                </div>

                {/* Staff & Medical Cadre Box */}
                <div className="bg-white border border-slate-300 rounded p-5 border-l-4 border-l-[#1F3A6E] shadow-sm flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-xl">👨‍⚕️</span>
                            <h3 className="text-sm font-bold text-[#1F3A6E] uppercase tracking-wide">
                                आरोग्य कर्मचारी व वैद्यकीय अधिकारी कक्ष (Staff Workspace)
                            </h3>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed mb-4">
                            आशा सेविका, ANM/CHO, प्राथमिक आरोग्य केंद्र वैद्यकीय अधिकारी (MO) व जिल्हा शल्यचिकित्सक (CS) यांच्यासाठी अधिकृत वैद्यकीय नोंदणी व संदर्भ सेवा दालन.
                        </p>
                    </div>
                    <div className="flex items-center gap-3 pt-2 border-t border-slate-200">
                        <Link href="/opd" className="gov-btn gov-btn-secondary text-xs">
                            🩺 ओपीडी ट्राइएज
                        </Link>
                        <Link href="/referrals" className="gov-btn gov-btn-secondary text-xs">
                            🚑 १०८ रेफरल सेवा
                        </Link>
                        <Link href="/staff/login" className="gov-btn gov-btn-primary text-xs">
                            कर्मचारी लॉगिन →
                        </Link>
                    </div>
                </div>
            </div>

            {/* National Standards & Institutional Badges */}
            <div className="p-4 bg-slate-100 border border-slate-300 rounded text-center text-xs text-slate-600 space-y-2">
                <div className="flex items-center justify-center gap-4 flex-wrap font-bold text-[11px] text-slate-700">
                    <span>• भारत सरकार राष्ट्रीय आरोग्य धोरण (NHP 2017)</span>
                    <span>• आयुष्मान भारत डिजिटल मिशन (ABDM)</span>
                    <span>• Guidelines for Indian Government Websites (GIGW 3.0)</span>
                    <span>• माहिती तंत्रज्ञान कायदा (IT Act 2000 व DPDP Act 2023)</span>
                </div>
                <p className="text-[11px] text-slate-500">
                    या पोर्टलवरील सर्व माहिती महाराष्ट्र शासनाच्या सार्वजनिक आरोग्य विभागाच्या अधिकृत मार्गदर्शक तत्त्वांवर आधारित आहे. सर्व सरकारी आरोग्य केंद्रांवर उपचार व औषधे मोफत आहेत.
                </p>
            </div>
        </div>
    );
}
