'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  getEnrollments, updateEnrollment, markEnrollmentPlanApplied,
  bulkCreatePlannedWorkouts, type EnrollmentRow, type PlannedWorkoutInput,
} from '@/lib/supabase/queries'
import { PLAN_LIBRARY, generatePlan } from '@/lib/training-plans'
import { ClipboardList, Loader2, Check, X, CalendarDays, Footprints, ExternalLink, Sparkles } from 'lucide-react'

const RED = '#e8001c'
const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

const LBL_RUN: Record<string, string> = { iniciante: 'Iniciante', intermediario: 'Intermediário', avancado: 'Avançado', competitivo: 'Competitivo' }
const LBL_DAYS: Record<string, string> = { '1_2': '1 ou 2 dias', '3': '3 dias', '4': '4 dias', '5_mais': '5+ dias' }
const LBL_DIST: Record<string, string> = { ate_15: 'até 15 km', '15_30': '15–30 km', '30_40': '30–40 km', '40_mais': '40+ km' }
const LBL_GOAL: Record<string, string> = {
  concluir_5_10k: 'Concluir de 5 a 10 km', meia_21k: 'Meia maratona (21 km)',
  maratona_42k: 'Maratona (42 km)', melhorar_ritmo: 'Melhorar o ritmo',
}
const PKG_TITLE: Record<string, string> = { primeiros_5k: 'Meus primeiros 5 km' }

// Plano padrão de cada pacote
const PKG_PLAN: Record<string, string> = { primeiros_5k: 'run_first5k_12' }

function ymd(d: Date) { return d.toLocaleDateString('en-CA') }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x }
function nextMonday() {
  const d = new Date(); const day = (d.getDay() + 6) % 7 // 0=segunda
  return addDays(d, 7 - day)
}

