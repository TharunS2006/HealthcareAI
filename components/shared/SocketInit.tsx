'use client';

import { useEffect } from 'react';
import { usePatientStore } from '@/stores/patientStore';

export default function SocketInit() {
    const { initSocket } = usePatientStore();

    useEffect(() => {
        initSocket();
    }, [initSocket]);

    return null;
}
