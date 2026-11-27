import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { BUILTIN_EXERCISES, LIBRARY, guideFor } from './index';
import { TEMPLATES } from '../templates';
import { GymDB } from '../dexie';
import { MUSCLE_GROUPS } from '../types';

// Id-ene fra versjon 1–3. Historikk, rutiner og maler peker på dem, så de må aldri forsvinne.
const OLD_IDS = `benkpress skrabenk benkpress-med-manualer skrabenk-med-manualer flyes-med-manualer kabelflyes brystpress-i-maskin pec-deck push-ups dips markloft stangroing pull-ups chin-ups nedtrekk sittende-roing roing-med-manual t-bar-roing rumensk-markloft hyperekstensjon militaerpress skulderpress-med-manualer sidehev sidehev-i-kabel face-pulls omvendt-flyes arnoldpress skulderpress-i-maskin shrugs bicepscurl-med-stang bicepscurl-med-manualer hammercurl preacher-curl kabelcurl triceps-pushdown fransk-press triceps-overhead-i-kabel smal-benkpress kickbacks kneboy frontboy beinpress utfall bulgarsk-splittboy beinspark larcurl tahev-staende tahev-sittende hack-squat goblet-squat hip-thrust glute-bridge hip-abduction kettlebell-swing planke situps hengende-beinhev kabel-crunch ab-wheel russian-twist tredemolle romaskin sykkel ellipsemaskin`
  .split(' ')
  .map((s) => `ex-${s}`);

describe('øvelsesbiblioteket', () => {
  const ids = BUILTIN_EXERCISES.map((e) => e.id);

  it('har over 200 øvelser med unike id-er og navn', () => {
    expect(ids.length).toBeGreaterThanOrEqual(200);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(BUILTIN_EXERCISES.map((e) => e.name)).size).toBe(ids.length);
  });

  it('beholder alle gamle id-er', () => {
    for (const id of OLD_IDS) expect(ids, id).toContain(id);
  });

  it('alle maler peker på øvelser som finnes', () => {
    for (const routines of Object.values(TEMPLATES))
      for (const r of routines) for (const [id] of r.exercises) expect(ids, id).toContain(id);
  });

  it('hver øvelse har en fullstendig fremgangsmåte', () => {
    for (const e of LIBRARY) {
      const g = guideFor(`ex-${e.slug}`)!;
      expect(g, e.name).toBeDefined();
      if (e.kind !== 'cardio' || e.slug !== 'sykkel-ute') expect(g.steps.length, e.name).toBeGreaterThanOrEqual(2);
      expect(g.tips.length, e.name).toBeGreaterThanOrEqual(1);
      expect(g.secondary.every((m) => MUSCLE_GROUPS.includes(m)), e.name).toBe(true);
      expect(g.secondary, e.name).not.toContain(e.group);
    }
  });

  it('hver muskelgruppe (unntatt Annet) har minst 3 øvelser', () => {
    for (const g of MUSCLE_GROUPS.filter((m) => m !== 'Annet'))
      expect(LIBRARY.filter((e) => e.group === g).length, g).toBeGreaterThanOrEqual(3);
  });
});

describe('nye innebygde øvelser i eksisterende kontoer', () => {
  it('legges til ved åpning, uten å røre egne øvelser', async () => {
    // Lag en «gammel» database med bare én innebygd øvelse og én egen.
    const name = 'old-db-test';
    const old = new Dexie(name);
    old.version(1).stores({ exercises: 'id, name, muscle_group, custom, dirty', kv: 'key' });
    await old.open();
    await old.table('exercises').bulkAdd([
      { id: 'ex-benkpress', name: 'Benkpress', muscle_group: 'Bryst', equipment: 'Stang', custom: 0, deleted: 0, dirty: 0, updated_at: '' },
      { id: 'egen-1', name: 'Min øvelse', muscle_group: 'Annet', equipment: 'Annet', custom: 1, deleted: 0, dirty: 1, updated_at: '' },
    ]);
    old.close();

    const db = new GymDB(name);
    await db.open();
    const all = await db.exercises.toArray();
    expect(all.length).toBe(BUILTIN_EXERCISES.length + 1);
    expect(all.find((e) => e.id === 'egen-1')).toMatchObject({ name: 'Min øvelse', custom: 1 });
    expect(all.find((e) => e.id === 'ex-planke')?.kind).toBe('time');
    expect(all.find((e) => e.id === 'ex-benkpress')?.kind).toBe('weight');
    db.close();
  });
});
