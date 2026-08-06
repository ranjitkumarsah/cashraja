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
const VAPID_KEY = env.VITE_FIREBASE_VAPID_KEY?.trim() || '';

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
    const token = await getToken(getMessaging(app), {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    if (!token) return false;
    await webApi.post('/notifications/register-token', { token });
    return true;
  } catch {
    return false;
  }
}

export type EnableResult = 'granted' | 'denied' | 'unsupported' | 'error';

/** Prompt for permission (call from a user gesture) then register the token. */
export async function enableWebPush(): Promise<EnableResult> {
  if (!(await supported())) return 'unsupported';
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return 'denied';
    return (await registerToken()) ? 'granted' : 'error';
  } catch {
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
