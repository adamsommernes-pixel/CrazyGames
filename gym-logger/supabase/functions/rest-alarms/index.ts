// Supabase Edge Function: sender «pausen er over»-varsler som har forfalt.
// Kalles av databasejobben «rest-alarms» (se migrations/010_push.sql) hvert 5. sekund når noe er forfalt.
// Hemmeligheter (supabase secrets set): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET.
// Deploy: supabase functions deploy rest-alarms --no-verify-jwt
import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import webpush from 'npm:web-push@3.6.7';

const env = (k: string) => Deno.env.get(k) ?? '';

webpush.setVapidDetails(env('VAPID_SUBJECT') || 'mailto:noreply@example.com', env('VAPID_PUBLIC_KEY'), env('VAPID_PRIVATE_KEY'));
const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

Deno.serve(async (req) => {
  if (!env('CRON_SECRET') || req.headers.get('x-cron-secret') !== env('CRON_SECRET')) return new Response('forbidden', { status: 403 });

  // Hent og slett forfalte alarmer i ett steg, så ingen sendes to ganger.
  const { data: due, error } = await db.from('rest_alarms').delete().lte('send_at', new Date().toISOString()).select();
  if (error) return new Response(error.message, { status: 500 });
  if (!due?.length) return new Response('ingen');

  const users = [...new Set(due.map((a) => a.user_id))];
  const { data: subs } = await db.from('push_subscriptions').select('*').in('user_id', users);
  let sent = 0;
  await Promise.all(
    (subs ?? []).map(async (s) => {
      const alarm = due.find((a) => a.user_id === s.user_id)!;
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ title: alarm.title, body: alarm.body, tag: 'rest' }),
          { TTL: 60, urgency: 'high' },
        );
        sent++;
      } catch (e) {
        // Abonnementet finnes ikke lenger (appen er fjernet eller varsler skrudd av): rydd bort.
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await db.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
      }
    }),
  );
  return new Response(JSON.stringify({ alarms: due.length, sent }), { headers: { 'Content-Type': 'application/json' } });
});
