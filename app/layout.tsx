import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { ToastProvider } from "@/components/shared/Toast";
import SocketInit from "@/components/shared/SocketInit";
import NativeInit from "@/components/shared/NativeInit";
import PWAInstall from "@/components/shared/PWAInstall";

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
    // Draw under the notch / home indicator; insets are handled in CSS (--sat etc.)
    viewportFit: "cover",
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
            <body className="antialiased bg-bg-page text-txt-primary">
                <ErrorBoundary>
                    <NativeInit />
                    {/* Solid backdrop behind the status bar / notch so content scrolls under it cleanly */}
                    <div aria-hidden className="status-scrim" />
                    <SocketInit />
                    {children}
                    <ToastProvider />
                    <PWAInstall />
                </ErrorBoundary>
            </body>
        </html>
    );
}