export default function MatriculasPage() {
  const [filter, setFilter] = useState<'pending' | 'active' | 'all'>('pending')
  const [rows, setRows] = useState<EnrollmentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [sel, setSel] = useState<EnrollmentRow | null>(null)

  async function load() {
    setLoading(true)
    const data = await getEnrollments(filter === 'all' ? undefined : filter)
    setRows(data)
    setSel(s => (s ? data.find(r => r.id === s.id) ?? null : null))
    setLoading(false)
  }
  useEffect(() => { load() /* eslint-disable-next-line */ }, [filter])

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2.5 mb-1">
        <ClipboardList className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-black text-foreground">Matrículas & Anamneses</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-5">Novos alunos que preencheram a anamnese. Revise e aplique o plano com um clique.</p>

      <div className="flex gap-1 p-1 rounded-xl bg-secondary w-fit mb-5">
        {([['pending', 'Pendentes'], ['active', 'Ativas'], ['all', 'Todas']] as const).map(([v, t]) => (
          <button key={v} onClick={() => setFilter(v)}
            className="px-4 py-1.5 rounded-lg text-xs font-bold transition-colors"
            style={filter === v ? { background: RED, color: '#fff' } : { color: 'var(--muted-foreground)' }}>{t}</button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl p-10 text-center text-muted-foreground" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          Nenhuma matrícula {filter === 'pending' ? 'pendente' : filter === 'active' ? 'ativa' : ''} no momento.
        </div>
      ) : (
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-4">
          {/* Lista */}
          <div className="space-y-2">
            {rows.map(r => (
              <button key={r.id} onClick={() => setSel(r)}
                className="w-full text-left rounded-xl p-3.5 transition-colors"
                style={{ background: 'var(--card)', border: `1px solid ${sel?.id === r.id ? RED : 'var(--border)'}` }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-foreground truncate">{r.full_name ?? 'Sem nome'}</span>
                  <StatusBadge status={r.status} />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{PKG_TITLE[r.package_key] ?? r.package_key} · {new Date(r.created_at).toLocaleDateString('pt-BR')}</p>
              </button>
            ))}
          </div>

          {/* Detalhe */}
          <div>
            {sel ? <Detail key={sel.id} enr={sel} onChanged={load} /> : (
              <div className="rounded-2xl p-10 text-center text-muted-foreground h-full flex items-center justify-center" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                Selecione uma matrícula para ver a anamnese.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { t: string; c: string }> = {
    pending: { t: 'Pendente', c: '#ffa800' }, active: { t: 'Ativa', c: '#00d084' }, rejected: { t: 'Recusada', c: '#94a3b8' },
  }
  const s = map[status] ?? map.pending
  return <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded flex-shrink-0" style={{ background: s.c + '22', color: s.c }}>{s.t}</span>
}

function Detail({ enr, onChanged }: { enr: EnrollmentRow; onChanged: () => void }) {
  const [notes, setNotes] = useState(enr.coach_notes ?? '')
  const [start, setStart] = useState(ymd(nextMonday()))
  const [busy, setBusy] = useState<null | 'apply' | 'reject' | 'notes'>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const planKey = PKG_PLAN[enr.package_key] ?? 'run_first5k_12'
  const plan = useMemo(() => PLAN_LIBRARY.find(p => p.key === planKey) ?? null, [planKey])

  async function applyPlan() {
    if (!enr.athlete_id || !plan) { setMsg('Sem atleta vinculado ou plano não encontrado.'); return }
    setBusy('apply'); setMsg(null)

    // Remapeia os dias do plano para os dias preferidos do aluno (se houver).
    const planDays = [...new Set(plan.week.map(w => w.day))].sort((a, b) => a - b)
    const pref = (enr.preferred_days ?? []).slice().sort((a, b) => a - b)
    const dayMap: Record<number, number> = {}
    planDays.forEach((pd, i) => { dayMap[pd] = pref[i] ?? pd })

    const startDate = new Date(start + 'T12:00:00')
    const gen = generatePlan(plan)
    const rows: PlannedWorkoutInput[] = []
    for (const wk of gen) for (const s of wk.workouts) {
      const day = dayMap[s.day] ?? s.day
      const d = addDays(startDate, (wk.week - 1) * 7 + day)
      rows.push({
        athlete_id: enr.athlete_id, date: ymd(d), sport: s.sport, title: s.title,
        description: s.description, planned_duration_min: s.duration_min, planned_tss: s.tss,
      })
    }
    const res = await bulkCreatePlannedWorkouts(rows)
    if (!res.ok) { setMsg(res.error ?? 'Falha ao aplicar o plano.'); setBusy(null); return }
    if (notes.trim() !== (enr.coach_notes ?? '')) await updateEnrollment(enr.id, { coach_notes: notes.trim() })
    await markEnrollmentPlanApplied(enr.id)
    setBusy(null); setMsg(`Plano aplicado: ${res.count} treinos no calendário do aluno.`)
    onChanged()
  }

  async function reject() {
    setBusy('reject')
    await updateEnrollment(enr.id, { status: 'rejected', coach_notes: notes.trim() || null })
    setBusy(null); onChanged()
  }
  async function saveNotes() {
    setBusy('notes')
    await updateEnrollment(enr.id, { coach_notes: notes.trim() || null })
    setBusy(null); setMsg('Observações salvas.')
  }

  return (
    <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-foreground">{enr.full_name}</h2>
          <p className="text-xs text-muted-foreground">{[enr.email, enr.phone].filter(Boolean).join(' · ')}</p>
        </div>
        <StatusBadge status={enr.status} />
      </div>

      {/* Respostas da anamnese */}
      <div className="grid grid-cols-2 gap-2">
        <Info k="Idade" v={enr.age ? `${enr.age} anos` : '—'} />
        <Info k="Altura / Peso" v={[enr.height_cm && `${enr.height_cm} cm`, enr.weight_kg && `${enr.weight_kg} kg`].filter(Boolean).join(' · ') || '—'} />
        <Info k="Corre hoje?" v={enr.currently_running === null ? '—' : enr.currently_running ? 'Sim' : 'Não'} />
        <Info k="Nível" v={enr.currently_running ? (LBL_RUN[enr.running_level ?? ''] ?? '—') : (LBL_RUN[enr.activity_level ?? ''] ?? '—')} />
        {enr.currently_running && <Info k="Dias/semana" v={LBL_DAYS[enr.days_running ?? ''] ?? '—'} />}
        {enr.currently_running && <Info k="Volume semanal" v={LBL_DIST[enr.weekly_distance ?? ''] ?? '—'} />}
        <Info k="Objetivo" v={LBL_GOAL[enr.goal ?? ''] ?? '—'} wide />
        <Info k="Dias preferidos" v={(enr.preferred_days ?? []).map(i => WEEKDAYS[i]).join(', ') || '—'} wide />
      </div>

      {enr.athlete_id && (
        <Link href={`/athletes/detail/?id=${enr.athlete_id}`} className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline">
          Abrir ficha do aluno <ExternalLink className="w-3 h-3" />
        </Link>
      )}

      {/* Observações do treinador */}
      <div>
        <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Observações (opcional)</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          className="w-full rounded-lg px-3 py-2 text-sm bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-[#e8001c]/40"
          placeholder="Anotações sobre o perfil, lesões, etc." />
      </div>

      {/* Aplicar plano */}
      <div className="rounded-xl p-4" style={{ background: 'var(--panel)', border: '1px solid var(--panel-border)' }}>
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm font-black text-foreground">{plan?.name ?? 'Plano'}</span>
        </div>
        <p className="text-[11px] text-muted-foreground mb-3">{plan?.focus}</p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs">
            <span className="block text-muted-foreground mb-1 flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" /> Início</span>
            <input type="date" value={start} onChange={e => setStart(e.target.value)}
              className="rounded-lg px-2.5 py-1.5 text-sm bg-background border border-border text-foreground" />
          </label>
          <button onClick={applyPlan} disabled={busy !== null || !enr.athlete_id}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-black text-white disabled:opacity-50" style={{ background: RED }}>
            {busy === 'apply' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Footprints className="w-4 h-4" />}
            {enr.status === 'active' ? 'Reaplicar plano' : 'Aplicar plano'}
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">Os treinos vão para os dias preferidos do aluno, quando informados.</p>
      </div>

      {msg && <p className="text-sm font-semibold" style={{ color: '#00d084' }}>{msg}</p>}

      <div className="flex items-center gap-2 pt-1">
        <button onClick={saveNotes} disabled={busy !== null}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-muted-foreground hover:bg-secondary disabled:opacity-50">
          {busy === 'notes' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Salvar obs.
        </button>
        {enr.status !== 'rejected' && (
          <button onClick={reject} disabled={busy !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-muted-foreground hover:bg-secondary disabled:opacity-50">
            <X className="w-3.5 h-3.5" /> Recusar
          </button>
        )}
      </div>
    </div>
  )
}

function Info({ k, v, wide }: { k: string; v: string; wide?: boolean }) {
  return (
    <div className={`rounded-lg px-3 py-2 ${wide ? 'col-span-2' : ''}`} style={{ background: 'var(--panel)', border: '1px solid var(--panel-border)' }}>
      <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">{k}</p>
      <p className="text-sm font-bold text-foreground mt-0.5">{v}</p>
    </div>
  )
}
