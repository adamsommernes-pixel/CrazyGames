import { describe, expect, it } from 'vitest';
import file from '../../public/whats-new.json';
import pkg from '../../package.json';
import { parseWhatsNew } from './whatsNew';

describe('hva er nytt', () => {
  it('nyhetsfila gjelder versjonen som bygges (husk å oppdatere begge ved ny versjon)', () => {
    expect(file.version).toBe(pkg.version);
  });
  it('har punkter på begge språk', () => {
    const w = parseWhatsNew(file);
    expect(w?.items.length).toBeGreaterThanOrEqual(1);
    for (const i of w!.items) expect(i.nb && i.en).toBeTruthy();
  });
  it('ugyldig fil gir null', () => {
    expect(parseWhatsNew({ version: '1' })).toBeNull();
    expect(parseWhatsNew(null)).toBeNull();
  });
});
