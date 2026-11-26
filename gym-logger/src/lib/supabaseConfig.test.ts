import { describe, expect, it } from 'vitest';
import { normalizeSupabaseConfig } from './supabaseConfig';

const ok = { url: 'https://abcdefghijklmnop.supabase.co', key: 'sb_publishable_123' };

describe('Supabase config', () => {
  it('is null without values (local mode)', () => {
    expect(normalizeSupabaseConfig('', ' ')).toBeNull();
  });
  it('fixes common paste mistakes', () => {
    expect(normalizeSupabaseConfig(' https://abcdefghijklmnop.supabase.co/ \n', ' sb_publishable_123 ')).toEqual(ok);
    expect(normalizeSupabaseConfig('abcdefghijklmnop.supabase.co', 'sb_publishable_123')).toEqual(ok);
    expect(normalizeSupabaseConfig('abcdefghijklmnop', 'sb_publishable_123')).toEqual(ok);
    expect(normalizeSupabaseConfig('"https://abcdefghijklmnop.supabase.co/rest/v1/"', 'sb_publishable_123')).toEqual(ok);
    expect(normalizeSupabaseConfig('sb_publishable_123', 'https://abcdefghijklmnop.supabase.co')).toEqual(ok);
  });
  it('explains what is wrong instead of crashing', () => {
    expect(normalizeSupabaseConfig('https://x.supabase.co', 'sb_secret_abc')).toHaveProperty('error');
    expect(normalizeSupabaseConfig('https://abc.supabase.co', '')).toHaveProperty('error');
    expect(normalizeSupabaseConfig('not a url', 'sb_publishable_1')).toHaveProperty('error');
  });
});
