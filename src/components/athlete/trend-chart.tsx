'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceArea, CartesianGrid } from 'recharts'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export interface TrendPoint {
  date: string   // ISO yyyy-mm-dd
  value: number
}

interface Props {
  points: TrendPoint[]
  color?: string
  unit?: string
  refMin?: number | null
  refMax?: number | null
  height?: number
}

/** Mini gráfico de linha com faixa de referência opcional (verde). */
export function TrendChart({ points, color = '#0088ff', unit = '', refMin, refMax, height = 130 }: Props) {
  if (points.length < 2) return null

  const data = [...points]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(p => ({ ...p, label: format(new Date(p.date + 'T12:00:00'), 'dd/MM/yy', { locale: ptBR }) }))

  const values = data.map(d => d.value)
  const lo = Math.min(...values, refMin ?? Infinity)
  const hi = Math.max(...values, refMax ?? -Infinity)
  const pad = (hi - lo) * 0.15 || 1

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        {refMin != null && refMax != null && (
          <ReferenceArea y1={refMin} y2={refMax} fill="#00d084" fillOpacity={0.08} />
        )}
        <XAxis dataKey="label" tick={{ fill: 'var(--muted-foreground)', fontSize: 9 }} tickLine={false} axisLine={false} />
        <YAxis domain={[lo - pad, hi + pad]} tick={{ fill: 'var(--muted-foreground)', fontSize: 9 }} tickLine={false} axisLine={false} width={38} />
        <Tooltip
          contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }}
          labelStyle={{ color: 'var(--muted-foreground)' }}
          formatter={(v) => [`${v} ${unit}`.trim(), '']}
        />
        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={{ r: 2.5, fill: color }} activeDot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}
