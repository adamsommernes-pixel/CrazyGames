// Rydder i Supabase-verdiene fra byggemiljøet. Vanlige feil ved innliming (mellomrom, anførselstegn,
// manglende https://, bare prosjektnavnet, eller URL og nøkkel byttet om) rettes automatisk.

export interface SupabaseConfig {
  url: string;
  key: string;
}

const clean = (v: string | undefined) => (v ?? '').trim().replace(/^["']|["']$/g, '').trim();
const looksLikeKey = (v: string) => /^(sb_publishable_|sb_secret_|eyJ)/.test(v);

export function normalizeSupabaseConfig(rawUrl: string | undefined, rawKey: string | undefined): SupabaseConfig | null | { error: string } {
  let url = clean(rawUrl);
  let key = clean(rawKey);
  if (!url && !key) return null; // bygget uten Supabase: lokal modus
  if (looksLikeKey(url) && !looksLikeKey(key)) [url, key] = [key, url];
  if (key.startsWith('sb_secret_')) return { error: 'VITE_SUPABASE_ANON_KEY er den hemmelige nøkkelen (sb_secret_…). Bruk Publishable key (sb_publishable_…) eller anon-nøkkelen.' };
  if (!url) return { error: 'VITE_SUPABASE_URL mangler.' };
  if (!key) return { error: 'VITE_SUPABASE_ANON_KEY mangler.' };
  if (/^[a-z0-9]{10,}$/i.test(url)) url = `https://${url}.supabase.co`; // bare prosjekt-ID
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  url = url.replace(/\/(rest|auth)\/v1\/?.*$/i, '').replace(/\/+$/, '');
  try {
    const u = new URL(url);
    if (!u.hostname.includes('.')) throw new Error();
  } catch {
    return { error: `VITE_SUPABASE_URL ser ikke ut som en adresse: «${clean(rawUrl)}». Den skal se ut som https://abcdefgh.supabase.co` };
  }
  return { url, key };
}
