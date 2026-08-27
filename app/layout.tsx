import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import SocketInit from "@/components/shared/SocketInit";
import PWAInstall from "@/components/shared/PWAInstall";
import { Toaster } from 'react-hot-toast';

const jakarta = Plus_Jakarta_Sans({
    subsets: ["latin"],
    variable: '--font-jakarta',
    display: 'swap',
    weight: ['400', '500', '600', '700', '800'],
});

const jetbrains = JetBrains_Mono({
    subsets: ["latin"],
    variable: '--font-jetbrains',
    display: 'swap',
    weight: ['400', '500'],
});

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    themeColor: "#0E7D6B",
};

export const metadata: Metadata = {
    title: "NalamMesh — Rural Public Healthcare Access Platform (Maharashtra)",
    description: "Integrated care-access and quality support platform for rural and underserved areas. SIH Problem Statement #26133.",
    manifest: "/manifest.json",
    appleWebApp: {
        capable: true,
        statusBarStyle: "black-translucent",
        title: "NalamMesh",
    },
    keywords: ["healthcare", "rural healthcare", "ABDM", "FHIR", "triage", "teleconsultation", "queue management", "referral tracking", "Maharashtra", "SIH 2025"],
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" className={`${jakarta.variable} ${jetbrains.variable}`}>
            <head>
                <link
                    rel="stylesheet"
                    href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"
                />
            </head>
            <body className="antialiased bg-bg-page text-txt-primary">
                <ErrorBoundary>
                    <SocketInit />
                    {children}
                    <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
                    <PWAInstall />
                </ErrorBoundary>
            </body>
        </html>
    );
}
