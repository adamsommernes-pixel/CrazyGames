// ?slug=kneboy&phase=0.5&view=side&accent=%2334c56a
import { DemoScene } from '../../src/features/exercise/demo3d/scene';
import { moveFor } from '../../src/features/exercise/demo3d/moves';
import { guideFor, BUILTIN_EXERCISES } from '../../src/db/exercises';

const q = new URLSearchParams(location.search);
const slug = q.get('slug') ?? 'kneboy';
const ex = BUILTIN_EXERCISES.find((e) => e.id === `ex-${slug}`)!;
const move = moveFor(ex.id)!;
const canvas = document.getElementById('c') as HTMLCanvasElement;
const scene = new DemoScene(canvas, move, { accent: q.get('accent') ?? '#34c56a', primary: ex.muscle_group, secondary: guideFor(ex.id)?.secondary ?? [] });
scene.resize(innerWidth, innerHeight);
scene.pause();
if (q.get('view')) scene.setView(q.get('view') as 'side');
scene.setPhase(Number(q.get('phase') ?? move.still));
scene.start();
requestAnimationFrame(() => requestAnimationFrame(() => document.body.setAttribute('data-ready', '1')));
