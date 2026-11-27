// ?case=record|liftup|ranked|levelup&tier=5&lang=nb&accent=%2334c56a
import { createRoot } from 'react-dom/client';
import '../../src/index.css';
import { openUserDb } from '../../src/db/dexie';
import { LevelHost, showLevelEvent } from '../../src/components/levelUp';
import { WhatsNewHost, fetchWhatsNew, showWhatsNew } from '../../src/components/whatsNew';
import { MemoryRouter } from 'react-router-dom';
import { PushPromptView } from '../../src/components/PushPrompt';
import { tierAt, type LevelEvent, type LiftScore, type StrengthProfile } from '../../src/lib/strength';
import { applyAccent } from '../../src/lib/theme';
import { setLang } from '../../src/i18n';

const q = new URLSearchParams(location.search);
setLang(q.get('lang') === 'en' ? 'en' : 'nb');
applyAccent(q.get('accent') ?? '#34c56a');
openUserDb('preview-levels');
const kase = q.get('case') ?? 'record';
const tier = Number(q.get('tier') ?? 5);

const lift = (score: number): LiftScore => ({ exerciseId: 'ex-benkpress', category: 'press' as never, e1rm: 100, score, tier: tierAt(Math.floor(score / 10)), nextTierKg: 110, capped: false, bodyweightLoad: false });
const profile = (score: number): StrengthProfile => ({ score, tier: tierAt(Math.floor(score / 10)), progress: (score % 10) / 10, categories: {} as never, lifts: [], missing: [] });

const base = tier * 10;
const ev: LevelEvent =
  kase === 'levelup'
    ? { exerciseId: 'ex-kneboy', before: lift(base - 1), after: lift(base + 2), overallBefore: profile(base - 0.6), overallAfter: profile(base + 0.8), weight: 140, reps: 5 }
    : kase === 'liftup'
      ? { exerciseId: 'ex-benkpress', before: lift(base - 1.5), after: lift(base + 1.2), overallBefore: profile(base + 3), overallAfter: profile(base + 3.6), weight: 100, reps: 5 }
      : kase === 'ranked'
        ? { exerciseId: 'ex-markloft', before: null, after: lift(base + 4), overallBefore: profile(base + 2), overallAfter: profile(base + 3), weight: 160, reps: 3 }
        : { exerciseId: 'ex-benkpress', before: lift(base + 3), after: lift(base + 5.5), overallBefore: profile(base + 4), overallAfter: profile(base + 4.5), weight: 102.5, reps: 4 };
const label = { levelup: 'Knebøy', liftup: 'Benkpress', ranked: 'Markløft', record: 'Benkpress' }[kase] ?? 'Benkpress';

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <LevelHost />
    <WhatsNewHost />
    {kase === 'push' && <PushPromptView busy={false} error={null} onEnable={() => {}} onClose={() => {}} />}
  </MemoryRouter>,
);
if (kase === 'whatsnew') void fetchWhatsNew().then((n) => n && showWhatsNew(n, () => {}, () => {}));
else if (kase !== 'push') setTimeout(() => showLevelEvent(ev, label, 82), 100);
