import { describe, expect, it } from 'vitest';
import file from '../../public/whats-new.json';
import pkg from '../../package.json';
import { compareVersions, parseWhatsNew, releasesSince } from './whatsNew';

describe('hva er nytt', () => {
  it('nyhetsfila gjelder versjonen som bygges (husk å oppdatere begge ved ny versjon)', () => {
    expect(file.version).toBe(pkg.version);
  });
  it('har punkter på begge språk', () => {
    const w = parseWhatsNew(file);
    expect(w?.items.length).toBeGreaterThanOrEqual(1);
    for (const i of w!.items) expect(i.nb && i.en).toBeTruthy();
  });
  it('ukjente ikoner ignoreres', () => {
    expect(parseWhatsNew({ version: '1', items: [{ nb: 'a', en: 'b', icon: 'finnes-ikke' }] })?.items[0].icon).toBeUndefined();
    expect(parseWhatsNew({ version: '1', items: [{ nb: 'a', en: 'b', icon: 'trophy' }] })?.items[0].icon).toBe('trophy');
  });
  it('viser alle versjoner brukeren har hoppet over (høyst 3), nyeste først', () => {
    const w = parseWhatsNew({
      version: '1.3.0',
      items: [{ nb: 'c', en: 'c' }],
      history: [{ version: '1.2.0', items: [{ nb: 'b', en: 'b' }] }, { version: '1.1.0', items: [{ nb: 'a', en: 'a' }] }],
    })!;
    expect(releasesSince(w, '1.1.0').map((r) => r.version)).toEqual(['1.3.0', '1.2.0']);
    expect(releasesSince(w, '1.2.0').map((r) => r.version)).toEqual(['1.3.0']);
    expect(releasesSince(w, null).map((r) => r.version)).toEqual(['1.3.0']);
    expect(compareVersions('1.10.0', '1.9.9')).toBeGreaterThan(0);
  });
  it('historikken i nyhetsfila er gyldig og eldre enn gjeldende versjon', () => {
    const w = parseWhatsNew(file)!;
    expect(w.releases[0].version).toBe(pkg.version);
    for (const r of w.releases.slice(1)) expect(compareVersions(r.version, pkg.version)).toBeLessThan(0);
  });
  it('overskrift og film for lanseringen, bare filer i appen', () => {
    const w = parseWhatsNew(file)!;
    expect(w.releases[0].headline?.en).toBe('Socials is here');
    expect(w.releases[0].video).toEqual({ src: 'ad/socials.mp4', poster: 'ad/socials-poster.jpg' });
    const bad = (src: string) => parseWhatsNew({ version: '1', items: [{ nb: 'a', en: 'b' }], video: { src } })?.video;
    expect(bad('https://evil.example/x.mp4')).toBeUndefined();
    expect(bad('../x.mp4')).toBeUndefined();
    expect(bad('/x.mp4')).toBeUndefined();
  });
  it('ugyldig fil gir null', () => {
    expect(parseWhatsNew({ version: '1' })).toBeNull();
    expect(parseWhatsNew(null)).toBeNull();
  });
});
