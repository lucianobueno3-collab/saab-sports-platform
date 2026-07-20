'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getPlannedWorkouts, createPlannedWorkout, updatePlannedWorkout, deletePlannedWorkout,
  getActivitiesRange, type PlannedWorkoutRow, type ActivityRow,
} from '@/lib/supabase/queries'
import {
  ChevronLeft, ChevronRight, Plus, X, Loader2, Trash2, CheckCircle2, Circle,
  CalendarDays, Dumbbell, Bike, Footprints, Waves, Activity as ActIcon,
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

export function CalendarioTab({ athleteId, defaultSport = 'running' }: { athleteId: string; defaultSport?: string }) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [planned, setPlanned] = useState<PlannedWorkoutRow[]>([])
  const [done, setDone] = useState<ActivityRow[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ date: string; edit?: PlannedWorkoutRow } | null>(null)

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const todayKey = ymd(new Date())

  const load = useCallback(async () => {
    setLoading(true)
    const from = ymd(weekStart), to = ymd(addDays(weekStart, 6))
    const fromISO = new Date(weekStart).toISOString()
    const toISO = new Date(addDays(weekStart, 7)).toISOString()
    const [p, a] = await Promise.all([
      getPlannedWorkouts(athleteId, from, to),
      getActivitiesRange(athleteId, fromISO, toISO),
    ])
    setPlanned(p); setDone(a); setLoading(false)
  }, [athleteId, weekStart])

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

  return (
    <div className="space-y-4">
      {/* Barra de navegação + resumo */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekStart(w => addDays(w, -7))} className="p-2 rounded-lg bg-secondary text-muted-foreground hover:bg-secondary/70"><ChevronLeft className="w-4 h-4" /></button>
          <button onClick={() => setWeekStart(startOfWeek(new Date()))} className="px-3 py-2 rounded-lg bg-secondary text-xs font-bold text-foreground">Hoje</button>
          <button onClick={() => setWeekStart(w => addDays(w, 7))} className="p-2 rounded-lg bg-secondary text-muted-foreground hover:bg-secondary/70"><ChevronRight className="w-4 h-4" /></button>
          <div className="flex items-center gap-1.5 ml-1 text-sm font-bold text-foreground"><CalendarDays className="w-4 h-4 text-primary" />{weekLabel}</div>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="px-2.5 py-1 rounded-lg font-bold" style={{ background: '#0088ff18', color: '#0088ff' }}>Planejado {plannedTss} TSS</span>
          <span className="px-2.5 py-1 rounded-lg font-bold" style={{ background: '#00d08418', color: '#00d084' }}>Realizado {doneTss.toFixed(0)} TSS</span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : (
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
                        {p.description && <p className="text-[10px] text-muted-foreground/80 mt-0.5 line-clamp-2">{p.description}</p>}
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
      )}

      {modal && (
        <PlannedModal
          athleteId={athleteId} date={modal.date} edit={modal.edit} defaultSport={defaultSport}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load() }}
          onDelete={modal.edit ? () => { remove(modal.edit!.id); setModal(null) } : undefined}
        />
      )}
    </div>
  )
}

function PlannedModal({ athleteId, date, edit, defaultSport, onClose, onSaved, onDelete }: {
  athleteId: string; date: string; edit?: PlannedWorkoutRow; defaultSport: string
  onClose: () => void; onSaved: () => void; onDelete?: () => void
}) {
  const [sport, setSport] = useState(edit?.sport ?? defaultSport)
  const [title, setTitle] = useState(edit?.title ?? '')
  const [dur, setDur] = useState(edit?.planned_duration_min?.toString() ?? '')
  const [tss, setTss] = useState(edit?.planned_tss?.toString() ?? '')
  const [desc, setDesc] = useState(edit?.description ?? '')
  const [saving, setSaving] = useState(false)

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const payload = {
      athlete_id: athleteId, date, sport, title: title.trim(),
      description: desc.trim() || null,
      planned_duration_min: dur ? parseInt(dur) : null,
      planned_tss: tss ? parseInt(tss) : null,
    }
    const ok = edit ? await updatePlannedWorkout(edit.id, payload) : await createPlannedWorkout(payload)
    setSaving(false)
    if (ok) onSaved()
  }

  const cls = 'w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary'
  const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card">
          <div>
            <h2 className="text-sm font-bold text-foreground">{edit ? 'Editar treino' : 'Novo treino'}</h2>
            <p className="text-[11px] text-muted-foreground capitalize">{dateLabel}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={save} className="p-6 space-y-4">
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
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Título *</label>
            <input required value={title} onChange={e => setTitle(e.target.value)} placeholder="ex: Intervalado 4x1km Z4" className={cls} />
          </div>
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
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Descrição / estrutura</label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3} placeholder="ex: 15min aquec Z2 · 4x1km Z4 (rec 2min) · 10min solto Z1" className={cls + ' resize-none'} />
          </div>

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
    </div>
  )
}
