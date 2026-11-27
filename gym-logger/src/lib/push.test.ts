import { describe, expect, it } from 'vitest';
import { pushStatus, urlBase64ToBytes } from './push';

describe('varsler', () => {
  it('dekoder VAPID-nøkkelen (base64url)', () => {
    expect([...urlBase64ToBytes('AQID_-8')]).toEqual([1, 2, 3, 255, 239]);
  });
  it('uten nøkkel i bygget er funksjonen skjult', () => {
    expect(pushStatus()).toBe('unconfigured');
  });
});
