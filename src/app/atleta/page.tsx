'use client'

import { useEffect, useState, type ElementType } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  getMyAthleteId, getMyRole, getAthleteSelf, submitCheckinSelf, updatePlannedWorkout,
  type CheckinRow, type PlannedWorkoutRow,
} from '@/lib/supabase/queries'
import { setViewMode } from '@/lib/view-mode'
import { StrengthPlayer } from '@/components/athlete/strength-player'
import { StructureBar } from '@/components/athlete/structured-builder'
import { SaudeTab } from '@/components/athlete/saude-tab'
import { NutricaoTab } from '@/components/athlete/nutricao-tab'
import { ProvasTab } from '@/components/athlete/provas-tab'
import { EvolucaoTab } from '@/components/athlete/evolucao-tab'
import { CalendarioTab } from '@/components/athlete/calendario-tab'
import { structureSummary } from '@/lib/workout-structure'
import { ForcePasswordChange, mustChangePassword } from '@/components/auth/force-password-change'
import { Activity, Loader2, CheckCircle2, Dumbbell, LogOut, CalendarDays, ShieldCheck, Heart, Utensils, Trophy, Target, UserRound, Save } from 'lucide-react'

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
type AthleteProfile = {
  weight_kg: number | null; height_cm: number | null; gender: 'M' | 'F' | 'other' | null
  ftp_watts: number | null; ftp_run_watts: number | null
  lthr_bpm: number | null; lthr_bike_bpm: number | null; lthr_run_bpm: number | null; lthr_swim_bpm: number | null
  vo2max_ml_kg_min: number | null
}
type AtletaTab = 'calendario' | 'inicio' | 'saude' | 'nutricao' | 'provas' | 'evolucao' | 'dados'

