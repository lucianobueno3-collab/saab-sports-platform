'use client'

import { ZONES, zoneTotals, type WorkoutStructure } from '@/lib/workout-structure'

/** Como cada zona SE SENTE — a tradução que falta na maioria dos apps. */
export const ZONE_FEEL: Record<number, string> = {
  1: 'bem leve, quase caminhando',
  2: 'dá pra conversar correndo',
  3: 'frases curtas, já incomoda',
  4: 'forte, só palavras soltas',
  5: 'máximo, sem conversa',
}

/** O que cada zona treina, em uma linha. */
export const ZONE_PURPOSE: Record<number, string> = {
  1: 'solta as pernas e ajuda a recuperar',
  2: 'constrói a base — é onde a resistência cresce',
  3: 'ensina a segurar um ritmo firme por mais tempo',
  4: 'empurra o limiar: você aguenta forte por mais tempo',
  5: 'melhora o motor e a velocidade máxima',
}

function fmtMin(min: number) {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60), m = min % 60
  return m ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h`
}

/**
 * Quanto tempo o treino passa em cada zona — barra proporcional + legenda.
 *
 * É a resposta para "esse treino é leve ou puxado?", que a duração total
 * sozinha não dá: 60 min em Z2 e 60 min com 20 min em Z4 são treinos
 * completamente diferentes.
 */
export function ZoneTime({ structure }: { structure: WorkoutStructure }) {
  const totais = zoneTotals(structure)
  if (totais.length === 0) return null

  return (
    <div className="rounded-xl p-3" style={{ background: 'var(--panel)', border: '1px solid var(--panel-border)' }}>
      <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-2">Tempo em cada zona</p>

      <div className="flex h-2.5 rounded-full overflow-hidden gap-px" role="img"
        aria-label={totais.map(t => `${ZONES[t.zone].label} ${t.min} minutos`).join(', ')}>
        {totais.map(t => (
          <div key={t.zone} style={{ width: `${t.pct}%`, background: ZONES[t.zone].color }} />
        ))}
      </div>

      <div className="mt-2.5 space-y-1.5">
        {totais.map(t => {
          const z = ZONES[t.zone]
          return (
            <div key={t.zone} className="flex items-baseline gap-2">
              <span className="w-2 h-2 rounded-full shrink-0 translate-y-px" style={{ background: z.color }} />
              <span className="text-[11px] font-black text-foreground shrink-0">{z.label}</span>
              <span className="text-[11px] text-muted-foreground shrink-0">{z.name}</span>
              <span className="flex-1 border-b border-dashed border-border/60 translate-y-[-2px]" />
              <span className="text-[11px] font-bold text-foreground tabular-nums shrink-0">{fmtMin(t.min)}</span>
              <span className="text-[10px] text-muted-foreground tabular-nums w-9 text-right shrink-0">{t.pct}%</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
