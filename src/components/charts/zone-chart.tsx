'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface ZoneData {
  zone: string
  percent: number
  color: string
  name: string
}

interface ZoneChartProps {
  zones: ZoneData[]
  title?: string
}

export function ZoneChart({ zones }: ZoneChartProps) {
  return (
    <div className="space-y-2">
      {zones.map((z) => (
        <div key={z.zone} className="flex items-center gap-3">
          <span className="text-[10px] text-muted-foreground w-8 font-mono">{z.zone}</span>
          <div className="flex-1 bg-secondary rounded-full h-2 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${z.percent}%`, background: z.color }}
            />
          </div>
          <span className="text-[11px] font-semibold text-foreground w-10 text-right">{z.percent}%</span>
          <span className="text-[10px] text-muted-foreground w-24 truncate">{z.name}</span>
        </div>
      ))}
    </div>
  )
}
