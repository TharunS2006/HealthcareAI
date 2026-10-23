/**
 * Medicine stock: what was received, what was issued, and what to reorder.
 *
 * The stock screen used to change balances with no quantity anyone had
 * counted: "+ Restock" added a fixed 50, "Auto-Restock All" set every empty
 * line to 100, and "Emergency Supply Request" announced a requisition "sent to
 * the District Warehouse" when nothing was sent anywhere. A stock register is
 * only worth reading if every change in it is something a pharmacist counted,
 * so the balance now moves only by a quantity entered as received (with the
 * challan or batch it came under) or issued — never below zero — and the
 * reorder list is something to hand to the district drug store, not a claim
 * that it was handed over. scripts/verify-stock.mts checks this module.
 */

import type { MedicineStockItem } from '@/types/facility';

export type StockMovementKind = 'RECEIVED' | 'ISSUED';

/** Days before expiry at which a line is flagged for use-first. */
export const NEAR_EXPIRY_DAYS = 90;

/**
 * The status a line should carry. Empty first, then below the minimum (both
 * mean reorder), then expiring within NEAR_EXPIRY_DAYS (use first).
 */
export function stockStatus(
    currentStock: number,
    minimumRequiredStock: number,
    expiryDate: string | undefined,
    now: Date = new Date(),
): MedicineStockItem['status'] {
    if (currentStock <= 0) return 'OUT_OF_STOCK';
    if (currentStock < minimumRequiredStock) return 'LOW';
    if (expiryDate) {
        const expiry = new Date(`${expiryDate}T00:00:00`);
        const days = (expiry.getTime() - now.getTime()) / 86_400_000;
        if (Number.isFinite(days) && days <= NEAR_EXPIRY_DAYS) return 'NEAR_EXPIRY';
    }
    return 'ADEQUATE';
}

export type MovementResult =
    | { ok: true; item: MedicineStockItem }
    | { ok: false; message: string };

/** Apply a counted receipt or issue to a stock line. */
export function applyMovement(
    item: MedicineStockItem,
    kind: StockMovementKind,
    quantity: number,
    details: { batchNumber?: string; expiryDate?: string } = {},
    now: Date = new Date(),
): MovementResult {
    if (!Number.isInteger(quantity) || quantity <= 0) {
        return { ok: false, message: 'Enter the quantity as a whole number greater than zero' };
    }
    if (kind === 'ISSUED' && quantity > item.currentStock) {
        return { ok: false, message: `Only ${item.currentStock} ${item.unit} are in stock — the issue cannot be larger` };
    }
    const currentStock = kind === 'RECEIVED' ? item.currentStock + quantity : item.currentStock - quantity;
    // A receipt may come with a new batch and expiry; an issue never changes them.
    const batchNumber = kind === 'RECEIVED' && details.batchNumber?.trim() ? details.batchNumber.trim() : item.batchNumber;
    const expiryDate = kind === 'RECEIVED' && details.expiryDate?.trim() ? details.expiryDate.trim() : item.expiryDate;
    return {
        ok: true,
        item: {
            ...item,
            currentStock,
            batchNumber,
            expiryDate,
            status: stockStatus(currentStock, item.minimumRequiredStock, expiryDate, now),
            ...(kind === 'RECEIVED' ? { lastRestocked: localDate(now) } : {}),
        },
    };
}

export interface RequisitionLine {
    name: string;
    dosageForm: MedicineStockItem['dosageForm'];
    facilityName: string;
    unit: string;
    currentStock: number;
    minimumRequiredStock: number;
    /** What it takes to reach the minimum level again — the pharmacist adjusts it. */
    quantityToMinimum: number;
}

/** Lines that are empty or below their minimum, emptiest first. */
export function requisitionLines(items: readonly MedicineStockItem[]): RequisitionLine[] {
    return items
        .filter(m => m.currentStock < m.minimumRequiredStock || m.currentStock <= 0)
        .map(m => ({
            name: m.name,
            dosageForm: m.dosageForm,
            facilityName: m.facilityName,
            unit: m.unit,
            currentStock: m.currentStock,
            minimumRequiredStock: m.minimumRequiredStock,
            quantityToMinimum: Math.max(0, m.minimumRequiredStock - m.currentStock),
        }))
        .sort((a, b) => a.currentStock / Math.max(1, a.minimumRequiredStock) - b.currentStock / Math.max(1, b.minimumRequiredStock));
}

/** The list as CSV, for the district drug store's indent or a print-out. */
export function requisitionCsv(lines: readonly RequisitionLine[]): string {
    const cell = (v: string | number) => {
        const s = String(v);
        // Quote every text cell; neutralise a leading formula character so a
        // spreadsheet opening this file never evaluates it.
        const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
        return typeof v === 'number' ? s : `"${safe.replace(/"/g, '""')}"`;
    };
    const header = ['Medicine', 'Form', 'Facility', 'Unit', 'In stock', 'Minimum', 'Needed to reach minimum'];
    return [header.map(cell).join(','), ...lines.map(l => [
        l.name, l.dosageForm, l.facilityName, l.unit, l.currentStock, l.minimumRequiredStock, l.quantityToMinimum,
    ].map(cell).join(','))].join('\r\n') + '\r\n';
}

function localDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
