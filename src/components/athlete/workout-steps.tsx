'use client'

import {
  type WorkoutStructure, type Step, ZONES, KIND_LABEL,
  flattenSteps, estimateStructure, dominantZone,
} from '@/lib/workout-structure'
import {
  buildWorkoutTCX, downloadFile, slugify, paceRange, hrRange,
  estimateKm, estimateTotalKm, fmtKm, type Thresholds,
} from '@/lib/workout-export'
import { StructureBar } from '@/components/athlete/structured-builder'
import { ZoneTime, ZONE_FEEL, ZONE_PURPOSE } from '@/components/athlete/zone-time'
import { Watch, Download, Clock, Flame, Route, Target } from 'lucide-react'

function fmtMin(min: number) {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60), m = min % 60
  return m ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h`
}

/** Um número em destaque com rótulo — usado no cabeçalho do treino. */
function Stat({ icon: Icon, value, label }: { icon: typeof Clock; value: string; label: string }) {
  return (
    <div className="flex-1 min-w-0 text-center">
      <Icon className="w-3.5 h-3.5 mx-auto text-muted-foreground mb-1" />
      <p className="text-sm font-black text-foreground tabular-nums leading-none">{value}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{label}</p>
    </div>
  )
}

function StepLine({ step, sport, th, index }: { step: Step; sport: string; th?: Thresholds; index?: number }) {
  const z = ZONES[step.zone]
  const pace = paceRange(step.zone, sport, th)
  const hr = hrRange(step.zone, th)
  const km = estimateKm(step.min, step.zone, sport, th)

  return (
    <div className="flex items-start gap-2.5">
      <span className="w-1 self-stretch rounded-full shrink-0 min-h-[2.5rem]" style={{ background: z.color }} />
      <div className="flex-1 min-w-0 py-0.5">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <p className="text-xs font-black text-foreground">
            {index != null ? `${index}. ` : ''}{KIND_LABEL[step.kind]}
          </p>
          <span className="text-[10px] font-black px-1.5 py-px rounded" style={{ background: z.color + '22', color: z.color }}>
            {z.label}
          </span>
        </div>

        {/* Quanto tempo, quanto dá de distância */}
        <p className="text-[11px] font-bold text-foreground mt-0.5 tabular-nums">
          {fmtMin(step.min)}{km ? <span className="text-muted-foreground font-normal"> · ~{fmtKm(km)}</span> : null}
        </p>

        {/* Alvos: ritmo E batimento, quando os dois são conhecidos */}
        {(pace || hr) && (
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
            {pace && <span className="text-[11px] text-muted-foreground tabular-nums">Ritmo <b className="text-foreground">{pace}</b></span>}
            {hr && <span className="text-[11px] text-muted-foreground tabular-nums">FC <b className="text-foreground">{hr}</b></span>}
          </div>
        )}

        <p className="text-[10px] text-muted-foreground/80 italic mt-0.5">{ZONE_FEEL[step.zone]}</p>
        {step.note && <p className="text-[10px] text-muted-foreground mt-0.5">{step.note}</p>}
      </div>
    </div>
  )
}

/** Visão "Passos" estilo TrainingPeaks + botão de exportar para o relógio (.TCX). */
export function WorkoutSteps({ title, sport, structure, thresholds, compact, plannedTss }: {
  title: string; sport: string; structure: WorkoutStructure; thresholds?: Thresholds; compact?: boolean
  /** Carga que o treinador gravou. Tem prioridade sobre a estimativa, senão o
   *  aluno veria um TSS no card do treino e outro aqui embaixo. */
  plannedTss?: number | null
}) {
  if (!structure || structure.length === 0) return null

  const passos = flattenSteps(structure)
  const { min, tss: tssEstimado } = estimateStructure(structure)
  const tss = plannedTss ?? tssEstimado
  const km = estimateTotalKm(passos, sport, thresholds)
  const principal = dominantZone(structure)

  function exportTcx() {
    downloadFile(`${slugify(title)}.tcx`, buildWorkoutTCX(title, sport, structure))
  }

  let n = 0
  return (
    <div className="space-y-3">
      {/* Números do treino inteiro, antes de sair de casa */}
      <div className="flex items-start gap-1 rounded-xl px-2 py-2.5" style={{ background: 'var(--panel)', border: '1px solid var(--panel-border)' }}>
        <Stat icon={Clock} value={fmtMin(min)} label="duração" />
        {km != null && <Stat icon={Route} value={fmtKm(km)} label="distância" />}
        <Stat icon={Flame} value={String(tss)} label="carga (TSS)" />
        {principal && <Stat icon={Target} value={ZONES[principal].label} label={ZONES[principal].name} />}
      </div>

      {/* Para que serve este treino */}
      {principal && (
        <p className="text-[11px] text-muted-foreground leading-relaxed px-0.5">
          <b className="text-foreground">Objetivo:</b> {ZONE_PURPOSE[principal]}.
        </p>
      )}

      {!compact && <StructureBar structure={structure} height={12} />}

      <ZoneTime structure={structure} />

      <div className="space-y-2.5">
        {structure.map((seg, i) => {
          if (seg.type === 'step') { n++; return <StepLine key={i} step={seg.step} sport={sport} th={thresholds} index={n} /> }
          const rid = ++n
          const porVolta = seg.steps.reduce((s, p) => s + p.min, 0)
          return (
            <div key={i} className="rounded-lg p-2.5" style={{ background: 'var(--panel)', border: '1px solid var(--panel-border)' }}>
              <p className="text-[11px] font-black text-primary mb-2">
                {rid}. Repita {seg.times}x
                <span className="text-muted-foreground font-normal"> · {fmtMin(porVolta)} por volta · {fmtMin(porVolta * seg.times)} no total</span>
              </p>
              <div className="pl-3 space-y-2 border-l-2 border-border">
                {seg.steps.map((s, j) => <StepLine key={j} step={s} sport={sport} th={thresholds} />)}
              </div>
            </div>
          )
        })}
      </div>

      {!thresholds?.thresholdPaceSecKm && !thresholds?.lthr && (
        <p className="text-[10px] text-muted-foreground/80 leading-relaxed">
          Peça ao seu treinador para cadastrar seu ritmo de limiar e sua FC de limiar — aí cada trecho
          passa a mostrar o ritmo e o batimento certos para você, em vez de só a zona.
        </p>
      )}

      <button type="button" onClick={exportTcx}
        className="w-full py-2.5 rounded-lg border border-border text-sm font-semibold text-foreground hover:bg-secondary flex items-center justify-center gap-2">
        <Watch className="w-4 h-4" /> Baixar treino p/ relógio (.TCX) <Download className="w-3.5 h-3.5 text-muted-foreground" />
      </button>
    </div>
  )
}
