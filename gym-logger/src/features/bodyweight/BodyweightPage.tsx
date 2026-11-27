import { Suspense, lazy, useMemo, useState } from 'react';
import { RangePicker, useRange } from '../../components/RangePicker';
import { inRange, rangeBounds, yearsWithData } from '../../lib/range';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/dexie';
import { deleteBodyweight, logBodyweight, restore } from '../../db/repo';
import { undoToast } from '../../components/toast';
import { Button, Card, EmptyState, IconButton, Page, SectionTitle, inputClass } from '../../components/ui';
import { useSetting } from '../../lib/settings';
import { dateLong, dateShort, fromDisplay, num, parseNum, toDisplay } from '../../lib/format';
import { t } from '../../i18n';

const LineTrend = lazy(() => import('../../components/charts').then((m) => ({ default: m.LineTrend })));

export function BodyweightPage() {
  const unit = useSetting('unit');
  const [value, setValue] = useState('');
  const entries = useLiveQuery(async () => (await db.bodyweights.toArray()).filter((b) => !b.deleted).sort((a, b) => (a.date < b.date ? 1 : -1)), [], []);
  const [range, setRange] = useRange();
  const latest = entries[0];
  // Endring og graf gjelder valgt tidsrom.
  const period = useMemo(() => {
    const b = rangeBounds(range);
    return entries.filter((e) => inRange(e.date, b));
  }, [entries, range]);
  const years = useMemo(() => yearsWithData(entries.map((e) => e.date)), [entries]);
  const pLatest = period[0];
  const oldest = period[period.length - 1];
  const change = pLatest && oldest && pLatest !== oldest ? pLatest.weight_kg - oldest.weight_kg : null;

  const save = async () => {
    const v = parseNum(value);
    if (v <= 0) return;
    await logBodyweight(fromDisplay(v, unit));
    setValue('');
  };

  return (
    <Page title={t('Kroppsvekt', 'Bodyweight')} back>
      <Card className="p-3.5">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <label className="flex-1">
            <span className="sr-only">{t('Vekt i dag', 'Weight today')} ({unit})</span>
            <input id="bw-input" className={`${inputClass} font-num text-lg`} inputMode="decimal" placeholder={`${t('Vekt i dag', 'Weight today')} (${unit})`} value={value} onChange={(e) => setValue(e.target.value)} />
          </label>
          <Button type="submit" disabled={parseNum(value) <= 0}>
            {t('Logg', 'Log')}
          </Button>
        </form>
        <p className="mt-2 text-xs text-faint">{t('Én måling per dag. Logger du igjen samme dag, erstattes den.', 'One entry per day. Logging again the same day replaces it.')}</p>
      </Card>

      {entries.length === 0 ? (
        <EmptyState icon="scale" title={t('Ingen målinger', 'No entries')} text={t('Vei deg gjerne til samme tid på dagen, for eksempel om morgenen.', 'Try to weigh yourself at the same time of day, for example in the morning.')} />
      ) : (
        <>
          <div className="mt-4">
            <RangePicker value={range} onChange={setRange} years={years} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="card rounded-xl p-4">
              <div className="text-xs text-muted">{t('Nå', 'Now')}</div>
              <div className="font-num text-3xl font-bold">
                {num(toDisplay(latest.weight_kg, unit))} <span className="text-base text-faint">{unit}</span>
              </div>
            </div>
            <div className="card rounded-xl p-4">
              <div className="text-xs text-muted">{oldest ? `${t('Endring siden', 'Change since')} ${dateShort(oldest.date)}` : t('Endring', 'Change')}</div>
              <div className={`font-num text-3xl font-bold ${change === null ? 'text-faint' : ''}`}>
                {change === null ? '–' : `${change > 0 ? '+' : change < 0 ? '−' : ''}${num(Math.abs(toDisplay(change, unit)))}`}
              </div>
            </div>
          </div>
          {period.length >= 2 ? (
            <Card className="mt-3 p-2 pt-4">
              <Suspense fallback={<div className="h-52" />}>
                <LineTrend data={[...period].reverse().map((e) => ({ x: dateShort(e.date), y: Math.round(toDisplay(e.weight_kg, unit) * 10) / 10 }))} label={t('Kroppsvekt', 'Bodyweight')} unit={unit} />
              </Suspense>
            </Card>
          ) : (
            entries.length >= 2 && <p className="mt-3 text-sm text-muted">{t('For få målinger i denne perioden til en graf.', 'Too few entries in this period for a chart.')}</p>
          )}
          <SectionTitle>{t('Målinger', 'Entries')}</SectionTitle>
          <Card className="divide-y divide-line">
            {entries.map((e) => (
              <div key={e.id} className="flex items-center gap-3 py-2 pr-2 pl-4">
                <span className="flex-1 text-sm text-muted first-letter:uppercase">{dateLong(e.date)}</span>
                <span className="font-num font-bold">
                  {num(toDisplay(e.weight_kg, unit))} {unit}
                </span>
                <IconButton
                  icon="trash"
                  label={t('Slett måling', 'Delete entry')}
                  onClick={async () => {
                    const removed = await deleteBodyweight(e.id);
                    undoToast(t('Målingen er slettet', 'Entry deleted'), () => restore(removed));
                  }}
                />
              </div>
            ))}
          </Card>
        </>
      )}
    </Page>
  );
}
