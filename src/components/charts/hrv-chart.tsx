'use client'

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface HRVPoint {
  date: string
  hrv: number
  recovery?: number
}

interface HRVChartProps {
  data: HRVPoint[]
  baseline?: number
}

export function HRVChart({ data, baseline }: HRVChartProps) {
  const formatted = data.map((d) => ({
    ...d,
    label: format(new Date(d.date), 'dd/MM', { locale: ptBR }),
  }))

  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart data={formatted} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="hrvGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#00d084" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#00d084" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="label" tick={{ fill: '#888899', fontSize: 10 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fill: '#888899', fontSize: 10 }} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }}
          labelStyle={{ color: '#888899' }}
          itemStyle={{ color: '#00d084' }}
        />
        {baseline && <ReferenceLine y={baseline} stroke="#ffa800" strokeDasharray="4 2" label={{ value: 'Baseline', fill: '#ffa800', fontSize: 10 }} />}
        <Area type="monotone" dataKey="hrv" name="HRV (ms)" stroke="#00d084" strokeWidth={2} fill="url(#hrvGrad)" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
