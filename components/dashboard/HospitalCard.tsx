/**
 * Facility / Hospital Capacity Card — NalamMesh
 * Visualizes bed occupancy and staff/resource availability for Maharashtra public facilities
 */

'use client';

import { motion } from 'framer-motion';
import { Facility } from '@/types/facility';

interface HospitalCardProps {
    hospital: Facility;
}

export default function HospitalCard({ hospital }: HospitalCardProps) {
    const { beds, staff } = hospital;
    const bedPct = beds.total > 0 ? (beds.occupied / beds.total) * 100 : 0;
    const isNearCapacity = beds.total > 0 && (beds.total - beds.occupied) <= 2;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="surface-card p-6 border-l-4 border-l-emerald-500 relative overflow-hidden flex flex-col justify-between"
        >
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="font-bold text-lg text-emerald-deep leading-tight">{hospital.name}</h3>
                    <p className="text-xs text-txt-muted mt-1 uppercase tracking-wide">
                        Tier: {hospital.type} • {hospital.tehsil} Tehsil
                    </p>
                </div>
                <div className={`px-2 py-1 rounded text-xs font-bold ${
                    isNearCapacity ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                }`}>
                    {isNearCapacity ? 'NEAR CAPACITY' : 'ACCEPTING'}
                </div>
            </div>

            <div className="space-y-4">
                {/* Bed Capacity */}
                {beds.total > 0 && (
                    <div>
                        <div className="flex justify-between text-xs mb-1 font-bold">
                            <span className="text-txt-secondary">Bed Occupancy</span>
                            <span className={bedPct > 85 ? 'text-red-600' : 'text-emerald-600'}>
                                {beds.occupied}/{beds.total} Beds
                            </span>
                        </div>
                        <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${bedPct}%` }}
                                transition={{ duration: 1 }}
                                className={`h-full rounded-full ${bedPct > 85 ? 'bg-red-500' : 'bg-emerald-500'}`}
                            />
                        </div>
                    </div>
                )}

                {/* Services Tags */}
                <div className="flex flex-wrap gap-1 mt-2">
                    {hospital.services.slice(0, 3).map(s => (
                        <span key={s} className="text-[10px] bg-gray-50 text-txt-secondary px-2 py-1 rounded border border-gray-100 font-medium">
                            {s}
                        </span>
                    ))}
                </div>

                {/* Live Staff / Resource Availability */}
                <div className="pt-3 border-t border-gray-100 grid grid-cols-3 gap-1.5 text-center">
                    <div className="bg-emerald-50 rounded-lg p-1 border border-emerald-100 min-w-0">
                        <span className="block text-base md:text-lg font-bold text-emerald-700 truncate">{staff.doctors}</span>
                        <span className="block text-[7px] md:text-[8px] uppercase font-bold text-emerald-800/60 truncate">Doctors</span>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-1 border border-blue-100 min-w-0">
                        <span className="block text-base md:text-lg font-bold text-blue-700 truncate">{staff.nurses}</span>
                        <span className="block text-[7px] md:text-[8px] uppercase font-bold text-blue-800/60 truncate">Nurses</span>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-1 border border-purple-100 min-w-0">
                        <span className="block text-base md:text-lg font-bold text-purple-700 truncate">{hospital.ambulanceAvailable}</span>
                        <span className="block text-[7px] md:text-[8px] uppercase font-bold text-purple-800/60 truncate">Ambulance</span>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
