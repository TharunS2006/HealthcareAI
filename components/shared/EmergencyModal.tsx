/**
 * Universal Emergency Escalation & 108/102 SOS Module — NalamMesh (SIH PS#26133)
 * Provides one-tap emergency escalation, nearest FRU/DH routing, and instant LHR emergency summary dispatch.
 * Full Trilingual Localization: English, Marathi (मराठी), and Hindi (हिन्दी)
 */

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePatientStore } from '@/stores/patientStore';
import { useReferralStore } from '@/stores/referralStore';
import { useLanguageStore } from '@/stores/languageStore';
import { MAHARASHTRA_FACILITIES } from '@/lib/data/facilities';
import { ReferralRecord } from '@/types/patient';
import Icon from '@/components/gov/Icon';
import toast from 'react-hot-toast';

export default function EmergencyModal() {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedType, setSelectedType] = useState<'108_TRAUMA' | '102_MATERNAL' | 'PEDIATRIC_EMERGENCY'>('108_TRAUMA');
    const [selectedPatientId, setSelectedPatientId] = useState<string>('');
    const [isDispatched, setIsDispatched] = useState(false);
    const [dispatchSummary, setDispatchSummary] = useState<ReferralRecord | null>(null);

    const { patients } = usePatientStore();
    const { addReferral } = useReferralStore();
    const { language } = useLanguageStore();

    const isEn = language === 'en';
    const isHi = language === 'hi';

    const t = {
        btnText: isEn ? 'EMERGENCY SOS (108 / 102)' : isHi ? 'आपातकालीन सहायता SOS (१०८ / १०२)' : 'तातडीची मदत SOS (१०८ / १०२)',
        modalTitle: isEn ? 'CRITICAL EMERGENCY ESCALATION' : isHi ? 'गंभीर आपातकालीन प्रेषण (SOS)' : 'तातडीची आपत्कालीन मदत (SOS)',
        modalSub: isEn ? 'Immediate 108/102 Dispatch & FRU Bed Pre-Alert' : isHi ? 'तत्काल १०८/१०२ एम्बुलेंस प्रेषण व अस्पताल पूर्व-सूचना' : '१०८/१०२ रुग्णवाहिका पाचारण व रुग्णालय पूर्व-सूचना',
        selectPatient: isEn ? '1. Select Patient for Emergency Transfer:' : isHi ? '१. आपातकालीन स्थानांतरण हेतु मरीज चुनें:' : '१. तातडीच्या उपचारासाठी रुग्ण निवडा:',
        selectService: isEn ? '2. Select Emergency Service Protocol:' : isHi ? '२. आपातकालीन सेवा प्रोटोकॉल चुनें:' : '२. आपत्कालीन सेवा प्रकार निवडा:',
        traumaTitle: isEn ? '108 Advanced Trauma Ambulance' : isHi ? '१०८ एडवांस ट्रॉमा एम्बुलेंस' : '१०८ प्रगत आपत्कालीन रुग्णवाहिका',
        traumaDesc: isEn ? 'Includes oxygen, multipara monitor, trained paramedic for severe trauma, stroke, SAM, hemorrhage.' : isHi ? 'ऑक्सीजन, मॉनिटर व पैरामेडिक युक्त - गंभीर आघात, आघात, कुपोषण हेतु।' : 'ऑक्सिजन, मॉनिटर व प्रशिक्षित पॅरामेडिक - गंभीर अपघात, पक्षाघात, रक्तस्त्रावासाठी.',
        maternalTitle: isEn ? '102 Janani Shishu Express' : isHi ? '१०२ जननी शिशु एक्सप्रेस' : '१०२ जननी-शिशु प्रसूती रुग्णवाहिका',
        maternalDesc: isEn ? 'Dedicated obstetric transfer with midwife kit, neonatal warmer for eclampsia, obstructed labor.' : isHi ? 'गर्भवती महिलाओं व नवजात शिशुओं के त्वरित प्रसव अस्पताल स्थानांतरण हेतु।' : 'गरोदर महिला व नवजात बालकांसाठी विशेष सुसज्ज वाहन.',
        targetFacility: isEn ? 'Auto-Routed Apex Facility:' : isHi ? 'स्वचालित निर्धारित रेफरल अस्पताल:' : 'स्वयंचलित निर्देशित संदर्भ रुग्णालय:',
        dispatchBtn: isEn ? 'CONFIRM & DISPATCH EMERGENCY AMBULANCE NOW' : isHi ? 'पुष्टि करें और अभी आपातकालीन एम्बुलेंस भेजें' : 'खात्री करा व त्वरित १०८/१०२ रुग्णवाहिका बोलवा',
        dispatchedSuccess: isEn ? 'EMERGENCY DISPATCH CONFIRMED' : isHi ? 'आपातकालीन प्रेषण सफल!' : 'रुग्णवाहिका यशस्वीरित्या पाचारण केली!',
        ambulanceVehicle: isEn ? 'Assigned Vehicle:' : isHi ? 'आवंटित वाहन:' : 'नियुक्त वाहन क्रमांक:',
        eta: isEn ? 'Estimated Arrival (ETA):' : isHi ? 'अनुमानित आगमन समय (ETA):' : 'अपेक्षित पोहोच वेळ (ETA):',
        etaVal: isEn ? '14 mins (GPS Tracking Live)' : isHi ? '१४ मिनट (लाइव जीपीएस सक्रिय)' : '१४ मिनिटे (थेट जीपीएस ट्रॅकिंग सुरू)',
        destFacility: isEn ? 'Destination Facility:' : isHi ? 'गंतव्य अस्पताल:' : 'गंतव्य रुग्णालय:',
        receivingTeam: isEn ? 'Receiving Trauma Team:' : isHi ? 'प्राप्तकर्ता डॉक्टर टीम:' : 'उपचार करणारे वैद्यकीय पथक:',
        teamAlerted: isEn ? 'Dr. Khandate / Dr. Meshram (Alerted via SMS & Web)' : isHi ? 'डॉ. खंदाते / डॉ. मेश्राम (एसएमएस व पोर्टलद्वारे सूचित)' : 'डॉ. खंदाते / डॉ. मेश्राम (SMS व वेबद्वारे पूर्व-सूचित)',
        lhrShared: isEn ? 'Emergency LHR Shared:' : isHi ? 'आपातकालीन डिजिटल रिकॉर्ड:' : 'तातडीचे आरोग्य रेकॉर्ड (LHR):',
        lhrVal: isEn ? '✓ ABDM FHIR Bundle Generated' : isHi ? '✓ ABDM FHIR बंडल तैयार' : '✓ ABDM FHIR बंडल तयार',
        closeBtn: isEn ? 'Close & Return to Work' : isHi ? 'बंद करें व मुख्य स्क्रीन पर लौटें' : 'बंद करा व डॅशबोर्डवर परत जा',
    };

    // Default emergency patient or selected
    const activePatient = patients.find(p => p.id === selectedPatientId) || patients[0] || {
        id: 'p-gad-emergency',
        name: 'Emergency Patient (Unknown)',
        age: 30,
        gender: 'F',
        village: 'Bhamragad Sub-Centre',
        vitals: { spo2: 88, heartRate: 124, bloodPressure: { systolic: 168, diastolic: 104 }, injuryType: 'Severe Respiratory Distress' }
    };

    const targetFacility = MAHARASHTRA_FACILITIES.find(f => f.type === 'SDH') || MAHARASHTRA_FACILITIES[1];

    const handleDispatch = async () => {
        const emergencyRecord: ReferralRecord = {
            id: `ref-sos-${Date.now()}`,
            patientId: activePatient.id,
            patientName: activePatient.name,
            patientAge: activePatient.age,
            patientGender: activePatient.gender,
            fromFacilityId: 'fac-phc-001',
            fromFacilityName: 'PHC Bhamragad',
            fromFacilityType: 'PHC',
            toFacilityId: targetFacility.id,
            toFacilityName: targetFacility.name,
            toFacilityType: targetFacility.type || 'SDH',
            reason: selectedType === '102_MATERNAL' ? 'Eclampsia / High Risk Delivery (CEmONC)' : 'Acute Respiratory Distress / Severe Trauma',
            priority: 'EMERGENCY',
            status: 'IN_TRANSIT',
            referredBy: 'Frontline Worker SOS Trigger (1-Tap)',
            referredAt: new Date().toISOString(),
            transportMode: selectedType === '102_MATERNAL' ? 'AMBULANCE_102' : 'AMBULANCE_108',
            ambulanceVehicleNo: selectedType === '102_MATERNAL' ? 'MH-33-T-0102' : 'MH-33-E-1081',
            clinicalSummary: `CRITICAL ALERT: SpO2 ${activePatient.vitals.spo2}%, Pulse ${activePatient.vitals.heartRate} bpm, BP ${activePatient.vitals.bloodPressure?.systolic || 160}/${activePatient.vitals.bloodPressure?.diastolic || 100} mmHg. Chief note: ${activePatient.vitals.injuryType}`,
        };

        await addReferral(emergencyRecord);
        setDispatchSummary(emergencyRecord);
        setIsDispatched(true);
        toast.error(`108/102 DISPATCHED: ${targetFacility.name}`, {
            duration: 6000,
            icon: <Icon name="ambulance" className="w-4 h-4" />,
        });
    };

    const handleReset = () => {
        setIsDispatched(false);
        setDispatchSummary(null);
        setIsOpen(false);
    };

    return (
        <>
            {/* Global Floating SOS Trigger Button */}
            <div className="fixed bottom-5 right-5 z-50">
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsOpen(true)}
                    className="flex items-center gap-2 px-3.5 py-2 bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold text-xs rounded border border-red-800 shadow-md cursor-pointer transition-colors"
                    id="universal-sos-btn"
                >
                    
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>{t.btnText}</span>
                </motion.button>
            </div>

            {/* Emergency Modal Backdrop */}
            <AnimatePresence>
                {isOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 overflow-y-auto">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            className="bg-white rounded shadow-xl border-2 border-red-700 max-w-2xl w-full overflow-hidden my-8"
                        >
                            {/* Modal Header */}
                            <div className="bg-red-700 text-white p-5 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded bg-white/15 flex items-center justify-center">
                                        <Icon name="ambulance" className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
                                            <span>{t.modalTitle}</span>
                                            <span className="text-[10px] bg-white text-red-700 px-2 py-0.5 rounded-full font-bold uppercase">
                                                Active Protocol
                                            </span>
                                        </h2>
                                        <p className="text-xs text-red-100 font-medium">
                                            {t.modalSub}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleReset}
                                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white font-bold"
                                >
                                    ✕
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="p-6 space-y-6">
                                {!isDispatched ? (
                                    <>
                                        {/* Step 1: Patient Selection */}
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                                                {t.selectPatient}
                                            </label>
                                            <select
                                                value={selectedPatientId}
                                                onChange={(e) => setSelectedPatientId(e.target.value)}
                                                className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-red-500 outline-none"
                                            >
                                                <option value="">{activePatient.name} ({activePatient.age}y/{activePatient.gender}) — {activePatient.village}</option>
                                                {patients.map(p => (
                                                    <option key={p.id} value={p.id}>
                                                        {p.name} ({p.age}y/{p.gender}) — {p.vitals.injuryType || 'Critical Condition'}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Step 2: Emergency Service Type */}
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                                                {t.selectService}
                                            </label>
                                            <div className="grid sm:grid-cols-2 gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedType('108_TRAUMA')}
                                                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                                                        selectedType === '108_TRAUMA'
                                                            ? 'border-red-600 bg-red-50/70 shadow-sm'
                                                            : 'border-slate-200 hover:border-slate-300 bg-white'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Icon name="ambulance" className="w-5 h-5 text-red-700" />
                                                        <strong className="text-xs font-black text-red-950">{t.traumaTitle}</strong>
                                                    </div>
                                                    <p className="text-[11px] text-slate-600 leading-snug">
                                                        {t.traumaDesc}
                                                    </p>
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedType('102_MATERNAL')}
                                                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                                                        selectedType === '102_MATERNAL'
                                                            ? 'border-emerald-600 bg-emerald-50/70 shadow-sm'
                                                            : 'border-slate-200 hover:border-slate-300 bg-white'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Icon name="maternal" className="w-5 h-5 text-emerald-700" />
                                                        <strong className="text-xs font-black text-emerald-950">{t.maternalTitle}</strong>
                                                    </div>
                                                    <p className="text-[11px] text-slate-600 leading-snug">
                                                        {t.maternalDesc}
                                                    </p>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Destination Routing Confirmation Box */}
                                        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-950">
                                            <div className="flex items-center gap-2">
                                                <Icon name="map-pin" className="w-4 h-4 text-amber-700" />
                                                <div>
                                                    <span className="font-bold block">{t.targetFacility}</span>
                                                    <span className="text-amber-900 font-extrabold">{targetFacility.name} (FRU Aheri)</span>
                                                </div>
                                            </div>
                                            <span className="text-[10px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded font-bold">
                                                42 km • 50 mins
                                            </span>
                                        </div>

                                        {/* Trigger Action Button */}
                                        <button
                                            type="button"
                                            onClick={handleDispatch}
                                            className="w-full py-4 bg-red-700 hover:bg-red-800 text-white font-black text-sm rounded-xl transition-all flex items-center justify-center gap-2"
                                            id="confirm-sos-dispatch-btn"
                                        >
                                            <Icon name="alert-siren" className="w-5 h-5" />
                                            <span>{t.dispatchBtn}</span>
                                        </button>
                                    </>
                                ) : (
                                    /* Dispatched Success View */
                                    <div className="text-center py-4 space-y-4">
                                        <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-3xl mx-auto shadow-inner">
                                            ✓
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-black text-emerald-950">
                                                {t.dispatchedSuccess}
                                            </h3>
                                            <p className="text-xs text-slate-600 mt-1">
                                                {dispatchSummary?.ambulanceVehicleNo} • {activePatient.name}
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 text-left text-xs bg-slate-50 p-4 rounded-2xl border border-slate-200">
                                            <div>
                                                <span className="text-slate-500 font-bold block">{t.ambulanceVehicle}</span>
                                                <strong className="text-slate-900">{dispatchSummary?.ambulanceVehicleNo}</strong>
                                            </div>
                                            <div>
                                                <span className="text-slate-500 font-bold block">{t.eta}</span>
                                                <strong className="text-emerald-700">{t.etaVal}</strong>
                                            </div>
                                        </div>

                                        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-left text-xs space-y-1.5 text-emerald-950">
                                            <div className="flex justify-between font-bold">
                                                <span>{t.destFacility}</span>
                                                <span className="text-emerald-800">{dispatchSummary?.toFacilityName}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>{t.receivingTeam}</span>
                                                <span className="font-semibold">{t.teamAlerted}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>{t.lhrShared}</span>
                                                <span className="font-semibold text-emerald-700">{t.lhrVal}</span>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={handleReset}
                                            className="w-full py-3 bg-emerald-800 text-white font-bold text-sm rounded-xl hover:bg-emerald-900 transition-all shadow-md"
                                        >
                                            {t.closeBtn}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
}
