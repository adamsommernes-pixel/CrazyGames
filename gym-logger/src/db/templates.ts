// Startrutiner. [øvelses-id, tilbehør?] — tilbehørsøvelser får flere reps og kortere hvile.
type Item = [string, boolean];
interface Template {
  name: string;
  exercises: Item[];
}

export const TEMPLATES: Record<'fullbody' | 'upperlower' | 'ppl', Template[]> = {
  fullbody: [
    {
      name: 'Fullkropp A',
      exercises: [['ex-kneboy', false], ['ex-benkpress', false], ['ex-stangroing', false], ['ex-sidehev', true], ['ex-planke', true]],
    },
    {
      name: 'Fullkropp B',
      exercises: [['ex-markloft', false], ['ex-militaerpress', false], ['ex-nedtrekk', false], ['ex-utfall', true], ['ex-bicepscurl-med-manualer', true]],
    },
  ],
  upperlower: [
    {
      name: 'Overkropp',
      exercises: [['ex-benkpress', false], ['ex-stangroing', false], ['ex-skulderpress-med-manualer', false], ['ex-nedtrekk', false], ['ex-triceps-pushdown', true], ['ex-hammercurl', true]],
    },
    {
      name: 'Underkropp',
      exercises: [['ex-kneboy', false], ['ex-rumensk-markloft', false], ['ex-beinpress', false], ['ex-larcurl', true], ['ex-tahev-staende', true]],
    },
  ],
  ppl: [
    {
      name: 'Push',
      exercises: [['ex-benkpress', false], ['ex-militaerpress', false], ['ex-skrabenk-med-manualer', false], ['ex-sidehev', true], ['ex-triceps-pushdown', true]],
    },
    {
      name: 'Pull',
      exercises: [['ex-markloft', false], ['ex-pull-ups', false], ['ex-sittende-roing', false], ['ex-face-pulls', true], ['ex-bicepscurl-med-stang', true]],
    },
    {
      name: 'Bein',
      exercises: [['ex-kneboy', false], ['ex-rumensk-markloft', false], ['ex-beinpress', false], ['ex-larcurl', true], ['ex-tahev-staende', true]],
    },
  ],
};

export function pickTemplate(perWeek: number): keyof typeof TEMPLATES {
  if (perWeek <= 3) return 'fullbody';
  if (perWeek === 4) return 'upperlower';
  return 'ppl';
}
