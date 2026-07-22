'use client'

import { useEffect, useState, type ElementType } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  getMyAthleteId, getMyRole, getAthleteSelf, updatePlannedWorkout, uploadAvatar,
  type CheckinRow, type PlannedWorkoutRow,
} from '@/lib/supabase/queries'
import { setViewMode } from '@/lib/view-mode'
import { StrengthPlayer } from '@/components/athlete/strength-player'
import { StructureBar } from '@/components/athlete/structured-builder'
import { SaudeTab } from '@/components/athlete/saude-tab'
import { NutricaoTab } from '@/components/athlete/nutricao-tab'
import { ProvasTab } from '@/components/athlete/provas-tab'
import { EvolucaoTab } from '@/components/athlete/evolucao-tab'
import { EvolutionShowcase } from '@/components/athlete/evolution-showcase'
import { CalendarioTab } from '@/components/athlete/calendario-tab'
import { structureSummary } from '@/lib/workout-structure'
import { ForcePasswordChange, mustChangePassword } from '@/components/auth/force-password-change'
import { VersionTag } from '@/components/ui/version-tag'
import { Activity, Loader2, CheckCircle2, Dumbbell, LogOut, CalendarDays, ShieldCheck, Heart, Utensils, Trophy, Target, UserRound, Save, MoreHorizontal, X, Camera } from 'lucide-react'

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


