'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  getMyAthleteId, getAthleteSelf, submitCheckinSelf, updatePlannedWorkout,
  type CheckinRow, type PlannedWorkoutRow,
} from '@/lib/supabase/queries'
import { StrengthPlayer } from '@/components/athlete/strength-player'
import { StructureBar } from '@/components/athlete/structured-builder'
import { structureSummary } from '@/lib/workout-structure'
import { ForcePasswordChange, mustChangePassword } from '@/components/auth/force-password-change'
import { Activity, Loader2, CheckCircle2, Dumbbell, LogOut, CalendarDays } from 'lucide-react'

function sportLabel(s: string) {
  const map: Record<string, string> = { running: 'Corrida', cycling: 'Ciclismo', triathlon: 'Triathlon', swimming: 'Natação', duathlon: 'Duathlon', other: 'Outro' }
  return map[s] ?? s
}
function fmtDate(d: string) {
  return new Date(d + (d.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('pt-BR')
}
function fmtDuration(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m}min`
}

function ScaleInput({ label, value, onChange, hint, invert }: {
  label: string; value: number; onChange: (v: number) => void; hint?: string; invert?: boolean
}) {
  const good = invert ? value <= 3 : value >= 7
  const bad = invert ? value >= 7 : value <= 3
  const color = good ? '#4ade80' : bad ? '#ef4444' : '#fbbf24'
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-sm font-medium text-foreground">{label}</label>
        <span className="text-lg font-black tabular-nums" style={{ color }}>{value}</span>
      </div>
      <input type="range" min={0} max={10} value={value} onChange={e => onChange(parseInt(e.target.value))}
        className="w-full" style={{ accentColor: color }} />
      {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  )
}

type SelfData = Awaited<ReturnType<typeof getAthleteSelf>>

export default function AtletaPage() {
  const sb = createClient()
  const [athleteId, setAthleteId] = useState<string | null>(null)
  const [data, setData] = useState<SelfData | null>(null)
  const [loading, setLoading] = useState(true)
  const [needsPassword, setNeedsPassword] = useState(false)

  // check-in
  const [rpe, setRpe] = useState(5)
  const [soreness, setSoreness] = useState(3)
  const [sleepQ, setSleepQ] = useState(7)
  const [mood, setMood] = useState(7)
  const [painLoc, setPainLoc] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    (async () => {
      const { data: sess } = await sb.auth.getSession()
      if (!sess.session) { window.location.href = '/login'; return }
      // primeiro acesso: troca de senha obrigatória
      if (mustChangePassword(sess.session.user)) { setNeedsPassword(true); setLoading(false); return }
      const id = await getMyAthleteId()
      if (!id) { window.location.href = '/dashboard'; return }
      setAthleteId(id)
      setData(await getAthleteSelf(id))
      setLoading(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function reload() {
    if (athleteId) setData(await getAthleteSelf(athleteId))
  }

  async function submitCheckin() {
    if (!athleteId) return
    setSubmitting(true)
    const ok = await submitCheckinSelf(athleteId, { rpe, soreness, sleep_quality: sleepQ, mood, pain_location: painLoc || null, notes: notes || null })
    setSubmitting(false)
    if (ok) { setSubmitted(true); setPainLoc(''); setNotes(''); reload(); setTimeout(() => setSubmitted(false), 2500) }
  }

  async function logout() {
    await sb.auth.signOut()
    window.location.href = '/login'
  }

  if (needsPassword) {
    return <ForcePasswordChange onDone={() => window.location.reload()} />
  }
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center gap-2 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /> <span className="text-sm">Carregando...</span></div>
  }
  if (!data?.summary) {
    return <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <Dumbbell className="w-10 h-10 text-muted-foreground/40 mb-3" />
      <p className="text-sm font-semibold text-foreground">Conta ainda não vinculada</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-xs">Peça o código de acesso ao seu treinador e refaça o vínculo no login.</p>
      <button onClick={logout} className="mt-4 text-xs text-primary underline">Sair</button>
    </div>
  }

  const a = data.summary
  const tsb = a.tsb ?? null
  const formColor = tsb == null ? '#888' : tsb >= 5 ? '#4ade80' : tsb >= -10 ? '#fbbf24' : '#ef4444'
  const formLabel = tsb == null ? '—' : tsb >= 5 ? 'Descansado' : tsb >= -10 ? 'Equilibrado' : 'Fadigado'

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-5 safe-top safe-bottom">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-black" style={{ background: '#e8001c22', border: '1.5px solid #e8001c55', color: '#e8001c' }}>
            {a.full_name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-base font-black text-foreground leading-tight">{a.full_name}</p>
              <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded" style={{ background: '#e8001c22', color: '#e8001c' }}>Atleta</span>
            </div>
            <p className="text-xs text-muted-foreground">{sportLabel(a.primary_sport)} · Meu treino</p>
          </div>
        </div>
        <button onClick={logout} className="p-2 rounded-lg hover:bg-secondary transition-colors" title="Sair"><LogOut className="w-4 h-4 text-muted-foreground" /></button>
      </div>

      {/* Forma atual */}
      <div className="bg-card border border-border rounded-2xl p-5 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Forma atual</p>
          <p className="text-2xl font-black" style={{ color: formColor }}>{formLabel}</p>
        </div>
        <Activity className="w-8 h-8" style={{ color: formColor }} />
      </div>

      {/* Próximos treinos programados */}
      {athleteId && data.plannedWorkouts && data.plannedWorkouts.length > 0 && (
        <UpcomingWorkouts workouts={data.plannedWorkouts} onChanged={reload} />
      )}

      {/* Check-in */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h2 className="text-sm font-bold text-foreground mb-1">Como você está hoje?</h2>
        <p className="text-xs text-muted-foreground mb-4">Seu check-in ajuda o treinador a ajustar seus treinos.</p>
        <div className="space-y-4">
          <ScaleInput label="Esforço do último treino (RPE)" value={rpe} onChange={setRpe} hint="0 = muito leve · 10 = máximo" invert />
          <ScaleInput label="Dor muscular" value={soreness} onChange={setSoreness} hint="0 = nenhuma · 10 = muito dolorido" invert />
          <ScaleInput label="Qualidade do sono" value={sleepQ} onChange={setSleepQ} hint="0 = péssimo · 10 = excelente" />
          <ScaleInput label="Humor / energia" value={mood} onChange={setMood} hint="0 = exausto · 10 = ótimo" />
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Local de dor (opcional)</label>
            <input value={painLoc} onChange={e => setPainLoc(e.target.value)} placeholder="ex: joelho direito, lombar"
              className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground outline-none focus:border-primary" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Observações (opcional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Como se sentiu, algo diferente..."
              className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground outline-none focus:border-primary resize-none" />
          </div>
          <button onClick={submitCheckin} disabled={submitting}
            className="w-full py-3 bg-primary text-white text-sm font-bold rounded-xl disabled:opacity-60 flex items-center justify-center gap-2">
            {submitted ? <><CheckCircle2 className="w-4 h-4" /> Check-in enviado!</> : submitting ? 'Enviando...' : 'Enviar check-in de hoje'}
          </button>
        </div>
      </div>

      {/* Treino de força */}
      {athleteId && data.program && (
        <StrengthPlayer athleteId={athleteId} program={data.program} logs={data.strengthLogs} onLogged={reload} />
      )}

      {/* Treinos recentes */}
      {data.activities.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <h2 className="text-sm font-bold text-foreground mb-3">Treinos recentes</h2>
          <div className="space-y-2">
            {data.activities.map((act, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <Dumbbell className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{act.name ?? sportLabel(act.sport)}</p>
                  <p className="text-[10px] text-muted-foreground">{fmtDate(act.started_at.slice(0, 10))} · {fmtDuration(act.duration_seconds)}{act.distance_meters ? ` · ${(act.distance_meters / 1000).toFixed(1)}km` : ''}</p>
                </div>
                {act.tss != null && <span className="text-xs font-bold text-[#ffa800]">{act.tss.toFixed(0)} TSS</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Check-ins */}
      {data.checkins.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <h2 className="text-sm font-bold text-foreground mb-3">Seus check-ins</h2>
          <div className="space-y-2">
            {data.checkins.slice(0, 7).map((c: CheckinRow, i) => (
              <div key={i} className="flex items-center gap-2 text-xs py-1.5 border-b border-border/30 last:border-0">
                <span className="text-muted-foreground w-16 flex-shrink-0">{fmtDate(c.checkin_date)}</span>
                <span className="flex gap-2 flex-wrap flex-1">
                  {c.rpe != null && <span className="text-muted-foreground">RPE {c.rpe}</span>}
                  {c.soreness != null && <span className="text-muted-foreground">Dor {c.soreness}</span>}
                  {c.sleep_quality != null && <span className="text-muted-foreground">Sono {c.sleep_quality}</span>}
                  {c.mood != null && <span className="text-muted-foreground">Humor {c.mood}</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-center text-[10px] text-muted-foreground/60 pt-2">Saab Sports Performance Platform</p>
    </div>
  )
}

const PLAN_SPORT: Record<string, { label: string; color: string }> = {
  running: { label: 'Corrida', color: '#ff6b00' }, cycling: { label: 'Ciclismo', color: '#0088ff' },
  swimming: { label: 'Natação', color: '#00b4d8' }, triathlon: { label: 'Triathlon', color: '#8b5cf6' },
  duathlon: { label: 'Duathlon', color: '#ffa800' }, strength: { label: 'Força', color: '#e8001c' },
  other: { label: 'Outro', color: '#64748b' },
}
function planDayLabel(d: string) {
  const today = new Date().toLocaleDateString('en-CA')
  const tomorrow = new Date(Date.now() + 86400000).toLocaleDateString('en-CA')
  if (d === today) return 'Hoje'
  if (d === tomorrow) return 'Amanhã'
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })
}

function UpcomingWorkouts({ workouts, onChanged }: { workouts: PlannedWorkoutRow[]; onChanged: () => void }) {
  async function toggle(w: PlannedWorkoutRow) {
    await updatePlannedWorkout(w.id, { completed: !w.completed }); onChanged()
  }
  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3"><CalendarDays className="w-4 h-4 text-primary" /><h2 className="text-sm font-bold text-foreground">Próximos treinos</h2></div>
      <div className="space-y-2">
        {workouts.map(w => {
          const info = PLAN_SPORT[w.sport] ?? PLAN_SPORT.other
          return (
            <div key={w.id} className="rounded-xl p-3" style={{ background: info.color + '10', borderLeft: `3px solid ${info.color}` }}>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded" style={{ background: info.color + '22', color: info.color }}>{planDayLabel(w.date)}</span>
                <span className="text-sm font-bold text-foreground flex-1 min-w-0 truncate">{w.title}</span>
                <button onClick={() => toggle(w)} aria-label="Marcar feito">
                  {w.completed ? <CheckCircle2 className="w-5 h-5 text-[#00d084]" /> : <div className="w-5 h-5 rounded-full border-2 border-border" />}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                {info.label}{w.planned_duration_min ? ` · ${w.planned_duration_min}min` : ''}{w.planned_tss ? ` · ${w.planned_tss} TSS` : ''}
              </p>
              {w.structure && w.structure.length > 0 ? (
                <div className="mt-1.5">
                  <StructureBar structure={w.structure} height={10} />
                  <p className="text-[11px] text-muted-foreground/90 mt-1">{structureSummary(w.structure)}</p>
                </div>
              ) : w.description && <p className="text-[11px] text-muted-foreground/90 mt-1 whitespace-pre-line">{w.description}</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
