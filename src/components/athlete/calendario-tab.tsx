'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  getPlannedWorkouts, createPlannedWorkout, updatePlannedWorkout, deletePlannedWorkout,
  getActivitiesRange, bulkCreatePlannedWorkouts,
  getWorkoutLibrary, createLibraryWorkout,
  type PlannedWorkoutRow, type ActivityRow, type WorkoutLibraryRow, type PlannedWorkoutInput,
} from '@/lib/supabase/queries'
import {
  PLAN_LIBRARY, generatePlan, planTotals, PLAN_SPORT_LABEL, type PlanDef,
} from '@/lib/training-plans'
import { StructuredBuilder, StructureBar } from '@/components/athlete/structured-builder'
import { estimateStructure, structureSummary, type WorkoutStructure } from '@/lib/workout-structure'
import {
  ChevronLeft, ChevronRight, Plus, X, Loader2, Trash2, CheckCircle2, Circle,
  CalendarDays, Dumbbell, Bike, Footprints, Waves, Activity as ActIcon,
  Sparkles, Library, BookmarkPlus,
} from 'lucide-react'

const SPORTS = [
  { key: 'running', label: 'Corrida', color: '#ff6b00', icon: Footprints },
  { key: 'cycling', label: 'Ciclismo', color: '#0088ff', icon: Bike },
  { key: 'swimming', label: 'Natação', color: '#00b4d8', icon: Waves },
  { key: 'triathlon', label: 'Triathlon', color: '#8b5cf6', icon: ActIcon },
  { key: 'duathlon', label: 'Duathlon', color: '#ffa800', icon: ActIcon },
  { key: 'strength', label: 'Força', color: '#e8001c', icon: Dumbbell },
  { key: 'other', label: 'Outro', color: '#64748b', icon: ActIcon },
]
const sportInfo = (s: string) => SPORTS.find(x => x.key === s) ?? SPORTS[6]

function startOfWeek(d: Date) {
  const x = new Date(d); const day = (x.getDay() + 6) % 7 // segunda = 0
  x.setDate(x.getDate() - day); x.setHours(0, 0, 0, 0); return x
}
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x }
function ymd(d: Date) { return d.toLocaleDateString('en-CA') } // YYYY-MM-DD local
const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
function fmtDur(min?: number | null) { if (!min) return null; const h = Math.floor(min / 60), m = min % 60; return h > 0 ? `${h}h${m ? m + '' : ''}` : `${m}min` }
function startOfMonth(d: Date) { const x = new Date(d.getFullYear(), d.getMonth(), 1); x.setHours(0, 0, 0, 0); return x }
function addMonths(d: Date, n: number) { return startOfMonth(new Date(d.getFullYear(), d.getMonth() + n, 1)) }

