import type { Metadata, Viewport } from "next";
// Fonts ship inside the app (npm @fontsource, OFL): text renders the same offline
// and in the APK, no browser calls Google, and the build needs no network.
import "@fontsource/noto-sans/400.css";
import "@fontsource/noto-sans/500.css";
import "@fontsource/noto-sans/600.css";
import "@fontsource/noto-sans/700.css";
import "@fontsource/noto-sans/800.css";
import "@fontsource/noto-sans-devanagari/400.css";
import "@fontsource/noto-sans-devanagari/500.css";
import "@fontsource/noto-sans-devanagari/600.css";
import "@fontsource/noto-sans-devanagari/700.css";
import "@fontsource/noto-sans-devanagari/800.css";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import GovPortalHeader from "@/components/gov/GovPortalHeader";
import GovPortalFooter from "@/components/gov/GovPortalFooter";
import OfflineBanner from "@/components/gov/OfflineBanner";
import SocketInit from "@/components/shared/SocketInit";
import PWAInstall from "@/components/shared/PWAInstall";
import ChatAssistant from "@/components/shared/ChatAssistant";
import RouteGuard from "@/components/auth/RouteGuard";
import NetworkSignIn from "@/components/auth/NetworkSignIn";
import ReferralRuntime from "@/components/referrals/ReferralRuntime";
import NativeDeepLink from "@/components/shared/NativeDeepLink";
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
    // Declared, so browsers use it instead of asking for a /favicon.ico that does not exist.
    icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
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
            <body className="font-sans antialiased bg-[#F4F6FA] text-[#0F172A] min-h-screen flex flex-col">
                {/* Skip to Content — Mandatory Accessibility Requirement */}
                <a href="#main-content" className="skip-to-content">
                    मुख्य मजकुराकडे जा (Skip to main content)
                </a>

                {/* Official Indian Government Portal Header (NIC / GIGW 3.0 Standard) */}
                <NativeDeepLink />
                <GovPortalHeader />
                <NetworkSignIn />

                {/* Offline Connectivity Notification Strip */}
                <OfflineBanner />

                {/* Main Content Area */}
                <ErrorBoundary>
                    <SocketInit />
                    {/* Referral transport, escalation clock, delivery receipts and
                        notification toasts — background only. */}
                    <ReferralRuntime />
                    <div id="main-content" className="flex-1 pb-20">
                        {/* Every page passes this gate; the rules are in lib/auth/permissions.ts. */}
                        <RouteGuard>{children}</RouteGuard>
                    </div>
                    {/* Registers the service worker (offline app shell) + install prompt */}
                    <PWAInstall />
                    {/* Assistant, open to staff and public alike — offline first, cloud
                        only as fallback. It occupies the screen corner that used to hold
                        the Emergency SOS launcher, so it carries the 108/102 numbers and
                        links /emergency itself; the dispatch screen is still in the nav. */}
                    <ChatAssistant />
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
