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
    saveDiagnostic,
    saveFacility as persistFacility,
} from '@/lib/db';
import toast from 'react-hot-toast';
import { applyMovement, type StockMovementKind } from '@/lib/stock/movement';

interface FacilityStore {
    facilities: Facility[];
    medicines: MedicineStockItem[];
    diagnostics: DiagnosticOrder[];
    selectedFacilityId: string;
    isLoading: boolean;

    // Actions
    loadAll: () => Promise<void>;
    setSelectedFacilityId: (id: string) => void;
    /**
     * Record a counted receipt or issue. Resolves to an error message when the
     * movement is refused (no quantity, or more issued than held), else null.
     */
    recordStockMovement: (
        id: string,
        kind: StockMovementKind,
        quantity: number,
        details?: { batchNumber?: string; expiryDate?: string },
    ) => Promise<string | null>;
    /** Super Admin edits to the facility directory. Throws on a failed write. */
    saveFacility: (facility: Facility) => Promise<void>;
    updateDiagnosticResult: (id: string, result: string, isAbnormal: boolean) => Promise<void>;
    /** Save a new lab order. Throws on a failed write, so the screen never claims an unsaved order. */
    addDiagnosticOrder: (order: DiagnosticOrder) => Promise<void>;
    /** Move an order along the sample pipeline: ordered → sample collected → at the lab. */
    setDiagnosticStatus: (id: string, status: 'SAMPLE_COLLECTED' | 'IN_PROGRESS' | 'CANCELLED') => Promise<void>;
}

export const useFacilityStore = create<FacilityStore>((set, get) => ({
    facilities: [],
    medicines: [],
    diagnostics: [],
    selectedFacilityId: 'phc-bhamragad',
    isLoading: false,

    setSelectedFacilityId: (id) => set({ selectedFacilityId: id }),

    saveFacility: async (facility) => {
        await persistFacility(facility);
        set(state => ({
            facilities: state.facilities.some(f => f.id === facility.id)
                ? state.facilities.map(f => (f.id === facility.id ? facility : f))
                : [...state.facilities, facility],
        }));
    },

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

    recordStockMovement: async (id, kind, quantity, details) => {
        const med = get().medicines.find(m => m.id === id);
        if (!med) return 'This stock line is no longer on the device — reload the page';
        const result = applyMovement(med, kind, quantity, details);
        if (!result.ok) return result.message;
        // Written before it is shown: a balance on screen that was never saved
        // is a count the next person will trust and should not.
        try {
            await saveMedicine(result.item);
        } catch (error) {
            console.error('Failed to save stock movement:', error);
            return 'Could not save the stock change on this device — nothing was changed';
        }
        set(state => ({ medicines: state.medicines.map(m => (m.id === id ? result.item : m)) }));
        toast.success(`${kind === 'RECEIVED' ? 'Received' : 'Issued'} ${quantity} ${med.unit} of ${med.name} — ${result.item.currentStock} in stock`);
        return null;
    },

    addDiagnosticOrder: async (order) => {
        await saveDiagnostic(order);
        set(state => ({ diagnostics: [order, ...state.diagnostics.filter(d => d.id !== order.id)] }));
    },

    setDiagnosticStatus: async (id, status) => {
        const diag = get().diagnostics.find(d => d.id === id);
        if (!diag) return;
        const updated: DiagnosticOrder = { ...diag, status };
        await saveDiagnostic(updated);
        set(state => ({ diagnostics: state.diagnostics.map(d => (d.id === id ? updated : d)) }));
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

        await saveDiagnostic(updated);
        set(state => ({
            diagnostics: state.diagnostics.map(d => d.id === id ? updated : d)
        }));
        toast.success(`Lab result saved: ${diag.testName} for ${diag.patientName}`);
    }
}));
