import type { Equipment } from '../../db/types';
import { Card, SectionTitle } from '../../components/ui';
import { platesPerSide } from '../../lib/plates';
import { stepFor } from '../../lib/progression';
import { useSetting } from '../../lib/settings';
import { num, toDisplay } from '../../lib/format';

const PERCENTS = [95, 90, 85, 80, 75, 70];

/** Omtrent hvor mange reps en vekt tilsvarer (Epley baklengs). */
const repsAt = (pct: number) => Math.max(1, Math.round(30 * (100 / pct - 1)));

/**
 * Tabell over prosent av beste beregnede 1RM, avrundet ned til noe som faktisk kan lastes:
 * skiver på stanga for stangøvelser, ellers nærmeste steg (1 kg / 2 lbs).
 */
export function OneRepMaxTable({ oneRm, equipment }: { oneRm: number; equipment?: Equipment }) {
  const unit = useSetting('unit');
  const barWeight = useSetting('barWeight');
  const plates = useSetting('plates');
  if (oneRm <= 0) return null;
  const step = stepFor(equipment, unit);
  const load = (kg: number) =>
    equipment === 'Stang' ? platesPerSide(kg, barWeight, plates).achieved : Math.floor(kg / step + 1e-9) * step;

  return (
    <section>
      <SectionTitle>Prosent av 1RM</SectionTitle>
      <Card className="overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-line text-[11px] tracking-wide text-faint uppercase">
              <th className="px-4 py-2 font-semibold">Prosent</th>
              <th className="px-4 py-2 font-semibold">Vekt ({unit})</th>
              <th className="px-4 py-2 text-right font-semibold">≈ Reps</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {PERCENTS.map((p) => (
              <tr key={p}>
                <td className="font-num px-4 py-2.5 text-muted">{p} %</td>
                <td className="font-num px-4 py-2.5 text-lg font-bold">{num(toDisplay(load((oneRm * p) / 100), unit))}</td>
                <td className="font-num px-4 py-2.5 text-right text-muted">{repsAt(p)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="mt-2 text-xs text-faint">
        Basert på beste beregnede 1RM: {num(toDisplay(oneRm, unit), 0)} {unit}. Avrundet ned til {equipment === 'Stang' ? 'skivene dine' : 'nærmeste steg'}.
      </p>
    </section>
  );
}
