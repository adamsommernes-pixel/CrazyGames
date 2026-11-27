import { currentAccent } from '../lib/theme';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { locale } from '../i18n';

// Felles grafstil: svak rutelinje, grønn strek, tekst i dempede tokens.
const AXIS = { stroke: '#66706a', tick: { fontSize: 11 }, tickLine: false, axisLine: false } as const;
const TOOLTIP = {
  contentStyle: { background: '#161b18', border: '1px solid #232a26', borderRadius: 12, color: '#f2f5f3' },
  labelStyle: { color: '#9ba59f' },
  cursor: { fill: 'color-mix(in srgb, var(--color-accent) 10%, transparent)' },
};

export function LineTrend({ data, label, unit }: { data: { x: string; y: number }[]; label: string; unit: string }) {
  return (
    <div className="h-52" role="img" aria-label={`Graf: ${label}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
          <CartesianGrid stroke="#232a26" vertical={false} />
          <XAxis dataKey="x" {...AXIS} minTickGap={16} />
          <YAxis {...AXIS} width={44} domain={['auto', 'auto']} />
          <Tooltip {...TOOLTIP} formatter={(v) => [`${Number(v).toLocaleString(locale(), { maximumFractionDigits: 1 })} ${unit}`, label]} />
          <Line type="monotone" dataKey="y" stroke={currentAccent().accent} strokeWidth={2.5} dot={{ r: 3, fill: '#2bd66b', strokeWidth: 0 }} activeDot={{ r: 5, fill: '#7dffaa' }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BarTrend({ data, label, unit }: { data: { x: string; y: number; current?: boolean }[]; label: string; unit: string }) {
  return (
    <div className="h-44" role="img" aria-label={`Graf: ${label}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
          <CartesianGrid stroke="#232a26" vertical={false} />
          <XAxis dataKey="x" {...AXIS} interval="preserveStartEnd" minTickGap={8} />
          <YAxis {...AXIS} width={44} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toLocaleString(locale(), { maximumFractionDigits: 1 })}k` : String(v))} />
          <Tooltip {...TOOLTIP} formatter={(v) => [`${Number(v).toLocaleString(locale(), { maximumFractionDigits: 0 })} ${unit}`, label]} />
          <Bar dataKey="y" radius={[6, 6, 0, 0]} fill={currentAccent().accent} fillOpacity={0.85} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
