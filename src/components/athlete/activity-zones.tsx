'use client'

import { getPowerZones, getHRZones } from '@/lib/calculations/zones'

interface Props {
  zoneData: { basis: 'power' | 'hr'; seconds: number[]; zoneModel: 'coggan' | 'friel' }
  ftp: number | null
  lthr: number | null
}

function fmtDur(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h${m.toString().padStart(2, '0')}`
  if (m > 0) return `${m}min${sec > 0 ? ` ${sec}s` : ''}`
  return `${sec}s`
}

export function ActivityZones({ zoneData, ftp, lthr }: Props) {
  const { basis, seconds } = zoneData
  // Rótulos das zonas conforme a base; se faltar o limiar, usamos nomes genéricos
  const zones = basis === 'power'
    ? getPowerZones(ftp ?? 250)
    : getHRZones(lthr ?? 160)

  const total = seconds.reduce((a, b) => a + b, 0)
  if (total === 0) return null

  return (
    <div className="rounded-lg px-3 py-2.5" style={{ background: 'var(--panel)', border: '1px solid var(--panel-border)' }}>
      <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        Distribuição de zonas · {basis === 'power' ? 'Potência (Coggan)' : 'FC (Friel)'}
      </p>
      {/* Barra empilhada */}
      <div className="flex h-2.5 rounded-full overflow-hidden mb-2.5" style={{ background: 'var(--secondary)' }}>
        {seconds.map((s, i) => {
          if (s === 0) return null
          return <div key={i} style={{ width: `${(s / total) * 100}%`, background: zones[i]?.color ?? '#666' }} title={`Z${i + 1}: ${fmtDur(s)}`} />
        })}
      </div>
      {/* Legenda por zona */}
      <div className="space-y-1">
        {seconds.map((s, i) => {
          if (s === 0) return null
          const z = zones[i]
          const pct = (s / total) * 100
          return (
            <div key={i} className="flex items-center gap-2 text-[10px]">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: z?.color ?? '#666' }} />
              <span className="font-mono text-muted-foreground w-5">Z{i + 1}</span>
              <span className="text-muted-foreground flex-1 truncate">{z?.name ?? ''}</span>
              <span className="text-foreground font-medium">{fmtDur(s)}</span>
              <span className="text-muted-foreground w-9 text-right">{pct.toFixed(0)}%</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
