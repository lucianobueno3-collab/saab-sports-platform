'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  logStrengthSelf,
  type StrengthLogExercise, type StrengthSetLog, type StrengthLogRow, type PortalStrengthProgram,
} from '@/lib/supabase/queries'
import {
  Dumbbell, CheckCircle2, ChevronLeft, ChevronRight, SkipForward,
  ClipboardCheck, History, Flag,
} from 'lucide-react'

function fmtDate(d: string) {
  return new Date(d + (d.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('pt-BR')
}
function fmtClock(totalS: number) {
  const m = Math.floor(totalS / 60), s = totalS % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

// Uma linha editável por série (Reps × Carga + concluída)
type SetEntry = { reps: string; load: string; done: boolean }

/**
 * Executor de treino de força — um exercício por vez, com séries dinâmicas
 * (Reps × Carga por linha), coluna "Último treino", progresso e navegação.
 * Espelha o fluxo de execução guiada.
 */
export function StrengthPlayer({ athleteId, program, logs, onLogged }: {
  athleteId: string; program: PortalStrengthProgram; logs: StrengthLogRow[]; onLogged: () => void
}) {
  const [dayIdx, setDayIdx] = useState(0)
  const day = program.structure[dayIdx]

  // entries[i] = séries do exercício i (alinhado a day.exercises)
  const [entries, setEntries] = useState<SetEntry[][]>([])
  const [exIdx, setExIdx] = useState(0)   // exercício atual; === total → tela de revisão
  const [rpe, setRpe] = useState(7)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  // Última execução registrada por exercício (para a coluna "Último treino")
  const lastSetsByExercise = useMemo(() => {
    const m: Record<string, StrengthSetLog[]> = {}
    for (const log of logs) {            // logs já vêm ordenados do mais recente
      for (const e of log.completed) {
        if (e.sets && e.sets.length && !(e.name in m)) m[e.name] = e.sets
      }
    }
    return m
  }, [logs])

  // (Re)inicializa as séries ao trocar de dia/programa
  useEffect(() => {
    if (!day) { setEntries([]); return }
    setEntries(day.exercises.map(ex => {
      const last = lastSetsByExercise[ex.name]
      return Array.from({ length: Math.max(1, ex.sets) }, (_, j) => ({
        reps: last?.[j]?.reps ?? ex.reps,     // prefill c/ o que fez da última vez, senão a prescrição
        load: last?.[j]?.load ?? '',          // carga começa vazia (placeholder mostra a última)
        done: false,
      }))
    }))
    setExIdx(0); setRpe(7); setNotes(''); setSaved(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayIdx, program.id])

  // Cronômetro da sessão
  const startRef = useRef(Date.now())
  useEffect(() => {
    startRef.current = Date.now(); setElapsed(0)
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000)
    return () => clearInterval(t)
  }, [dayIdx, program.id])

  if (!day || entries.length === 0) return null
  const total = day.exercises.length

  function patchSet(exI: number, setI: number, patch: Partial<SetEntry>) {
    setEntries(prev => prev.map((sets, i) => i !== exI ? sets : sets.map((s, j) => j !== setI ? s : { ...s, ...patch })))
  }
  function addSet(exI: number) {
    setEntries(prev => prev.map((sets, i) => i !== exI ? sets : [...sets, { reps: sets[sets.length - 1]?.reps ?? '', load: sets[sets.length - 1]?.load ?? '', done: false }]))
  }

  const exDone = entries.map(sets => sets.some(s => s.done))
  const doneCount = exDone.filter(Boolean).length

  async function save() {
    setSaving(true)
    const completed: StrengthLogExercise[] = day.exercises.map((ex, i) => {
      const sets = entries[i].map(s => ({ reps: s.reps.trim(), load: s.load.trim(), done: s.done }))
      const valid = sets.filter(s => s.done)
      const loadSummary = valid.filter(s => s.load).map(s => `${s.reps || '?'}×${s.load}`).join(' · ') || undefined
      return { name: ex.name, muscle: ex.muscle, done: valid.length > 0, load: loadSummary, reps: ex.reps, sets }
    })
    const ok = await logStrengthSelf(athleteId, { program_id: program.id, day_label: day.label, rpe, completed, notes: notes || null })
    setSaving(false)
    if (ok) { setSaved(true); onLogged(); setTimeout(() => setSaved(false), 3000) }
  }

  // ─── Tela de revisão (após o último exercício) ────────────────────────────
  const isReview = exIdx >= total
  const ex = day.exercises[exIdx]

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {/* Cabeçalho: programa + dia + cronômetro */}
      <div className="flex items-center gap-2 px-5 pt-4 pb-3">
        <Dumbbell className="w-4 h-4 text-primary flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-foreground truncate">Treino de força</h2>
          <p className="text-[11px] text-muted-foreground truncate">{program.name}</p>
        </div>
        <span className="text-xs font-black tabular-nums text-muted-foreground px-2 py-1 rounded-lg bg-secondary">{fmtClock(elapsed)}</span>
      </div>

      {/* Seletor de dia */}
      {program.structure.length > 1 && (
        <div className="flex gap-1.5 px-5 pb-3 overflow-x-auto">
          {program.structure.map((d, i) => (
            <button key={i} onClick={() => setDayIdx(i)}
              className="px-3 py-1.5 text-[11px] font-bold rounded-lg whitespace-nowrap flex-shrink-0 transition-colors"
              style={i === dayIdx ? { background: '#e8001c', color: '#fff' } : { background: 'var(--secondary)', color: 'var(--muted-foreground)' }}>{d.label}</button>
          ))}
        </div>
      )}

      {/* Barra de progresso por exercício */}
      <div className="flex gap-1 px-5 pb-3">
        {day.exercises.map((_, i) => (
          <button key={i} onClick={() => setExIdx(i)} className="flex-1 h-1.5 rounded-full transition-colors" aria-label={`Exercício ${i + 1}`}
            style={{ background: exDone[i] ? '#00d084' : (!isReview && i === exIdx) ? '#e8001c' : 'var(--border)' }} />
        ))}
        <button onClick={() => setExIdx(total)} className="w-5 h-1.5 rounded-full flex items-center justify-center"
          style={{ background: isReview ? '#e8001c' : 'var(--border)' }} aria-label="Revisão" />
      </div>

      {isReview ? (
        <ReviewPane
          exercises={day.exercises.map((e, i) => ({ name: e.name, done: exDone[i], sets: entries[i] }))}
          doneCount={doneCount} total={total}
          rpe={rpe} setRpe={setRpe} notes={notes} setNotes={setNotes}
          onBack={() => setExIdx(total - 1)} onSave={save} saving={saving} saved={saved}
        />
      ) : (
        <ExercisePane
          key={exIdx}
          ex={ex} exIdx={exIdx} total={total}
          sets={entries[exIdx]} last={lastSetsByExercise[ex.name]}
          onPatch={(setI, patch) => patchSet(exIdx, setI, patch)}
          onAddSet={() => addSet(exIdx)}
          onPrev={() => setExIdx(i => Math.max(0, i - 1))}
          onSkip={() => setExIdx(i => i + 1)}
          onComplete={() => setExIdx(i => i + 1)}
        />
      )}

      {/* Histórico */}
      {logs.length > 0 && (
        <div className="px-5 py-4 border-t border-border/40">
          <div className="flex items-center gap-1.5 mb-2"><History className="w-3.5 h-3.5 text-muted-foreground" /><p className="text-[11px] font-bold text-muted-foreground">Últimos treinos de força</p></div>
          <div className="space-y-1.5">
            {logs.slice(0, 5).map(l => {
              const doneN = l.completed.filter(e => e.done).length
              return (
                <div key={l.id} className="flex items-center gap-2 text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#00d084] flex-shrink-0" />
                  <span className="text-muted-foreground w-16 flex-shrink-0">{fmtDate(l.performed_at)}</span>
                  <span className="text-foreground flex-1 min-w-0 truncate">{l.day_label ?? 'Treino'}</span>
                  <span className="text-muted-foreground flex-shrink-0">{doneN} ex.{l.rpe != null ? ` · RPE ${l.rpe}` : ''}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Um exercício com suas séries ───────────────────────────────────────────
function ExercisePane({ ex, exIdx, total, sets, last, onPatch, onAddSet, onPrev, onSkip, onComplete }: {
  ex: PortalStrengthProgram['structure'][number]['exercises'][number]
  exIdx: number; total: number; sets: SetEntry[]; last?: StrengthSetLog[]
  onPatch: (setI: number, patch: Partial<SetEntry>) => void
  onAddSet: () => void; onPrev: () => void; onSkip: () => void; onComplete: () => void
}) {
  return (
    <div className="px-5">
      {/* Pílula "Exercício X de N" */}
      <div className="flex justify-center mb-2">
        <span className="text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-secondary text-muted-foreground">Exercício {exIdx + 1} de {total}</span>
      </div>

      <p className="text-[11px] font-bold uppercase tracking-wide text-primary text-center">{ex.muscle}</p>
      <h3 className="text-xl font-black text-foreground text-center leading-tight mt-0.5">{ex.name}</h3>
      <p className="text-[11px] text-muted-foreground text-center mt-1">
        {ex.sets} séries × {ex.reps}{ex.load ? ` · ${ex.load}` : ''}{ex.rest_s ? ` · ${ex.rest_s}s desc.` : ''}
      </p>
      {ex.notes && <p className="text-[11px] text-muted-foreground/80 italic text-center mt-1">{ex.notes}</p>}

      {/* Tabela de séries */}
      <div className="mt-4">
        <div className="grid grid-cols-[28px_1fr_1fr_1fr_28px] gap-2 items-center px-1 pb-1.5">
          <span />
          <span className="text-[10px] font-bold uppercase text-muted-foreground text-center">Reps</span>
          <span className="text-[10px] font-bold uppercase text-muted-foreground text-center">Carga(kg)</span>
          <span className="text-[10px] font-bold uppercase text-muted-foreground text-center">Último</span>
          <span />
        </div>
        <div className="space-y-1.5">
          {sets.map((s, j) => {
            const lastLabel = last?.[j] ? `${last[j].reps || '?'}×${last[j].load || '?'}` : '—'
            return (
              <div key={j} className="grid grid-cols-[28px_1fr_1fr_1fr_28px] gap-2 items-center rounded-xl p-1.5"
                style={{ background: s.done ? '#00d0840f' : 'var(--panel)', border: `1px solid ${s.done ? '#00d08455' : 'var(--panel-border)'}` }}>
                <span className="text-xs font-black text-muted-foreground text-center">{j + 1}</span>
                <input value={s.reps} onChange={e => onPatch(j, { reps: e.target.value })} inputMode="numeric"
                  className="w-full py-2 text-sm font-semibold text-center rounded-lg bg-background border border-border text-foreground outline-none focus:border-primary" />
                <input value={s.load} onChange={e => onPatch(j, { load: e.target.value })} inputMode="decimal"
                  placeholder={last?.[j]?.load || '0'}
                  className="w-full py-2 text-sm font-semibold text-center rounded-lg bg-background border border-border text-foreground outline-none focus:border-primary" />
                <span className="text-[11px] text-muted-foreground text-center tabular-nums">{lastLabel}</span>
                <button onClick={() => onPatch(j, { done: !s.done })} aria-label={`Série ${j + 1} concluída`}
                  className="w-6 h-6 rounded-full flex items-center justify-center mx-auto transition-colors"
                  style={{ background: s.done ? '#00d084' : 'transparent', border: `1.5px solid ${s.done ? '#00d084' : 'var(--border)'}` }}>
                  {s.done && <CheckCircle2 className="w-4 h-4 text-white" />}
                </button>
              </div>
            )
          })}
        </div>
        <button onClick={onAddSet} className="w-full mt-2 py-1.5 text-[11px] font-bold text-muted-foreground rounded-lg border border-dashed border-border hover:bg-secondary transition-colors">+ série</button>
      </div>

      {/* Navegação */}
      <div className="flex items-center gap-2 mt-4 mb-4">
        <button onClick={onPrev} disabled={exIdx === 0}
          className="p-2.5 rounded-xl bg-secondary text-muted-foreground disabled:opacity-40" aria-label="Anterior"><ChevronLeft className="w-4 h-4" /></button>
        <button onClick={onSkip}
          className="flex-1 py-3 text-sm font-bold rounded-xl bg-secondary text-muted-foreground flex items-center justify-center gap-1.5"><SkipForward className="w-4 h-4" /> Pular</button>
        <button onClick={onComplete}
          className="flex-1 py-3 text-sm font-bold rounded-xl bg-primary text-white flex items-center justify-center gap-1.5">
          {exIdx === total - 1 ? <><Flag className="w-4 h-4" /> Revisar</> : <>Próximo <ChevronRight className="w-4 h-4" /></>}
        </button>
      </div>
    </div>
  )
}

// ─── Revisão final + RPE da sessão + salvar ─────────────────────────────────
function ReviewPane({ exercises, doneCount, total, rpe, setRpe, notes, setNotes, onBack, onSave, saving, saved }: {
  exercises: { name: string; done: boolean; sets: SetEntry[] }[]
  doneCount: number; total: number
  rpe: number; setRpe: (v: number) => void; notes: string; setNotes: (v: string) => void
  onBack: () => void; onSave: () => void; saving: boolean; saved: boolean
}) {
  const rpeColor = rpe <= 3 ? '#4ade80' : rpe <= 6 ? '#fbbf24' : '#ef4444'
  return (
    <div className="px-5 pb-4">
      <div className="flex justify-center mb-3">
        <span className="text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-secondary text-muted-foreground">Revisão do treino</span>
      </div>

      <div className="space-y-1.5">
        {exercises.map((e, i) => {
          const doneSets = e.sets.filter(s => s.done)
          return (
            <div key={i} className="flex items-center gap-2 rounded-xl p-2.5" style={{ background: 'var(--panel)', border: '1px solid var(--panel-border)' }}>
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: e.done ? '#00d084' : 'var(--border)' }} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground truncate">{e.name}</p>
                {doneSets.length > 0 && (
                  <p className="text-[11px] text-muted-foreground truncate">{doneSets.map(s => `${s.reps || '?'}×${s.load || '?'}`).join(' · ')}</p>
                )}
              </div>
              <span className="text-[11px] font-bold text-muted-foreground flex-shrink-0">{doneSets.length}/{e.sets.length}</span>
            </div>
          )
        })}
      </div>

      {/* RPE da sessão */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-sm font-medium text-foreground">Esforço do treino (RPE)</label>
          <span className="text-lg font-black tabular-nums" style={{ color: rpeColor }}>{rpe}</span>
        </div>
        <input type="range" min={0} max={10} value={rpe} onChange={e => setRpe(parseInt(e.target.value))} className="w-full" style={{ accentColor: rpeColor }} />
        <p className="text-[11px] text-muted-foreground mt-0.5">0 = muito leve · 10 = máximo</p>
      </div>

      <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Observações (opcional)"
        className="w-full mt-3 px-3 py-2 text-sm rounded-lg bg-background border border-border text-foreground outline-none focus:border-primary resize-none" />

      <div className="flex items-center gap-2 mt-3">
        <button onClick={onBack} className="p-2.5 rounded-xl bg-secondary text-muted-foreground" aria-label="Voltar"><ChevronLeft className="w-4 h-4" /></button>
        <button onClick={onSave} disabled={saving || doneCount === 0}
          className="flex-1 py-3 text-sm font-bold rounded-xl bg-primary text-white disabled:opacity-50 flex items-center justify-center gap-2">
          {saved ? <><CheckCircle2 className="w-4 h-4" /> Treino registrado!</> : saving ? 'Salvando...' : <><ClipboardCheck className="w-4 h-4" /> Registrar treino ({doneCount}/{total})</>}
        </button>
      </div>
    </div>
  )
}
