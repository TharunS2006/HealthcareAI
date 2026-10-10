/**
 * NalamMesh — National Rural Public Healthcare Infrastructure (DPI)
 * Government of Maharashtra • Department of Public Health
 * Portal home, laid out to GIGW 3.0
 * Full Trilingual Localization: English, Marathi (मराठी), and Hindi (हिन्दी) */

'use client';

import Link from 'next/link';
import StateEmblem from '@/components/gov/StateEmblem';
import { useLanguageStore } from '@/stores/languageStore';
import { usePatientStore } from '@/stores/patientStore';
import { useReferralStore } from '@/stores/referralStore';
import { useFacilityStore } from '@/stores/facilityStore';
import GovPanel from '@/components/gov/GovPanel';
import PortalAside from '@/components/gov/PortalAside';
import Breadcrumb from '@/components/gov/Breadcrumb';
import { useEffect } from 'react';

import { isOpenReferral } from '@/lib/referrals/workflow';
import { dep } from '@/lib/config/deployment';

const isToday = (value: Date | string | undefined, now: Date): boolean => {
    if (!value) return false;
    const d = new Date(value);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
};

export default function Home() {
    const { language } = useLanguageStore();
    const { patients, loadPatients } = usePatientStore();
    const { referrals, loadReferrals } = useReferralStore();
    const { facilities, loadAll: loadFacilities } = useFacilityStore();

    const isEn = language === 'en';
    const isHi = language === 'hi';

    useEffect(() => {
        loadPatients();
        loadReferrals();
        loadFacilities();
    }, [loadPatients, loadReferrals, loadFacilities]);

    // Every figure below is counted from the records on this device — they are
    // labelled that way, and the district-wide view is the Command Center's.
    const now = new Date();
    const seenTodayCount = patients.filter(p => isToday(p.timestamp, now) || (p.visits ?? []).some(v => isToday(v.date, now))).length;
    const activeReferralsCount = referrals.filter(r => isOpenReferral(r.status)).length;
    const maternalHighRiskCount = patients.filter(p => (p.highRiskFlags ?? []).some(f => f.type === 'MATERNAL')).length;
    const district = dep('district', language);

    // Bed occupancy is summed from the facility records rather than asserted.
    // If no facility reports bed capacity, the row says so instead of showing a figure.
    const bedTotal = facilities.reduce((n, f) => n + (f.beds?.total ?? 0), 0);
    const bedOccupied = facilities.reduce((n, f) => n + (f.beds?.occupied ?? 0), 0);
    const icuVacant = facilities.reduce((n, f) => n + ((f.beds?.icu?.total ?? 0) - (f.beds?.icu?.occupied ?? 0)), 0);
    const matVacant = facilities.reduce((n, f) => n + ((f.beds?.maternity?.total ?? 0) - (f.beds?.maternity?.occupied ?? 0)), 0);
    const bedPct = bedTotal > 0 ? Math.round((bedOccupied / bedTotal) * 100) : null;
    const inTransit = referrals.filter(r => r.status === 'ACCEPTED' && Boolean(r.inTransitAt)).length;
    const noData = isEn ? 'Not reported' : isHi ? 'सूचित नहीं' : 'नोंद नाही';

    const modules = [
        {
            code: 'M-01',
            title: isEn ? 'OPD Intake & AI Triage' : isHi ? 'ओपीडी पंजीकरण व डिजिटल ट्राइएज' : 'ओपीडी नोंदणी व डिजिटल ट्राइएज',
            dept: isEn ? 'Primary Clinical Care' : isHi ? 'प्राथमिक स्वास्थ्य सेवा' : 'प्राथमिक आरोग्य सेवा',
            desc: isEn
                ? 'On-device triage from measured vitals (SpO2, BP, pulse, respiration), spoken complaints in English, Hindi or Marathi, emergency prioritisation and an ordered OPD token queue.'
                : isHi
                ? 'लक्षणों व महत्वपूर्ण संकेतों (SpO2, रक्तचाप, शुगर) द्वारा मरीजों का तत्काल आपातकालीन वर्गीकरण एवं डिजिटल टोकन।'
                : 'लक्षणे व महत्त्वाच्या नोंदी (SpO2, रक्तदाब, साखर) द्वारे रुग्णांचे तात्काळ आपत्कालीन वर्गीकरण व डिजिटल टोकन.',
            href: '/opd',
            btn: isEn ? 'Launch OPD Intake →' : isHi ? 'ओपीडी शुरू करें →' : 'ओपीडी सुरू करा →',
            tag: isEn ? 'Point of Care' : 'आरोग्य केंद्र',
        },
        {
            code: 'M-02',
            title: isEn ? 'District Health Command (DHO)' : isHi ? 'जिला स्वास्थ्य आदेश कक्ष (DHO)' : 'जिल्हा आरोग्य आदेश कक्ष (DHO)',
            dept: isEn ? 'Public Health Command' : isHi ? 'स्वास्थ्य निगरानी' : 'आरोग्य संनियंत्रण',
            desc: isEn
                ? `Census, IPHS facility scorecards, travel burden avoided, referral audits and danger-sign escalations across the${district ? ` ${district}` : ''} facility network.`
                : isHi
                ? 'जिले के सभी उपकेंद्र, प्राथमिक स्वास्थ्य केंद्र व ग्रामीण अस्पतालों का सीधा सांख्यिकी एवं गुणवत्ता मूल्यांकन।'
                : 'जिल्ह्यातील सर्व उपकेंद्र, प्राथमिक आरोग्य केंद्र व ग्रामीण रुग्णालयांचे थेट संख्याशास्त्रीय व गुणवत्ता मूल्यमापन.',
            href: '/dashboard',
            btn: isEn ? 'Open Command Center →' : isHi ? 'डैशबोर्ड खोलें →' : 'डॅशबोर्ड उघडा →',
            tag: isEn ? 'Executive Hub' : 'प्रशासन',
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
        },
        {
            code: 'M-04',
            title: isEn ? 'Diagnostic Lab Coordination' : isHi ? 'निदान एवं प्रयोगशाला समन्वय' : 'निदान व प्रयोगशाळा समन्वय',
            dept: isEn ? 'Diagnostic Network' : isHi ? 'पैथोलॉजी व लैब नेटवर्क' : 'पॅथॉलॉजी व लॅब नेटवर्क',
            desc: isEn
                ? 'Sample collection tracking, nearest-lab routing for tests not available on site, and pathology result entry.'
                : isHi
                ? 'रक्त व मूत्र नमूना संग्रह, जांच स्थिति और प्राथमिक केंद्र पर अनुपलब्ध जांचों के लिए निकटतम लैब की स्वचालित मैपिंग।'
                : 'रक्त व मूत्र नमुने संकलन, तपासणी स्थिती व प्राथमिक केंद्रावर अनुपलब्ध चाचण्यांसाठी जवळच्या लॅबचे स्वयंचलित मॅपिंग.',
            href: '/diagnostics',
            btn: isEn ? 'Access Lab Network →' : isHi ? 'लैब नेटवर्क खोलें →' : 'लॅब नेटवर्क उघडा →',
            tag: isEn ? 'Lab Network' : 'प्रयोगशाळा',
        },
        {
            code: 'M-05',
            title: isEn ? 'Essential Medicine Stock (IPHS)' : isHi ? 'आवश्यक दवा उपलब्धता एवं स्टॉक' : 'आवश्यक औषध साठा व उपलब्धता',
            dept: isEn ? 'Supply Chain (IPHS)' : isHi ? 'दवा आपूर्ति विभाग' : 'औषध पुरवठा विभाग',
            desc: isEn
                ? 'IPHS Essential Drug List tracking, stock received and issued, low-stock and near-expiry alerts, and transparent ₹0 medicines for citizens.'
                : isHi
                ? 'IPHS मानकों के अनुसार मुफ्त दवा स्टॉक, तत्काल पुनःपूर्ति मांग और निकटतम एक्सपायरी दवाओं के अलर्ट।'
                : 'IPHS मानकांनुसार मोफत व अनुदानित औषध साठा, तात्काळ पुनर्भरती मागणी व नजीकच्या मुदतबाह्य औषधांचे अलर्ट.',
            href: '/medicine',
            btn: isEn ? 'Check Medicine Stock →' : isHi ? 'दवा स्टॉक देखें →' : 'औषध साठा तपासा →',
            tag: isEn ? 'Free Pharmacy' : 'औषधालय',
        },
        {
            code: 'M-06',
            title: isEn ? '108 / 102 Emergency Referral Pipeline' : isHi ? '१०८ / १०२ रोगी रेफरल ट्रैकर' : '१०८ / १०२ रुग्ण रेफरल ट्रॅकर',
            dept: isEn ? 'Emergency Medical Services' : isHi ? 'आपातकालीन संदर्भ सेवा' : 'आपत्कालीन संदर्भ सेवा',
            desc: isEn
                ? 'Multi-tier referral tracker from Sub-Centre to District Hospital: the record reaches the receiving facility first, with the 108/102 vehicle the sender records. Ambulances are called by phone; the app does not dispatch them.'
                : isHi
                ? 'उपकेंद्र से जिला अस्पताल सीधा रेफरल, एम्बुलेंस समन्वय और उच्च केंद्र को डिजिटल स्वास्थ्य रिकॉर्ड (LHR) प्रेषण।'
                : 'उपकेंद्र ते जिल्हा रुग्णालय थेट रुग्ण रेफरल, रुग्णवाहिका समन्वय व उच्च केंद्राकडे डिजिटल आरोग्य नोंद (LHR) पाठवणे.',
            href: '/referrals',
            btn: isEn ? 'Track Referrals →' : isHi ? 'रेफरल पाइपलाइन देखें →' : 'रेफरल पाइपलाइन →',
            tag: isEn ? 'Emergency Transit' : 'रुग्णवाहिका',
        },
        {
            code: 'M-07',
            title: isEn ? 'OPD Queue & Token Board' : isHi ? 'ओपीडी कतार एवं टोकन प्रबंधन' : 'ओपीडी रांग व टोकन व्यवस्थापन',
            dept: isEn ? 'Patient Services' : isHi ? 'अस्पताल प्रबंधन' : 'रुग्णालय व्यवस्थापन',
            desc: isEn
                ? 'Live token display, wait times measured from the tokens themselves, priority calling, and a full-screen waiting-room TV display.'
                : isHi
                ? 'डिजिटल टोकन नंबर, अनुमानित प्रतीक्षा समय और विभागों के अनुसार तत्काल प्राथमिकता कतार नियंत्रण प्रणाली।'
                : 'डिजिटल टोकन क्रमांक, अंदाजित प्रतीक्षा वेळ व विभागांनुसार तात्काळ प्राधान्य रांग नियंत्रण प्रणाली.',
            href: '/queue',
            btn: isEn ? 'View Queue Board →' : isHi ? 'कतार बोर्ड देखें →' : 'रांग फलक पहा →',
            tag: isEn ? 'Live Queue' : 'रांग फलक',
        },
        {
            code: 'M-08',
            title: isEn ? 'Assisted Teleconsultation Record' : isHi ? 'सहायता प्राप्त टेलीकंसल्टेशन रिकॉर्ड' : 'सहाय्यित टेलिकन्सल्टेशन नोंद',
            dept: isEn ? 'Specialist Telemedicine Hub' : isHi ? 'टेलीमेडिसिन विभाग' : 'टेलिमेडिसिन विभाग',
            desc: isEn
                ? 'A structured record for a specialist consult — shared vitals, notes and orders — kept beside the call. The call itself runs on eSanjeevani; audio and video are not built into this app.'
                : isHi
                ? 'विशेषज्ञ परामर्श का संरचित रिकॉर्ड — साझा वाइटल्स, नोट्स व आदेश। कॉल ई-संजीवनी पर होती है; ऑडियो/वीडियो इस ऐप में नहीं है।'
                : 'तज्ज्ञ सल्ल्याची संरचित नोंद — सामायिक वाइटल्स, नोंदी व आदेश. कॉल ई-संजीवनीवर होतो; ऑडिओ/व्हिडिओ या ॲपमध्ये नाही.',
            href: '/teleconsult',
            btn: isEn ? 'Open consult record →' : isHi ? 'परामर्श रिकॉर्ड खोलें →' : 'सल्ला नोंद उघडा →',
            tag: isEn ? 'Specialist Hub' : 'तज्ज्ञ डॉक्टर',
        },
        {
            code: 'M-09',
            title: isEn ? '4-Tier Health Facility Directory' : isHi ? '४-स्तरीय स्वास्थ्य संस्था निर्देशिका' : '४-स्तरीय आरोग्य संस्था निर्देशिका',
            dept: isEn ? 'Health Infrastructure' : isHi ? 'बुनियादी ढांचा व मानव संसाधन' : 'पायाभूत सुविधा व मनुष्यबळ',
            desc: isEn
                ? 'Sub-Centre (Health Temple) → Primary Health Centre (PHC) → Community Health Centre (CHC) → District Hospital (DH) hierarchy with each facility\'s reported bed status.'
                : isHi
                ? 'उपकेंद्र (आरोग्य मंदिर) → प्राथमिक स्वास्थ्य केंद्र → सामुदायिक स्वास्थ्य केंद्र → जिला अस्पताल का नक्शा व बिस्तरों की जानकारी।'
                : 'उपकेंद्र (आरोग्य मंदिर) → प्राथमिक आरोग्य केंद्र → ग्रामीण रुग्णालय → जिल्हा रुग्णालय नकाशा व खाटांची माहिती.',
            href: '/facilities',
            btn: isEn ? 'Explore Facilities →' : isHi ? 'संस्था निर्देशिका देखें →' : 'संस्था निर्देशिका →',
            tag: isEn ? 'Directory' : 'मार्गदर्शक',
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
            ? `Unified digital care delivery, triage intelligence, cross-tier referrals, and electronic health records connecting Sub-Centres, PHCs, CHCs, and the District Hospital${district ? ` in ${district}` : ''}.`
            : isHi
            ? 'गढ़चिरौली एवं दुर्गम आदिवासी क्षेत्रों के उपकेंद्रों, प्राथमिक स्वास्थ्य केंद्रों (PHC), ग्रामीण अस्पतालों (CHC) व जिला अस्पताल (DH) के बीच निर्बाध डिजिटल स्वास्थ्य सेवा प्रणाली।'
            : 'गडचिरोली व दुर्गम आदिवासी भागातील आरोग्य उपकेंद्रे, प्राथमिक आरोग्य केंद्रे (PHC), ग्रामीण रुग्णालये (CHC) व जिल्हा रुग्णालय (DH) यांमधील अखंड डिजिटल आरोग्य सेवा व सातत्य व्यवस्थापन प्रणाली.',
        // What this table is: counts of the records held on this device. It used
        // to call itself a live district census synchronised across the network,
        // which a single device's IndexedDB is not.
        censusTitle: isEn
            ? 'Health Census — Records on This Device'
            : isHi
            ? 'स्वास्थ्य सांख्यिकी — इस डिवाइस के अभिलेख'
            : 'आरोग्य आकडेवारी — या उपकरणावरील नोंदी',
        censusDate: isEn
            ? 'Counted from this device\'s records. District-wide figures are on the District Health Command.'
            : isHi
            ? 'इस डिवाइस के अभिलेखों से गिना गया। जिला-स्तरीय आँकड़े जिला स्वास्थ्य कमांड पर हैं।'
            : 'या उपकरणावरील नोंदींवरून मोजले. जिल्हास्तरीय आकडे जिल्हा आरोग्य कमांडवर आहेत.',
        stat1Label: isEn ? 'Patients Registered or Seen Today' : isHi ? 'आज पंजीकृत या देखे गए मरीज' : 'आज नोंदवलेले किंवा तपासलेले रुग्ण',
        stat1Sub: isEn ? `${patients.length} patient records on this device in all` : isHi ? `इस डिवाइस पर कुल ${patients.length} मरीज़ अभिलेख` : `या उपकरणावर एकूण ${patients.length} रुग्ण नोंदी`,
        stat2Label: isEn ? 'Open Referrals' : isHi ? 'खुले रेफरल' : 'चालू संदर्भ (रेफरल)',
        stat2Sub: isEn ? 'Sent and not yet closed' : isHi ? 'भेजे गए, अभी बंद नहीं' : 'पाठवलेले, अद्याप बंद नाहीत',
        stat3Label: isEn ? 'High-Risk Pregnancies (ANC)' : isHi ? 'उच्च जोखिम गर्भावस्था (ANC)' : 'उच्च जोखीम गरोदरपणा (ANC)',
        stat3Sub: isEn ? 'Patients with a maternal high-risk flag' : isHi ? 'मातृ उच्च-जोखिम चिह्न वाले मरीज़' : 'माता उच्च-जोखीम चिन्ह असलेले रुग्ण',
        stat4Label: isEn ? 'Bed Occupancy' : isHi ? 'बिस्तर अधिभोग' : 'खाटांचा वापर',
        stat4Sub: isEn ? 'Summed across reporting facilities' : isHi ? 'रिपोर्टिंग केंद्रों का योग' : 'नोंद करणाऱ्या केंद्रांची बेरीज',
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
            ? 'Citizens can locate the nearest public health center, see the services, clinic days and free entitlements at each, check which ₹0 essential medicines are in stock, and verify their Ayushman Bharat (ABHA) number.'
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
            ? 'Service and entitlement information here is drawn from published National Health Mission and Government of Maharashtra guidelines; confirm with your facility. OPD consultation and essential drugs are free at government health facilities under NHM.'
            : isHi
            ? 'यहाँ सेवाओं व पात्रताओं की जानकारी राष्ट्रीय स्वास्थ्य मिशन व महाराष्ट्र सरकार के प्रकाशित दिशानिर्देशों से ली गई है; अपने स्वास्थ्य केंद्र से पुष्टि करें। सरकारी स्वास्थ्य केंद्रों पर ओपीडी परामर्श व आवश्यक दवाएं NHM के तहत निःशुल्क हैं।'
            : 'येथील सेवा व पात्रतेची माहिती राष्ट्रीय आरोग्य अभियान व महाराष्ट्र शासनाच्या प्रकाशित मार्गदर्शक तत्त्वांवरून घेतली आहे; आपल्या आरोग्य केंद्रात खात्री करा. शासकीय आरोग्य केंद्रांवर ओपीडी सल्ला व आवश्यक औषधे NHM अंतर्गत मोफत आहेत.',
    };

    return (
        <>
        <Breadcrumb
            trail={[
                { label: isEn ? 'Home' : isHi ? 'मुख्य पृष्ठ' : 'मुख्य पृष्ठ', href: '/' },
                { label: isEn ? 'Departmental Services' : isHi ? 'विभागीय सेवाएं' : 'विभागीय सेवा' },
            ]}
        />
        <div className="max-w-[1600px] mx-auto px-3 sm:px-4 py-4 font-sans text-slate-800">
        <div className="grid grid-cols-12 gap-3 items-start">
        <div className="col-span-12 lg:col-span-9 min-w-0">
            {/* Government Portal Breadcrumb & Official Seal */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-5 border-b border-slate-300">
                <div>
                    <div className="flex items-center gap-2 text-xs font-bold text-gov-navy mb-1">
                        <StateEmblem size={18} />
                        <span>{pageTexts.deptTag}</span>
                    </div>
                    <h1 className="text-[19px] sm:text-[21px] font-bold text-gov-navy">
                        {pageTexts.heroTitle}
                    </h1>
                    <p className="text-[12.5px] text-slate-600 mt-1 max-w-4xl leading-snug">
                        {pageTexts.heroSub}
                    </p>
                </div>

            </div>

            {/* Official State & District Live Telemetry Table (NIC Style) */}
            <div className="my-5">
                <GovPanel title={pageTexts.censusTitle} meta={pageTexts.censusDate} flush>
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-[#EDF1F7] text-[#1F3A6E]">
                                <th scope="col" className="px-3 py-1.5 text-[11.5px] font-bold border-b border-[#B9C5D6]">
                                    {isEn ? 'Indicator' : isHi ? 'संकेतक' : 'निर्देशांक'}
                                </th>
                                <th scope="col" className="px-3 py-1.5 text-[11.5px] font-bold border-b border-[#B9C5D6] w-32 text-right">
                                    {isEn ? 'Value' : isHi ? 'मान' : 'मूल्य'}
                                </th>
                                <th scope="col" className="px-3 py-1.5 text-[11.5px] font-bold border-b border-[#B9C5D6] w-72 hidden sm:table-cell">
                                    {isEn ? 'Remarks' : isHi ? 'टिप्पणी' : 'शेरा'}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="text-[12.5px]">
                            {[
                                [pageTexts.stat1Label, String(seenTodayCount), pageTexts.stat1Sub],
                                [pageTexts.stat2Label, String(activeReferralsCount),
                                    `${pageTexts.stat2Sub} · ${inTransit} ${isEn ? 'patients in transit' : isHi ? 'मरीज़ मार्ग पर' : 'रुग्ण मार्गावर'}`],
                                [pageTexts.stat3Label, String(maternalHighRiskCount), pageTexts.stat3Sub],
                                [pageTexts.stat4Label,
                                    bedPct === null ? noData : `${bedPct}%`,
                                    bedTotal > 0
                                        ? `${bedOccupied} / ${bedTotal} ${isEn ? 'occupied' : isHi ? 'भरे' : 'भरलेले'} · ICU ${icuVacant} · ${isEn ? 'Maternity' : isHi ? 'प्रसूति' : 'प्रसूती'} ${matVacant} ${isEn ? 'vacant' : isHi ? 'रिक्त' : 'रिक्त'}`
                                        : noData],
                            ].map((row, i) => (
                                <tr key={row[0]} className={`border-b border-[#E2E8F1] ${i % 2 === 1 ? 'bg-[#F6F8FB]' : 'bg-white'}`}>
                                    <td className="px-3 py-2 text-[#243449]">{row[0]}</td>
                                    <td className="px-3 py-2 text-right font-bold text-[#1F3A6E] tabular-nums">{row[1]}</td>
                                    <td className="px-3 py-2 text-[11.5px] text-[#4A5A73] hidden sm:table-cell">{row[2]}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </GovPanel>
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

                <div className="border border-[#B9C5D6] bg-white overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[640px]">
                        <thead>
                            <tr className="bg-[#1F3A6E] text-white">
                                <th scope="col" className="px-3 py-2 text-[11.5px] font-bold w-14">
                                    {isEn ? 'Sr. No.' : isHi ? 'क्र.' : 'अ.क्र.'}
                                </th>
                                <th scope="col" className="px-3 py-2 text-[11.5px] font-bold">
                                    {isEn ? 'Service / Module' : isHi ? 'सेवा / मॉड्यूल' : 'सेवा / विभाग'}
                                </th>
                                <th scope="col" className="px-3 py-2 text-[11.5px] font-bold w-52 hidden md:table-cell">
                                    {isEn ? 'Administering Section' : isHi ? 'प्रशासनिक अनुभाग' : 'प्रशासकीय विभाग'}
                                </th>
                                <th scope="col" className="px-3 py-2 text-[11.5px] font-bold w-44 text-right">
                                    {isEn ? 'Access' : isHi ? 'प्रवेश' : 'प्रवेश'}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {modules.map((m, i) => (
                                <tr
                                    key={m.code}
                                    className={`border-t border-[#D5DDE8] align-top ${i % 2 === 1 ? 'bg-[#F6F8FB]' : 'bg-white'}`}
                                >
                                    <td className="px-3 py-2.5 text-[12px] text-[#4A5A73] tabular-nums">{i + 1}.</td>
                                    <td className="px-3 py-2.5">
                                        <Link href={m.href} className="text-[13px] font-bold text-[#1F3A6E] hover:underline">
                                            {m.title}
                                        </Link>
                                        <p className="text-[11.5px] text-[#4A5A73] leading-snug mt-0.5 max-w-3xl">{m.desc}</p>
                                    </td>
                                    <td className="px-3 py-2.5 text-[11.5px] text-[#4A5A73] hidden md:table-cell">{m.dept}</td>
                                    <td className="px-3 py-2.5 text-right">
                                        <Link href={m.href} className="text-[11.5px] font-semibold text-[#1F3A6E] hover:underline whitespace-nowrap">
                                            {m.btn}
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Official Citizen and Staff Cadre Portals (NIC Gateways) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
                {/* Citizen Services Box */}
                <div className="bg-white border border-[#B9C5D6] p-4 flex flex-col justify-between">
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
                        {/* /medicine is the staff stock register; citizens see which free
                            medicines their centre has in stock on Services & Entitlements. */}
                        <Link href="/services-info" className="gov-btn gov-btn-secondary text-xs">
                            {pageTexts.checkMeds}
                        </Link>
                        <Link href="/login" className="gov-btn gov-btn-primary text-xs">
                            {pageTexts.citizenLoginBtn}
                        </Link>
                    </div>
                </div>

                {/* Staff & Medical Cadre Box */}
                <div className="bg-white border border-[#B9C5D6] p-4 flex flex-col justify-between">
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

        <div className="col-span-12 lg:col-span-3 min-w-0">
            <PortalAside tier="PHC" />
        </div>
        </div>
        </div>
        </>
    );
}