export default function AtletaPage() {
  const sb = createClient()
  const [athleteId, setAthleteId] = useState<string | null>(null)
  const [data, setData] = useState<SelfData | null>(null)
  const [profile, setProfile] = useState<AthleteProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [needsPassword, setNeedsPassword] = useState(false)
  const [canCoach, setCanCoach] = useState(false)
  const [tab, setTab] = useState<AtletaTab>('calendario')

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
      // conta dupla (treinador que também é atleta): habilita voltar ao painel
      getMyRole().then(r => setCanCoach(r === 'coach' || r === 'admin')).catch(() => {})
      const { data: prof } = await sb.from('athletes')
        .select('weight_kg, height_cm, gender, ftp_watts, ftp_run_watts, lthr_bpm, lthr_bike_bpm, lthr_run_bpm, lthr_swim_bpm, vo2max_ml_kg_min')
        .eq('id', id).single()
      if (prof) setProfile(prof as AthleteProfile)
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

  function switchToCoach() {
    setViewMode('coach')
    window.location.href = '/dashboard'
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

  const tabs: { key: AtletaTab; label: string; icon: ElementType }[] = [
    { key: 'calendario', label: 'Calendário', icon: CalendarDays },
    { key: 'inicio', label: 'Hoje', icon: Activity },
    { key: 'saude', label: 'Saúde', icon: Heart },
    { key: 'nutricao', label: 'Nutrição', icon: Utensils },
    { key: 'provas', label: 'Provas', icon: Trophy },
    { key: 'evolucao', label: 'Evolução', icon: Target },
    { key: 'dados', label: 'Meus dados', icon: UserRound },
  ]

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5 safe-top safe-bottom">
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
        <div className="flex items-center gap-1">
          {canCoach && (
            <button onClick={switchToCoach} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors" title="Ir para o painel do treinador">
              <ShieldCheck className="w-4 h-4" /> <span className="hidden sm:inline">Treinador</span>
            </button>
          )}
          <button onClick={logout} className="p-2 rounded-lg hover:bg-secondary transition-colors" title="Sair"><LogOut className="w-4 h-4 text-muted-foreground" /></button>
        </div>
      </div>

      {/* Navegação por abas — a ficha completa do atleta */}
      <div className="flex gap-1 p-1 rounded-xl overflow-x-auto" style={{ background: 'var(--sidebar)', border: '1px solid var(--panel-border)' }}>
        {tabs.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className="flex items-center gap-1.5 flex-1 justify-center py-2 px-3 rounded-lg text-xs font-semibold transition-all whitespace-nowrap"
            style={tab === key ? { background: '#e8001c', color: '#fff' } : { color: 'var(--muted-foreground)' }}>
            <Icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {tab === 'calendario' && athleteId && (
        <CalendarioTab athleteId={athleteId} defaultSport={a.primary_sport} readOnly />
      )}

      {tab === 'inicio' && (
      <div className="space-y-5 max-w-2xl mx-auto">
      {/* Forma atual */}
      <div className="bg-card border border-border rounded-2xl p-5 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Forma atual</p>
          <p className="text-2xl font-black" style={{ color: formColor }}>{formLabel}</p>
        </div>
        <Activity className="w-8 h-8" style={{ color: formColor }} />
      </div>

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
      </div>
      )}

      {tab === 'saude' && athleteId && <SaudeTab athleteId={athleteId} sex={profile?.gender === 'M' || profile?.gender === 'F' ? profile.gender : null} />}
      {tab === 'nutricao' && athleteId && <NutricaoTab athleteId={athleteId} />}
      {tab === 'provas' && athleteId && <ProvasTab athleteId={athleteId} />}
      {tab === 'evolucao' && athleteId && <EvolucaoTab athleteId={athleteId} />}
      {tab === 'dados' && athleteId && (
        <MyDataForm athleteId={athleteId} profile={profile} onSaved={p => setProfile(p)} />
      )}

      <p className="text-center text-[10px] text-muted-foreground/60 pt-2">Saab Sports Performance Platform</p>
    </div>
  )
}

// Meus dados — o atleta edita os próprios números físicos
function MyDataForm({ athleteId, profile, onSaved }: {
  athleteId: string; profile: AthleteProfile | null; onSaved: (p: AthleteProfile) => void
}) {
  const sb = createClient()
  const [v, setV] = useState({
    weight_kg: profile?.weight_kg?.toString() ?? '',
    height_cm: profile?.height_cm?.toString() ?? '',
    ftp_watts: profile?.ftp_watts?.toString() ?? '',
    ftp_run_watts: profile?.ftp_run_watts?.toString() ?? '',
    lthr_bpm: profile?.lthr_bpm?.toString() ?? '',
    lthr_bike_bpm: profile?.lthr_bike_bpm?.toString() ?? '',
    lthr_run_bpm: profile?.lthr_run_bpm?.toString() ?? '',
    lthr_swim_bpm: profile?.lthr_swim_bpm?.toString() ?? '',
    vo2max_ml_kg_min: profile?.vo2max_ml_kg_min?.toString() ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const num = (s: string) => (s.trim() === '' ? null : Number(s))
  const fields: { key: keyof typeof v; label: string; hint?: string; step?: string }[] = [
    { key: 'weight_kg', label: 'Peso (kg)', step: '0.1' },
    { key: 'height_cm', label: 'Altura (cm)', step: '0.1' },
    { key: 'ftp_watts', label: 'FTP Bike (W)' },
    { key: 'ftp_run_watts', label: 'FTP Corrida (W)', hint: 'Stryd' },
    { key: 'vo2max_ml_kg_min', label: 'VO2max', step: '0.1' },
    { key: 'lthr_bpm', label: 'LTHR geral (bpm)' },
    { key: 'lthr_bike_bpm', label: 'LTHR bike (bpm)' },
    { key: 'lthr_run_bpm', label: 'LTHR corrida (bpm)' },
    { key: 'lthr_swim_bpm', label: 'LTHR natação (bpm)' },
  ]

  async function save() {
    setSaving(true); setError(null); setSaved(false)
    const payload = {
      weight_kg: num(v.weight_kg), height_cm: num(v.height_cm),
      ftp_watts: num(v.ftp_watts), ftp_run_watts: num(v.ftp_run_watts),
      lthr_bpm: num(v.lthr_bpm), lthr_bike_bpm: num(v.lthr_bike_bpm),
      lthr_run_bpm: num(v.lthr_run_bpm), lthr_swim_bpm: num(v.lthr_swim_bpm),
      vo2max_ml_kg_min: num(v.vo2max_ml_kg_min),
    }
    const { error } = await sb.from('athletes').update(payload).eq('id', athleteId)
    setSaving(false)
    if (error) { setError(error.message); return }
    setSaved(true); setTimeout(() => setSaved(false), 2500)
    onSaved({ ...(profile ?? { gender: null }), ...payload } as AthleteProfile)
  }

  const inputCls = 'w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary'

  return (
    <div className="bg-card border border-border rounded-2xl p-5 max-w-2xl">
      <h2 className="text-sm font-bold text-foreground mb-1">Meus dados físicos</h2>
      <p className="text-xs text-muted-foreground mb-4">Mantenha seus números atualizados — eles deixam os cálculos de treino mais precisos para você e seu treinador.</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {fields.map(f => (
          <div key={f.key}>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">{f.label}{f.hint && <span className="text-muted-foreground/50"> · {f.hint}</span>}</label>
            <input type="number" step={f.step ?? '1'} value={v[f.key]}
              onChange={e => setV(prev => ({ ...prev, [f.key]: e.target.value }))}
              className={inputCls} />
          </div>
        ))}
      </div>
      {error && <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2 mt-3">{error}</p>}
      <button onClick={save} disabled={saving}
        className="mt-4 flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-60 text-white text-sm font-bold rounded-lg transition-colors">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
        {saved ? 'Salvo!' : saving ? 'Salvando...' : 'Salvar meus dados'}
      </button>
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
