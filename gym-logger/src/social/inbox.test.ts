import { describe as group, expect, it } from 'vitest';
import { describe } from './inbox';
import type { NotificationKind, Person, SocialNotification } from './types';

const zara: Person = { user_id: 'z', handle: 'zara', display_name: 'Zara', color: '#000000' };
const n = (kind: NotificationKind, payload: Record<string, unknown> = {}): SocialNotification => ({ id: '1', user_id: 'me', kind, actor: 'z', payload, read_at: null, created_at: '' });

group('innboks', () => {
  it('tekst og mål for hver type varsel', () => {
    expect(describe(n('follow_request'), zara)).toEqual({ text: 'Zara vil følge deg', to: '/social', tab: 'people' });
    expect(describe(n('follow_accepted'), zara)).toEqual({ text: 'Zara godtok forespørselen din', to: '/u/zara' });
    expect(describe(n('new_follower'), zara).to).toBe('/u/zara');
    expect(describe(n('reaction', { emoji: '🔥' }), zara)).toEqual({ text: 'Zara ga 🔥 på økta di', to: '/social', tab: 'feed' });
    expect(describe(n('challenge_invite', { challenge_id: 'c1', title: 'Uka' }), zara)).toEqual({ text: 'Zara utfordret deg: «Uka»', to: '/challenge/c1' });
    expect(describe(n('challenge_joined', { challenge_id: 'c1', title: 'Uka' }), zara).text).toBe('Zara ble med i «Uka»');
  });

  it('ukjent avsender (f.eks. blokkert eller slettet)', () => {
    expect(describe(n('new_follower'), undefined)).toEqual({ text: 'Noen følger deg nå', to: '/social' });
  });
});
