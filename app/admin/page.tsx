/**
 * System administration — users, roles and facilities (Super Admin).
 *
 * Users: add, re-post, change role, deactivate. Every change is audited and
 * published, so a newly posted Medical Officer starts receiving referrals on
 * every device. Roles: shown exactly as lib/auth/permissions.ts defines them —
 * roles are edited in that one file, not here, so the matrix on this screen can
 * never disagree with the rules the app enforces. Facilities: directory
 * details (name, contact, officer in charge, online status).
 */

'use client';

import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import Sidebar from '@/components/shared/Sidebar';
import MobileMenu from '@/components/shared/MobileMenu';
import GovPanel from '@/components/gov/GovPanel';
import { useSession } from '@/lib/auth/session';
import {
    ROLE_FACILITY_TIERS,
    ROLE_LABELS,
    ROLE_PERMISSIONS,
    ROUTE_PERMISSIONS,
    STAFF_ROLES,
    DISTRICT_WIDE_ROLES,
    can,
    type Permission,
    type StaffRole,
} from '@/lib/auth/permissions';
import { useDirectoryStore } from '@/stores/directoryStore';
import { useFacilityStore } from '@/stores/facilityStore';
import { FACILITY_NETWORK } from '@/lib/data/facilities';
import type { StaffUser } from '@/lib/auth/users';
import { hashPin, PIN_PATTERN } from '@/lib/auth/pin';
import { wireOf } from '@/lib/referrals/transport';
import type { Facility } from '@/types/facility';

type Tab = 'USERS' | 'ROLES' | 'FACILITIES';

const field = 'px-2 py-1 text-[12px] bg-white border border-slate-300 rounded focus:ring-2 focus:ring-[#1F3A6E] focus:outline-none';
const btn = 'px-2.5 py-1 text-[11px] font-bold rounded border disabled:opacity-50';
const primary = `${btn} bg-[#1F3A6E] text-white border-[#1F3A6E] hover:bg-[#16294E]`;
const secondary = `${btn} bg-white text-[#1F3A6E] border-[#1F3A6E] hover:bg-slate-50`;

const ALL_PERMISSIONS = Array.from(new Set(STAFF_ROLES.flatMap(r => ROLE_PERMISSIONS[r]))) as Permission[];

