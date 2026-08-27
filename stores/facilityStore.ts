/**
 * Facility & Inventory State Store
 * Manages Maharashtra facilities, essential medicine stock, and diagnostic orders
 */

import { create } from 'zustand';
import { Facility, MedicineStockItem, DiagnosticOrder } from '@/types/facility';
import {
    getAllFacilities,
    getAllMedicines,
    getAllDiagnostics,
    saveMedicine,
    saveDiagnostic
} from '@/lib/db';
import toast from 'react-hot-toast';

interface FacilityStore {
    facilities: Facility[];
    medicines: MedicineStockItem[];
    diagnostics: DiagnosticOrder[];
    selectedFacilityId: string;
    isLoading: boolean;

    // Actions
    loadAll: () => Promise<void>;
    setSelectedFacilityId: (id: string) => void;
    restockMedicine: (id: string, amount: number) => Promise<void>;
    updateDiagnosticResult: (id: string, result: string, isAbnormal: boolean) => Promise<void>;
}

export const useFacilityStore = create<FacilityStore>((set, get) => ({
    facilities: [],
    medicines: [],
    diagnostics: [],
    selectedFacilityId: 'phc-bhamragad',
    isLoading: false,

    setSelectedFacilityId: (id) => set({ selectedFacilityId: id }),

    loadAll: async () => {
        set({ isLoading: true });
        try {
            const [facs, meds, diags] = await Promise.all([
                getAllFacilities(),
                getAllMedicines(),
                getAllDiagnostics(),
            ]);
            set({
                facilities: facs,
                medicines: meds,
                diagnostics: diags,
                isLoading: false
            });
        } catch (error) {
            console.error('Failed to load facility data:', error);
            set({ isLoading: false });
        }
    },

    restockMedicine: async (id: string, amount: number) => {
        const med = get().medicines.find(m => m.id === id);
        if (!med) return;

        const newStock = med.currentStock + amount;
        let newStatus: MedicineStockItem['status'] = 'ADEQUATE';
        if (newStock === 0) newStatus = 'OUT_OF_STOCK';
        else if (newStock < med.minimumRequiredStock) newStatus = 'LOW';

        const updated: MedicineStockItem = {
            ...med,
            currentStock: newStock,
            status: newStatus,
            lastRestocked: new Date().toISOString().split('T')[0]
        };

        set(state => ({
            medicines: state.medicines.map(m => m.id === id ? updated : m)
        }));

        await saveMedicine(updated);
        toast.success(`Restocked ${amount} ${med.unit} of ${med.name}`);
    },

    updateDiagnosticResult: async (id: string, result: string, isAbnormal: boolean) => {
        const diag = get().diagnostics.find(d => d.id === id);
        if (!diag) return;

        const updated: DiagnosticOrder = {
            ...diag,
            status: 'COMPLETED',
            resultSummary: result,
            isAbnormal,
            completedAt: new Date().toISOString()
        };

        set(state => ({
            diagnostics: state.diagnostics.map(d => d.id === id ? updated : d)
        }));

        await saveDiagnostic(updated);
        toast.success(`Lab result recorded for ${diag.testName}`);
    }
}));
