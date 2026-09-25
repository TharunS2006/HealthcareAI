/**
 * The referral system's background half, mounted once in the root layout.
 *
 *   - loads the staff directory, referrals, notifications and resources
 *   - starts the transport and routes whatever arrives to the right store
 *   - runs the escalation / reservation clock every 30 seconds
 *   - confirms delivery of referrals addressed to the signed-in user's facility
 *   - toasts new notifications for the signed-in user
 *
 * None of this renders anything visible except the toasts.
 */

'use client';

import { useEffect } from 'react';
import { useAuthStore, type StaffSession } from '@/stores/authStore';
import { useReferralStore } from '@/stores/referralStore';
import { useResourceStore } from '@/stores/resourceStore';
import { useDirectoryStore } from '@/stores/directoryStore';
import { useFacilityStore } from '@/stores/facilityStore';
import { onSyncMessage, startTransport, identityHeaders } from '@/lib/referrals/transport';
import { setIdentityProvider } from '@/lib/sync/cloudRecords';
import { flushOutbox } from '@/lib/sync/outbox';
import { REFERRAL_TIMING } from '@/lib/referrals/config';
import { can } from '@/lib/auth/permissions';
import NotificationToaster from '@/components/notifications/NotificationToaster';

/**
 * Confirms that a referral reached its destination: when this session belongs
 * to the receiving facility and holds a referral still marked CREATED, the
 * referral has in fact been delivered to that facility — so it is recorded as
 * SENT. Used for the tab's own user and, in the simulation, for each pane.
 */
export function DeliveryReceiver({ session }: { session: StaffSession | null }) {
    const referrals = useReferralStore(s => s.referrals);
    const confirmDelivery = useReferralStore(s => s.confirmDelivery);

    useEffect(() => {
        if (!session?.facilityId || !can(session.role, 'referral:receive')) return;
        for (const r of referrals) {
            if (r.status === 'CREATED' && r.toFacilityId === session.facilityId) {
                void confirmDelivery(r.id, 'LOCAL_PEER', session.name);
            }
        }
    }, [referrals, session, confirmDelivery]);

    return null;
}

export default function ReferralRuntime() {
    const session = useAuthStore(s => s.session);
    const token = session?.token;

    // Records queued while nobody held a relay token wait in the outbox
    // (lib/sync/outbox.ts); send them the moment someone signs in with one.
    useEffect(() => {
        if (token) void flushOutbox();
    }, [token]);

    useEffect(() => {
        const loadAll = () =>
            Promise.all([
                useDirectoryStore.getState().load(),
                useReferralStore.getState().loadReferrals(),
                useResourceStore.getState().load(),
                useFacilityStore.getState().loadAll(),
            ]);

        // The clock runs only once the stores hold what is on this device; a
        // sweep over an empty store would do nothing, and one over half-loaded
        // data could escalate a referral whose acknowledgement has not loaded.
        let ready = false;
        void loadAll().then(() => {
            ready = true;
            void useReferralStore.getState().sweep();
        });

        setIdentityProvider(() => identityHeaders());

        const unsubscribe = onSyncMessage(message => {
            switch (message.kind) {
                case 'referral':
                    void useReferralStore.getState().ingest(message.referral, message.notifications);
                    break;
                case 'resources':
                    void useResourceStore.getState().ingestResources(message.resources);
                    break;
                case 'ticket':
                    void useResourceStore.getState().ingestTicket(message.ticket);
                    break;
                case 'user':
                    void useDirectoryStore.getState().ingest(message.user);
                    break;
                case 'reset':
                    void loadAll();
                    break;
            }
        });

        const stopTransport = startTransport(() => {
            if (ready) void useReferralStore.getState().pushPending();
        });

        const clock = setInterval(() => {
            if (ready) void useReferralStore.getState().sweep();
        }, REFERRAL_TIMING.SWEEP_INTERVAL_MS);

        return () => {
            clearInterval(clock);
            stopTransport();
            unsubscribe();
        };
    }, []);

    return (
        <>
            <DeliveryReceiver session={session} />
            <NotificationToaster session={session} mode="global" />
        </>
    );
}
