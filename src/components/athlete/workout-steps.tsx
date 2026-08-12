'use client'

import { useState } from 'react'
import {
  type WorkoutStructure, type Step, ZONES, KIND_LABEL,
  flattenSteps, estimateStructure, dominantZone,
} from '@/lib/workout-structure'
import {
  buildWorkoutTCX, downloadFile, slugify, paceRange, pacePctRange, hrRange,
  estimateKm, estimateTotalKm, fmtKm, type Thresholds,
} from '@/lib/workout-export'
import { StructureBar } from '@/components/athlete/structured-builder'
import { ZoneTime, ZONE_FEEL, ZONE_PURPOSE } from '@/components/athlete/zone-time'
import { textoDeCarga } from '@/lib/carga'
import { GlossarioAluno } from '@/components/athlete/carga-chip'
import { Watch, Download } from 'lucide-react'

function fmtMin(min: number) {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60), m = min % 60
  return m ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h`
}

/**
 * Um trecho do treino em duas linhas: o que fazer e por quanto, depois o alvo.
 *
 * Antes eram cinco linhas por trecho — tipo, zona, %, tempo, distância, ritmo,
 * FC e sensação, cada uma na sua. Num treino de 3 blocos isso virava uma
 * parede de texto que ninguém lê no meio da rua.
 */
function StepLine({ step, sport, th, index }: { step: Step; sport: string; th?: Thresholds; index?: number }) {
  const z = ZONES[step.zone]
  const parado = step.pacePct?.[1] === 0
  // Com % prescrita, o ritmo sai dela; sem, cai na faixa larga da zona.
  const pace = step.pacePct ? pacePctRange(step.pacePct, sport, th) : paceRange(step.zone, sport, th)
  const hr = parado ? null : hrRange(step.zone, th)
  const km = step.km ?? estimateKm(step.min, step.zone, sport, th, step.pacePct)
  const alvo = step.pacePct && !parado ? `${step.pacePct[0]}–${step.pacePct[1]}%` : z.label

  // Quanto: distância quando prescrita assim, senão tempo.
  const quanto = step.km ? fmtKm(step.km) : fmtMin(step.min)
  const complemento = step.km ? `~${fmtMin(step.min)}` : km ? `~${fmtKm(km)}` : null
  const alvos = [pace, hr, complemento].filter(Boolean).join(' · ')

  return (
    <div className="flex items-start gap-2.5">
      <span className="w-1 self-stretch rounded-full shrink-0" style={{ background: z.color }} />
      <div className="flex-1 min-w-0 py-0.5">
        <div className="flex items-baseline gap-2">
          <p className="text-[13px] font-black text-foreground truncate">
            {index != null ? `${index}. ` : ''}{KIND_LABEL[step.kind]}
          </p>
          <span className="text-[10px] font-black px-1.5 py-px rounded shrink-0" style={{ background: z.color + '22', color: z.color }}>
            {alvo}
          </span>
          <span className="flex-1" />
          <span className="text-[13px] font-black text-foreground tabular-nums shrink-0">{quanto}</span>
        </div>

        {/* Tudo que é alvo numa linha só, separado por ponto. Sem alvo nenhum
            (trecho parado, atleta sem limiar) cai na sensação da zona — mas só
            quando o treino não traz uma nota, que já diz a mesma coisa. */}
        {alvos ? <p className="text-[11px] text-muted-foreground tabular-nums mt-0.5">{alvos}</p>
          : !step.note ? <p className="text-[11px] text-muted-foreground/80 italic mt-0.5">{ZONE_FEEL[step.zone]}</p>
          : null}

        {step.note && <p className="text-[10px] text-muted-foreground/70 italic mt-0.5">{step.note}</p>}
      </div>
    </div>
  )
}

/** Visão "Passos" estilo TrainingPeaks + botão de exportar para o relógio (.TCX). */
export function WorkoutSteps({ title, sport, structure, thresholds, compact, plannedTss, tecnico = false }: {
  title: string; sport: string; structure: WorkoutStructure; thresholds?: Thresholds; compact?: boolean
  /** Carga que o treinador gravou. Tem prioridade sobre a estimativa, senão o
   *  aluno veria um TSS no card do treino e outro aqui embaixo. */
  plannedTss?: number | null
  /** Nas telas do treinador, mostra "47 TSS"; nas do aluno, "carga moderada". */
  tecnico?: boolean
}) {
  // O hook vem antes do retorno vazio: a ordem dos hooks não pode variar.
  const [glossario, setGlossario] = useState(false)
  if (!structure || structure.length === 0) return null

  const passos = flattenSteps(structure)
  const { min, tss: tssEstimado } = estimateStructure(structure)
  const tss = plannedTss ?? tssEstimado
  const km = estimateTotalKm(passos, sport, thresholds)
  const principal = dominantZone(structure)

  function exportTcx() {
    downloadFile(`${slugify(title)}.tcx`, buildWorkoutTCX(title, sport, structure))
  }

  // Os números do treino inteiro, numa linha só. Para o aluno, a carga sai em
  // palavras: "47 TSS" não diz nada para quem está começando.
  const carga = tecnico ? `${tss} TSS` : textoDeCarga(tss)?.toLowerCase() ?? null
  const resumo = [fmtMin(min), km != null ? fmtKm(km) : null, carga].filter(Boolean).join(' · ')

  let n = 0
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-black text-foreground tabular-nums">{resumo}</p>
        {principal && (
          <span className="text-[10px] font-black px-2 py-0.5 rounded shrink-0"
            style={{ background: ZONES[principal].color + '22', color: ZONES[principal].color }}>
            {ZONES[principal].name}
          </span>
        )}
      </div>

      {!compact && <StructureBar structure={structure} height={10} />}

      <ZoneTime structure={structure} tecnico={tecnico} />

      <div className="space-y-3">
        {structure.map((seg, i) => {
          if (seg.type === 'step') { n++; return <StepLine key={i} step={seg.step} sport={sport} th={thresholds} index={n} /> }
          const rid = ++n
          const porVolta = seg.steps.reduce((s, p) => s + p.min, 0)
          return (
            <div key={i} className="rounded-lg p-2.5" style={{ background: 'var(--panel)', border: '1px solid var(--panel-border)' }}>
              <div className="flex items-baseline justify-between gap-2 mb-2">
                <p className="text-[13px] font-black text-primary">{rid}. Repita {seg.times}x</p>
                <p className="text-[11px] text-muted-foreground tabular-nums shrink-0">{fmtMin(porVolta * seg.times)}</p>
              </div>
              <div className="pl-2.5 space-y-2.5 border-l-2 border-border">
                {seg.steps.map((s, j) => <StepLine key={j} step={s} sport={sport} th={thresholds} />)}
              </div>
            </div>
          )
        })}
      </div>

      {principal && (
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          <b className="text-foreground">Para que serve:</b> {ZONE_PURPOSE[principal]}.
        </p>
      )}

      {!thresholds?.thresholdPaceSecKm && !thresholds?.lthr && (
        <p className="text-[10px] text-muted-foreground/80 leading-relaxed">
          Peça ao seu treinador para cadastrar seu ritmo de limiar e sua FC de limiar — aí cada trecho
          passa a mostrar o ritmo e o batimento certos para você, em vez de só a zona.
        </p>
      )}

      {!tecnico && (
        <button type="button" onClick={() => setGlossario(true)}
          className="w-full text-[11px] font-semibold text-muted-foreground hover:text-foreground underline underline-offset-2">
          O que significam esses números?
        </button>
      )}
      {glossario && <GlossarioAluno tss={tss} onClose={() => setGlossario(false)} />}

      <button type="button" onClick={exportTcx}
        className="w-full py-2.5 rounded-lg border border-border text-[13px] font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary flex items-center justify-center gap-2">
        <Watch className="w-4 h-4" /> Baixar para o relógio (.TCX) <Download className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
