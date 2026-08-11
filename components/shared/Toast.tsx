/**
 * Toast notification system using react-hot-toast
 * Modern Medcare Style - Clean, white, soft shadows
 * @module components/shared/Toast
 */

'use client';

import { Toaster } from 'react-hot-toast';

export function ToastProvider() {
    return (
        <Toaster
            position="top-right"
            toastOptions={{
                duration: 4000,
                style: {
                    background: '#FFFFFF',
                    color: '#1A202C',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                    border: '1px solid #E2E8F0',
                    borderRadius: '12px',
                    padding: '16px 20px',
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    fontSize: '14px',
                    fontWeight: 500,
                },
                success: {
                    iconTheme: {
                        primary: '#38A169',
                        secondary: '#F0FFF4',
                    },
                    style: {
                        borderLeft: '4px solid #38A169',
                    }
                },
                error: {
                    iconTheme: {
                        primary: '#E53E3E',
                        secondary: '#FFF5F5',
                    },
                    style: {
                        borderLeft: '4px solid #E53E3E',
                    },
                    duration: 6000,
                },
                loading: {
                    iconTheme: {
                        primary: '#2AA198',
                        secondary: '#E6FFFA',
                    },
                    style: {
                        borderLeft: '4px solid #2AA198',
                    }
                },
            }}
        />
    );
}
