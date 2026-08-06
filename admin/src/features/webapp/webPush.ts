import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import { app } from '../webauth/firebase';
import { webApi } from '../webauth/web-api';

/**
 * Web push (Firebase Cloud Messaging). Reuses the same backend pipeline as the
 * Android app: a device FCM token is registered via POST /notifications/
 * register-token, and the backend's existing FCM sender pushes to it. The web
 * token comes from the browser Push API via a service worker + VAPID key.
 *
 * The VAPID key is the public "Web Push certificate" key pair from Firebase
 * Console → Project settings → Cloud Messaging. Set it as VITE_FIREBASE_VAPID_KEY
 * (public, safe to ship). Web push is inert until it's provided.
 */
const env = import.meta.env as Record<string, string | undefined>;
// Public Web Push certificate key pair (safe to ship). Override via env if needed.
const VAPID_KEY =
  env.VITE_FIREBASE_VAPID_KEY?.trim() ||
  'BGgGMfufPNMUz4Qw4k_vEd2vrCPpzknJ47xOGAPirhgxebkw61Eb0QwOaAfzcFiL96bpjhun99TJakLV3kVgoUY';

export const webPushConfigured = VAPID_KEY.length > 0;

async function supported(): Promise<boolean> {
  if (!webPushConfigured) return false;
  if (!('serviceWorker' in navigator) || !('Notification' in window)) return false;
  return isSupported().catch(() => false);
}

async function swRegistration(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register('/firebase-messaging-sw.js');
}

/** Get the FCM web token and register it with the backend. Requires granted permission. */
async function registerToken(): Promise<boolean> {
  if (!(await supported()) || Notification.permission !== 'granted') return false;
  try {
    const registration = await swRegistration();
    // Wait for the SW to be active before asking for a token.
    await navigator.serviceWorker.ready;
    const token = await getToken(getMessaging(app), {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    if (!token) {
      console.error('[webpush] getToken returned empty');
      return false;
    }
    console.info('[webpush] FCM token acquired:', token.slice(0, 16) + '…');
    await webApi.post('/notifications/register-token', { token });
    console.info('[webpush] token registered with backend');
    return true;
  } catch (e) {
    console.error('[webpush] registerToken failed:', e);
    return false;
  }
}

export type EnableResult = 'granted' | 'denied' | 'unsupported' | 'error';

/** Prompt for permission (call from a user gesture) then register the token. */
export async function enableWebPush(): Promise<EnableResult> {
  if (!(await supported())) {
    console.warn('[webpush] not supported in this browser/context');
    return 'unsupported';
  }
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return 'denied';
    return (await registerToken()) ? 'granted' : 'error';
  } catch (e) {
    console.error('[webpush] enableWebPush failed:', e);
    return 'error';
  }
}

/** The browser's current permission state (or 'unsupported'). */
export function pushPermission(): 'granted' | 'denied' | 'default' | 'unsupported' {
  if (!webPushConfigured || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

/**
 * On app load: refresh the token if already granted, and show foreground pushes
 * as a browser notification. Safe no-op when push isn't configured/granted.
 */
export async function initWebPush(): Promise<void> {
  if (!(await supported())) return;
  if (Notification.permission === 'granted') {
    await registerToken();
  }
  try {
    onMessage(getMessaging(app), (payload) => {
      const n = payload.notification;
      if (n && Notification.permission === 'granted') {
        new Notification(n.title || 'Cash Raja', {
          body: n.body || '',
          icon: '/favicon.svg',
        });
      }
    });
  } catch {
    /* ignore */
  }
}
