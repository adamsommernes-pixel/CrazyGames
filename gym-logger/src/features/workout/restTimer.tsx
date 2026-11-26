import { useEffect, useRef, useState } from 'react';
import { getSetting, setSetting, useSetting } from '../../lib/settings';
import { duration } from '../../lib/format';
import { Icon } from '../../components/Icon';
import { buzz } from '../../lib/haptics';

// Timeren lagrer sluttidspunktet, så den teller riktig selv om skjermen låses
// eller appen lukkes og åpnes igjen.

let audio: AudioContext | null = null;

/** Må kalles fra et trykk (iOS krever det) før lyd kan spilles senere. */
export function unlockAudio() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audio ??= new Ctx();
    if (audio.state === 'suspended') void audio.resume();
  } catch {
    /* lyd er ikke tilgjengelig */
  }
}

function beep() {
  if (!audio) return;
  try {
    const t = audio.currentTime;
    for (const [i, freq] of [880, 880, 1320].entries()) {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.0001, t + i * 0.25);
      gain.gain.exponentialRampToValueAtTime(0.4, t + i * 0.25 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.25 + 0.2);
      osc.connect(gain).connect(audio.destination);
      osc.start(t + i * 0.25);
      osc.stop(t + i * 0.25 + 0.22);
    }
  } catch {
    /* ignorer */
  }
}

export async function startRest(seconds: number) {
  if (seconds <= 0) return;
  await setSetting('restTimer', { endAt: Date.now() + seconds * 1000, total: seconds });
}

export async function adjustRest(delta: number) {
  const t = await getSetting('restTimer');
  if (!t) return;
  const endAt = t.endAt + delta * 1000;
  if (endAt <= Date.now()) return setSetting('restTimer', null);
  await setSetting('restTimer', { endAt, total: Math.max(1, t.total + delta) });
}

export const stopRest = () => setSetting('restTimer', null);

export function useNow(intervalMs = 1000, active = true) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, active]);
  return now;
}

/** Linje over bunnmenyen som viser gjenstående hviletid. */
export function RestTimerBar() {
  const timer = useSetting('restTimer');
  const sound = useSetting('sound');
  const now = useNow(250, !!timer);
  const notified = useRef<number | null>(null);
  const remaining = timer ? timer.endAt - now : 0;

  useEffect(() => {
    if (!timer || remaining > 0 || notified.current === timer.endAt) return;
    notified.current = timer.endAt;
    if (sound) beep();
    void buzz([300, 150, 300]);
    const t = setTimeout(() => void stopRest(), 2500);
    return () => clearTimeout(t);
  }, [timer, remaining, sound]);

  if (!timer) return null;
  const done = remaining <= 0;
  const pct = done ? 100 : Math.min(100, 100 - (remaining / (timer.total * 1000)) * 100);

  return (
    <div className="mx-auto w-full max-w-xl px-3 pb-2" role="timer" aria-live="off">
      <div className="relative overflow-hidden rounded-2xl border border-green/40 bg-surface shadow-lg shadow-black">
        <div className="absolute inset-y-0 left-0 bg-green-dim/60 transition-[width] duration-200" style={{ width: `${pct}%` }} />
        <div className="relative flex items-center gap-2 px-3 py-2">
          <Icon name="timer" className="text-green" />
          <span className={`tabular flex-1 text-xl font-bold ${done ? 'text-green-light' : ''}`}>
            {done ? 'Klar for neste set!' : duration(remaining)}
          </span>
          {!done && (
            <>
              <button type="button" className="min-h-10 rounded-lg bg-raised px-3 text-sm font-semibold" onClick={() => void adjustRest(-15)}>
                −15
              </button>
              <button type="button" className="min-h-10 rounded-lg bg-raised px-3 text-sm font-semibold" onClick={() => void adjustRest(15)}>
                +15
              </button>
            </>
          )}
          <button type="button" className="min-h-10 rounded-lg px-3 text-sm font-semibold text-green" onClick={() => void stopRest()}>
            {done ? 'OK' : 'Hopp over'}
          </button>
        </div>
      </div>
    </div>
  );
}
