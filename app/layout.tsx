import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { ToastProvider } from "@/components/shared/Toast";
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
    themeColor: "#0E4D45", // Deep Emerald
};

export const metadata: Metadata = {
    title: "NalamMesh DPI - Hospital Operations",
    description: "Enterprise Digital Public Infrastructure for healthcare logic",
    manifest: "/manifest.json",
    appleWebApp: {
        capable: true,
        statusBarStyle: "black-translucent",
        title: "NalamMesh",
    },
    keywords: ["healthcare", "hospital software", "triage", "mesh network", "ABDM"],
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
                    <Toaster position="top-right" />
                    <PWAInstall />
                </ErrorBoundary>
            </body>
        </html>
    );
}
