import { useEffect, useRef, useState } from 'react';
import { Button, Chip, Sheet } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { showToast } from '../../components/toast';
import { useExerciseMap } from '../workout/ExercisePicker';
import { usePRMap } from '../../lib/prs';
import { useSetting } from '../../lib/settings';
import { useStrength } from '../../lib/strengthLive';
import { t } from '../../i18n';
import { buildShareData, type ShareData } from './shareData';
import { CARD_LEVELS, CARD_SIZE, cardBlob, renderCard, type CardFormat, type CardLevel } from './cards';

/** Velg et delekort (fire nivåer, story eller post) og del det som bilde. */
export default function ShareSheet({ workoutId, onClose }: { workoutId: string; onClose: () => void }) {
  const exMap = useExerciseMap();
  const prMap = usePRMap();
  const unit = useSetting('unit');
  const strength = useStrength();
  const [data, setData] = useState<ShareData | null>(null);
  const [level, setLevel] = useState<CardLevel>(3);
  const [format, setFormat] = useState<CardFormat>('story');
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fullImage, setFullImage] = useState<string | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!exMap.size || strength === undefined) return;
    void buildShareData(workoutId, exMap, prMap, unit, strength.profile).then(setData);
  }, [workoutId, exMap, prMap, unit, strength]);

  useEffect(() => {
    if (!data) return;
    let alive = true;
    void renderCard(data, level, format).then((c) => {
      if (!alive) return;
      canvas.current = c;
      setPreview(c.toDataURL('image/png'));
    });
    return () => {
      alive = false;
    };
  }, [data, level, format]);

  const fileName = `gym-logger-${(data?.name ?? 'okt').toLowerCase().replace(/[^a-z0-9æøå]+/gi, '-')}.png`;

  const share = async () => {
    if (!canvas.current) return;
    setBusy(true);
    try {
      const blob = await cardBlob(canvas.current);
      const file = new File([blob], fileName, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: data?.name });
          return;
        } catch (e) {
          if ((e as Error).name === 'AbortError') return;
        }
      }
      download(blob);
    } finally {
      setBusy(false);
    }
  };

  const download = async (blob?: Blob) => {
    if (!canvas.current) return;
    const b = blob ?? (await cardBlob(canvas.current));
    const url = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    showToast(t('Bildet er lastet ned. Fungerte det ikke? Trykk «Åpne bilde».', 'Image downloaded. Did not work? Tap “Open image”.'));
  };

  const ratio = CARD_SIZE[format].w / CARD_SIZE[format].h;

  return (
    <>
      <Sheet open onClose={onClose} title={t('Del økta', 'Share workout')} tall>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-1.5" role="group" aria-label={t('Format', 'Format')}>
              <Chip active={format === 'story'} onClick={() => setFormat('story')}>
                Story 9:16
              </Chip>
              <Chip active={format === 'post'} onClick={() => setFormat('post')}>
                Post 4:5
              </Chip>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-1.5" role="tablist" aria-label={t('Korttype', 'Card type')}>
            {CARD_LEVELS.map((c) => (
              <button
                key={c.level}
                type="button"
                role="tab"
                aria-selected={level === c.level}
                onClick={() => setLevel(c.level)}
                className={`flex flex-col items-center gap-0.5 rounded-2xl border px-1 py-2 text-xs font-semibold transition ${
                  level === c.level ? 'border-green bg-green-dim/40 text-green-light' : 'border-line bg-raised text-muted'
                }`}
              >
                <span className="font-num text-base">{c.level}</span>
                <span className="w-full leading-tight break-words hyphens-manual">{c.name}</span>
              </button>
            ))}
          </div>
          <p className="text-center text-xs text-faint">{CARD_LEVELS[level - 1].text}</p>

          <div className="mx-auto w-full" style={{ maxWidth: `calc(40vh * ${ratio})` }}>
            <div className="relative w-full overflow-hidden rounded-2xl border border-line bg-black shadow-2xl" style={{ aspectRatio: `${ratio}` }}>
              {preview ? (
                <img src={preview} alt={t(`Delekort: ${CARD_LEVELS[level - 1].name}`, `Share card: ${CARD_LEVELS[level - 1].name}`)} className="h-full w-full animate-fade" />
              ) : (
                <div className="grid h-full place-items-center text-sm text-muted">{t('Lager kort …', 'Making card …')}</div>
              )}
            </div>
          </div>
        </div>
        <div className="sticky bottom-0 -mx-4 mt-3 flex flex-col gap-2 border-t border-line bg-surface px-4 pt-3">
          <Button full icon="share" className="min-h-14 text-lg" disabled={!preview || busy} onClick={() => void share()}>
            {t('Del bilde', 'Share image')}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" disabled={!preview} onClick={() => void download()}>
              {t('Last ned', 'Download')}
            </Button>
            <Button variant="secondary" disabled={!preview} onClick={() => setFullImage(preview)}>
              {t('Åpne bilde', 'Open image')}
            </Button>
          </div>
        </div>
      </Sheet>

      {fullImage && (
        <div className="fixed inset-0 z-[90] flex animate-fade flex-col items-center justify-center gap-3 bg-black/95 p-4" role="dialog" aria-modal="true" aria-label={t('Bilde', 'Image')}>
          <img src={fullImage} alt={t('Delekort', 'Share card')} className="max-h-[80vh] max-w-full rounded-xl" />
          <p className="text-sm text-muted">{t('Hold inne på bildet for å lagre eller dele det.', 'Press and hold the image to save or share it.')}</p>
          <button type="button" onClick={() => setFullImage(null)} className="flex min-h-12 items-center gap-2 rounded-2xl bg-raised px-5 font-semibold">
            <Icon name="x" size={18} /> {t('Lukk', 'Close')}
          </button>
        </div>
      )}
    </>
  );
}
