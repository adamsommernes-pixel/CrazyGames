import { useRef, useState } from 'react';
import { t } from '../i18n';

/**
 * Reklamefilmen (stående video). Starter uten lyd (telefoner tillater ikke lyd av seg selv);
 * «Trykk for lyd» starter den på nytt med lyd. Kan ikke filmen lastes (f.eks. uten nett), vises ingenting.
 */
export function AdVideo({ src, poster, className = '' }: { src: string; poster?: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const [sound, setSound] = useState(false);
  if (failed) return null;
  const base = import.meta.env.BASE_URL;
  const withSound = () => {
    const v = ref.current;
    if (!v) return;
    v.muted = false;
    v.currentTime = 0;
    setSound(true);
    void v.play().catch(() => {});
  };
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-line bg-surface ${className}`} style={{ aspectRatio: '9 / 16' }}>
      <video
        ref={ref}
        poster={poster ? `${base}${poster}` : undefined}
        className="block h-full w-full object-cover"
        autoPlay
        muted
        playsInline
        preload="auto"
        controls={sound}
        aria-label={t('Reklamefilm for Sosialt', 'Socials ad video')}
      >
        {/* MP4 for Safari og Chrome; WebM for nettlesere uten H.264. Feiler begge, skjules filmen. */}
        <source src={`${base}${src}`} type="video/mp4" />
        <source src={`${base}${src.replace(/\.mp4$/, '.webm')}`} type="video/webm" onError={() => setFailed(true)} />
      </video>
      {!sound && (
        <button
          type="button"
          onClick={withSound}
          className="absolute right-3 bottom-3 left-3 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-black/70 text-base font-semibold text-white backdrop-blur"
        >
          <span aria-hidden="true">🔊</span>
          {t('Trykk for lyd', 'Tap for sound')}
        </button>
      )}
    </div>
  );
}
