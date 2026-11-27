import { useEffect, useRef, useState } from 'react';
import type { Exercise } from '../../../db/types';
import { guideFor } from '../../../db/exercises';
import { exerciseName } from '../../../lib/exerciseName';
import { currentAccent } from '../../../lib/theme';
import { IconButton } from '../../../components/ui';
import { t, useLang } from '../../../i18n';
import { moveFor, type Move } from './moves';
import { DemoScene, hasWebGL } from './scene';

/** Bilde som vises når nettleseren ikke kan tegne 3D. */
function Still({ move, name }: { move: Move; name: string }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}demos/${move.slug}.jpg`}
      alt={t(`Illustrasjon av ${name}`, `Illustration of ${name}`)}
      className="aspect-square w-full rounded-xl border border-line bg-raised object-contain"
    />
  );
}

/** 3D-mannekeng som viser øvelsen i løkke. Dra for å snu, pause og sakte film. */
export default function ExerciseDemo3D({ exercise }: { exercise: Exercise }) {
  useLang();
  const move = moveFor(exercise.id)!;
  const name = exerciseName(exercise);
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<DemoScene | null>(null);
  const [webgl] = useState(hasWebGL);
  const [playing, setPlaying] = useState(true);
  const [slow, setSlow] = useState(false);
  const [view, setView] = useState<Move['view']>(move.view);
  const [cue, setCue] = useState<[string, string] | undefined>(move.keys[0].cue);

  useEffect(() => {
    if (!webgl || !canvas.current || !wrap.current) return;
    const guide = guideFor(exercise.id);
    let scene: DemoScene;
    try {
      scene = new DemoScene(canvas.current, move, { accent: currentAccent().accent, primary: exercise.muscle_group, secondary: guide?.secondary ?? [] });
    } catch {
      return;
    }
    sceneRef.current = scene;
    scene.onCue = setCue;
    scene.onAutoPause = () => setPlaying(false);
    const el = wrap.current;
    const ro = new ResizeObserver(([e]) => scene.resize(e.contentRect.width, e.contentRect.height));
    ro.observe(el);
    const io = new IntersectionObserver(([e]) => scene.setVisible(e.isIntersecting && !document.hidden));
    io.observe(el);
    const onVis = () => scene.setVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVis);
    scene.start();
    return () => {
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      scene.dispose();
      sceneRef.current = null;
    };
  }, [webgl, move, exercise.id, exercise.muscle_group]);

  if (!webgl) return <Still move={move} name={name} />;

  const toggle = () => {
    const s = sceneRef.current;
    if (!s) return;
    if (playing) s.pause();
    else s.play();
    setPlaying(!playing);
  };
  const toggleSlow = () => {
    const next = !slow;
    setSlow(next);
    if (sceneRef.current) sceneRef.current.speed = next ? 0.5 : 1;
  };
  const nextView: Move['view'] = view === 'front' ? (move.view === 'front' ? 'side' : move.view) : 'front';
  const changeView = () => {
    sceneRef.current?.setView(nextView);
    setView(nextView);
  };

  return (
    <figure className="overflow-hidden rounded-xl border border-line bg-raised" data-demo3d={move.slug}>
      <div ref={wrap} className="relative aspect-square w-full" onDoubleClick={() => sceneRef.current?.setView(view)}>
        <canvas
          ref={canvas}
          className="absolute inset-0 h-full w-full cursor-grab touch-none active:cursor-grabbing"
          role="img"
          aria-label={t(`3D-demonstrasjon av ${name}. Dra for å snu figuren.`, `3D demonstration of ${name}. Drag to turn the figure.`)}
        />
        {cue && (
          <p className="pointer-events-none absolute inset-x-3 bottom-3 rounded-lg bg-bg/80 px-3 py-2 text-sm font-medium" aria-live="off">
            {t(cue[0], cue[1])}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1 border-t border-line px-1.5 py-1">
        <IconButton icon={playing ? 'pause' : 'play'} label={playing ? t('Pause', 'Pause') : t('Spill av', 'Play')} onClick={toggle} />
        <button
          type="button"
          aria-pressed={slow}
          onClick={toggleSlow}
          className={`min-h-11 rounded-lg px-3 text-sm font-semibold ${slow ? 'text-accent-strong' : 'text-muted'}`}
        >
          {t('0,5×', '0.5×')}
        </button>
        <button type="button" onClick={changeView} className="min-h-11 rounded-lg px-3 text-sm font-semibold text-muted">
          {nextView === 'front' ? t('Forfra', 'Front') : t('Fra siden', 'Side')}
        </button>
        <figcaption className="ml-auto pr-2 text-xs text-faint">{t('Dra for å snu', 'Drag to turn')}</figcaption>
      </div>
    </figure>
  );
}