type SelfData = Awaited<ReturnType<typeof getAthleteSelf>>
type AthleteProfile = {
  weight_kg: number | null; height_cm: number | null; gender: 'M' | 'F' | 'other' | null
  ftp_watts: number | null; ftp_run_watts: number | null
  lthr_bpm: number | null; lthr_bike_bpm: number | null; lthr_run_bpm: number | null; lthr_swim_bpm: number | null
  vo2max_ml_kg_min: number | null
  avatar_url: string | null; full_name: string | null
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
  const [moreOpen, setMoreOpen] = useState(false)

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
        .select('weight_kg, height_cm, gender, ftp_watts, ftp_run_watts, lthr_bpm, lthr_bike_bpm, lthr_run_bpm, lthr_swim_bpm, vo2max_ml_kg_min, avatar_url, full_name')
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

  // Menu inferior (estilo TrainingPeaks): 4 principais + "Mais"
  type TabDef = { key: AtletaTab; label: string; icon: ElementType }
  const primaryTabs: TabDef[] = [
    { key: 'calendario', label: 'Calendário', icon: CalendarDays },
    { key: 'inicio', label: 'Hoje', icon: Activity },
    { key: 'saude', label: 'Saúde', icon: Heart },
    { key: 'evolucao', label: 'Evolução', icon: Target },
  ]
  const moreTabs: TabDef[] = [
    { key: 'nutricao', label: 'Nutrição', icon: Utensils },
    { key: 'provas', label: 'Provas', icon: Trophy },
    { key: 'dados', label: 'Meus dados', icon: UserRound },
  ]
  const moreActive = moreTabs.some(t => t.key === tab)
  function go(k: AtletaTab) { setTab(k); setMoreOpen(false) }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 pb-28 space-y-5 safe-top">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => go('dados')} className="w-11 h-11 rounded-full overflow-hidden flex items-center justify-center text-sm font-black flex-shrink-0" style={{ background: '#e8001c22', border: '1.5px solid #e8001c55', color: '#e8001c' }} title="Editar meus dados">
            {profile?.avatar_url
              ? <img src={profile.avatar_url} alt={a.full_name} className="w-full h-full object-cover" />
              : (profile?.full_name ?? a.full_name).split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()}
          </button>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-base font-black text-foreground leading-tight">{profile?.full_name ?? a.full_name}</p>
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

      {/* O check-in agora é feito ao concluir cada treino no Calendário
          (dificuldade + relato), então não fica mais aqui. */}

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
      {tab === 'evolucao' && athleteId && (
        <div className="space-y-6">
          <EvolutionShowcase athleteId={athleteId} athleteName={profile?.full_name ?? a.full_name} />
          <EvolucaoTab athleteId={athleteId} />
        </div>
      )}
      {tab === 'dados' && athleteId && (
        <MyDataForm athleteId={athleteId} profile={profile} onSaved={p => setProfile(p)} />
      )}

      <div className="text-center pt-2 space-y-0.5">
        <p className="text-[10px] text-muted-foreground/60">Saab Sports Performance Platform</p>
        <VersionTag className="text-[10px] text-muted-foreground/50" />
      </div>

      {/* Folha "Mais" (abas secundárias) */}
      {moreOpen && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/50" onClick={() => setMoreOpen(false)} />
          <div className="fixed left-0 right-0 bottom-0 z-[61] bg-card border-t border-border rounded-t-2xl p-3 safe-bottom">
            <div className="flex items-center justify-between px-2 pb-2">
              <p className="text-sm font-bold text-foreground">Mais</p>
              <button onClick={() => setMoreOpen(false)} className="p-1.5 rounded-lg hover:bg-secondary"><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>
            {moreTabs.map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => go(key)}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-foreground hover:bg-secondary transition-colors"
                style={tab === key ? { background: 'var(--secondary)' } : undefined}>
                <Icon className="w-4 h-4 text-muted-foreground" /> {label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Menu inferior fixo (estilo TrainingPeaks) */}
      <nav className="fixed left-0 right-0 bottom-0 z-40 bg-card/95 backdrop-blur border-t border-border safe-bottom">
        <div className="max-w-5xl mx-auto flex items-stretch">
          {primaryTabs.map(({ key, label, icon: Icon }) => {
            const active = tab === key
            return (
              <button key={key} onClick={() => go(key)}
                className="flex-1 flex flex-col items-center gap-0.5 py-2 transition-colors"
                style={{ color: active ? '#e8001c' : 'var(--muted-foreground)' }}>
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-semibold">{label}</span>
              </button>
            )
          })}
          <button onClick={() => setMoreOpen(true)}
            className="flex-1 flex flex-col items-center gap-0.5 py-2 transition-colors"
            style={{ color: moreActive ? '#e8001c' : 'var(--muted-foreground)' }}>
            <MoreHorizontal className="w-5 h-5" />
            <span className="text-[10px] font-semibold">Mais</span>
          </button>
        </div>
      </nav>
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

  // Foto + nome
  const [name, setName] = useState(profile?.full_name ?? '')
  const [avatar, setAvatar] = useState(profile?.avatar_url ?? null)
  const [uploading, setUploading] = useState(false)
  const [savingName, setSavingName] = useState(false)

  async function changePhoto(file: File) {
    setUploading(true); setError(null)
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { setUploading(false); setError('Sessão expirada.'); return }
    const up = await uploadAvatar(user.id, file)
    if (!up.ok || !up.url) { setUploading(false); setError(up.error ?? 'Falha ao enviar a foto.'); return }
    const { error } = await sb.from('athletes').update({ avatar_url: up.url }).eq('id', athleteId)
    setUploading(false)
    if (error) { setError(error.message); return }
    setAvatar(up.url)
    onSaved({ ...(profile ?? {}), avatar_url: up.url } as AthleteProfile)
  }

  async function saveName() {
    if (!name.trim()) return
    setSavingName(true); setError(null)
    const { error } = await sb.from('athletes').update({ full_name: name.trim() }).eq('id', athleteId)
    setSavingName(false)
    if (error) { setError(error.message); return }
    onSaved({ ...(profile ?? {}), full_name: name.trim() } as AthleteProfile)
  }

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
    <div className="space-y-5 max-w-2xl">
    {/* Foto + nome */}
    <div className="bg-card border border-border rounded-2xl p-5">
      <h2 className="text-sm font-bold text-foreground mb-4">Foto e nome</h2>
      <div className="flex items-center gap-4">
        <label className="relative w-20 h-20 rounded-full overflow-hidden flex items-center justify-center text-lg font-black cursor-pointer flex-shrink-0"
          style={{ background: '#e8001c22', border: '1.5px solid #e8001c55', color: '#e8001c' }} title="Trocar foto">
          {avatar
            ? <img src={avatar} alt="" className="w-full h-full object-cover" />
            : (name || '?').split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()}
          <span className="absolute inset-x-0 bottom-0 h-6 flex items-center justify-center" style={{ background: '#00000066' }}>
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-white" /> : <Camera className="w-3.5 h-3.5 text-white" />}
          </span>
          <input type="file" accept="image/*" className="hidden" disabled={uploading}
            onChange={e => { const f = e.target.files?.[0]; if (f) changePhoto(f) }} />
        </label>
        <div className="flex-1 min-w-0">
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Nome</label>
          <div className="flex gap-2">
            <input value={name} onChange={e => setName(e.target.value)} className={inputCls} />
            <button onClick={saveName} disabled={savingName || !name.trim()}
              className="px-4 rounded-lg bg-secondary text-foreground text-xs font-bold disabled:opacity-50 flex items-center gap-1.5 flex-shrink-0">
              {savingName ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Salvar
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5">Toque na foto para trocar (JPG/PNG).</p>
        </div>
      </div>
    </div>

    <div className="bg-card border border-border rounded-2xl p-5">
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
