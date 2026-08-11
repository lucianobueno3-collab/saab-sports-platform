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
 * Quanto tempo o treino passa em cada zona, numa linha só de etiquetas.
 *
 * Responde "esse treino é leve ou puxado?", que a duração sozinha não responde:
 * 60 min em Z2 e 60 min com 20 min em Z4 são treinos completamente diferentes.
 * A barra de sequência do treino já fica logo acima, então aqui basta o total
 * de cada zona — uma tabela inteira só repetiria a mesma informação.
 */
export function ZoneTime({ structure }: { structure: WorkoutStructure }) {
  const totais = zoneTotals(structure)
  if (totais.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
      <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Tempo por zona</span>
      {totais.map(t => {
        const z = ZONES[t.zone]
        return (
          <span key={t.zone} className="inline-flex items-center gap-1 text-[11px] tabular-nums">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: z.color }} />
            <b className="text-foreground">{z.label}</b>
            <span className="text-muted-foreground">{fmtMin(t.min)}</span>
          </span>
        )
      })}
    </div>
  )
}
