'use client'

import type { LibExercise } from '@/lib/supabase/queries'
import { repsPorSerie, seriesDe, ehPorTempo, estimarForca } from '@/lib/fase-1-forca'
import { Dumbbell, Timer, Repeat } from 'lucide-react'

const VERMELHO = 'var(--marca)'

/** "45s" vira "45s"; "12" vira "12 reps". */
function rotuloSerie(valor: number, porTempo: boolean) {
  return porTempo ? `${valor}s` : `${valor}`
}

function fmtDescanso(s: number) {
  return s >= 60 ? `${Math.round(s / 60)}min` : `${s}s`
}

/**
 * Como fazer um treino de força, exercício por exercício.
 *
 * É o equivalente do passo a passo da corrida. A diferença que importa: a
 * pirâmide "12/12/10/8" precisa aparecer série a série, senão o aluno não sabe
 * que a carga sobe enquanto as repetições caem — que é o ponto do treino.
 */
export function StrengthSteps({ exercises, compact = false }: {
  exercises: LibExercise[]
  compact?: boolean
}) {
  if (!exercises.length) return null
  const est = estimarForca(exercises)
  const totalSeries = exercises.reduce((s, e) => s + seriesDe(e), 0)
  // A pirâmide é a regra do treino, não a exceção: explicada uma vez no topo,
  // e não repetida em cada uma das oito linhas.
  const temPiramide = exercises.some(e => new Set(repsPorSerie(e.reps, seriesDe(e))).size > 1)

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--panel)', border: '1px solid var(--panel-border)' }}>
      {!compact && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3.5 py-2.5 border-b" style={{ borderColor: 'var(--panel-border)' }}>
          <span className="flex items-center gap-1.5 text-[11px] font-bold text-foreground">
            <Dumbbell className="w-3.5 h-3.5" style={{ color: VERMELHO }} />
            {exercises.length} exercícios
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground tabular-nums">
            <Repeat className="w-3.5 h-3.5" />{totalSeries} séries
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground tabular-nums">
            <Timer className="w-3.5 h-3.5" />~{est.min} min
          </span>
          {temPiramide && (
            <span className="text-[11px] text-muted-foreground basis-full">
              Onde as repetições caem (12 · 12 · 10 · 8), a carga sobe a cada série.
            </span>
          )}
        </div>
      )}

      <ol>
        {exercises.map((e, i) => {
          const series = seriesDe(e)
          const porTempo = ehPorTempo(e.reps)
          const valores = repsPorSerie(e.reps, series)
          const descanso = e.rest_s ?? null

          return (
            <li key={i} className="px-3.5 py-2.5 flex gap-3" style={i ? { borderTop: '1px solid var(--panel-border)' } : undefined}>
              <span className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 text-[10px] font-black tabular-nums mt-0.5"
                style={{ background: 'var(--marca-1f)', color: VERMELHO }}>{i + 1}</span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-[13px] font-bold text-foreground">{e.name}</span>
                  {e.muscle && <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{e.muscle}</span>}
                </div>

                {/* Uma caixinha por série: é o que o aluno acompanha na academia. */}
                <div className="flex flex-wrap items-center gap-1 mt-1.5">
                  {valores.map((v, s) => (
                    <span key={s} className="px-1.5 py-0.5 rounded text-[11px] font-bold tabular-nums"
                      style={{ background: 'var(--secondary)', color: 'var(--foreground)' }}
                      title={`Série ${s + 1}`}>
                      {rotuloSerie(v, porTempo)}
                    </span>
                  ))}
                </div>

                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[10px] text-muted-foreground tabular-nums">
                  {/* O número de séries já se lê nas caixinhas acima. */}
                  {descanso != null && <span>{fmtDescanso(descanso)} de intervalo</span>}
                  {e.load && <span>{e.load}</span>}
                  {e.note && <span className="text-muted-foreground/80">{e.note}</span>}
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
