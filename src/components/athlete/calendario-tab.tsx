'use client'

import { useCallback, useEffect, useMemo, useState, type DragEvent } from 'react'
import { createPortal } from 'react-dom'
import {
  getPlannedWorkouts, createPlannedWorkout, updatePlannedWorkout, deletePlannedWorkout,
  getActivitiesRange, bulkCreatePlannedWorkouts, submitWorkoutCheckin, matchPlannedActivities,
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
  Sparkles, Library, BookmarkPlus, GripVertical,
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
function fmtPace(secPerKm: number) { const m = Math.floor(secPerKm / 60), s = Math.round(secPerKm % 60); return `${m}:${String(s).padStart(2, '0')}/km` }
const ZONE_COLORS = ['#3b82f6', '#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444', '#dc2626', '#b91c1c', '#991b1b', '#7f1d1d']
function startOfMonth(d: Date) { const x = new Date(d.getFullYear(), d.getMonth(), 1); x.setHours(0, 0, 0, 0); return x }
function addMonths(d: Date, n: number) { return startOfMonth(new Date(d.getFullYear(), d.getMonth() + n, 1)) }

export function CalendarioTab({ athleteId, defaultSport = 'running', readOnly = false }: { athleteId: string; defaultSport?: string; readOnly?: boolean }) {
  const [view, setView] = useState<'week' | 'month'>('month')
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [monthAnchor, setMonthAnchor] = useState(() => startOfMonth(new Date()))
  const [planned, setPlanned] = useState<PlannedWorkoutRow[]>([])
  const [done, setDone] = useState<ActivityRow[]>([])
  const [library, setLibrary] = useState<WorkoutLibraryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ date: string; edit?: PlannedWorkoutRow } | null>(null)
  const [detail, setDetail] = useState<PlannedWorkoutRow | null>(null)
  const [detailActivity, setDetailActivity] = useState<ActivityRow | null>(null)
  const [selectedDay, setSelectedDay] = useState<string>(() => ymd(new Date()))
  const [showPlan, setShowPlan] = useState(false)
  const [showLib, setShowLib] = useState(false)
  const [dragLib, setDragLib] = useState<WorkoutLibraryRow | null>(null)
  const [dragOverDay, setDragOverDay] = useState<string | null>(null)

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
    // cruza planejado x realizado antes de carregar (idempotente)
    await matchPlannedActivities(athleteId, from, to).catch(() => {})
    const [p, a, lib] = await Promise.all([
      getPlannedWorkouts(athleteId, from, to),
      getActivitiesRange(athleteId, fromISO, toISO),
      readOnly ? Promise.resolve([]) : getWorkoutLibrary(),
    ])
    setPlanned(p); setDone(a); setLibrary(lib); setLoading(false)
  }, [athleteId, rangeStart, rangeDays, readOnly])

  useEffect(() => { load() }, [load])

  const plannedByDay = useMemo(() => {
    const m: Record<string, PlannedWorkoutRow[]> = {}
    for (const p of planned) (m[p.date] ??= []).push(p)
    return m
  }, [planned])
  // atividades já vinculadas a um treino planejado (mostradas junto do planejado)
  const realizedLine = (a: ActivityRow) => [fmtDur(Math.round((a.duration_seconds || 0) / 60)), a.distance_meters ? `${(a.distance_meters / 1000).toFixed(1)}km` : null, a.avg_hr_bpm ? `${a.avg_hr_bpm} bpm` : null, a.tss != null ? `${a.tss.toFixed(0)} TSS` : null].filter(Boolean).join(' · ')
  const doneByDay = useMemo(() => {
    const m: Record<string, ActivityRow[]> = {}
    for (const a of done) { const k = ymd(new Date(a.started_at)); (m[k] ??= []).push(a) }
    return m
  }, [done])
  // Mescla planejado x realizado do dia: por vínculo do banco (activity_id) ou,
  // como reforço, por modalidade. Devolve pares (planejado + atividade) e as
  // atividades sem plano (extras).
  function mergeDay(dayPlanned: PlannedWorkoutRow[], dayDone: ActivityRow[]) {
    const used = new Set<string>()
    const pairs = dayPlanned.map(p => {
      let act = p.activity_id ? dayDone.find(a => a.id === p.activity_id) : undefined
      if (!act) act = dayDone.find(a => !used.has(a.id) && a.sport.toLowerCase() === p.sport.toLowerCase())
      if (act) used.add(act.id)
      return { p, act }
    })
    const extras = dayDone.filter(a => !used.has(a.id))
    return { pairs, extras }
  }

  // Resumo da semana
  const plannedTss = planned.reduce((s, p) => s + (p.planned_tss ?? 0), 0)
  const doneTss = done.reduce((s, a) => s + (a.tss ?? 0), 0)

  async function toggleDone(p: PlannedWorkoutRow) {
    await updatePlannedWorkout(p.id, { completed: !p.completed })
    setDetail(d => (d && d.id === p.id ? { ...d, completed: !p.completed } : d))
    load()
  }
  // Concluir treino (atleta): marca feito + registra dificuldade e relato
  async function completeWorkout(p: PlannedWorkoutRow, rpe: number, notes: string) {
    await updatePlannedWorkout(p.id, { completed: true })
    await submitWorkoutCheckin(athleteId, { rpe, notes: notes.trim() || null })
    setDetail(d => (d && d.id === p.id ? { ...d, completed: true } : d))
    load()
  }
  async function remove(id: string) { await deletePlannedWorkout(id); load() }
  // No modo atleta (readOnly) o clique abre os detalhes do treino; no modo
  // treinador abre o editor.
  function openWorkout(date: string, p: PlannedWorkoutRow) {
    if (readOnly) setDetail(p); else setModal({ date, edit: p })
  }
  // Arrastar um treino da biblioteca para um dia programa o treino nesse dia.
  async function dropOnDay(date: string) {
    const w = dragLib
    setDragLib(null); setDragOverDay(null)
    if (!w) return
    await createPlannedWorkout({
      athlete_id: athleteId, date, sport: w.sport, title: w.title,
      description: w.description ?? null, planned_duration_min: w.duration_min ?? null,
      planned_tss: w.tss ?? null, structure: w.structure ?? null,
    })
    load()
  }
  // Props de "solte aqui" aplicadas às células de dia (só no modo treinador).
  const dropProps = (key: string) => (readOnly ? {} : {
    onDragOver: (e: DragEvent) => { if (dragLib) { e.preventDefault(); setDragOverDay(key) } },
    onDragLeave: () => setDragOverDay(o => (o === key ? null : o)),
    onDrop: () => dropOnDay(key),
  })

  const weekLabel = `${weekStart.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} – ${addDays(weekStart, 6).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`
  const monthLabel = monthAnchor.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  const goPrev = () => view === 'week' ? setWeekStart(w => addDays(w, -7)) : setMonthAnchor(m => addMonths(m, -1))
  const goNext = () => view === 'week' ? setWeekStart(w => addDays(w, 7)) : setMonthAnchor(m => addMonths(m, 1))
  const goToday = () => { setWeekStart(startOfWeek(new Date())); setMonthAnchor(startOfMonth(new Date())) }

  // ── Visão do ATLETA: calendário com bolinhas + detalhe do dia (estilo TP) ──
  if (readOnly) {
    const goMonth = (delta: number) => {
      const next = addMonths(monthAnchor, delta)
      setMonthAnchor(next)
      const now = new Date()
      const isNow = next.getMonth() === now.getMonth() && next.getFullYear() === now.getFullYear()
      setSelectedDay(isNow ? ymd(now) : ymd(next))
    }
    const backToToday = () => { setMonthAnchor(startOfMonth(new Date())); setSelectedDay(ymd(new Date())) }
    const dayLabel = (key: string) => {
      const today = ymd(new Date()); const yst = ymd(addDays(new Date(), -1)); const tmr = ymd(addDays(new Date(), 1))
      if (key === today) return 'Hoje'
      if (key === yst) return 'Ontem'
      if (key === tmr) return 'Amanhã'
      return new Date(key + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long' })
    }
    const sel = mergeDay(plannedByDay[selectedDay] ?? [], doneByDay[selectedDay] ?? [])

    return (
      <div className="space-y-4">
        {/* Navegação do mês */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-base font-black text-foreground capitalize">
            <CalendarDays className="w-5 h-5 text-primary" />{monthLabel}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => goMonth(-1)} className="p-2 rounded-lg bg-secondary text-muted-foreground hover:bg-secondary/70"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={backToToday} className="px-3 py-2 rounded-lg bg-secondary text-xs font-bold text-foreground">Hoje</button>
            <button onClick={() => goMonth(1)} className="p-2 rounded-lg bg-secondary text-muted-foreground hover:bg-secondary/70"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>

        {/* Grade do mês com bolinhas por dia */}
        <div className="rounded-2xl p-2" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map(w => <div key={w} className="text-center text-[10px] font-bold text-muted-foreground py-1">{w[0]}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {monthDays.map(d => {
              const key = ymd(d)
              const inMonth = d.getMonth() === monthAnchor.getMonth()
              const isToday = key === todayKey
              const isSel = key === selectedDay
              const items = [...(plannedByDay[key] ?? []).map(p => ({ color: sportInfo(p.sport).color, done: p.completed })),
                             ...(doneByDay[key] ?? []).map(a => ({ color: sportInfo(a.sport).color, done: true }))]
              return (
                <button key={key} onClick={() => setSelectedDay(key)}
                  className="aspect-square flex flex-col items-center justify-center rounded-xl transition-colors"
                  style={{
                    background: isSel ? '#e8001c18' : 'transparent',
                    border: isSel ? '1.5px solid #e8001c' : isToday ? '1.5px solid var(--primary)' : '1.5px solid transparent',
                    opacity: inMonth ? 1 : 0.35,
                  }}>
                  <span className={`text-xs font-bold ${isToday ? 'text-primary' : 'text-foreground'}`}>{d.getDate()}</span>
                  <span className="flex items-center gap-0.5 h-2 mt-0.5">
                    {items.slice(0, 4).map((it, i) => (
                      <span key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: it.color, opacity: it.done ? 1 : 0.5 }} />
                    ))}
                    {items.length > 4 && <span className="text-[8px] text-muted-foreground">+</span>}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Detalhe do dia selecionado */}
        <div>
          <p className="text-sm font-black text-foreground capitalize mb-2">
            {dayLabel(selectedDay)} <span className="text-muted-foreground font-medium">· {new Date(selectedDay + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}</span>
          </p>
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : (sel.pairs.length === 0 && sel.extras.length === 0) ? (
            <p className="text-xs text-muted-foreground rounded-xl p-4 text-center" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>Nenhum treino neste dia.</p>
          ) : (
            <div className="space-y-2">
              {sel.pairs.map(({ p, act }) => {
                const info = sportInfo(p.sport)
                const doneCol = (p.completed || act) ? '#00d084' : info.color
                return (
                  <button key={p.id} onClick={() => (act ? setDetailActivity(act) : setDetail(p))} className="w-full text-left rounded-2xl p-4"
                    style={{ background: 'var(--card)', border: '1px solid var(--border)', borderLeftWidth: 4, borderLeftColor: doneCol }}>
                    <div className="flex items-center gap-2">
                      <info.icon className="w-4 h-4 flex-shrink-0" style={{ color: info.color }} />
                      <span className="text-sm font-bold text-foreground flex-1 min-w-0 truncate">{p.title}</span>
                      {(p.completed || act)
                        ? <CheckCircle2 className="w-5 h-5 text-[#00d084]" />
                        : <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: info.color + '22', color: info.color }}>Ver</span>}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      <span className="font-semibold">Planejado:</span> {info.label}{p.planned_duration_min ? ` · ${fmtDur(p.planned_duration_min)}` : ''}{p.planned_tss ? ` · ${p.planned_tss} TSS` : ''}
                    </p>
                    {act && (
                      <p className="text-[11px] mt-0.5 font-semibold" style={{ color: '#00d084' }}>Realizado: {realizedLine(act)} <span className="opacity-70 font-normal">· toque p/ detalhes</span></p>
                    )}
                    {p.structure && p.structure.length > 0 && (
                      <div className="mt-2"><StructureBar structure={p.structure} height={12} /></div>
                    )}
                  </button>
                )
              })}
              {sel.extras.map(a => {
                const info = sportInfo(a.sport)
                return (
                  <button key={a.id} onClick={() => setDetailActivity(a)} className="w-full text-left rounded-2xl p-4"
                    style={{ background: 'var(--card)', border: '1px solid var(--border)', borderLeftWidth: 4, borderLeftColor: '#00d084' }}>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: '#00d084' }} />
                      <span className="text-sm font-bold text-foreground flex-1 min-w-0 truncate">{a.name ?? info.label}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: '#00d08422', color: '#00d084' }}>Realizado</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">{realizedLine(a)}</p>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {detail && (
          <WorkoutDetailModal workout={detail} onClose={() => setDetail(null)}
            onComplete={(rpe, notes) => completeWorkout(detail, rpe, notes)}
            onReopen={() => toggleDone(detail)} />
        )}
        {detailActivity && <ActivityDetailModal activity={detailActivity} onClose={() => setDetailActivity(null)} />}
      </div>
    )
  }

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
          {!readOnly && library.length > 0 && (
            <button onClick={() => setShowLib(v => !v)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
              style={showLib ? { background: '#7c3aed', color: '#fff' } : { background: 'var(--secondary)', color: 'var(--foreground)' }}>
              <GripVertical className="w-3.5 h-3.5" /> Arrastar treino
            </button>
          )}
          {!readOnly && (
            <button onClick={() => setShowPlan(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary/90">
              <Sparkles className="w-3.5 h-3.5" /> Aplicar plano
            </button>
          )}
        </div>
      </div>

      {/* Rail de treinos para arrastar até um dia (modelo TrainingPeaks/Garmin) */}
      {!readOnly && showLib && library.length > 0 && (
        <div className="rounded-xl p-3" style={{ background: 'var(--sidebar)', border: '1px solid var(--panel-border)' }}>
          <p className="text-[11px] text-muted-foreground mb-2">Arraste um treino para um dia do calendário para programá-lo.</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {library.map(w => {
              const info = sportInfo(w.sport)
              return (
                <div key={w.id} draggable
                  onDragStart={() => setDragLib(w)}
                  onDragEnd={() => { setDragLib(null); setDragOverDay(null) }}
                  className="flex-shrink-0 cursor-grab active:cursor-grabbing rounded-lg px-3 py-2 select-none"
                  style={{ background: info.color + '14', borderLeft: `3px solid ${info.color}`, minWidth: 160 }}>
                  <div className="flex items-center gap-1.5">
                    <GripVertical className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <info.icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: info.color }} />
                    <span className="text-xs font-bold text-foreground truncate">{w.title}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5 pl-5">{info.label}{w.duration_min ? ` · ${fmtDur(w.duration_min)}` : ''}{w.tss ? ` · ${w.tss} TSS` : ''}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

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
              <div key={key} {...dropProps(key)} className="rounded-xl p-2 min-h-[120px] flex flex-col transition-shadow"
                style={{ background: 'var(--card)', border: `1px solid ${dragOverDay === key ? '#7c3aed' : isToday ? '#7c3aed' : 'var(--border)'}`, boxShadow: dragOverDay === key ? '0 0 0 2px #7c3aed55' : undefined }}>
                <div className="flex items-center justify-between mb-1.5 px-1">
                  <span className={`text-[11px] font-bold ${isToday ? 'text-[#7c3aed]' : 'text-muted-foreground'}`}>
                    {WEEKDAYS[(d.getDay() + 6) % 7]} {d.getDate()}
                  </span>
                  {!readOnly && <button onClick={() => setModal({ date: key })} className="p-1 rounded-md hover:bg-secondary text-muted-foreground" aria-label="Adicionar treino"><Plus className="w-3.5 h-3.5" /></button>}
                </div>

                <div className="space-y-1.5 flex-1">
                  {(() => { const { pairs, extras } = mergeDay(dayPlanned, dayDone); return <>
                  {/* Planejado (+ realizado casado) */}
                  {pairs.map(({ p, act }) => {
                    const info = sportInfo(p.sport)
                    const isDone = p.completed || !!act
                    return (
                      <button key={p.id} onClick={() => openWorkout(key, p)}
                        className="w-full text-left rounded-lg p-1.5 group"
                        style={{ background: info.color + '14', borderLeft: `3px solid ${isDone ? '#00d084' : info.color}` }}>
                        <div className="flex items-center gap-1">
                          <info.icon className="w-3 h-3 flex-shrink-0" style={{ color: info.color }} />
                          <span className="text-[11px] font-bold text-foreground truncate flex-1">{p.title}</span>
                          {isDone
                            ? <CheckCircle2 className="w-3.5 h-3.5 text-[#00d084] flex-shrink-0" onClick={e => { e.stopPropagation(); if (act) setDetailActivity(act); else if (readOnly) setDetail(p); else toggleDone(p) }} />
                            : <Circle className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" onClick={e => { e.stopPropagation(); if (readOnly) setDetail(p); else toggleDone(p) }} />}
                        </div>
                        {(p.planned_duration_min || p.planned_tss) && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">{[fmtDur(p.planned_duration_min), p.planned_tss ? `${p.planned_tss} TSS` : null].filter(Boolean).join(' · ')}</p>
                        )}
                        {act && (
                          <span onClick={e => { e.stopPropagation(); setDetailActivity(act) }} className="text-[10px] mt-0.5 font-semibold flex items-center gap-1" style={{ color: '#00d084' }}><CheckCircle2 className="w-2.5 h-2.5" /> {realizedLine(act)}</span>
                        )}
                        {p.structure && p.structure.length > 0 && <div className="mt-1"><StructureBar structure={p.structure} height={6} /></div>}
                        {p.description && !(p.structure && p.structure.length) && <p className="text-[10px] text-muted-foreground/80 mt-0.5 line-clamp-2">{p.description}</p>}
                      </button>
                    )
                  })}

                  {/* Realizados sem plano (clicáveis) */}
                  {extras.map(a => {
                    const info = sportInfo(a.sport)
                    return (
                      <button key={a.id} onClick={() => setDetailActivity(a)} className="w-full text-left rounded-lg p-1.5 flex items-center gap-1" style={{ background: 'var(--panel)', border: '1px dashed var(--panel-border)' }}>
                        <CheckCircle2 className="w-3 h-3 flex-shrink-0" style={{ color: info.color }} />
                        <span className="text-[10px] text-foreground truncate flex-1">{a.name ?? info.label}</span>
                        {a.tss != null && <span className="text-[9px] font-bold text-[#00d084]">{a.tss.toFixed(0)}</span>}
                      </button>
                    )
                  })}
                  </> })()}

                  {dayPlanned.length === 0 && dayDone.length === 0 && !readOnly && (
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
          {/* auto-rows-fr + altura por viewport: as semanas dividem a altura da
              tela e a grade cresce quando você maximiza a janela */}
          <div className="grid grid-cols-7 auto-rows-fr gap-1 min-h-[calc(100dvh-22rem)]">
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
                <div key={key} {...dropProps(key)} onClick={() => { if (!readOnly) setModal({ date: key }) }}
                  className={`rounded-lg p-1.5 min-h-[84px] flex flex-col transition-colors hover:border-primary/40 ${readOnly ? '' : 'cursor-pointer'}`}
                  style={{ background: 'var(--card)', border: `1px solid ${dragOverDay === key ? '#7c3aed' : isToday ? '#7c3aed' : 'var(--border)'}`, boxShadow: dragOverDay === key ? '0 0 0 2px #7c3aed55' : undefined, opacity: inMonth ? 1 : 0.45 }}>
                  <span className={`text-[11px] font-bold px-0.5 ${isToday ? 'text-[#7c3aed]' : 'text-muted-foreground'}`}>{d.getDate()}</span>
                  <div className="space-y-1 mt-1 flex-1 overflow-hidden">
                    {items.slice(0, 6).map((it) => {
                      if (it.kind === 'p') {
                        const info = sportInfo(it.p.sport)
                        return (
                          <button key={'p' + it.p.id} onClick={e => { e.stopPropagation(); openWorkout(key, it.p) }}
                            className="w-full text-left rounded-md px-1.5 py-1 truncate text-[11px] font-semibold flex items-center gap-1"
                            style={{ background: info.color + '22', color: info.color }}>
                            <info.icon className="w-3 h-3 flex-shrink-0" />
                            {it.p.completed && <CheckCircle2 className="w-3 h-3 flex-shrink-0" />}
                            <span className="truncate flex-1">{it.p.title}</span>
                            {(it.p.planned_tss || it.p.planned_duration_min) && (
                              <span className="text-[10px] font-bold opacity-80 flex-shrink-0">{it.p.planned_tss ? `${it.p.planned_tss}` : fmtDur(it.p.planned_duration_min)}</span>
                            )}
                          </button>
                        )
                      }
                      return (
                        <button key={'d' + it.a.id} onClick={e => { e.stopPropagation(); setDetailActivity(it.a) }} className="w-full text-left rounded-md px-1.5 py-1 truncate text-[11px] flex items-center gap-1" style={{ background: 'var(--panel)', color: 'var(--muted-foreground)' }}>
                          <CheckCircle2 className="w-3 h-3 flex-shrink-0 text-[#00d084]" /><span className="truncate">{it.a.name ?? sportInfo(it.a.sport).label}</span>
                        </button>
                      )
                    })}
                    {items.length > 6 && <span className="text-[10px] text-muted-foreground/70 px-1">+{items.length - 6}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {modal && !readOnly && (
        <PlannedModal
          athleteId={athleteId} date={modal.date} edit={modal.edit} defaultSport={defaultSport} library={library}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load() }}
          onDelete={modal.edit ? () => { remove(modal.edit!.id); setModal(null) } : undefined}
        />
      )}

      {detail && (
        <WorkoutDetailModal workout={detail} onClose={() => setDetail(null)}
          onComplete={(rpe, notes) => completeWorkout(detail, rpe, notes)}
          onReopen={() => toggleDone(detail)} />
      )}

      {detailActivity && <ActivityDetailModal activity={detailActivity} onClose={() => setDetailActivity(null)} />}

      {showPlan && (
        <ApplyPlanModal athleteId={athleteId} defaultSport={defaultSport}
          onClose={() => setShowPlan(false)}
          onApplied={() => { setShowPlan(false); load() }} />
      )}
    </div>
  )
}

// Distribuição de minutos por zona (FC ou potência)
function ZoneBar({ label, minutes }: { label: string; minutes: number[] }) {
  const total = minutes.reduce((s, v) => s + v, 0)
  if (total <= 0) return null
  return (
    <div>
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      <div className="flex h-3.5 rounded overflow-hidden">
        {minutes.map((m, i) => m > 0 ? <div key={i} title={`Z${i + 1}: ${m} min`} style={{ width: `${(m / total) * 100}%`, background: ZONE_COLORS[i] }} /> : null)}
      </div>
      <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 mt-1">
        {minutes.map((m, i) => m > 0 ? <span key={i} className="text-[9px] text-muted-foreground flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ background: ZONE_COLORS[i] }} />Z{i + 1} {m}min</span> : null)}
      </div>
    </div>
  )
}

// Detalhe do treino REALIZADO (importado): KM, FC, potência, pace, zonas...
function ActivityDetailModal({ activity: a, onClose }: { activity: ActivityRow; onClose: () => void }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  const info = sportInfo(a.sport)
  const dist = a.distance_meters ?? 0
  const pace = a.sport === 'running' && dist >= 400 ? (a.duration_seconds || 0) / (dist / 1000) : null
  const dateLabel = new Date(a.started_at).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
  const hrZones = a.hr_zone_minutes && a.hr_zone_minutes.some(m => m > 0) ? a.hr_zone_minutes
    : (a.zone_data && a.zone_data.basis === 'hr' ? a.zone_data.seconds.map(s => Math.round(s / 60)) : null)
  const pwrZones = a.pwr_zone_minutes && a.pwr_zone_minutes.some(m => m > 0) ? a.pwr_zone_minutes
    : (a.zone_data && a.zone_data.basis === 'power' ? a.zone_data.seconds.map(s => Math.round(s / 60)) : null)
  const tiles = ([
    dist > 0 ? { label: 'Distância', value: `${(dist / 1000).toFixed(2)} km` } : null,
    { label: 'Duração', value: fmtDur(Math.round((a.duration_seconds || 0) / 60)) ?? '—' },
    pace ? { label: 'Pace', value: fmtPace(pace) } : null,
    a.tss != null ? { label: 'TSS', value: a.tss.toFixed(0), hi: true } : null,
    a.intensity_factor != null ? { label: 'IF', value: a.intensity_factor.toFixed(3) } : null,
    a.avg_hr_bpm ? { label: 'FC média', value: `${a.avg_hr_bpm} bpm` } : null,
    a.max_hr_bpm ? { label: 'FC máx', value: `${a.max_hr_bpm} bpm` } : null,
    a.avg_power_watts ? { label: 'Pot. média', value: `${a.avg_power_watts} W` } : null,
    a.max_power_watts ? { label: 'Pot. máx', value: `${a.max_power_watts} W` } : null,
    a.normalized_power ? { label: 'NP', value: `${a.normalized_power} W` } : null,
    a.avg_cadence_rpm ? { label: 'Cadência', value: `${a.avg_cadence_rpm}${a.max_cadence_rpm ? ` / ${a.max_cadence_rpm}` : ''} rpm` } : null,
    a.velocity_avg_mps ? { label: 'Velocidade', value: `${(a.velocity_avg_mps * 3.6).toFixed(1)} km/h` } : null,
    a.energy_kj ? { label: 'Energia', value: `${a.energy_kj} kJ` } : null,
    a.rpe != null ? { label: 'RPE', value: `${a.rpe}` } : null,
  ].filter(Boolean) as { label: string; value: string; hi?: boolean }[])
  if (!mounted) return null
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-border" style={{ borderTop: `3px solid ${info.color}` }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded" style={{ background: info.color + '22', color: info.color }}>{info.label} · realizado</span>
              <h2 className="text-lg font-black text-foreground mt-2 leading-tight">{a.name ?? info.label}</h2>
              <p className="text-xs text-muted-foreground capitalize mt-0.5">{dateLabel}</p>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground flex-shrink-0"><X className="w-5 h-5" /></button>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {tiles.map(t => (
              <div key={t.label} className="rounded-lg px-3 py-2" style={{ background: 'var(--panel)', border: '1px solid var(--panel-border)' }}>
                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">{t.label}</p>
                <p className={`text-sm font-bold mt-0.5 ${t.hi ? 'text-[#ffa800]' : 'text-foreground'}`}>{t.value}</p>
              </div>
            ))}
          </div>
          {hrZones && <ZoneBar label="Tempo por zona de FC" minutes={hrZones} />}
          {pwrZones && <ZoneBar label="Tempo por zona de potência" minutes={pwrZones} />}
          {a.feeling && <p className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">Sensação:</span> {a.feeling}</p>}
          {a.athlete_comments && <p className="text-xs text-muted-foreground whitespace-pre-line"><span className="font-semibold text-foreground">Atleta:</span> {a.athlete_comments}</p>}
        </div>
      </div>
    </div>,
    document.body,
  )
}

// Detalhe do treino (visão do atleta): leitura + concluir com check-in simples
function WorkoutDetailModal({ workout, onClose, onComplete, onReopen }: {
  workout: PlannedWorkoutRow; onClose: () => void
  onComplete: (rpe: number, notes: string) => Promise<void>; onReopen: () => void
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  const [rpe, setRpe] = useState(6)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  async function finish() {
    setSaving(true)
    await onComplete(rpe, notes)
    setSaving(false)
    onClose()
  }
  const rpeColor = rpe <= 3 ? '#4ade80' : rpe <= 6 ? '#fbbf24' : rpe <= 8 ? '#ff8c00' : '#ef4444'
  const info = sportInfo(workout.sport)
  const dateLabel = new Date(workout.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
  if (!mounted) return null
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-border" style={{ borderTop: `3px solid ${info.color}` }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded" style={{ background: info.color + '22', color: info.color }}>{info.label}</span>
              <h2 className="text-lg font-black text-foreground mt-2 leading-tight">{workout.title}</h2>
              <p className="text-xs text-muted-foreground capitalize mt-0.5">{dateLabel}</p>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground flex-shrink-0"><X className="w-5 h-5" /></button>
          </div>
          <div className="flex gap-2 mt-3">
            {workout.planned_duration_min ? <span className="text-[11px] font-bold px-2 py-1 rounded-lg" style={{ background: 'var(--panel)', color: 'var(--muted-foreground)' }}>{fmtDur(workout.planned_duration_min)}</span> : null}
            {workout.planned_tss ? <span className="text-[11px] font-bold px-2 py-1 rounded-lg" style={{ background: '#0088ff18', color: '#0088ff' }}>{workout.planned_tss} TSS</span> : null}
          </div>
        </div>
        <div className="p-5 space-y-4">
          {workout.structure && workout.structure.length > 0 && (
            <div>
              <p className="text-[11px] font-black text-muted-foreground uppercase tracking-wider mb-2">Estrutura</p>
              <StructureBar structure={workout.structure} height={14} />
              <p className="text-xs text-muted-foreground mt-2">{structureSummary(workout.structure)}</p>
            </div>
          )}
          {workout.description && (
            <div>
              <p className="text-[11px] font-black text-muted-foreground uppercase tracking-wider mb-1">Instruções</p>
              <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">{workout.description}</p>
            </div>
          )}
          {workout.completed ? (
            <div className="rounded-xl p-4 space-y-3" style={{ background: '#00d0840d', border: '1px solid #00d08433' }}>
              <p className="text-sm font-bold text-[#00d084] flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Treino concluído</p>
              <button onClick={() => { onReopen(); onClose() }}
                className="text-xs text-muted-foreground hover:text-foreground underline">Marcar como não feito</button>
            </div>
          ) : (
            <div className="rounded-xl p-4 space-y-4" style={{ background: 'var(--panel)', border: '1px solid var(--panel-border)' }}>
              <p className="text-sm font-bold text-foreground">Concluir treino</p>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-foreground">Dificuldade do treino</label>
                  <span className="text-lg font-black tabular-nums" style={{ color: rpeColor }}>{rpe}</span>
                </div>
                <input type="range" min={0} max={10} value={rpe} onChange={e => setRpe(parseInt(e.target.value))}
                  className="w-full" style={{ accentColor: rpeColor }} />
                <p className="text-[11px] text-muted-foreground mt-0.5">0 = muito leve · 10 = máximo</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">Como foi? Dores / feedback (opcional)</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                  placeholder="ex: senti o treino bom, leve incômodo no joelho direito no fim..."
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground outline-none focus:border-primary resize-none" />
              </div>
              <button onClick={finish} disabled={saving}
                className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ background: '#00d084', color: '#fff' }}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {saving ? 'Salvando...' : 'Concluir treino'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
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
