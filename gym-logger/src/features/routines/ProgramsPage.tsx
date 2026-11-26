import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useUser } from '../../auth/AuthProvider';
import { applyProgram, getProfile, replaceableRoutines } from '../../db/repo';
import { programById, recommendedProgramId } from '../../db/programs';
import { Button, Chip, Page, Sheet } from '../../components/ui';
import { showToast } from '../../components/toast';
import { db, now } from '../../db/dexie';
import { PROGRAMS_SEEN_KEY } from '../../db/repo';
import { t } from '../../i18n';
import { ProgramList } from './ProgramList';

/** Programbiblioteket: velg dager i uka og et program, så lages rutinene. */
export function ProgramsPage() {
  const user = useUser();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const profile = useLiveQuery(() => getProfile(user.id), [user.id]);
  const [days, setDays] = useState<number | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [ask, setAsk] = useState<{ replaceable: number } | null>(null);
  const [busy, setBusy] = useState(false);

  // Å åpne siden teller som å ha sett de nye programmene (banneret på Hjem forsvinner).
  useEffect(() => {
    void db.kv.put({ key: PROGRAMS_SEEN_KEY, value: now() });
  }, []);

  if (!profile) return <Page title={t('Programmer', 'Programs')} back>{null}</Page>;
  const d = days ?? (Number(params.get('days')) || profile.weekly_target || 3);
  const goal = profile.goal;
  const selected = picked ?? recommendedProgramId(d, profile.experience, goal);
  const program = programById(selected);

  const apply = async (mode: 'add' | 'replace') => {
    setBusy(true);
    try {
      const n = await applyProgram(selected, goal, mode);
      setAsk(null);
      showToast(t(`${program?.name} er lagt til (${n} rutiner).`, `${program?.name} added (${n} routines).`));
      navigate('/routines', { replace: true });
    } finally {
      setBusy(false);
    }
  };

  const start = async () => {
    const replaceable = (await replaceableRoutines()).length;
    if (replaceable > 0) setAsk({ replaceable });
    else void apply('add');
  };

  return (
    <Page title={t('Programmer', 'Programs')} back>
      <p className="text-muted">
        {t('Velg hvor mange dager i uka du vil trene, så foreslår vi en splitt. Rutinene kan endres etterpå.', 'Choose how many days a week you want to train, and we suggest a split. The routines can be changed afterwards.')}
      </p>
      <div className="mt-4 mb-4 flex flex-wrap items-center gap-2" role="group" aria-label={t('Dager i uka', 'Days a week')}>
        {[2, 3, 4, 5, 6].map((n) => (
          <Chip key={n} active={d === n} onClick={() => { setDays(n); setPicked(null); }}>
            {t(`${n} dager`, `${n} days`)}
          </Chip>
        ))}
      </div>
      <ProgramList days={d} experience={profile.experience} goal={goal} selected={selected} onSelect={setPicked} />
      <div className="sticky bottom-20 -mx-4 mt-5 bg-gradient-to-t from-bg via-bg to-transparent px-4 pt-6 pb-4">
        <Button full className="min-h-14 text-lg" disabled={busy || !program} onClick={() => void start()}>
          {t('Bruk dette programmet', 'Use this program')}
        </Button>
      </div>

      <Sheet open={!!ask} onClose={() => setAsk(null)} title={t('Hva med rutinene du har?', 'What about your current routines?')}>
        <p className="text-muted">
          {t(
            `Du har ${ask?.replaceable} startrutine${ask?.replaceable === 1 ? '' : 'r'} fra et tidligere program. Rutiner du har laget eller endret selv beholdes uansett.`,
            `You have ${ask?.replaceable} starter routine${ask?.replaceable === 1 ? '' : 's'} from an earlier program. Routines you made or changed yourself are always kept.`,
          )}
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <Button full disabled={busy} onClick={() => void apply('replace')}>
            {t('Erstatt startrutinene', 'Replace the starter routines')}
          </Button>
          <Button full variant="secondary" disabled={busy} onClick={() => void apply('add')}>
            {t('Behold dem og legg til de nye', 'Keep them and add the new ones')}
          </Button>
        </div>
      </Sheet>
    </Page>
  );
}
