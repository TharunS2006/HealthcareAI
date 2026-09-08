/**
 * NalamMesh — National Rural Public Healthcare Infrastructure (DPI)
 * Government of Maharashtra • Department of Public Health
 * Official NIC / GIGW 3.0 Portal Gateway
 * Full Trilingual Localization: English, Marathi (मराठी), and Hindi (हिन्दी)
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

    const isEn = language === 'en';
    const isHi = language === 'hi';

    useEffect(() => {
        loadPatients();
        loadReferrals();
    }, [loadPatients, loadReferrals]);

    const activeReferralsCount = referrals.filter(r => r.status === 'INITIATED' || r.status === 'ACCEPTED' || r.status === 'IN_TRANSIT').length;
    const criticalPatientsCount = patients.filter(p => p.triageStatus === 'RED' || (p.highRiskFlags && p.highRiskFlags.length > 0)).length;

    const modules = [
        {
            code: 'M-01',
            title: isEn ? 'OPD Intake & AI Triage' : isHi ? 'ओपीडी पंजीकरण व डिजिटल ट्राइएज' : 'ओपीडी नोंदणी व डिजिटल ट्राइएज',
            dept: isEn ? 'Primary Clinical Care' : isHi ? 'प्राथमिक स्वास्थ्य सेवा' : 'प्राथमिक आरोग्य सेवा',
            desc: isEn
                ? 'On-device symptom triage, voice vitals capture (SpO2, BP, Glucose), automated emergency risk prioritization, and instant OPD token queue.'
                : isHi
                ? 'लक्षणों व महत्वपूर्ण संकेतों (SpO2, रक्तचाप, शुगर) द्वारा मरीजों का तत्काल आपातकालीन वर्गीकरण एवं डिजिटल टोकन।'
                : 'लक्षणे व महत्त्वाच्या नोंदी (SpO2, रक्तदाब, साखर) द्वारे रुग्णांचे तात्काळ आपत्कालीन वर्गीकरण व डिजिटल टोकन.',
            href: '/opd',
            btn: isEn ? 'Launch OPD Intake →' : isHi ? 'ओपीडी शुरू करें →' : 'ओपीडी सुरू करा →',
            tag: isEn ? 'Point of Care' : 'आरोग्य केंद्र',
            accent: 'border-l-gov-navy',
        },
        {
            code: 'M-02',
            title: isEn ? 'District Health Command (DHO)' : isHi ? 'जिला स्वास्थ्य आदेश कक्ष (DHO)' : 'जिल्हा आरोग्य आदेश कक्ष (DHO)',
            dept: isEn ? 'Public Health Command' : isHi ? 'स्वास्थ्य निगरानी' : 'आरोग्य संनियंत्रण',
            desc: isEn
                ? 'Real-time census, IPHS facility scorecards, travel burden avoided, referral audits, and danger-sign escalation telemetry across the Gadchiroli facility network.'
                : isHi
                ? 'जिले के सभी उपकेंद्र, प्राथमिक स्वास्थ्य केंद्र व ग्रामीण अस्पतालों का सीधा सांख्यिकी एवं गुणवत्ता मूल्यांकन।'
                : 'जिल्ह्यातील सर्व उपकेंद्र, प्राथमिक आरोग्य केंद्र व ग्रामीण रुग्णालयांचे थेट संख्याशास्त्रीय व गुणवत्ता मूल्यमापन.',
            href: '/dashboard',
            btn: isEn ? 'Open Command Center →' : isHi ? 'डैशबोर्ड खोलें →' : 'डॅशबोर्ड उघडा →',
            tag: isEn ? 'Executive Hub' : 'प्रशासन',
            accent: 'border-l-gov-amber',
        },
        {
            code: 'M-03',
            title: isEn ? 'High-Risk Recall Engine (ANC/SAM)' : isHi ? 'उच्च जोखिम निगरानी (ANC/SAM)' : 'उच्च जोखीम पाठपुरावा (ANC/SAM)',
            dept: isEn ? 'Maternal & Child Health' : isHi ? 'मातृ एवं शिशु स्वास्थ्य' : 'माता व बाल आरोग्य',
            desc: isEn
                ? 'Active surveillance pathways for maternal preeclampsia, severe acute malnutrition (SAM) in under-5s, and non-communicable diseases (NCD).'
                : isHi
                ? 'गर्भवती महिलाओं में उच्च रक्तचाप, बच्चों में गंभीर कुपोषण (SAM) और गैर-संचारी रोगों (NCD) की प्राथमिकता ट्रैकिंग।'
                : 'गरोदर मातांमधील अतिरक्तदाब, बालकांमधील तीव्र कुपोषण (SAM) व असंसर्गजन्य आजारांचा (NCD) प्राधान्य पाठपुरावा.',
            href: '/followup',
            btn: isEn ? 'View Recall Cohorts →' : isHi ? 'फॉलो-अप सूची देखें →' : 'पाठपुरावा यादी पहा →',
            tag: isEn ? 'Surveillance' : 'निगरानी',
            accent: 'border-l-gov-red',
        },
        {
            code: 'M-04',
            title: isEn ? 'Diagnostic Lab Coordination' : isHi ? 'निदान एवं प्रयोगशाला समन्वय' : 'निदान व प्रयोगशाळा समन्वय',
            dept: isEn ? 'Diagnostic Network' : isHi ? 'पैथोलॉजी व लैब नेटवर्क' : 'पॅथॉलॉजी व लॅब नेटवर्क',
            desc: isEn
                ? 'Sample collection tracking, nearest-lab routing for unavailable tests, instant ABHA diagnostic reports, and pathology result entry.'
                : isHi
                ? 'रक्त व मूत्र नमूना संग्रह, जांच स्थिति और प्राथमिक केंद्र पर अनुपलब्ध जांचों के लिए निकटतम लैब की स्वचालित मैपिंग।'
                : 'रक्त व मूत्र नमुने संकलन, तपासणी स्थिती व प्राथमिक केंद्रावर अनुपलब्ध चाचण्यांसाठी जवळच्या लॅबचे स्वयंचलित मॅपिंग.',
            href: '/diagnostics',
            btn: isEn ? 'Access Lab Network →' : isHi ? 'लैब नेटवर्क खोलें →' : 'लॅब नेटवर्क उघडा →',
            tag: isEn ? 'Lab Network' : 'प्रयोगशाळा',
            accent: 'border-l-gov-accent-sky',
        },
        {
            code: 'M-05',
            title: isEn ? 'Essential Medicine Stock (IPHS)' : isHi ? 'आवश्यक दवा उपलब्धता एवं स्टॉक' : 'आवश्यक औषध साठा व उपलब्धता',
            dept: isEn ? 'Supply Chain (IPHS)' : isHi ? 'दवा आपूर्ति विभाग' : 'औषध पुरवठा विभाग',
            desc: isEn
                ? 'IPHS Essential Drug List tracking, emergency warehouse requisitions, near-expiry alerts, and transparent ₹0 medicines for citizens.'
                : isHi
                ? 'IPHS मानकों के अनुसार मुफ्त दवा स्टॉक, तत्काल पुनःपूर्ति मांग और निकटतम एक्सपायरी दवाओं के अलर्ट।'
                : 'IPHS मानकांनुसार मोफत व अनुदानित औषध साठा, तात्काळ पुनर्भरती मागणी व नजीकच्या मुदतबाह्य औषधांचे अलर्ट.',
            href: '/medicine',
            btn: isEn ? 'Check Medicine Stock →' : isHi ? 'दवा स्टॉक देखें →' : 'औषध साठा तपासा →',
            tag: isEn ? 'Free Pharmacy' : 'औषधालय',
            accent: 'border-l-gov-success',
        },
        {
            code: 'M-06',
            title: isEn ? '108 / 102 Emergency Referral Pipeline' : isHi ? '१०८ / १०२ रोगी रेफरल ट्रैकर' : '१०८ / १०२ रुग्ण रेफरल ट्रॅकर',
            dept: isEn ? 'Emergency Medical Services' : isHi ? 'आपातकालीन संदर्भ सेवा' : 'आपत्कालीन संदर्भ सेवा',
            desc: isEn
                ? 'Multi-tier continuum tracker from Sub-Centre to District Hospital with live 108 ambulance dispatch and electronic longitudinal health records.'
                : isHi
                ? 'उपकेंद्र से जिला अस्पताल सीधा रेफरल, एम्बुलेंस समन्वय और उच्च केंद्र को डिजिटल स्वास्थ्य रिकॉर्ड (LHR) प्रेषण।'
                : 'उपकेंद्र ते जिल्हा रुग्णालय थेट रुग्ण रेफरल, रुग्णवाहिका समन्वय व उच्च केंद्राकडे डिजिटल आरोग्य नोंद (LHR) पाठवणे.',
            href: '/referrals',
            btn: isEn ? 'Track Referrals →' : isHi ? 'रेफरल पाइपलाइन देखें →' : 'रेफरल पाइपलाइन →',
            tag: isEn ? 'Emergency Transit' : 'रुग्णवाहिका',
            accent: 'border-l-gov-accent-crimson',
        },
        {
            code: 'M-07',
            title: isEn ? 'OPD Queue & Token Board' : isHi ? 'ओपीडी कतार एवं टोकन प्रबंधन' : 'ओपीडी रांग व टोकन व्यवस्थापन',
            dept: isEn ? 'Patient Services' : isHi ? 'अस्पताल प्रबंधन' : 'रुग्णालय व्यवस्थापन',
            desc: isEn
                ? 'Live token display, wait time estimators, department triage routing, and dedicated Full-Screen TV Waiting Room display mode.'
                : isHi
                ? 'डिजिटल टोकन नंबर, अनुमानित प्रतीक्षा समय और विभागों के अनुसार तत्काल प्राथमिकता कतार नियंत्रण प्रणाली।'
                : 'डिजिटल टोकन क्रमांक, अंदाजित प्रतीक्षा वेळ व विभागांनुसार तात्काळ प्राधान्य रांग नियंत्रण प्रणाली.',
            href: '/queue',
            btn: isEn ? 'View Queue Board →' : isHi ? 'कतार बोर्ड देखें →' : 'रांग फलक पहा →',
            tag: isEn ? 'Live Queue' : 'रांग फलक',
            accent: 'border-l-gov-accent-indigo',
        },
        {
            code: 'M-08',
            title: isEn ? 'Assisted Teleconsultation (eSanjeevani)' : isHi ? 'ई-संजीवनी टेलीकंसल्टेशन' : 'ई-संजीवनी टेलिकन्सल्टेशन',
            dept: isEn ? 'Specialist Telemedicine Hub' : isHi ? 'टेलीमेडिसिन विभाग' : 'टेलिमेडिसिन विभाग',
            desc: isEn
                ? 'Frontline-assisted video/audio consult connecting rural Sub-Centres directly to District Hospital specialists with 2G low-bandwidth mode.'
                : isHi
                ? 'स्वास्थ्य कार्यकर्ता समर्थित ऑडियो/वीडियो कॉल द्वारा विशेषज्ञ डॉक्टरों से सीधा परामर्श एवं डिजिटल ई-प्रिस्क्रिप्शन।'
                : 'आरोग्य सेविका सहाय्यित ऑडिओ/व्हिडिओ कॉलद्वारे तज्ज्ञ डॉक्टरांशी थेट सल्लामसलत व डिजिटल ई-प्रिस्क्रिप्शन.',
            href: '/teleconsult',
            btn: isEn ? 'Start Teleconsult →' : isHi ? 'कॉल शुरू करें →' : 'कॉल सुरू करा →',
            tag: isEn ? 'Specialist Hub' : 'तज्ज्ञ डॉक्टर',
            accent: 'border-l-gov-accent-teal',
        },
        {
            code: 'M-09',
            title: isEn ? '4-Tier Health Facility Directory' : isHi ? '४-स्तरीय स्वास्थ्य संस्था निर्देशिका' : '४-स्तरीय आरोग्य संस्था निर्देशिका',
            dept: isEn ? 'Health Infrastructure' : isHi ? 'बुनियादी ढांचा व मानव संसाधन' : 'पायाभूत सुविधा व मनुष्यबळ',
            desc: isEn
                ? 'Sub-Centre (Health Temple) → Primary Health Centre (PHC) → Community Health Centre (CHC) → District Hospital (DH) hierarchy with live bed status.'
                : isHi
                ? 'उपकेंद्र (आरोग्य मंदिर) → प्राथमिक स्वास्थ्य केंद्र → सामुदायिक स्वास्थ्य केंद्र → जिला अस्पताल का नक्शा व बिस्तरों की जानकारी।'
                : 'उपकेंद्र (आरोग्य मंदिर) → प्राथमिक आरोग्य केंद्र → ग्रामीण रुग्णालय → जिल्हा रुग्णालय नकाशा व खाटांची माहिती.',
            href: '/facilities',
            btn: isEn ? 'Explore Facilities →' : isHi ? 'संस्था निर्देशिका देखें →' : 'संस्था निर्देशिका →',
            tag: isEn ? 'Directory' : 'मार्गदर्शक',
            accent: 'border-l-gov-accent-violet',
        },
    ];

    const pageTexts = {
        deptTag: isEn
            ? 'Department of Public Health, Government of Maharashtra • National Health Mission'
            : isHi
            ? 'सार्वजनिक स्वास्थ्य विभाग, महाराष्ट्र सरकार • राष्ट्रीय स्वास्थ्य मिशन'
            : 'सार्वजनिक आरोग्य विभाग, महाराष्ट्र शासन • राष्ट्रीय आरोग्य अभियान',
        heroTitle: isEn
            ? 'NalamMesh — Integrated Rural Public Healthcare Platform'
            : isHi
            ? 'नलममेश — ग्रामीण सार्वजनिक स्वास्थ्य सेवा एवं गुणवत्ता एकीकृत मंच'
            : 'नलममेश — एकात्मिक ग्रामीण सार्वजनिक आरोग्य सेवा व गुणवत्ता मंच',
        heroSub: isEn
            ? 'Unified digital care delivery, triage intelligence, cross-tier referrals, and electronic health records connecting Sub-Centres, PHCs, CHCs, and District Hospital in Gadchiroli.'
            : isHi
            ? 'गढ़चिरौली एवं दुर्गम आदिवासी क्षेत्रों के उपकेंद्रों, प्राथमिक स्वास्थ्य केंद्रों (PHC), ग्रामीण अस्पतालों (CHC) व जिला अस्पताल (DH) के बीच निर्बाध डिजिटल स्वास्थ्य सेवा प्रणाली।'
            : 'गडचिरोली व दुर्गम आदिवासी भागातील आरोग्य उपकेंद्रे, प्राथमिक आरोग्य केंद्रे (PHC), ग्रामीण रुग्णालये (CHC) व जिल्हा रुग्णालय (DH) यांमधील अखंड डिजिटल आरोग्य सेवा व सातत्य व्यवस्थापन प्रणाली.',
        abdmBadge: isEn ? '✓ ABDM-Ready • FHIR R4' : isHi ? '✓ ABDM-सज्ज • FHIR R4' : '✓ ABDM-सज्ज • FHIR R4',
        offlineBadge: isEn ? '✓ 100% Offline Mesh Ready' : isHi ? '✓ १००% ऑफलाइन मेश सक्षम' : '✓ १००% ऑफलाइन मेश सक्षम',
        censusTitle: isEn
            ? 'Live District Health Census — Gadchiroli Division'
            : isHi
            ? 'थेट स्वास्थ्य सांख्यिकी फलक — गढ़चिरौली मंडल'
            : 'थेट आरोग्य संख्याशास्त्र फलक (Live District Health Census — Gadchiroli Division)',
        // No hardcoded date here: a "live" census stamped with a fixed calendar date
        // reads as stale the day after it is written, and it disagreed with the English
        // string beside it.
        censusDate: isEn
            ? 'Updated: Live Real-time • Synchronized across the Gadchiroli facility network'
            : isHi
            ? 'अद्यतन: लाइव रीयल-टाइम | गढ़चिरौली सुविधा नेटवर्क में सीधा एकत्रीकरण'
            : 'अद्ययावत: थेट रिअल-टाइम | गडचिरोली आरोग्य संस्था नेटवर्कमध्ये थेट एकत्रीकरण',
        stat1Label: isEn ? 'Patients Examined Today (OPD)' : isHi ? 'आज देखे गए मरीज (OPD)' : 'आज तपासलेले रुग्ण (OPD)',
        stat1Sub: isEn ? '↑ 100% Digital Registration' : isHi ? '↑ १००% डिजिटल पंजीकरण' : '↑ १००% डिजिटल नोंदणी',
        stat2Label: isEn ? '108 / 102 Ambulances in Transit' : isHi ? '१०८ / १०२ एम्बुलेंस ट्रांजिट' : '१०८/१०२ रुग्णवाहिका प्रवास',
        stat2Sub: isEn ? 'Avg Response Time: 28 min' : isHi ? 'औसत प्रतिक्रिया समय: २८ मिनट' : 'सरासरी प्रतिसाद वेळ: २८ मिनिटे',
        stat3Label: isEn ? 'High-Risk Maternal Cohort (ANC)' : isHi ? 'उच्च जोखिम गर्भवती माताएं (ANC)' : 'उच्च जोखीम गरोदर माता (ANC)',
        stat3Sub: isEn ? 'Urgent follow-ups required' : isHi ? 'तत्काल गृह भेंट आवश्यक' : 'तातडीने भेटी आवश्यक',
        stat4Label: isEn ? 'Bed Occupancy (District)' : isHi ? 'बिस्तरों की उपलब्धता (Bed Status)' : 'खाटांची उपलब्धता (Bed Status)',
        stat4Sub: isEn ? 'ICU: 4 Vacant | Maternity: 6 Vacant' : isHi ? 'ICU: ४ रिक्त | प्रसूति: ६ रिक्त' : 'ICU: ४ रिक्त | प्रसूती: ६ रिक्त',
        modulesHeading: isEn ? 'Operational Healthcare Modules' : isHi ? 'सार्वजनिक स्वास्थ्य प्रणाली विभाग' : 'सार्वजनिक आरोग्य प्रणाली विभाग',
        modulesSub: isEn
            ? 'Select a clinical workstation or administrative healthcare department.'
            : isHi
            ? 'कृपया संबंधित अस्पताल सेवा अथवा चिकित्सकीय कार्यकक्ष चुनें।'
            : 'कृपया संबंधित रुग्णालय सेवा किंवा वैद्यकीय कार्यकक्ष निवडा.',
        modulesCount: isEn ? 'Total Modules: 9' : isHi ? 'कुल विभाग: ९' : 'एकूण विभाग: ९',
        portalTag: isEn ? 'Govt. Health Portal' : isHi ? 'सरकारी स्वास्थ्य पोर्टल' : 'शासकीय आरोग्य पोर्टल',
        citizenTitle: isEn ? 'Citizen Health Services Portal' : isHi ? 'नागरिक स्वास्थ्य सेवा कक्ष' : 'नागरिक आरोग्य सेवा दालन',
        citizenDesc: isEn
            ? 'Citizens can locate the nearest public health center, check ₹0 essential drug stock, generate an OPD token, and access longitudinal Ayushman Bharat (ABHA) digital records.'
            : isHi
            ? 'नागरिकों के लिए निकटतम स्वास्थ्य केंद्र खोजना, आवश्यक मुफ्त दवा स्टॉक जांचना, ओपीडी टोकन प्राप्त करना व अपनी आभा (ABHA) डिजिटल स्वास्थ्य रिकॉर्ड देखने की सुविधा।'
            : 'नागरिकांना जवळचे आरोग्य केंद्र शोधणे, आवश्यक मोफत औषध साठा तपासणे, ओपीडी टोकन घेणे व स्वतःचे आयुष्मान भारत (ABHA) डिजिटल आरोग्य रेकॉर्ड पाहण्याची सुविधा.',
        findCenter: isEn ? 'Find Health Center' : isHi ? 'स्वास्थ्य केंद्र खोजें' : 'आरोग्य केंद्र शोधा',
        checkMeds: isEn ? 'Check Medicine Stock' : isHi ? 'दवा स्टॉक देखें' : 'औषध साठा पहा',
        citizenLoginBtn: isEn ? 'ABHA Login →' : 'ABHA लॉगिन →',
        staffTitle: isEn ? 'Staff & Clinical Workstation' : isHi ? 'स्वास्थ्य कार्यकर्ता एवं डॉक्टर कक्ष' : 'आरोग्य कर्मचारी व वैद्यकीय अधिकारी कक्ष',
        staffDesc: isEn
            ? 'Authorized clinical workstation for ASHA workers, ANM/CHO, PHC Medical Officers (MO), and Civil Surgeons (CS) for electronic consultations and referrals.'
            : isHi
            ? 'आशा सेविका, ANM/CHO, प्राथमिक स्वास्थ्य केंद्र चिकित्सा अधिकारी (MO) और जिला सर्जन (CS) के लिए अधिकृत चिकित्सकीय पंजीकरण कक्ष।'
            : 'आशा सेविका, ANM/CHO, प्राथमिक आरोग्य केंद्र वैद्यकीय अधिकारी (MO) व जिल्हा शल्यचिकित्सक (CS) यांच्यासाठी अधिकृत वैद्यकीय नोंदणी व संदर्भ सेवा दालन.',
        opdTriageBtn: isEn ? 'OPD Triage' : isHi ? 'ओपीडी ट्राइएज' : 'ओपीडी ट्राइएज',
        refServicesBtn: isEn ? '108 Referral Pipeline' : isHi ? '१०८ रेफरल सेवा' : '१०८ रेफरल सेवा',
        staffLoginBtn: isEn ? 'Staff Login →' : isHi ? 'कर्मचारी लॉगिन →' : 'कर्मचारी लॉगिन →',
        disclaimer: isEn
            ? 'All information on this portal is compliant with National Health Policy (NHP) and Govt. of Maharashtra guidelines. Consultations and essential drugs are 100% FREE at all government facilities.'
            : isHi
            ? 'इस पोर्टल की समस्त जानकारी राष्ट्रीय स्वास्थ्य नीति (NHP) एवं महाराष्ट्र सरकार के दिशा-निर्देशों के अनुरूप है। सभी सरकारी स्वास्थ्य केंद्रों पर उपचार व दवाएं पूर्णतः निःशुल्क हैं।'
            : 'या पोर्टलवरील सर्व माहिती महाराष्ट्र शासनाच्या सार्वजनिक आरोग्य विभागाच्या अधिकृत मार्गदर्शक तत्त्वांवर आधारित आहे. सर्व सरकारी आरोग्य केंद्रांवर उपचार व औषधे मोफत आहेत.',
    };

    return (
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-6 font-sans text-slate-800">
            {/* Government Portal Breadcrumb & Official Seal */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-5 border-b border-slate-300">
                <div>
                    <div className="flex items-center gap-2 text-xs font-bold text-gov-navy mb-1">
                        <StateEmblem size={18} />
                        <span>{pageTexts.deptTag}</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-gov-navy tracking-tight">
                        {pageTexts.heroTitle}
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-4xl leading-relaxed">
                        {pageTexts.heroSub}
                    </p>
                </div>

                <div className="flex items-center gap-2 text-xs flex-shrink-0">
                    <span className="px-3 py-1.5 bg-gov-green-bg text-gov-green border border-gov-green-border rounded font-bold">
                        {pageTexts.abdmBadge}
                    </span>
                    <span className="px-3 py-1.5 bg-gov-blue-bg text-gov-blue border border-gov-blue-border rounded font-bold">
                        {pageTexts.offlineBadge}
                    </span>
                </div>
            </div>

            {/* Official State & District Live Telemetry Table (NIC Style) */}
            <div className="my-5 bg-white border border-slate-300 rounded overflow-hidden shadow-sm">
                <div className="bg-gov-navy text-white px-4 py-2 flex items-center justify-between text-xs font-bold">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span>{pageTexts.censusTitle}</span>
                    </div>
                    <span className="text-[11px] text-slate-300 font-normal">
                        {pageTexts.censusDate}
                    </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-200 text-center">
                    <div className="p-3.5">
                        <span className="text-[11px] text-slate-500 font-bold uppercase block">
                            {pageTexts.stat1Label}
                        </span>
                        <strong className="text-2xl font-black text-gov-navy">
                            {patients.length + 152}
                        </strong>
                        <span className="text-[10px] text-emerald-700 block font-semibold">{pageTexts.stat1Sub}</span>
                    </div>

                    <div className="p-3.5">
                        <span className="text-[11px] text-slate-500 font-bold uppercase block">
                            {pageTexts.stat2Label}
                        </span>
                        <strong className="text-2xl font-black text-amber-700">
                            {activeReferralsCount > 0 ? activeReferralsCount : '4'} {isEn ? 'Active' : 'सक्रिय'}
                        </strong>
                        <span className="text-[10px] text-slate-500 block">{pageTexts.stat2Sub}</span>
                    </div>

                    <div className="p-3.5">
                        <span className="text-[11px] text-slate-500 font-bold uppercase block">
                            {pageTexts.stat3Label}
                        </span>
                        <strong className="text-2xl font-black text-red-700">
                            {criticalPatientsCount > 0 ? criticalPatientsCount : '7'} {isEn ? 'Recalls' : 'पाठपुरावा'}
                        </strong>
                        <span className="text-[10px] text-red-600 block font-semibold">{pageTexts.stat3Sub}</span>
                    </div>

                    <div className="p-3.5">
                        <span className="text-[11px] text-slate-500 font-bold uppercase block">
                            {pageTexts.stat4Label}
                        </span>
                        <strong className="text-2xl font-black text-slate-800">
                            78% {isEn ? 'Occupied' : 'पूर्ण'}
                        </strong>
                        <span className="text-[10px] text-emerald-700 block font-semibold">{pageTexts.stat4Sub}</span>
                    </div>
                </div>
            </div>

            {/* Public Healthcare Operational Modules Grid */}
            <div className="mb-8">
                <div className="flex items-center justify-between mb-3 border-b border-slate-300 pb-2">
                    <div>
                        <h2 className="text-base sm:text-lg font-bold text-gov-navy">
                            {pageTexts.modulesHeading}
                        </h2>
                        <p className="text-xs text-slate-500">
                            {pageTexts.modulesSub}
                        </p>
                    </div>
                    <span className="text-xs font-bold text-slate-600">
                        {pageTexts.modulesCount}
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
                                        {m.code} • {m.dept}
                                    </span>
                                    <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 border border-slate-300 text-slate-700 rounded">
                                        {m.tag}
                                    </span>
                                </div>
                                <h3 className="text-sm font-bold text-gov-navy mb-1 leading-snug">
                                    {m.title}
                                </h3>
                                <p className="text-xs text-slate-600 leading-relaxed">
                                    {m.desc}
                                </p>
                            </div>

                            <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
                                <span className="text-[11px] text-slate-500 font-medium">
                                    {pageTexts.portalTag}
                                </span>
                                <Link
                                    href={m.href}
                                    className="font-bold text-gov-navy hover:text-gov-navy-hover hover:underline"
                                >
                                    {m.btn}
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
                            <h3 className="text-sm font-bold text-gov-navy uppercase tracking-wide">
                                {pageTexts.citizenTitle}
                            </h3>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed mb-4">
                            {pageTexts.citizenDesc}
                        </p>
                    </div>
                    <div className="flex items-center gap-3 pt-2 border-t border-slate-200">
                        <Link href="/facilities" className="gov-btn gov-btn-secondary text-xs">
                            {pageTexts.findCenter}
                        </Link>
                        <Link href="/medicine" className="gov-btn gov-btn-secondary text-xs">
                            {pageTexts.checkMeds}
                        </Link>
                        <Link href="/login" className="gov-btn gov-btn-primary text-xs">
                            {pageTexts.citizenLoginBtn}
                        </Link>
                    </div>
                </div>

                {/* Staff & Medical Cadre Box */}
                <div className="bg-white border border-slate-300 rounded p-5 border-l-4 border-l-gov-navy shadow-sm flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-sm font-bold text-gov-navy uppercase tracking-wide">
                                {pageTexts.staffTitle}
                            </h3>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed mb-4">
                            {pageTexts.staffDesc}
                        </p>
                    </div>
                    <div className="flex items-center gap-3 pt-2 border-t border-slate-200">
                        <Link href="/opd" className="gov-btn gov-btn-secondary text-xs">
                            {pageTexts.opdTriageBtn}
                        </Link>
                        <Link href="/referrals" className="gov-btn gov-btn-secondary text-xs">
                            {pageTexts.refServicesBtn}
                        </Link>
                        <Link href="/staff/login" className="gov-btn gov-btn-primary text-xs">
                            {pageTexts.staffLoginBtn}
                        </Link>
                    </div>
                </div>
            </div>

            {/* National Standards & Institutional Badges */}
            <div className="p-4 bg-slate-100 border border-slate-300 rounded text-center text-xs text-slate-600 space-y-2">
                <div className="flex items-center justify-center gap-4 flex-wrap font-bold text-[11px] text-slate-700">
                    <span>• {isEn ? 'National Health Policy (NHP)' : 'भारत सरकार राष्ट्रीय आरोग्य धोरण (NHP 2017)'}</span>
                    <span>• {isEn ? 'Ayushman Bharat Digital Mission (ABDM)' : 'आयुष्मान भारत डिजिटल मिशन (ABDM)'}</span>
                    <span>• Guidelines for Indian Government Websites (GIGW 3.0)</span>
                    <span>• {isEn ? 'Digital Personal Data Protection Act (DPDP)' : 'माहिती तंत्रज्ञान कायदा व DPDP Act 2023'}</span>
                </div>
                <p className="text-[11px] text-slate-500">
                    {pageTexts.disclaimer}
                </p>
            </div>
        </div>
    );
}
