'use client'

import { type WorkoutStructure, type Step, ZONES, KIND_LABEL } from '@/lib/workout-structure'
import { buildWorkoutTCX, downloadFile, slugify, stepTargetLabel, type Thresholds } from '@/lib/workout-export'
import { StructureBar } from '@/components/athlete/structured-builder'
import { Watch, Download } from 'lucide-react'

function StepLine({ step, sport, th, index }: { step: Step; sport: string; th?: Thresholds; index?: number }) {
  const z = ZONES[step.zone]
  return (
    <div className="flex items-start gap-2">
      <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: z.color }} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-foreground">{index != null ? `${index}. ` : ''}{KIND_LABEL[step.kind]}</p>
        <p className="text-[11px] text-muted-foreground">{step.min} min · {stepTargetLabel(step.zone, sport, th)}</p>
      </div>
    </div>
  )
}

/** Visão "Passos" estilo TrainingPeaks + botão de exportar para o relógio (.TCX). */
export function WorkoutSteps({ title, sport, structure, thresholds, compact }: {
  title: string; sport: string; structure: WorkoutStructure; thresholds?: Thresholds; compact?: boolean
}) {
  if (!structure || structure.length === 0) return null

  function exportTcx() {
    downloadFile(`${slugify(title)}.tcx`, buildWorkoutTCX(title, sport, structure))
  }

  let n = 0
  return (
    <div className="space-y-3">
      {!compact && <StructureBar structure={structure} height={12} />}
      <div className="space-y-2">
        {structure.map((seg, i) => {
          if (seg.type === 'step') { n++; return <StepLine key={i} step={seg.step} sport={sport} th={thresholds} index={n} /> }
          const rid = ++n
          return (
            <div key={i} className="rounded-lg p-2" style={{ background: 'var(--panel)', border: '1px solid var(--panel-border)' }}>
              <p className="text-[11px] font-black text-primary mb-1.5">{rid}. Repita {seg.times}x</p>
              <div className="pl-3 space-y-1.5 border-l-2 border-border">
                {seg.steps.map((s, j) => <StepLine key={j} step={s} sport={sport} th={thresholds} />)}
              </div>
            </div>
          )
        })}
      </div>
      <button type="button" onClick={exportTcx}
        className="w-full py-2.5 rounded-lg border border-border text-sm font-semibold text-foreground hover:bg-secondary flex items-center justify-center gap-2">
        <Watch className="w-4 h-4" /> Baixar treino p/ relógio (.TCX) <Download className="w-3.5 h-3.5 text-muted-foreground" />
      </button>
    </div>
  )
}
