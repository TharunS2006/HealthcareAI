/**
 * ABDM / FHIR R4 Interoperability Inspector — NalamMesh (SIH PS#26133)
 * Locally generates, validates, and exports (JSON download) FHIR R4 Document Bundles built
 * to the NDHM/ABDM profile. This is an ABDM-ready export, not a live gateway integration:
 * no bundle is transmitted to ABDM here. The milestone tab maps the integration roadmap.
 */

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Patient } from '@/types/patient';
import { generateFHIRBundle } from '@/lib/fhir';
import Icon from '@/components/gov/Icon';
import toast from 'react-hot-toast';

interface FHIRModalProps {
    patient: Patient;
    isOpen: boolean;
    onClose: () => void;
}

export default function FHIRModal({ patient, isOpen, onClose }: FHIRModalProps) {
    const [copied, setCopied] = useState(false);
    const [selectedTab, setSelectedTab] = useState<'RESOURCES' | 'RAW_JSON' | 'ABDM_MILESTONES'>('RESOURCES');

    if (!isOpen || !patient) return null;

    const bundle = generateFHIRBundle(patient);
    const jsonString = JSON.stringify(bundle, null, 2);

    const handleCopy = () => {
        navigator.clipboard.writeText(jsonString);
        setCopied(true);
        toast.success('FHIR R4 Bundle copied to clipboard');
        setTimeout(() => setCopied(false), 3000);
    };

    const handleDownload = () => {
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `FHIR-R4-ABDM-${patient.id}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(`Downloaded FHIR-R4-ABDM-${patient.id}.json`);
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 overflow-y-auto">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="bg-white rounded shadow-xl border border-border-subtle max-w-4xl w-full overflow-hidden my-6 flex flex-col max-h-[90vh]"
                >
                    {/* Header */}
                    <div className="bg-emerald-950 text-white p-5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded bg-teal-500/20 border border-teal-400/30 flex items-center justify-center">
                                <Icon name="document" className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-extrabold bg-teal-400/20 text-teal-300 border border-teal-400/40 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                        NRCeS • ABDM FHIR R4 StructureDefinition
                                    </span>
                                </div>
                                <h2 className="text-xl font-extrabold tracking-tight mt-0.5">
                                    ABDM Interoperability Inspector — {patient.name}
                                </h2>
                            </div>
                        </div>

                        <button
                            onClick={onClose}
                            className="text-white/70 hover:text-white text-2xl font-bold p-1 rounded-lg hover:bg-white/10"
                        >
                            ✕
                        </button>
                    </div>

                    {/* Navigation Tabs & Actions Bar */}
                    <div className="bg-gray-50 border-b border-border-subtle p-3 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setSelectedTab('RESOURCES')}
                                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                    selectedTab === 'RESOURCES'
                                        ? 'bg-emerald-deep text-white shadow-sm'
                                        : 'bg-white text-txt-secondary border border-border-subtle hover:bg-gray-100'
                                }`}
                            >
                                <Icon name="archive-box" className="w-3.5 h-3.5 inline -mt-0.5 mr-1" /> FHIR Resources ({bundle.entry.length})
                            </button>
                            <button
                                onClick={() => setSelectedTab('RAW_JSON')}
                                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                    selectedTab === 'RAW_JSON'
                                        ? 'bg-emerald-deep text-white shadow-sm'
                                        : 'bg-white text-txt-secondary border border-border-subtle hover:bg-gray-100'
                                }`}
                            >
                                {'{ }'} Raw FHIR JSON
                            </button>
                            <button
                                onClick={() => setSelectedTab('ABDM_MILESTONES')}
                                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                    selectedTab === 'ABDM_MILESTONES'
                                        ? 'bg-emerald-deep text-white shadow-sm'
                                        : 'bg-white text-txt-secondary border border-border-subtle hover:bg-gray-100'
                                }`}
                            >
                                <Icon name="government" className="w-3.5 h-3.5 inline -mt-0.5 mr-1" /> ABDM M1/M2/M3 Roadmap
                            </button>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleCopy}
                                className="px-3 py-1.5 bg-white border border-border-subtle hover:bg-gray-100 text-txt-primary text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm"
                            >
                                {copied ? <Icon name="check-circle" className="w-3.5 h-3.5" /> : <Icon name="clipboard" className="w-3.5 h-3.5" />}
                                <span>{copied ? 'Copied' : 'Copy JSON'}</span>
                            </button>
                            <button
                                onClick={handleDownload}
                                className="px-3.5 py-1.5 bg-emerald-deep hover:bg-emerald-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm"
                            >
                                <Icon name="download" className="w-3.5 h-3.5" />
                                <span>Download Bundle</span>
                            </button>
                        </div>
                    </div>

                    {/* Modal Content */}
                    <div className="p-6 overflow-y-auto flex-1 text-txt-primary">
                        {selectedTab === 'RESOURCES' && (
                            <div className="space-y-4">
                                <div className="p-4 bg-teal-50/70 border border-teal-200 rounded-2xl flex items-center justify-between text-xs text-teal-950">
                                    <div>
                                        <strong className="block text-teal-900 font-extrabold text-sm">
                                            Bundle Type: {bundle.type} • ID: {bundle.id}
                                        </strong>
                                        <span>Target Profile: NDHM Ayushman Bharat Digital Mission (ABDM) Document Bundle</span>
                                    </div>
                                    <span className="bg-teal-700 text-white font-extrabold px-3 py-1 rounded-full text-xs">
                                        ABHA: {patient.abhaId || 'LINKED'}
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {bundle.entry.map((entry, idx) => {
                                        const res = entry.resource;
                                        return (
                                            <div
                                                key={idx}
                                                className="p-4 bg-white border border-border-subtle rounded-2xl hover:border-emerald-300 hover:shadow-md transition-all space-y-2"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-extrabold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                                                        {res.resourceType}
                                                    </span>
                                                    <span className="text-[10px] text-txt-muted font-mono truncate max-w-[150px]">
                                                        {res.id}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-txt-secondary space-y-1">
                                                    {res.resourceType === 'Patient' && (
                                                        <>
                                                            <p><strong>Name:</strong> {res.name?.[0]?.text || patient.name}</p>
                                                            <p><strong>Gender / Age:</strong> {res.gender} • {patient.age} yrs</p>
                                                            <p><strong>Location:</strong> {patient.village}, {patient.district}, {patient.state}</p>
                                                        </>
                                                    )}
                                                    {res.resourceType === 'Encounter' && (
                                                        <>
                                                            <p><strong>Status:</strong> {res.status} ({res.class?.display})</p>
                                                            <p><strong>Triage Class:</strong> {patient.triageStatus} Priority</p>
                                                            <p><strong>GPS:</strong> [{patient.gps?.lat}, {patient.gps?.lng}]</p>
                                                        </>
                                                    )}
                                                    {res.resourceType === 'Observation' && (
                                                        <>
                                                            <p><strong>Code:</strong> {res.code?.coding?.[0]?.display || 'Vital Sign'}</p>
                                                            <p><strong>Value:</strong> {res.valueQuantity ? `${res.valueQuantity.value} ${res.valueQuantity.unit}` : res.valueString || 'Recorded'}</p>
                                                        </>
                                                    )}
                                                    {res.resourceType === 'Condition' && (
                                                        <>
                                                            <p><strong>Clinical Condition:</strong> {res.code?.text || patient.vitals?.injuryType}</p>
                                                            <p><strong>Severity:</strong> {res.severity?.coding?.[0]?.display || patient.triagePriority}</p>
                                                        </>
                                                    )}
                                                    {res.resourceType === 'ServiceRequest' && (
                                                        <>
                                                            <p><strong>Intent:</strong> Referral Service Request</p>
                                                            <p><strong>Priority:</strong> {patient.triagePriority}</p>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {selectedTab === 'RAW_JSON' && (
                            <div className="relative">
                                <pre className="bg-slate-950 text-emerald-400 p-4 rounded-2xl text-xs font-mono overflow-x-auto max-h-[500px] leading-relaxed border border-slate-800">
                                    <code>{jsonString}</code>
                                </pre>
                            </div>
                        )}

                        {selectedTab === 'ABDM_MILESTONES' && (
                            <div className="space-y-4 text-xs text-txt-secondary">
                                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-1">
                                    <h4 className="font-extrabold text-emerald-900 text-sm">
                                        Ayushman Bharat Digital Mission (ABDM) Interoperability Roadmap
                                    </h4>
                                    <p>
                                        The exported FHIR R4 bundle is built to the ABDM profile. Live exchange with the National Health Authority (NHA) ABDM ecosystem is the integration roadmap below — not yet wired:
                                    </p>
                                </div>

                                <div className="space-y-3">
                                    <div className="p-4 bg-white border border-border-subtle rounded-2xl flex items-start gap-3">
                                        <Icon name="check-circle" className="w-5 h-5 text-emerald-700 flex-shrink-0" />
                                        <div>
                                            <strong className="text-sm font-bold text-emerald-deep block">
                                                Milestone 1 (M1): ABHA Creation & Verification
                                            </strong>
                                            <p className="mt-0.5">
                                                Generates and validates 14-digit ABHA IDs via Aadhaar OTP / mobile simulation and issues compliant offline QR wristbands.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="p-4 bg-white border border-border-subtle rounded-2xl flex items-start gap-3">
                                        <Icon name="check-circle" className="w-5 h-5 text-emerald-700 flex-shrink-0" />
                                        <div>
                                            <strong className="text-sm font-bold text-emerald-deep block">
                                                Milestone 2 (M2): Health Information Provider (HIP)
                                            </strong>
                                            <p className="mt-0.5">
                                                Bundles local Sub-Centre / PHC clinical encounters, vitals, and e-prescriptions into FHIR R4 Document Bundles, ready to push to ABDM health lockers once gateway integration is enabled. Bundle generation and export work today; the push to ABDM is not yet wired.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="p-4 bg-white border border-border-subtle rounded-2xl flex items-start gap-3">
                                        <Icon name="check-circle" className="w-5 h-5 text-emerald-700 flex-shrink-0" />
                                        <div>
                                            <strong className="text-sm font-bold text-emerald-deep block">
                                                Milestone 3 (M3): Health Information User (HIU)
                                            </strong>
                                            <p className="mt-0.5">
                                                Roadmap: will let apex specialists at District Hospital Gadchiroli pull previous care records across facilities with cryptographic consent verification once ABDM HIU integration is enabled — not yet live.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