export function CalendarioTab({ athleteId, defaultSport = 'running' }: { athleteId: string; defaultSport?: string }) {
  const [view, setView] = useState<'week' | 'month'>('week')
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [monthAnchor, setMonthAnchor] = useState(() => startOfMonth(new Date()))
  const [planned, setPlanned] = useState<PlannedWorkoutRow[]>([])
  const [done, setDone] = useState<ActivityRow[]>([])
  const [library, setLibrary] = useState<WorkoutLibraryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ date: string; edit?: PlannedWorkoutRow } | null>(null)
  const [showPlan, setShowPlan] = useState(false)

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const monthGridStart = useMemo(() => startOfWeek(monthAnchor), [monthAnchor])
  const monthDays = useMemo(() => Array.from({ length: 42 }, (_, i) => addDays(monthGridStart, i)), [monthGridStart])
  const todayKey = ymd(new Date())

  // Intervalo carregado conforme a visão (semana ou mês)
  const rangeStart = view === 'week' ? weekStart : monthGridStart
  const rangeDays = view === 'week' ? 7 : 42

  const load = useCallback(async () => {
    setLoading(true)
    const from = ymd(rangeStart), to = ymd(addDays(rangeStart, rangeDays - 1))
    const fromISO = new Date(rangeStart).toISOString()
    const toISO = new Date(addDays(rangeStart, rangeDays)).toISOString()
    const [p, a, lib] = await Promise.all([
      getPlannedWorkouts(athleteId, from, to),
      getActivitiesRange(athleteId, fromISO, toISO),
      getWorkoutLibrary(),
    ])
    setPlanned(p); setDone(a); setLibrary(lib); setLoading(false)
  }, [athleteId, rangeStart, rangeDays])

  useEffect(() => { load() }, [load])

  const plannedByDay = useMemo(() => {
    const m: Record<string, PlannedWorkoutRow[]> = {}
    for (const p of planned) (m[p.date] ??= []).push(p)
    return m
  }, [planned])
  const doneByDay = useMemo(() => {
    const m: Record<string, ActivityRow[]> = {}
    for (const a of done) { const k = ymd(new Date(a.started_at)); (m[k] ??= []).push(a) }
    return m
  }, [done])

  // Resumo da semana
  const plannedTss = planned.reduce((s, p) => s + (p.planned_tss ?? 0), 0)
  const doneTss = done.reduce((s, a) => s + (a.tss ?? 0), 0)

  async function toggleDone(p: PlannedWorkoutRow) {
    await updatePlannedWorkout(p.id, { completed: !p.completed }); load()
  }
  async function remove(id: string) { await deletePlannedWorkout(id); load() }

  const weekLabel = `${weekStart.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} – ${addDays(weekStart, 6).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`
  const monthLabel = monthAnchor.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  const goPrev = () => view === 'week' ? setWeekStart(w => addDays(w, -7)) : setMonthAnchor(m => addMonths(m, -1))
  const goNext = () => view === 'week' ? setWeekStart(w => addDays(w, 7)) : setMonthAnchor(m => addMonths(m, 1))
  const goToday = () => { setWeekStart(startOfWeek(new Date())); setMonthAnchor(startOfMonth(new Date())) }

  return (
    <div className="space-y-4">
      {/* Barra de navegação + resumo */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2">
          <button onClick={goPrev} className="p-2 rounded-lg bg-secondary text-muted-foreground hover:bg-secondary/70"><ChevronLeft className="w-4 h-4" /></button>
          <button onClick={goToday} className="px-3 py-2 rounded-lg bg-secondary text-xs font-bold text-foreground">Hoje</button>
          <button onClick={goNext} className="p-2 rounded-lg bg-secondary text-muted-foreground hover:bg-secondary/70"><ChevronRight className="w-4 h-4" /></button>
          <div className="flex items-center gap-1.5 ml-1 text-sm font-bold text-foreground capitalize"><CalendarDays className="w-4 h-4 text-primary" />{view === 'week' ? weekLabel : monthLabel}</div>
        </div>
        <div className="flex items-center gap-2 text-[11px] flex-wrap">
          {/* Seletor Semana/Mês */}
          <div className="flex gap-0.5 p-0.5 rounded-lg bg-background border border-border">
            <button onClick={() => setView('week')} className="px-2.5 py-1 rounded-md font-bold transition-colors" style={view === 'week' ? { background: '#7c3aed', color: '#fff' } : { color: 'var(--muted-foreground)' }}>Semana</button>
            <button onClick={() => setView('month')} className="px-2.5 py-1 rounded-md font-bold transition-colors" style={view === 'month' ? { background: '#7c3aed', color: '#fff' } : { color: 'var(--muted-foreground)' }}>Mês</button>
          </div>
          <span className="px-2.5 py-1 rounded-lg font-bold" style={{ background: '#0088ff18', color: '#0088ff' }}>Planejado {plannedTss} TSS</span>
          <span className="px-2.5 py-1 rounded-lg font-bold" style={{ background: '#00d08418', color: '#00d084' }}>Realizado {doneTss.toFixed(0)} TSS</span>
          <button onClick={() => setShowPlan(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary/90">
            <Sparkles className="w-3.5 h-3.5" /> Aplicar plano
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : view === 'week' ? (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
          {days.map(d => {
            const key = ymd(d)
            const isToday = key === todayKey
            const dayPlanned = plannedByDay[key] ?? []
            const dayDone = doneByDay[key] ?? []
            return (
              <div key={key} className="rounded-xl p-2 min-h-[120px] flex flex-col"
                style={{ background: 'var(--card)', border: `1px solid ${isToday ? '#7c3aed' : 'var(--border)'}` }}>
                <div className="flex items-center justify-between mb-1.5 px-1">
                  <span className={`text-[11px] font-bold ${isToday ? 'text-[#7c3aed]' : 'text-muted-foreground'}`}>
                    {WEEKDAYS[(d.getDay() + 6) % 7]} {d.getDate()}
                  </span>
                  <button onClick={() => setModal({ date: key })} className="p-1 rounded-md hover:bg-secondary text-muted-foreground" aria-label="Adicionar treino"><Plus className="w-3.5 h-3.5" /></button>
                </div>

                <div className="space-y-1.5 flex-1">
                  {/* Planejados */}
                  {dayPlanned.map(p => {
                    const info = sportInfo(p.sport)
                    return (
                      <button key={p.id} onClick={() => setModal({ date: key, edit: p })}
                        className="w-full text-left rounded-lg p-1.5 group"
                        style={{ background: info.color + '14', borderLeft: `3px solid ${info.color}` }}>
                        <div className="flex items-center gap-1">
                          <info.icon className="w-3 h-3 flex-shrink-0" style={{ color: info.color }} />
                          <span className="text-[11px] font-bold text-foreground truncate flex-1">{p.title}</span>
                          {p.completed
                            ? <CheckCircle2 className="w-3.5 h-3.5 text-[#00d084] flex-shrink-0" onClick={e => { e.stopPropagation(); toggleDone(p) }} />
                            : <Circle className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" onClick={e => { e.stopPropagation(); toggleDone(p) }} />}
                        </div>
                        {(p.planned_duration_min || p.planned_tss) && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">{[fmtDur(p.planned_duration_min), p.planned_tss ? `${p.planned_tss} TSS` : null].filter(Boolean).join(' · ')}</p>
                        )}
                        {p.structure && p.structure.length > 0 && <div className="mt-1"><StructureBar structure={p.structure} height={6} /></div>}
                        {p.description && !(p.structure && p.structure.length) && <p className="text-[10px] text-muted-foreground/80 mt-0.5 line-clamp-2">{p.description}</p>}
                      </button>
                    )
                  })}

                  {/* Realizados (importados) */}
                  {dayDone.map(a => {
                    const info = sportInfo(a.sport)
                    return (
                      <div key={a.id} className="rounded-lg p-1.5 flex items-center gap-1" style={{ background: 'var(--panel)', border: '1px dashed var(--panel-border)' }}>
                        <CheckCircle2 className="w-3 h-3 flex-shrink-0" style={{ color: info.color }} />
                        <span className="text-[10px] text-foreground truncate flex-1">{a.name ?? info.label}</span>
                        {a.tss != null && <span className="text-[9px] font-bold text-[#00d084]">{a.tss.toFixed(0)}</span>}
                      </div>
                    )
                  })}

                  {dayPlanned.length === 0 && dayDone.length === 0 && (
                    <button onClick={() => setModal({ date: key })} className="w-full py-3 text-[10px] text-muted-foreground/50 hover:text-muted-foreground rounded-lg border border-dashed border-border">+ treino</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* ─── Visão de MÊS ─── */
        <div>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS.map(w => <div key={w} className="text-center text-[10px] font-bold text-muted-foreground py-1">{w}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {monthDays.map(d => {
              const key = ymd(d)
              const isToday = key === todayKey
              const inMonth = d.getMonth() === monthAnchor.getMonth()
              const dayPlanned = plannedByDay[key] ?? []
              const dayDone = doneByDay[key] ?? []
              const items = [
                ...dayPlanned.map(p => ({ kind: 'p' as const, p })),
                ...dayDone.map(a => ({ kind: 'd' as const, a })),
              ]
              return (
                <div key={key} onClick={() => setModal({ date: key })}
                  className="rounded-lg p-1 min-h-[84px] flex flex-col cursor-pointer transition-colors hover:border-primary/40"
                  style={{ background: 'var(--card)', border: `1px solid ${isToday ? '#7c3aed' : 'var(--border)'}`, opacity: inMonth ? 1 : 0.45 }}>
                  <span className={`text-[10px] font-bold px-0.5 ${isToday ? 'text-[#7c3aed]' : 'text-muted-foreground'}`}>{d.getDate()}</span>
                  <div className="space-y-0.5 mt-0.5 flex-1 overflow-hidden">
                    {items.slice(0, 3).map((it, i) => {
                      if (it.kind === 'p') {
                        const info = sportInfo(it.p.sport)
                        return (
                          <button key={'p' + it.p.id} onClick={e => { e.stopPropagation(); setModal({ date: key, edit: it.p }) }}
                            className="w-full text-left rounded px-1 py-0.5 truncate text-[9px] font-semibold flex items-center gap-1"
                            style={{ background: info.color + '22', color: info.color }}>
                            {it.p.completed && <CheckCircle2 className="w-2.5 h-2.5 flex-shrink-0" />}
                            <span className="truncate">{it.p.title}</span>
                          </button>
                        )
                      }
                      return (
                        <div key={'d' + it.a.id} className="w-full rounded px-1 py-0.5 truncate text-[9px] flex items-center gap-1" style={{ background: 'var(--panel)', color: 'var(--muted-foreground)' }}>
                          <CheckCircle2 className="w-2.5 h-2.5 flex-shrink-0 text-[#00d084]" /><span className="truncate">{it.a.name ?? sportInfo(it.a.sport).label}</span>
                        </div>
                      )
                    })}
                    {items.length > 3 && <span className="text-[9px] text-muted-foreground/70 px-1">+{items.length - 3}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {modal && (
        <PlannedModal
          athleteId={athleteId} date={modal.date} edit={modal.edit} defaultSport={defaultSport} library={library}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load() }}
          onDelete={modal.edit ? () => { remove(modal.edit!.id); setModal(null) } : undefined}
        />
      )}

      {showPlan && (
        <ApplyPlanModal athleteId={athleteId} defaultSport={defaultSport}
          onClose={() => setShowPlan(false)}
          onApplied={() => { setShowPlan(false); load() }} />
      )}
    </div>
  )
}

function PlannedModal({ athleteId, date, edit, defaultSport, library, onClose, onSaved, onDelete }: {
  athleteId: string; date: string; edit?: PlannedWorkoutRow; defaultSport: string; library: WorkoutLibraryRow[]
  onClose: () => void; onSaved: () => void; onDelete?: () => void
}) {
  const [sport, setSport] = useState(edit?.sport ?? defaultSport)
  const [title, setTitle] = useState(edit?.title ?? '')
  const [dur, setDur] = useState(edit?.planned_duration_min?.toString() ?? '')
  const [tss, setTss] = useState(edit?.planned_tss?.toString() ?? '')
  const [desc, setDesc] = useState(edit?.description ?? '')
  const [saveToLib, setSaveToLib] = useState(false)
  const [saving, setSaving] = useState(false)
  const [structured, setStructured] = useState<boolean>(!!edit?.structure && edit.structure.length > 0)
  const [structure, setStructure] = useState<WorkoutStructure>(edit?.structure ?? [])
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const est = structured ? estimateStructure(structure) : null
  // treinos da biblioteca da modalidade selecionada (para escolher depois da modalidade)
  const libForSport = library.filter(l => l.sport === sport)

  function applyFromLibrary(id: string) {
    const w = library.find(l => l.id === id); if (!w) return
    setSport(w.sport); setTitle(w.title); setDesc(w.description ?? '')
    setDur(w.duration_min?.toString() ?? ''); setTss(w.tss?.toString() ?? '')
  }

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const useStruct = structured && structure.length > 0
    const finalDur = useStruct ? est!.min : (dur ? parseInt(dur) : null)
    const finalTss = useStruct ? est!.tss : (tss ? parseInt(tss) : null)
    const finalDesc = desc.trim() || (useStruct ? structureSummary(structure) : '') || null
    const payload = {
      athlete_id: athleteId, date, sport, title: title.trim(),
      description: finalDesc,
      planned_duration_min: finalDur,
      planned_tss: finalTss,
      structure: useStruct ? structure : null,
    }
    const ok = edit ? await updatePlannedWorkout(edit.id, payload) : await createPlannedWorkout(payload)
    if (ok && saveToLib && !edit) {
      await createLibraryWorkout({ sport, title: title.trim(), description: finalDesc, duration_min: finalDur, tss: finalTss })
    }
    setSaving(false)
    if (ok) onSaved()
  }

  const cls = 'w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary'
  const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })

  if (!mounted) return null
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card">
          <div>
            <h2 className="text-sm font-bold text-foreground">{edit ? 'Editar treino' : 'Novo treino'}</h2>
            <p className="text-[11px] text-muted-foreground capitalize">{dateLabel}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={save} className="p-6 space-y-4">
          {/* 1º) Modalidade — filtra os treinos da biblioteca abaixo */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Modalidade *</label>
            <div className="grid grid-cols-4 gap-1.5">
              {SPORTS.map(s => (
                <button type="button" key={s.key} onClick={() => setSport(s.key)}
                  className="flex flex-col items-center gap-1 py-2 rounded-lg text-[10px] font-bold transition-colors"
                  style={sport === s.key ? { background: s.color + '22', border: `1.5px solid ${s.color}`, color: s.color } : { background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--muted-foreground)' }}>
                  <s.icon className="w-4 h-4" />{s.label}
                </button>
              ))}
            </div>
          </div>
          {/* 2º) Treinos disponíveis para a modalidade escolhida */}
          {!edit && (
            libForSport.length > 0 ? (
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5 flex items-center gap-1"><Library className="w-3.5 h-3.5 text-primary" /> Treinos disponíveis ({SPORTS.find(s => s.key === sport)?.label ?? sport})</label>
                <select key={sport} defaultValue="" onChange={e => { if (e.target.value) applyFromLibrary(e.target.value) }} className={cls}>
                  <option value="">Escolher um treino salvo…</option>
                  {libForSport.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
                </select>
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground px-1">Nenhum treino salvo nesta modalidade — preencha manualmente abaixo.</p>
            )
          )}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Título *</label>
            <input required value={title} onChange={e => setTitle(e.target.value)} placeholder="ex: Intervalado 4x1km Z4" className={cls} />
          </div>
          {/* Toggle: simples x estruturado */}
          <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: 'var(--panel)', border: '1px solid var(--panel-border)' }}>
            <label className="text-xs font-semibold text-foreground">Treino estruturado (passo a passo)</label>
            <button type="button" onClick={() => setStructured(v => !v)} aria-label="Alternar estruturado"
              className="relative w-10 h-5 rounded-full transition-colors" style={{ background: structured ? '#7c3aed' : 'var(--border)' }}>
              <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all" style={{ left: structured ? '22px' : '2px' }} />
            </button>
          </div>

          {structured ? (
            <StructuredBuilder value={structure} onChange={setStructure} />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">Duração (min)</label>
                <input type="number" min="0" value={dur} onChange={e => setDur(e.target.value)} placeholder="60" className={cls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">TSS alvo</label>
                <input type="number" min="0" value={tss} onChange={e => setTss(e.target.value)} placeholder="70" className={cls} />
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">{structured ? 'Observações (opcional)' : 'Descrição / estrutura'}</label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={structured ? 2 : 3} placeholder={structured ? 'notas adicionais…' : 'ex: 15min aquec Z2 · 4x1km Z4 (rec 2min) · 10min solto Z1'} className={cls + ' resize-none'} />
          </div>

          {!edit && (
            <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
              <input type="checkbox" checked={saveToLib} onChange={e => setSaveToLib(e.target.checked)} className="accent-primary w-4 h-4" />
              <BookmarkPlus className="w-3.5 h-3.5 text-muted-foreground" /> Salvar este treino na biblioteca
            </label>
          )}

          <div className="flex gap-2 pt-1">
            {onDelete && (
              <button type="button" onClick={onDelete} className="p-2.5 rounded-lg border border-border text-red-400 hover:bg-red-400/10" aria-label="Excluir"><Trash2 className="w-4 h-4" /></button>
            )}
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-border text-sm font-semibold text-muted-foreground rounded-lg hover:bg-secondary">Cancelar</button>
            <button type="submit" disabled={saving || !title.trim()} className="flex-1 py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-60 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}{saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}

// ─── Aplicar um plano de mercado ao calendário ──────────────────────────────
function ApplyPlanModal({ athleteId, defaultSport, onClose, onApplied }: {
  athleteId: string; defaultSport: string; onClose: () => void; onApplied: () => void
}) {
  const [filter, setFilter] = useState<string>(['running', 'cycling', 'triathlon'].includes(defaultSport) ? defaultSport : 'all')
  const [selected, setSelected] = useState<PlanDef | null>(null)
  const [start, setStart] = useState(ymd(addDays(startOfWeek(new Date()), 7))) // próxima segunda
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const plans = PLAN_LIBRARY.filter(p => filter === 'all' || p.sport === filter)

  async function apply() {
    if (!selected) return
    setApplying(true); setError(null)
    const startDate = new Date(start + 'T12:00:00')
    const gen = generatePlan(selected)
    const rows: PlannedWorkoutInput[] = []
    for (const wk of gen) for (const s of wk.workouts) {
      const d = addDays(startDate, (wk.week - 1) * 7 + s.day)
      rows.push({
        athlete_id: athleteId, date: ymd(d), sport: s.sport, title: s.title,
        description: s.description, planned_duration_min: s.duration_min, planned_tss: s.tss,
      })
    }
    const res = await bulkCreatePlannedWorkouts(rows)
    setApplying(false)
    if (res.ok) onApplied(); else setError(res.error ?? 'Falha ao aplicar o plano')
  }

  const totals = selected ? planTotals(selected) : null

  if (!mounted) return null
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <div className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /><h2 className="text-sm font-bold text-foreground">Aplicar plano de treino</h2></div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-6 space-y-4">
          {/* Filtro por modalidade */}
          <div className="flex gap-1 p-1 rounded-xl bg-background border border-border">
            {[['all', 'Todos'], ['running', 'Corrida'], ['cycling', 'Ciclismo'], ['triathlon', 'Triathlon']].map(([k, label]) => (
              <button key={k} onClick={() => { setFilter(k); setSelected(null) }}
                className="flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors"
                style={filter === k ? { background: '#7c3aed', color: '#fff' } : { color: 'var(--muted-foreground)' }}>{label}</button>
            ))}
          </div>

          {/* Lista de planos */}
          <div className="space-y-2">
            {plans.map(p => {
              const t = planTotals(p)
              const isSel = selected?.key === p.key
              return (
                <button key={p.key} onClick={() => setSelected(p)}
                  className="w-full text-left rounded-xl p-3 transition-colors"
                  style={{ background: isSel ? '#7c3aed14' : 'var(--panel)', border: `1.5px solid ${isSel ? '#7c3aed' : 'var(--panel-border)'}` }}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-foreground flex-1">{p.name}</span>
                    <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded" style={{ background: 'var(--panel-border)', color: '#8b93a7' }}>{p.level}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">{p.focus}</p>
                  <p className="text-[10px] text-muted-foreground/80 mt-1.5">{PLAN_SPORT_LABEL[p.sport]} · {p.weeks} semanas · {t.perWeek}x/sem · ~{t.hours}h · {t.tss} TSS</p>
                </button>
              )
            })}
          </div>

          {/* Aplicar */}
          {selected && (
            <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--panel)', border: '1px solid var(--panel-border)' }}>
              <p className="text-xs font-bold text-foreground">Aplicar “{selected.name}” a partir de:</p>
              <input type="date" value={start} onChange={e => setStart(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary" />
              <p className="text-[11px] text-muted-foreground">Serão criados <b>{totals?.sessions}</b> treinos ao longo de <b>{selected.weeks} semanas</b> no calendário do atleta. Você pode editar cada um depois.</p>
              {error && <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>}
              <button onClick={apply} disabled={applying}
                className="w-full py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-60 text-white text-sm font-bold rounded-lg flex items-center justify-center gap-2">
                {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}{applying ? 'Aplicando...' : `Aplicar plano (${totals?.sessions} treinos)`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
