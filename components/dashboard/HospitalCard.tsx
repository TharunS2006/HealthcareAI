/**
 * Hospital Capacity Card - NalamMesh
 * Visualizes bed occupancy and resource availability
 */

'use client';

import { motion } from 'framer-motion';
import { Hospital } from '@/lib/data/hospitals';

interface HospitalCardProps {
    hospital: Hospital;
}

export default function HospitalCard({ hospital }: HospitalCardProps) {
    const { icu, emergency, general } = hospital.capacity;

    // Percentage Calculations
    const icuPct = (icu.occupied / icu.total) * 100;
    const emgPct = (emergency.occupied / emergency.total) * 100;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="surface-card p-6 border-l-4 border-l-emerald-500 relative overflow-hidden flex flex-col justify-between"
        >
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="font-bold text-lg text-emerald-deep leading-tight">{hospital.name}</h3>
                    <p className="text-xs text-txt-muted mt-1 uppercase tracking-wide">{hospital.type}</p>
                </div>
                <div className={`px-2 py-1 rounded text-xs font-bold ${icu.total - icu.occupied < 3
                    ? 'bg-red-100 text-red-700'
                    : 'bg-green-100 text-green-700'
                    }`}>
                    {icu.total - icu.occupied < 3 ? 'NEAR CAPACITY' : 'ACCEPTING'}
                </div>
            </div>

            <div className="space-y-4">
                {/* ICU Capacity */}
                <div>
                    <div className="flex justify-between text-xs mb-1 font-bold">
                        <span className="text-txt-secondary">ICU Beds</span>
                        <span className={icuPct > 90 ? 'text-red-600' : 'text-emerald-600'}>
                            {icu.occupied}/{icu.total}
                        </span>
                    </div>
                    <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${icuPct}%` }}
                            transition={{ duration: 1 }}
                            className={`h-full rounded-full ${icuPct > 90 ? 'bg-red-500' : 'bg-emerald-500'}`}
                        />
                    </div>
                </div>

                {/* Emergency Capacity */}
                <div>
                    <div className="flex justify-between text-xs mb-1 font-bold">
                        <span className="text-txt-secondary">Trauma / ER</span>
                        <span className={emgPct > 85 ? 'text-yellow-600' : 'text-blue-600'}>
                            {emergency.occupied}/{emergency.total}
                        </span>
                    </div>
                    <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${emgPct}%` }}
                            transition={{ duration: 1, delay: 0.2 }}
                            className={`h-full rounded-full ${emgPct > 85 ? 'bg-yellow-500' : 'bg-blue-500'}`}
                        />
                    </div>
                </div>

                {/* Specialties Tags */}
                <div className="flex flex-wrap gap-1 mt-2">
                    {hospital.specialties.slice(0, 3).map(s => (
                        <span key={s} className="text-[10px] bg-gray-50 text-txt-secondary px-2 py-1 rounded border border-gray-100 font-medium">
                            {s}
                        </span>
                    ))}
                </div>

                {/* Live Resource Availability */}
                <div className="pt-3 border-t border-gray-100 grid grid-cols-3 gap-1.5 text-center">
                    <div className="bg-emerald-50 rounded-lg p-1 border border-emerald-100 min-w-0">
                        <span className="block text-base md:text-lg font-bold text-emerald-700 truncate">{hospital.resources_available.doctors}</span>
                        <span className="block text-[7px] md:text-[8px] uppercase font-bold text-emerald-800/60 truncate">Doctors</span>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-1 border border-blue-100 min-w-0">
                        <span className="block text-base md:text-lg font-bold text-blue-700 truncate">{hospital.resources_available.nurses}</span>
                        <span className="block text-[7px] md:text-[8px] uppercase font-bold text-blue-800/60 truncate">Nurses</span>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-1 border border-purple-100 min-w-0">
                        <span className="block text-base md:text-lg font-bold text-purple-700 truncate">{hospital.resources_available.oxygen_cylinders}</span>
                        <span className="block text-[7px] md:text-[8px] uppercase font-bold text-purple-800/60 truncate">O2 Cyl</span>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
