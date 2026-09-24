# NalamMesh native apps

The Next.js site is statically exported (`out/`) and wrapped with Capacitor 8:

| Target | Project | Notes |
| --- | --- | --- |
| iPhone | `ios/App/App.xcodeproj` | iOS 15+, portrait and landscape |
| iPad | same target | All orientations; sidebar in landscape, tab bar in portrait |
| Mac | same target (Mac Catalyst) | "Optimize Interface for Mac", sandboxed via `ios/App/App/App.entitlements` |
| Android | `android/` | minSdk 24, edge-to-edge, hardware back button |

## Build

```bash
npm install
npm run cap:sync            # next build + copy web assets into ios/ and android/

npm run cap:open:ios        # Xcode (requires macOS + Xcode 16+)
npm run cap:open:android    # Android Studio
```

In Xcode choose a destination: an iPhone or iPad simulator, a device, or **My Mac (Mac Catalyst)**.
Set your signing team under *Signing & Capabilities* before running on a device or the Mac.
Dependencies come from Swift Package Manager (`ios/App/CapApp-SPM`), so CocoaPods is not needed.

## Mesh server

Inside the apps the page is served from `localhost`, so the socket client can't infer the
mesh server host. To sync with a server on the LAN, build with:

```bash
NEXT_PUBLIC_MESH_SERVER_URL=http://192.168.1.10:3001 npm run cap:sync
```

Without it the apps run in standalone (offline) mode. Plain-HTTP LAN traffic is allowed through
`NSAllowsLocalNetworking` on iOS/Mac and `usesCleartextTraffic` on Android.

## Layout

- `< 1024px` (phones, iPad portrait, narrow windows): bottom tab bar + "More" sheet (`components/shared/MobileMenu.tsx`).
- `≥ 1024px` (iPad landscape, Mac, desktop): the sidebar (`components/shared/Sidebar.tsx`).
- Page bodies use `.app-main` (in `app/globals.css`), which applies safe-area insets for the notch,
  home indicator and Android system bars (`--sat/--sab/--sal/--sar`).
- Native-only behaviour (system bar style, splash, keyboard, Android back button, haptics) lives in `lib/native.ts`.

## Icons and splash

Generated from `public/icon-512.png` (brand green `#055643`):
`ios/App/App/Assets.xcassets/{AppIcon,Splash}` and `android/app/src/main/res/{mipmap-*,drawable*}`.
