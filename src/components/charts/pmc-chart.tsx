'use client'

import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export interface PMCPoint {
  date: string
  ctl: number
  atl: number
  tsb: number
  tss?: number
}

interface PMCChartProps {
  data: PMCPoint[]
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { color: string; name: string; value: number }[]; label?: string }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card border border-border rounded-lg p-3 text-xs shadow-xl">
      <p className="text-muted-foreground mb-2 font-medium">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-bold text-foreground">{p.value?.toFixed(1)}</span>
        </div>
      ))}
    </div>
  )
}

export function PMCChart({ data }: PMCChartProps) {
  const formatted = data.map((d) => ({
    ...d,
    label: format(new Date(d.date), 'dd/MM', { locale: ptBR }),
  }))

  return (
    <ResponsiveContainer width="100%" height={240}>
      <ComposedChart data={formatted} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="label" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} tickLine={false} axisLine={false} />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
          formatter={(v) => <span style={{ color: 'var(--muted-foreground)' }}>{v}</span>}
        />
        <ReferenceLine y={0} stroke="var(--border)" />
        {/* TSS bars */}
        <Bar dataKey="tss" name="TSS" fill="#1a1a24" radius={[2, 2, 0, 0]} yAxisId={0} />
        <Line type="monotone" dataKey="ctl" name="CTL/Fitness" stroke="#0088ff" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="atl" name="ATL/Fadiga" stroke="#e8001c" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="tsb" name="TSB/Forma" stroke="#00d084" strokeWidth={2} dot={false} strokeDasharray="4 2" />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
