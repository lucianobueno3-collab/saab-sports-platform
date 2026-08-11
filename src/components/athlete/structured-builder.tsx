'use client'

import {
  type WorkoutStructure, type Segment, type Step, type StepKind, type Zone,
  ZONES, KIND_LABEL, estimateStructure, flattenSteps,
} from '@/lib/workout-structure'
import { Plus, Repeat, X, Clock, Flame } from 'lucide-react'

const KINDS: StepKind[] = ['warmup', 'work', 'recovery', 'steady', 'cooldown']
const ZONE_LIST: Zone[] = [1, 2, 3, 4, 5]

/** Gráfico de blocos coloridos por zona (largura ∝ duração). */
export function StructureBar({ structure, height = 10 }: { structure: WorkoutStructure; height?: number }) {
  const steps = flattenSteps(structure)
  const total = steps.reduce((s, x) => s + Math.max(0.2, x.min || 0), 0) || 1
  if (steps.length === 0) return null
  return (
    <div className="flex w-full rounded overflow-hidden gap-px" style={{ height }}>
      {steps.map((s, i) => (
        <div key={i} title={`${KIND_LABEL[s.kind]} · ${s.min}min · ${ZONES[s.zone].label}`}
          style={{ width: `${(Math.max(0.2, s.min) / total) * 100}%`, background: ZONES[s.zone].color }} />
      ))}
    </div>
  )
}

function ZoneChips({ zone, onChange }: { zone: Zone; onChange: (z: Zone) => void }) {
  return (
    <div className="flex gap-0.5">
      {ZONE_LIST.map(z => (
        <button key={z} type="button" onClick={() => onChange(z)} title={ZONES[z].name}
          className="w-6 h-6 rounded text-[10px] font-black transition-all"
          style={zone === z
            ? { background: ZONES[z].color, color: '#fff', outline: `2px solid ${ZONES[z].color}66` }
            : { background: ZONES[z].color + '22', color: ZONES[z].color }}>
          {z}
        </button>
      ))}
    </div>
  )
}

function StepRow({ step, onChange, onRemove }: { step: Step; onChange: (s: Step) => void; onRemove?: () => void }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <select value={step.kind} onChange={e => onChange({ ...step, kind: e.target.value as StepKind })}
        className="text-[11px] font-semibold bg-background border border-border rounded px-1.5 py-1 text-foreground focus:outline-none">
        {KINDS.map(k => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
      </select>
      <div className="flex items-center gap-1">
        <input type="number" min={1} value={step.min} onChange={e => onChange({ ...step, min: parseInt(e.target.value) || 0 })}
          className="w-14 text-sm text-center bg-background border border-border rounded px-1 py-1 text-foreground focus:outline-none focus:border-primary" />
        <span className="text-[11px] text-muted-foreground">min</span>
      </div>
      <ZoneChips zone={step.zone} onChange={z => onChange({ ...step, zone: z })} />
      {onRemove && <button type="button" onClick={onRemove} className="p-1 text-muted-foreground hover:text-red-400"><X className="w-3.5 h-3.5" /></button>}
    </div>
  )
}

export function StructuredBuilder({ value, onChange }: { value: WorkoutStructure; onChange: (s: WorkoutStructure) => void }) {
  const est = estimateStructure(value)

  const addStep = () => onChange([...value, { type: 'step', step: { kind: 'steady', min: 10, zone: 2 } }])
  const addRepeat = () => onChange([...value, { type: 'repeat', times: 4, steps: [{ kind: 'work', min: 3, zone: 4 }, { kind: 'recovery', min: 2, zone: 1 }] }])
  const removeSeg = (i: number) => onChange(value.filter((_, j) => j !== i))
  const patchSeg = (i: number, seg: Segment) => onChange(value.map((s, j) => j === i ? seg : s))

  return (
    <div className="space-y-3">
      {value.length > 0 && <StructureBar structure={value} height={14} />}

      <div className="space-y-2">
        {value.map((seg, i) => (
          <div key={i} className="rounded-lg p-2.5" style={{ background: 'var(--panel)', border: '1px solid var(--panel-border)' }}>
            {seg.type === 'step' ? (
              <StepRow step={seg.step} onChange={s => patchSeg(i, { type: 'step', step: s })} onRemove={() => removeSeg(i)} />
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Repeat className="w-3.5 h-3.5 text-primary" />
                  <input type="number" min={1} value={seg.times} onChange={e => patchSeg(i, { ...seg, times: parseInt(e.target.value) || 1 })}
                    className="w-12 text-sm text-center font-bold bg-background border border-border rounded px-1 py-1 text-foreground focus:outline-none focus:border-primary" />
                  <span className="text-xs font-bold text-foreground">séries</span>
                  <button type="button" onClick={() => removeSeg(i)} className="ml-auto p-1 text-muted-foreground hover:text-red-400"><X className="w-3.5 h-3.5" /></button>
                </div>
                <div className="pl-4 space-y-1.5 border-l-2 border-border">
                  {seg.steps.map((s, j) => (
                    <StepRow key={j} step={s}
                      onChange={ns => patchSeg(i, { ...seg, steps: seg.steps.map((x, k) => k === j ? ns : x) })}
                      onRemove={seg.steps.length > 1 ? () => patchSeg(i, { ...seg, steps: seg.steps.filter((_, k) => k !== j) }) : undefined} />
                  ))}
                  <button type="button" onClick={() => patchSeg(i, { ...seg, steps: [...seg.steps, { kind: 'work', min: 1, zone: 3 }] })}
                    className="text-[11px] font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1"><Plus className="w-3 h-3" /> passo na série</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={addStep} className="flex-1 py-2 text-[11px] font-bold rounded-lg border border-dashed border-border text-muted-foreground hover:bg-secondary flex items-center justify-center gap-1"><Plus className="w-3.5 h-3.5" /> Passo</button>
        <button type="button" onClick={addRepeat} className="flex-1 py-2 text-[11px] font-bold rounded-lg border border-dashed border-border text-muted-foreground hover:bg-secondary flex items-center justify-center gap-1"><Repeat className="w-3.5 h-3.5" /> Série (intervalado)</button>
      </div>

      {/* Estimativas + legenda de zonas */}
      <div className="flex items-center justify-between text-[11px]">
        <div className="flex gap-3 text-muted-foreground">
          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {est.min} min</span>
          <span className="flex items-center gap-1"><Flame className="w-3.5 h-3.5" /> {est.tss} TSS</span>
        </div>
        <div className="flex gap-2">
          {ZONE_LIST.map(z => (
            <span key={z} className="flex items-center gap-0.5 text-[9px] text-muted-foreground">
              <span className="w-2 h-2 rounded-sm" style={{ background: ZONES[z].color }} />{ZONES[z].label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