export default function AdminPage() {
    const session = useSession();
    const users = useDirectoryStore(s => s.users);
    const upsert = useDirectoryStore(s => s.upsert);
    const stored = useFacilityStore(s => s.facilities);
    const saveFacility = useFacilityStore(s => s.saveFacility);
    const facilities = stored.length ? stored : FACILITY_NETWORK;

    const [tab, setTab] = useState<Tab>('USERS');
    const [editing, setEditing] = useState<StaffUser | null>(null);
    const [isNew, setIsNew] = useState(false);
    /** A new PIN typed for the user being edited — hashed before it is saved, never stored as typed. */
    const [pinDraft, setPinDraft] = useState('');
    const [facilityDraft, setFacilityDraft] = useState<Facility | null>(null);
    const [filter, setFilter] = useState('');

    const sorted = useMemo(
        () => [...users]
            .filter(u => !filter || `${u.name} ${u.staffId} ${u.role} ${u.facilityId ?? ''}`.toLowerCase().includes(filter.toLowerCase()))
            .sort((a, b) => STAFF_ROLES.indexOf(a.role) - STAFF_ROLES.indexOf(b.role) || a.name.localeCompare(b.name)),
        [users, filter]
    );

    if (!session) return null;
    const wire = wireOf(session)!;
    const facilityName = (id: string | null) => (id ? facilities.find(f => f.id === id)?.name ?? id : 'District / system');

    const saveUser = async () => {
        if (!editing) return;
        const u = { ...editing, name: editing.name.trim(), staffId: editing.staffId.trim() };
        const tiers = ROLE_FACILITY_TIERS[u.role];
        if (u.name.length < 2) return toast.error('Enter the user\'s name');
        if (!u.staffId) return toast.error('Enter a staff ID');
        if (users.some(x => x.id !== u.id && x.staffId.toLowerCase() === u.staffId.toLowerCase())) return toast.error('That staff ID is already in use');
        if (tiers.length === 0) u.facilityId = null;
        else {
            const f = facilities.find(x => x.id === u.facilityId);
            if (!f || !tiers.includes(f.type)) return toast.error(`${ROLE_LABELS[u.role]} must be posted at a ${tiers.join(' / ')}`);
        }
        if (!u.active && u.id === session.userId) return toast.error('You cannot deactivate your own account');
        if (pinDraft && !PIN_PATTERN.test(pinDraft)) return toast.error('A PIN is 4 to 6 digits');
        if (!pinDraft && !u.pinHash) return toast.error('Set a PIN — without one this user cannot sign in');
        try {
            if (pinDraft) u.pinHash = await hashPin(pinDraft);
            await upsert(u, wire);
            toast.success(`${u.name} saved`);
            if (u.facilityId && u.active && !users.some(x => x.id !== u.id && x.active && x.role === u.role && x.facilityId === u.facilityId)) {
                toast(`${u.name} is now the only active ${ROLE_LABELS[u.role]} at ${facilityName(u.facilityId)}`);
            }
            const remaining = users.filter(x => x.id !== u.id && x.active && x.role === editing.role && x.facilityId === editing.facilityId);
            if ((!u.active || u.facilityId !== editing.facilityId) && editing.facilityId && remaining.length === 0) {
                toast.error(`No active ${ROLE_LABELS[editing.role]} is left at ${facilityName(editing.facilityId)} — referrals there will reach nobody`, { duration: 9000 });
            }
            setEditing(null);
            setPinDraft('');
        } catch (e) {
            toast.error(`Could not save: ${(e as Error).message}`);
        }
    };

    const saveFacilityDraft = async () => {
        if (!facilityDraft) return;
        if (facilityDraft.name.trim().length < 3) return toast.error('Enter the facility name');
        try {
            await saveFacility({ ...facilityDraft, name: facilityDraft.name.trim() });
            toast.success('Facility saved');
            setFacilityDraft(null);
        } catch (e) {
            toast.error(`Could not save: ${(e as Error).message}`);
        }
    };

    const postingOptions = (role: StaffRole) => facilities.filter(f => ROLE_FACILITY_TIERS[role].includes(f.type));

    return (
        <div className="flex bg-bg-page min-h-screen font-sans text-txt-primary">
            <Sidebar />
            <main className="flex-1 p-3 md:p-5 overflow-y-auto min-w-0">
                <MobileMenu />
                <div className="max-w-6xl mx-auto space-y-4">
                    <div className="bg-white border border-slate-300 p-3">
                        <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">{ROLE_LABELS[session.role]} · {session.name}</p>
                        <h1 className="text-xl sm:text-2xl font-black text-[#1F3A6E] tracking-tight">Users, roles &amp; facilities</h1>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                            {([['USERS', `Users (${users.length})`], ['ROLES', 'Roles & permissions'], ['FACILITIES', `Facilities (${facilities.length})`]] as const).map(([key, label]) => (
                                <button key={key} type="button" onClick={() => setTab(key)} aria-pressed={tab === key}
                                    className={`px-3 py-1 text-[12px] font-bold border rounded ${tab === key ? 'bg-[#1F3A6E] text-white border-[#1F3A6E]' : 'bg-white text-[#1F3A6E] border-[#B9C5D6]'}`}>
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {tab === 'USERS' && (
                        <GovPanel title="Staff directory" meta="role and posting decide what each user sees" flush>
                            <div className="px-3 py-2 flex flex-wrap gap-2 items-center border-b border-slate-200">
                                <input className={`${field} flex-1 min-w-[12rem]`} placeholder="Search name, staff ID, role, facility" value={filter} onChange={e => setFilter(e.target.value)} />
                                <button type="button" className={primary} onClick={() => {
                                    setIsNew(true);
                                    setPinDraft('');
                                    setEditing({ id: `u-${Date.now().toString(36)}`, name: '', role: 'ANM', facilityId: postingOptions('ANM')[0]?.id ?? null, staffId: '', active: true });
                                }}>+ Add user</button>
                            </div>
                            {editing && (
                                <div className="m-3 p-3 border border-[#1F3A6E] bg-[#F8FAFC] grid sm:grid-cols-2 lg:grid-cols-5 gap-2 text-[12px] items-end">
                                    <label className="lg:col-span-2">
                                        <span className="block text-[11px] font-bold text-slate-600">Name</span>
                                        <input className={`${field} w-full`} value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} />
                                    </label>
                                    <label>
                                        <span className="block text-[11px] font-bold text-slate-600">Staff ID</span>
                                        <input className={`${field} w-full font-mono`} value={editing.staffId} onChange={e => setEditing({ ...editing, staffId: e.target.value })} />
                                    </label>
                                    <label>
                                        <span className="block text-[11px] font-bold text-slate-600">Role</span>
                                        <select className={`${field} w-full`} value={editing.role} onChange={e => {
                                            const role = e.target.value as StaffRole;
                                            const options = postingOptions(role);
                                            setEditing({ ...editing, role, facilityId: ROLE_FACILITY_TIERS[role].length === 0 ? null : options.some(f => f.id === editing.facilityId) ? editing.facilityId : options[0]?.id ?? null });
                                        }}>
                                            {STAFF_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                                        </select>
                                    </label>
                                    <label>
                                        <span className="block text-[11px] font-bold text-slate-600">Posting</span>
                                        {ROLE_FACILITY_TIERS[editing.role].length === 0 ? (
                                            <span className="block px-2 py-1 text-[12px] text-slate-600">District / system (all facilities)</span>
                                        ) : (
                                            <select className={`${field} w-full`} value={editing.facilityId ?? ''} onChange={e => setEditing({ ...editing, facilityId: e.target.value })}>
                                                {postingOptions(editing.role).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                            </select>
                                        )}
                                    </label>
                                    <label>
                                        <span className="block text-[11px] font-bold text-slate-600">{editing.pinHash ? 'New PIN (leave blank to keep)' : 'PIN (4–6 digits)'}</span>
                                        <input className={`${field} w-full font-mono`} type="password" inputMode="numeric" autoComplete="new-password" maxLength={6}
                                            value={pinDraft} onChange={e => setPinDraft(e.target.value.replace(/\D/g, ''))} />
                                    </label>
                                    <label className="flex items-center gap-1.5">
                                        <input type="checkbox" checked={editing.active} onChange={e => setEditing({ ...editing, active: e.target.checked })} /> Active
                                    </label>
                                    <div className="flex gap-2 lg:col-span-4">
                                        <button type="button" className={primary} onClick={() => void saveUser()}>{isNew ? 'Add user' : 'Save changes'}</button>
                                        <button type="button" className={secondary} onClick={() => { setEditing(null); setPinDraft(''); }}>Cancel</button>
                                    </div>
                                </div>
                            )}
                            <div className="overflow-x-auto">
                                <table className="gov-table w-full text-[12px]">
                                    <thead>
                                        <tr>
                                            <th className="text-left">Name</th>
                                            <th className="text-left">Role</th>
                                            <th className="text-left">Posting</th>
                                            <th className="text-left">Staff ID</th>
                                            <th className="text-left">Status</th>
                                            <th />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sorted.map(u => (
                                            <tr key={u.id} className={u.active ? '' : 'opacity-60'}>
                                                <td className="font-semibold">{u.name}{u.id === session.userId ? ' (you)' : ''}</td>
                                                <td>{ROLE_LABELS[u.role]}</td>
                                                <td>{facilityName(u.facilityId)}</td>
                                                <td className="font-mono">{u.staffId}</td>
                                                <td>{u.active ? 'Active' : 'Deactivated'}</td>
                                                <td className="text-right">
                                                    <button type="button" className={secondary} onClick={() => { setIsNew(false); setPinDraft(''); setEditing(u); }}>Edit</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </GovPanel>
                    )}

                    {tab === 'ROLES' && (
                        <>
                            <GovPanel title="Permission matrix" meta="source: lib/auth/permissions.ts" flush>
                                <p className="px-3 py-2 text-[12px] text-slate-700 border-b border-slate-200">
                                    Roles are defined in one configuration file so a change applies to every screen, the mesh relay and the
                                    district service together. This matrix is read from that file — it is what the app enforces.
                                    Roles marked ◆ see every facility; the rest see only their own posting.
                                </p>
                                <div className="overflow-x-auto">
                                    <table className="gov-table w-full text-[11px]">
                                        <thead>
                                            <tr>
                                                <th className="text-left">Permission</th>
                                                {STAFF_ROLES.map(r => (
                                                    <th key={r} className="text-center whitespace-nowrap">{r}{DISTRICT_WIDE_ROLES.includes(r) ? ' ◆' : ''}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {ALL_PERMISSIONS.map(p => (
                                                <tr key={p}>
                                                    <td className="font-mono">{p}</td>
                                                    {STAFF_ROLES.map(r => (
                                                        <td key={r} className="text-center">
                                                            {can(r, p) ? <span className="text-emerald-700 font-bold" aria-label="granted">✓</span> : <span className="text-slate-300" aria-label="not granted">—</span>}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </GovPanel>
                            <GovPanel title="Protected pages" flush>
                                <div className="overflow-x-auto">
                                    <table className="gov-table w-full text-[12px]">
                                        <thead><tr><th className="text-left">Page</th><th className="text-left">Needs</th><th className="text-left">Open to</th></tr></thead>
                                        <tbody>
                                            {Object.entries(ROUTE_PERMISSIONS).map(([route, perm]) => (
                                                <tr key={route}>
                                                    <td className="font-mono">{route.endsWith('/') ? `${route}…` : route}</td>
                                                    <td className="font-mono">{perm}</td>
                                                    <td>{STAFF_ROLES.filter(r => can(r, perm)).map(r => ROLE_LABELS[r]).join(', ')}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <p className="px-3 py-2 text-[11px] text-slate-600">Every other page is public (citizen portal). Anything else answers “403 — Not permitted”.</p>
                            </GovPanel>
                        </>
                    )}

                    {tab === 'FACILITIES' && (
                        <GovPanel title="Facility directory" flush>
                            {facilityDraft && (
                                <div className="m-3 p-3 border border-[#1F3A6E] bg-[#F8FAFC] grid sm:grid-cols-2 gap-2 text-[12px] items-end">
                                    <label className="sm:col-span-2">
                                        <span className="block text-[11px] font-bold text-slate-600">Name</span>
                                        <input className={`${field} w-full`} value={facilityDraft.name} onChange={e => setFacilityDraft({ ...facilityDraft, name: e.target.value })} />
                                    </label>
                                    <label>
                                        <span className="block text-[11px] font-bold text-slate-600">Contact</span>
                                        <input className={`${field} w-full`} value={facilityDraft.contact} onChange={e => setFacilityDraft({ ...facilityDraft, contact: e.target.value })} />
                                    </label>
                                    <label>
                                        <span className="block text-[11px] font-bold text-slate-600">Officer in charge</span>
                                        <input className={`${field} w-full`} value={facilityDraft.medicalOfficerInCharge} onChange={e => setFacilityDraft({ ...facilityDraft, medicalOfficerInCharge: e.target.value })} />
                                    </label>
                                    <label className="flex items-center gap-1.5">
                                        <input type="checkbox" checked={facilityDraft.isOnline} onChange={e => setFacilityDraft({ ...facilityDraft, isOnline: e.target.checked })} /> Online (connected to the network)
                                    </label>
                                    <div className="flex gap-2">
                                        <button type="button" className={primary} onClick={() => void saveFacilityDraft()}>Save</button>
                                        <button type="button" className={secondary} onClick={() => setFacilityDraft(null)}>Cancel</button>
                                    </div>
                                </div>
                            )}
                            <div className="overflow-x-auto">
                                <table className="gov-table w-full text-[12px]">
                                    <thead>
                                        <tr>
                                            <th className="text-left">Facility</th>
                                            <th>Tier</th>
                                            <th className="text-left">Contact</th>
                                            <th className="text-left">Officer in charge</th>
                                            <th className="text-left">Staff posted</th>
                                            <th>Online</th>
                                            <th />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {facilities.map(f => (
                                            <tr key={f.id}>
                                                <td className="font-semibold">{f.name}<span className="block font-mono text-[10px] text-slate-600">{f.id}</span></td>
                                                <td className="text-center">{f.type}</td>
                                                <td>{f.contact}</td>
                                                <td>{f.medicalOfficerInCharge}</td>
                                                <td className="text-[11px]">
                                                    {users.filter(u => u.facilityId === f.id && u.active).map(u => `${u.name} (${u.role})`).join(', ') || <span className="text-red-700">Nobody</span>}
                                                </td>
                                                <td className="text-center">{f.isOnline ? 'Yes' : 'No'}</td>
                                                <td className="text-right"><button type="button" className={secondary} onClick={() => setFacilityDraft(f)}>Edit</button></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </GovPanel>
                    )}
                </div>
            </main>
        </div>
    );
}
