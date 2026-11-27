// Varsel når pausen er over, også når telefonen er låst. Nettleseren stopper appen når skjermen
// låses, så varselet sendes fra serveren (Supabase) som web push. Se supabase/migrations/010_push.sql
// og supabase/functions/rest-alarms.
import { supabase } from './supabase';
import { getSetting, setSetting } from './settings';
import { t } from '../i18n';

const VAPID = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined)?.trim() ?? '';

export type PushStatus =
  | 'ready' // kan slås på
  | 'unconfigured' // appen er bygget uten nøkkel, eller uten sky
  | 'unsupported' // nettleseren mangler web push
  | 'install-first' // iPhone: må legges på Hjem-skjermen først
  | 'denied'; // brukeren har blokkert varsler

const isIOS = () => typeof navigator !== 'undefined' && /iP(hone|ad|od)/.test(navigator.userAgent);
const isStandalone = () =>
  typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true);

export function pushStatus(): PushStatus {
  if (!VAPID || !supabase) return 'unconfigured';
  if (isIOS() && !isStandalone()) return 'install-first';
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  return 'ready';
}

/** base64url → bytes (VAPID-nøkkelen). */
export function urlBase64ToBytes(s: string): Uint8Array {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function userId(): Promise<string | null> {
  const { data } = (await supabase?.auth.getSession()) ?? { data: { session: null } };
  return data.session?.user.id ?? null;
}

/** Ber om lov til varsler og lagrer abonnementet. Kast med forklaring om noe mangler. */
export async function enableRestPush(): Promise<void> {
  const status = pushStatus();
  if (status !== 'ready') throw new Error(pushStatusText(status));
  const uid = await userId();
  if (!uid) throw new Error(t('Logg inn med konto for å få varsler.', 'Log in with an account to get notifications.'));
  if ((await Notification.requestPermission()) !== 'granted') throw new Error(pushStatusText('denied'));
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToBytes(VAPID) as BufferSource }));
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  const { error } = await supabase!.from('push_subscriptions').upsert({ endpoint: json.endpoint, user_id: uid, p256dh: json.keys.p256dh, auth: json.keys.auth });
  if (error) throw new Error(error.message);
  await setSetting('restPush', true);
}

export async function disableRestPush(): Promise<void> {
  await setSetting('restPush', false);
  try {
    const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
    if (sub) {
      await supabase?.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      await sub.unsubscribe();
    }
    await cancelRestAlarm();
  } catch {
    /* ikke viktig */
  }
}

/** Planlegger varselet. Feiler stille (uten nett ringer appen fortsatt selv når den er åpen). */
export async function scheduleRestAlarm(endAt: number, body: string): Promise<void> {
  if (!supabase || !(await getSetting('restPush'))) return;
  const uid = await userId();
  if (!uid) return;
  await supabase
    .from('rest_alarms')
    .upsert({ user_id: uid, send_at: new Date(endAt).toISOString(), title: t('Pausen er over', 'Rest is over'), body })
    .then(
      () => undefined,
      () => undefined,
    );
}

export async function cancelRestAlarm(): Promise<void> {
  if (!supabase || !(await getSetting('restPush'))) return;
  const uid = await userId();
  if (!uid) return;
  await supabase
    .from('rest_alarms')
    .delete()
    .eq('user_id', uid)
    .then(
      () => undefined,
      () => undefined,
    );
}

export function pushStatusText(s: PushStatus): string {
  switch (s) {
    case 'unconfigured':
      return t('Varsler er ikke satt opp i denne versjonen av appen.', 'Notifications are not set up in this version of the app.');
    case 'install-first':
      return t('På iPhone må appen ligge på Hjem-skjermen: trykk Del-knappen i Safari og «Legg til på Hjem-skjerm», og åpne appen derfra.', 'On iPhone the app must be on the Home Screen: tap Share in Safari, then “Add to Home Screen”, and open the app from there.');
    case 'unsupported':
      return t('Nettleseren din støtter ikke varsler.', 'Your browser does not support notifications.');
    case 'denied':
      return t('Varsler er blokkert. Slå dem på for Repgrade i telefonens innstillinger.', 'Notifications are blocked. Turn them on for Repgrade in your phone’s settings.');
    default:
      return '';
  }
}
