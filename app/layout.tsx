import type { Metadata, Viewport } from "next";
import "./globals.css";
import GovPortalHeader from "@/components/gov/GovPortalHeader";
import GovPortalFooter from "@/components/gov/GovPortalFooter";
import OfflineBanner from "@/components/gov/OfflineBanner";
import EmergencyModal from "@/components/shared/EmergencyModal";
import SocketInit from "@/components/shared/SocketInit";
import PWAInstall from "@/components/shared/PWAInstall";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { Toaster } from 'react-hot-toast';

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
    themeColor: "#1F3A6E",
};

export const metadata: Metadata = {
    title: "NalamMesh — National Rural Public Healthcare Platform | Government of Maharashtra",
    description: "National Rural Public Healthcare Access, Continuity & Quality Platform. Department of Public Health, Government of Maharashtra & National Health Mission (NHM).",
    manifest: "/manifest.json",
    keywords: [
        "NalamMesh", "National Health Mission", "Government of Maharashtra",
        "सार्वजनिक आरोग्य विभाग", "ABDM", "FHIR R4", "OPD Triage",
        "Gadchiroli", "eSanjeevani", "108 Ambulance", "Public Healthcare",
    ],
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" className="h-full">
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link
                    href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700;800&family=Noto+Sans+Devanagari:wght@400;500;600;700;800&display=swap"
                    rel="stylesheet"
                />
                <link
                    rel="stylesheet"
                    href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"
                />
            </head>
            <body className="font-sans antialiased bg-[#F4F6FA] text-[#0F172A] min-h-screen flex flex-col">
                {/* Skip to Content — Mandatory Accessibility Requirement */}
                <a href="#main-content" className="skip-to-content">
                    मुख्य मजकुराकडे जा (Skip to main content)
                </a>

                {/* Official Indian Government Portal Header (NIC / GIGW 3.0 Standard) */}
                <GovPortalHeader />

                {/* Offline Connectivity Notification Strip */}
                <OfflineBanner />

                {/* Main Content Area */}
                <ErrorBoundary>
                    <SocketInit />
                    <div id="main-content" className="flex-1 pb-20">
                        {children}
                    </div>
                    {/* Universal Emergency SOS Modal */}
                    <EmergencyModal />
                    {/* Registers the service worker (offline app shell) + install prompt */}
                    <PWAInstall />
                </ErrorBoundary>

                {/* Official NIC Government Footer */}
                <GovPortalFooter />

                {/* Toast Notification Provider */}
                <Toaster
                    position="top-right"
                    toastOptions={{
                        duration: 4000,
                        style: {
                            borderRadius: '4px',
                            fontSize: '0.8125rem',
                            border: '1px solid #CBD5E1',
                        },
                    }}
                />
            </body>
        </html>
    );
}
