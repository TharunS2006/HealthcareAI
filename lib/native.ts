/**
 * Native shell helpers (Capacitor)
 * Thin wrappers so the web build keeps working when the native bridge is absent.
 * @module lib/native
 */

import { Capacitor } from '@capacitor/core';

export type AppPlatform = 'ios' | 'android' | 'web';

export const isNative = (): boolean => Capacitor.isNativePlatform();

export const getPlatform = (): AppPlatform => Capacitor.getPlatform() as AppPlatform;

/** Light haptic tap for primary actions. No-op on web. */
export async function hapticTap(): Promise<void> {
    if (!isNative()) return;
    try {
        const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
        await Haptics.impact({ style: ImpactStyle.Light });
    } catch { /* haptics unavailable (e.g. Mac) */ }
}

/** Stronger feedback for critical events (RED triage, completed handover). */
export async function hapticAlert(type: 'success' | 'warning' | 'error' = 'warning'): Promise<void> {
    if (!isNative()) return;
    try {
        const { Haptics, NotificationType } = await import('@capacitor/haptics');
        const map = { success: NotificationType.Success, warning: NotificationType.Warning, error: NotificationType.Error };
        await Haptics.notification({ type: map[type] });
    } catch { /* haptics unavailable */ }
}

/**
 * One-time native setup: platform classes for CSS, system bar styling,
 * splash dismissal, keyboard behaviour and the Android hardware back button.
 * Returns a cleanup function.
 */
export async function initNativeShell(): Promise<() => void> {
    const root = document.documentElement;
    const platform = getPlatform();
    root.classList.add(`platform-${platform}`);
    if (!isNative()) return () => {};
    root.classList.add('native');

    const cleanups: Array<() => void> = [];

    const { SystemBars, SystemBarsStyle } = await import('@capacitor/core');
    // Light page background -> dark status/navigation bar icons.
    SystemBars.setStyle({ style: SystemBarsStyle.Light }).catch(() => {});

    const { SplashScreen } = await import('@capacitor/splash-screen');
    SplashScreen.hide({ fadeOutDuration: 250 }).catch(() => {});

    const { Keyboard } = await import('@capacitor/keyboard');
    if (platform === 'ios') {
        // Show the "Done" accessory bar so numeric keypads can be dismissed.
        Keyboard.setAccessoryBarVisible({ isVisible: true }).catch(() => {});
    }
    // Hide the bottom tab bar while typing so it doesn't ride on top of the keyboard.
    const shown = await Keyboard.addListener('keyboardWillShow', () => root.classList.add('keyboard-open'));
    const hidden = await Keyboard.addListener('keyboardWillHide', () => root.classList.remove('keyboard-open'));
    cleanups.push(() => { shown.remove(); hidden.remove(); });

    if (platform === 'android') {
        const { App } = await import('@capacitor/app');
        const handle = await App.addListener('backButton', ({ canGoBack }) => {
            // Close any open sheet/modal first.
            const closeEvent = new CustomEvent('nalam:back', { cancelable: true });
            if (!window.dispatchEvent(closeEvent)) return;

            if (canGoBack && window.location.pathname !== '/') {
                window.history.back();
            } else {
                App.minimizeApp();
            }
        });
        cleanups.push(() => handle.remove());
    }

    return () => cleanups.forEach((fn) => fn());
}
