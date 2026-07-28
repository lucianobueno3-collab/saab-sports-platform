'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import {
  getEnrollments, updateEnrollment, markEnrollmentPlanApplied, notifyEnrollmentApproved,
  bulkCreatePlannedWorkouts, getTrainingPrograms, getWorkoutLibrary,
  type EnrollmentRow, type PlannedWorkoutInput, type TrainingProgramRow, type WorkoutLibraryRow,
} from '@/lib/supabase/queries'
import { PLAN_LIBRARY, generatePlan } from '@/lib/training-plans'
import { recommendProgram, expandProgram } from '@/lib/program-templates'
import { ClipboardList, Loader2, Check, X, CalendarDays, ExternalLink, Sparkles, Wand2, Eye, Plus, Pencil, Trash2, Library } from 'lucide-react'

const RED = '#e8001c'
const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

const LBL_RUN: Record<string, string> = { iniciante: 'Iniciante', intermediario: 'Intermediário', avancado: 'Avançado', competitivo: 'Competitivo' }
const LBL_DAYS: Record<string, string> = { '1_2': '1 ou 2 dias', '3': '3 dias', '4': '4 dias', '5_mais': '5+ dias' }
const LBL_DIST: Record<string, string> = { ate_15: 'até 15 km', '15_30': '15–30 km', '30_40': '30–40 km', '40_mais': '40+ km' }
const LBL_GOAL: Record<string, string> = {
  '5km': 'Correr 5 km', '10km': 'Correr 10 km', '21km': 'Meia maratona (21 km)', '42km': 'Maratona (42 km)',
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

type Filter = 'paid_waiting' | 'pending' | 'paid' | 'active' | 'all'

export default function MatriculasPage() {
  const [filter, setFilter] = useState<Filter>('paid_waiting')
  const [rows, setRows] = useState<EnrollmentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [sel, setSel] = useState<EnrollmentRow | null>(null)

  async function load() {
    setLoading(true)
    // Filtros de status usam a query; os de pagamento buscam tudo e filtram no cliente.
    const serverStatus = filter === 'pending' ? 'pending' : filter === 'active' ? 'active' : undefined
    let data = await getEnrollments(serverStatus)
    if (filter === 'paid') data = data.filter(r => r.payment_status === 'approved')
    else if (filter === 'paid_waiting') data = data.filter(r => r.payment_status === 'approved' && r.status !== 'active')
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
      <p className="text-sm text-muted-foreground mb-5">Novos alunos que preencheram a anamnese. <strong className="text-foreground">Aguardando plano</strong> são os que já pagaram e ainda não receberam o treino — sua fila de ação.</p>

      <div className="flex gap-1 p-1 rounded-xl bg-secondary w-fit mb-5 flex-wrap">
        {([['paid_waiting', 'Aguardando plano'], ['pending', 'Pendentes'], ['paid', 'Pagos'], ['active', 'Ativas'], ['all', 'Todas']] as const).map(([v, t]) => (
          <button key={v} onClick={() => setFilter(v)}
            className="px-4 py-1.5 rounded-lg text-xs font-bold transition-colors"
            style={filter === v ? { background: RED, color: '#fff' } : { color: 'var(--muted-foreground)' }}>{t}</button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl p-10 text-center text-muted-foreground" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          {filter === 'paid_waiting' ? 'Ninguém aguardando plano — todos os alunos que pagaram já receberam o treino. ✅'
            : filter === 'paid' ? 'Nenhum pagamento confirmado ainda.'
            : filter === 'pending' ? 'Nenhuma matrícula pendente no momento.'
            : filter === 'active' ? 'Nenhuma matrícula ativa no momento.'
            : 'Nenhuma matrícula no momento.'}
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
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <PaymentBadge enr={r} />
                    <StatusBadge status={r.status} />
                  </div>
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

function PaymentBadge({ enr }: { enr: EnrollmentRow }) {
  const map: Record<string, { t: string; c: string }> = {
    approved: { t: 'Pago', c: '#00d084' }, refunded: { t: 'Estornado', c: '#ef4444' }, canceled: { t: 'Cancelado', c: '#94a3b8' },
  }
  const s = enr.payment_status ? map[enr.payment_status] : null
  if (!s) return null
  return <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded flex-shrink-0" style={{ background: s.c + '22', color: s.c }}>{s.t}</span>
}

function Detail({ enr, onChanged }: { enr: EnrollmentRow; onChanged: () => void }) {
  const [notes, setNotes] = useState(enr.coach_notes ?? '')
  const [start, setStart] = useState(ymd(nextMonday()))
  const [busy, setBusy] = useState<null | 'apply' | 'reject' | 'notes'>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [preview, setPreview] = useState<PlannedWorkoutInput[] | null>(null)

  // Programas compostos (compositor) + roteamento pela anamnese.
  const [programs, setPrograms] = useState<TrainingProgramRow[]>([])
  const [programId, setProgramId] = useState<string>('')
  const [library, setLibrary] = useState<WorkoutLibraryRow[]>([])
  useEffect(() => {
    getTrainingPrograms().then(list => {
      setPrograms(list)
      const rec = recommendProgram({
        currently_running: enr.currently_running, running_level: enr.running_level,
        activity_level: enr.activity_level, goal: enr.goal,
      }, list)
      setProgramId(rec?.id ?? list[0]?.id ?? '')
    }).catch(() => {})
    getWorkoutLibrary().then(setLibrary).catch(() => {})
  }, [enr.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const recommended = useMemo(() => recommendProgram({
    currently_running: enr.currently_running, running_level: enr.running_level,
    activity_level: enr.activity_level, goal: enr.goal,
  }, programs), [programs, enr])
  const selectedProgram = programs.find(p => p.id === programId) ?? null

  // Fallback: plano paramétrico embutido, caso ainda não haja programas criados.
  const planKey = PKG_PLAN[enr.package_key] ?? 'run_first5k_12'
  const fallbackPlan = useMemo(() => PLAN_LIBRARY.find(p => p.key === planKey) ?? null, [planKey])

  // Monta os treinos (com dias flutuantes), sem gravar — usado na pré-visualização.
  function buildRows(): PlannedWorkoutInput[] | null {
    if (!enr.athlete_id) { setMsg('Sem atleta vinculado.'); return null }
    const startDate = new Date(start + 'T12:00:00')
    const pref = (enr.preferred_days ?? []).slice().sort((a, b) => a - b)
    let rows: PlannedWorkoutInput[] = []

    if (selectedProgram) {
      // Programa composto: dias flutuantes (corrida nos preferidos, força nos livres).
      rows = expandProgram(selectedProgram.weeks, startDate, pref, enr.long_run_day).map(x => ({
        athlete_id: enr.athlete_id!, date: x.date, sport: x.sport, title: x.title,
        description: x.description, planned_duration_min: x.planned_duration_min, planned_tss: x.planned_tss,
        structure: x.structure,
      }))
    } else if (fallbackPlan) {
      const planDays = [...new Set(fallbackPlan.week.map(w => w.day))].sort((a, b) => a - b)
      const dayMap: Record<number, number> = {}
      planDays.forEach((pd, i) => { dayMap[pd] = pref[i] ?? pd })
      for (const wk of generatePlan(fallbackPlan)) for (const s of wk.workouts) {
        const day = dayMap[s.day] ?? s.day
        rows.push({
          athlete_id: enr.athlete_id, date: ymd(addDays(startDate, (wk.week - 1) * 7 + day)), sport: s.sport, title: s.title,
          description: s.description, planned_duration_min: s.duration_min, planned_tss: s.tss,
        })
      }
    } else { setMsg('Nenhum programa disponível para aplicar.'); return null }
    return rows
  }

  // Abre a pré-visualização (valida os dias antes de gravar).
  function openPreview() {
    setMsg(null)
    const rows = buildRows()
    if (rows && rows.length) setPreview(rows)
    else if (rows) setMsg('O programa selecionado não gerou treinos.')
  }

  // Grava de fato no calendário do aluno (após confirmar na pré-visualização).
  async function commit(rows: PlannedWorkoutInput[]) {
    setBusy('apply'); setMsg(null)
    const res = await bulkCreatePlannedWorkouts(rows)
    if (!res.ok) { setMsg(res.error ?? 'Falha ao aplicar.'); setBusy(null); return }
    if (notes.trim() !== (enr.coach_notes ?? '')) await updateEnrollment(enr.id, { coach_notes: notes.trim() })
    await markEnrollmentPlanApplied(enr.id)
    // Avisa o aluno por e-mail (não bloqueia a aprovação se o e-mail falhar/estiver desligado)
    const wasPending = enr.status !== 'active'
    let mail = ''
    if (wasPending && enr.athlete_id) {
      const n = await notifyEnrollmentApproved(enr.athlete_id)
      mail = n.sent ? ' E-mail de boas-vindas enviado. 📧' : (n.skipped === 'email_nao_configurado' ? '' : '')
    }
    setBusy(null); setPreview(null)
    setMsg(`Aplicado: ${res.count} treinos no calendário. Acesso do aluno liberado. ✅${mail}`)
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
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <PaymentBadge enr={enr} />
          <StatusBadge status={enr.status} />
        </div>
      </div>

      {enr.payment_status && (
        <div className="rounded-xl px-3.5 py-2.5 text-xs" style={{ background: 'var(--panel)', border: '1px solid var(--panel-border)' }}>
          {enr.payment_status === 'approved' ? (
            <span className="font-bold" style={{ color: '#00d084' }}>
              ✅ Pagamento confirmado{enr.paid_at ? ` em ${new Date(enr.paid_at).toLocaleDateString('pt-BR')}` : ''}
              {enr.payment_source ? ` · ${enr.payment_source}` : ''}{enr.payment_ref ? ` · ${enr.payment_ref}` : ''}
            </span>
          ) : (
            <span className="font-bold" style={{ color: enr.payment_status === 'refunded' ? '#ef4444' : '#94a3b8' }}>
              {enr.payment_status === 'refunded' ? '↩︎ Pagamento estornado' : '⨯ Pagamento cancelado'}
              {enr.payment_ref ? ` · ${enr.payment_ref}` : ''}
            </span>
          )}
        </div>
      )}

      {/* Respostas da anamnese */}
      <div className="grid grid-cols-2 gap-2">
        <Info k="Idade" v={enr.age ? `${enr.age} anos` : '—'} />
        <Info k="Altura / Peso" v={[enr.height_cm && `${enr.height_cm} cm`, enr.weight_kg && `${enr.weight_kg} kg`].filter(Boolean).join(' · ') || '—'} />
        <Info k="Corre hoje?" v={enr.currently_running === null ? '—' : enr.currently_running ? 'Sim' : 'Não'} />
        <Info k="Nível" v={enr.currently_running ? (LBL_RUN[enr.running_level ?? ''] ?? '—') : (LBL_RUN[enr.activity_level ?? ''] ?? '—')} />
        {enr.currently_running && <Info k="Dias/semana" v={LBL_DAYS[enr.days_running ?? ''] ?? '—'} />}
        {enr.currently_running && <Info k="Volume semanal" v={LBL_DIST[enr.weekly_distance ?? ''] ?? '—'} />}
        <Info k="Objetivo" v={LBL_GOAL[enr.goal ?? ''] ?? '—'} wide />
        <Info k="Dias preferidos" v={(enr.preferred_days ?? []).map(i => WEEKDAYS[i]).join(', ') || '—'} />
        <Info k="Dia do longão" v={enr.long_run_day != null ? WEEKDAYS[enr.long_run_day] : '—'} />
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

      {/* Aplicar programa (com roteamento pela anamnese) */}
      <div className="rounded-xl p-4" style={{ background: 'var(--panel)', border: '1px solid var(--panel-border)' }}>
        {programs.length > 0 ? (
          <>
            <div className="flex items-center gap-2 mb-2">
              <Wand2 className="w-4 h-4 text-primary" />
              <span className="text-sm font-black text-foreground">Programa</span>
              {recommended && programId === recommended.id && (
                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded" style={{ background: '#00d08422', color: '#00d084' }}>Recomendado</span>
              )}
            </div>
            <select value={programId} onChange={e => setProgramId(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm bg-background border border-border text-foreground mb-2">
              {programs.map(p => (
                <option key={p.id} value={p.id}>{p.name}{recommended?.id === p.id ? ' ⭐ (recomendado)' : ''}</option>
              ))}
            </select>
            {selectedProgram && <p className="text-[11px] text-muted-foreground mb-3">{selectedProgram.weeks.length} semanas · {selectedProgram.description}</p>}
          </>
        ) : (
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-black text-foreground">{fallbackPlan?.name ?? 'Plano'}</span>
            <span className="text-[10px] text-muted-foreground">(crie programas em Treinos → Programas)</span>
          </div>
        )}
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs">
            <span className="block text-muted-foreground mb-1 flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" /> Início</span>
            <input type="date" value={start} onChange={e => setStart(e.target.value)}
              className="rounded-lg px-2.5 py-1.5 text-sm bg-background border border-border text-foreground" />
          </label>
          <button onClick={openPreview} disabled={busy !== null || !enr.athlete_id}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-black text-white disabled:opacity-50" style={{ background: RED }}>
            {busy === 'apply' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
            {enr.status === 'active' ? 'Revisar e reaplicar' : 'Revisar e aplicar'}
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">Dias flutuantes: o longão vai para {enr.long_run_day != null ? WEEKDAYS[enr.long_run_day] : 'o último dia preferido'}, as outras corridas nos demais dias preferidos ({(enr.preferred_days ?? []).map(i => WEEKDAYS[i]).join(', ') || 'não informados'}) e a força nos dias que sobram.</p>
        {enr.status === 'pending' && (
          <p className="text-[10px] font-semibold mt-1.5" style={{ color: RED }}>O aluno está aguardando aprovação — aplicar o programa libera o acesso dele ao portal.</p>
        )}
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

      {preview && (
        <PlanPreview
          rows={preview} start={start}
          programName={selectedProgram?.name ?? fallbackPlan?.name ?? 'Plano'}
          athleteName={enr.full_name ?? 'aluno'}
          longRunDay={enr.long_run_day}
          library={library}
          busy={busy === 'apply'}
          onCancel={() => setPreview(null)}
          onConfirm={rows => commit(rows)}
        />
      )}
    </div>
  )
}

// ─── Pré-visualização do plano antes de gravar ──────────────────────────────
const SPORT_META: Record<string, { label: string; color: string }> = {
  running: { label: 'Corrida', color: '#ff6b00' },
  cycling: { label: 'Ciclismo', color: '#0088ff' },
  swimming: { label: 'Natação', color: '#00b4d8' },
  strength: { label: 'Força', color: '#e8001c' },
  triathlon: { label: 'Triathlon', color: '#8b5cf6' },
}
const sportMeta = (s: string) => SPORT_META[s] ?? { label: s, color: '#64748b' }
function wdMon(dateStr: string) { return (new Date(dateStr + 'T12:00:00').getDay() + 6) % 7 } // 0=Seg … 6=Dom
function fmtDM(dateStr: string) { const d = new Date(dateStr + 'T12:00:00'); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}` }
// Data de um dia da semana (0=Seg…6=Dom) dentro da janela de 7 dias da semana do programa.
function dateForWeekday(startStr: string, weekIdx: number, targetWd: number): string {
  const base = new Date(startStr + 'T12:00:00'); base.setDate(base.getDate() + weekIdx * 7)
  const off = (targetWd - ((base.getDay() + 6) % 7) + 7) % 7
  base.setDate(base.getDate() + off)
  return base.toLocaleDateString('en-CA')
}
const SPORT_OPTS = ['running', 'strength', 'cycling', 'swimming'] as const

type PreviewItem = PlannedWorkoutInput & { _uid: number }

function PlanPreview({ rows, start, programName, athleteName, longRunDay, library, busy, onCancel, onConfirm }: {
  rows: PlannedWorkoutInput[]; start: string; programName: string; athleteName: string
  longRunDay: number | null; library: WorkoutLibraryRow[]; busy: boolean; onCancel: () => void; onConfirm: (rows: PlannedWorkoutInput[]) => void
}) {
  const startMs = new Date(start + 'T12:00:00').getTime()
  const weekOf = (d: string) => Math.max(0, Math.floor((new Date(d + 'T12:00:00').getTime() - startMs) / (7 * 86400000)))

  const [items, setItems] = useState<PreviewItem[]>(() => rows.map((r, i) => ({ ...r, _uid: i })))
  const [editing, setEditing] = useState<number | null>(null)
  const uidRef = useRef(rows.length)

  const patch = (uid: number, p: Partial<PlannedWorkoutInput>) => setItems(list => list.map(it => it._uid === uid ? { ...it, ...p } : it))
  const remove = (uid: number) => setItems(list => list.filter(it => it._uid !== uid))
  // Carrega um treino da biblioteca com o máximo de detalhe (título, modalidade,
  // duração, TSS, descrição e estrutura passo a passo, quando houver).
  const applyLib = (uid: number, libId: string) => {
    const w = library.find(l => l.id === libId); if (!w) return
    patch(uid, {
      sport: w.sport, title: w.title, description: w.description ?? null,
      planned_duration_min: w.duration_min ?? null, planned_tss: w.tss ?? null,
      structure: w.structure ?? null,
    })
  }
  const addToWeek = (w: number) => {
    const uid = uidRef.current++
    // procura um dia livre da semana; senão, cai na segunda
    const used = new Set(items.filter(it => weekOf(it.date) === w).map(it => wdMon(it.date)))
    const day = [0, 1, 2, 3, 4, 5, 6].find(d => !used.has(d)) ?? 0
    setItems(list => [...list, { _uid: uid, athlete_id: rows[0]?.athlete_id ?? '', date: dateForWeekday(start, w, day), sport: 'running', title: 'Novo treino', description: null, planned_duration_min: 30, planned_tss: null }])
    setEditing(uid)
  }

  // Agrupa por semana do programa (recalcula a cada edição).
  const weeks = useMemo(() => {
    const map = new Map<number, PreviewItem[]>()
    for (const it of items) {
      const w = weekOf(it.date)
      if (!map.has(w)) map.set(w, [])
      map.get(w)!.push(it)
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0])
      .map(([w, list]) => [w, list.slice().sort((a, b) => a.date.localeCompare(b.date))] as const)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, start])

  // Padrão semanal (da 1ª semana): dias com corrida x força e checagem de dias seguidos.
  const firstWeek = weeks[0]?.[1] ?? []
  const runDays = [...new Set(firstWeek.filter(r => r.sport !== 'strength').map(r => wdMon(r.date)))].sort((a, b) => a - b)
  const strengthDays = [...new Set(firstWeek.filter(r => r.sport === 'strength').map(r => wdMon(r.date)))].sort((a, b) => a - b)
  const consecutiveRuns = runDays.some((d, i) => runDays.slice(i + 1).some(e => e - d === 1 || (d === 0 && e === 6)))

  const inCls = 'rounded-lg px-2 py-1.5 text-xs bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-[#e8001c]/40'
  const commitRows = () => onConfirm(items.slice().sort((a, b) => a.date.localeCompare(b.date)).map(({ _uid, ...r }) => r)) // eslint-disable-line @typescript-eslint/no-unused-vars

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full max-w-2xl shadow-2xl max-h-[92vh] flex flex-col">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-black text-foreground flex items-center gap-2"><Eye className="w-4 h-4 text-primary" /> Revisar o plano de {athleteName}</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">{programName} · {weeks.length} semanas · {items.length} treinos · início {fmtDM(start)}</p>
          </div>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>

        {/* Resumo dos dias */}
        <div className="px-5 py-3 border-b border-border space-y-2">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="text-muted-foreground">Longão: <strong className="text-foreground">{longRunDay != null ? WEEKDAYS[longRunDay] : '—'}</strong></span>
            <span className="text-muted-foreground">Corridas: <strong className="text-foreground">{runDays.map(d => WEEKDAYS[d]).join(', ') || '—'}</strong></span>
            <span className="text-muted-foreground">Força: <strong className="text-foreground">{strengthDays.map(d => WEEKDAYS[d]).join(', ') || '—'}</strong></span>
          </div>
          {consecutiveRuns && (
            <p className="text-[11px] font-semibold rounded-lg px-2.5 py-1.5" style={{ background: '#f59e0b18', color: '#b45309' }}>
              ⚠️ Há corridas em dias seguidos. Para iniciante, o ideal é intercalar com descanso — ajuste o dia no treino abaixo se quiser.
            </p>
          )}
          <p className="text-[10px] text-muted-foreground">Toque no lápis para mudar dia, modalidade, título ou duração de cada treino.</p>
        </div>

        {/* Semanas */}
        <div className="overflow-y-auto px-5 py-3 space-y-3">
          {weeks.map(([w, list]) => (
            <div key={w}>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Semana {w + 1}</p>
                <button onClick={() => addToWeek(w)} className="flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"><Plus className="w-3 h-3" /> treino</button>
              </div>
              <div className="space-y-1.5">
                {list.map(it => {
                  const m = sportMeta(it.sport)
                  const isEd = editing === it._uid
                  return (
                    <div key={it._uid} className="rounded-lg" style={{ background: 'var(--panel)', border: `1px solid ${isEd ? RED : 'var(--panel-border)'}` }}>
                      <div className="flex items-center gap-3 px-3 py-2">
                        <span className="text-[11px] font-black w-9 shrink-0 text-center" style={{ color: m.color }}>{WEEKDAYS[wdMon(it.date)]}</span>
                        <span className="text-[10px] text-muted-foreground w-10 shrink-0">{fmtDM(it.date)}</span>
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: m.color }} />
                        <span className="text-sm font-semibold text-foreground truncate flex-1">{it.title}</span>
                        {it.planned_duration_min ? <span className="text-[11px] text-muted-foreground shrink-0">{it.planned_duration_min}min</span> : null}
                        <button onClick={() => setEditing(isEd ? null : it._uid)} className="p-1 rounded text-muted-foreground hover:text-foreground" aria-label="Editar"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => remove(it._uid)} className="p-1 rounded text-red-400 hover:bg-red-400/10" aria-label="Excluir"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                      {isEd && (
                        <div className="grid grid-cols-2 gap-2 px-3 pb-3 pt-1 border-t border-border">
                          {library.length > 0 && (
                            <label className="text-[10px] font-semibold text-muted-foreground col-span-2 flex items-center gap-1"><Library className="w-3 h-3 text-primary" /> Carregar da biblioteca
                              <select value="" onChange={e => { if (e.target.value) applyLib(it._uid, e.target.value) }} className={`${inCls} w-full mt-0.5`}>
                                <option value="">Escolher um treino salvo…</option>
                                {library.map(l => <option key={l.id} value={l.id}>{sportMeta(l.sport).label} · {l.title}{l.duration_min ? ` (${l.duration_min}min)` : ''}</option>)}
                              </select>
                            </label>
                          )}
                          <label className="text-[10px] font-semibold text-muted-foreground">Dia
                            <select value={wdMon(it.date)} onChange={e => patch(it._uid, { date: dateForWeekday(start, w, Number(e.target.value)) })} className={`${inCls} w-full mt-0.5`}>
                              {WEEKDAYS.map((d, idx) => <option key={idx} value={idx}>{d}</option>)}
                            </select>
                          </label>
                          <label className="text-[10px] font-semibold text-muted-foreground">Modalidade
                            <select value={it.sport} onChange={e => patch(it._uid, { sport: e.target.value })} className={`${inCls} w-full mt-0.5`}>
                              {SPORT_OPTS.map(s => <option key={s} value={s}>{sportMeta(s).label}</option>)}
                            </select>
                          </label>
                          <label className="text-[10px] font-semibold text-muted-foreground col-span-2">Título
                            <input value={it.title} onChange={e => patch(it._uid, { title: e.target.value })} className={`${inCls} w-full mt-0.5`} />
                          </label>
                          <label className="text-[10px] font-semibold text-muted-foreground">Duração (min)
                            <input type="number" min="0" value={it.planned_duration_min ?? ''} onChange={e => patch(it._uid, { planned_duration_min: e.target.value ? parseInt(e.target.value) : null })} className={`${inCls} w-full mt-0.5`} />
                          </label>
                          <label className="text-[10px] font-semibold text-muted-foreground">TSS
                            <input type="number" min="0" value={it.planned_tss ?? ''} onChange={e => patch(it._uid, { planned_tss: e.target.value ? parseInt(e.target.value) : null })} className={`${inCls} w-full mt-0.5`} />
                          </label>
                          <label className="text-[10px] font-semibold text-muted-foreground col-span-2">Descrição / estrutura
                            <textarea value={it.description ?? ''} onChange={e => patch(it._uid, { description: e.target.value || null })} rows={2}
                              className={`${inCls} w-full mt-0.5 resize-none`} placeholder="ex: 5min aquec · 20min Z2 · 5min solto" />
                          </label>
                          {it.structure && it.structure.length > 0 && (
                            <p className="col-span-2 text-[10px] text-muted-foreground">Treino estruturado ({it.structure.length} blocos) carregado da biblioteca — o aluno vê o passo a passo.</p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Ações */}
        <div className="flex items-center gap-2 px-5 py-4 border-t border-border">
          <button onClick={onCancel} disabled={busy}
            className="flex-1 py-2.5 rounded-lg text-sm font-bold text-muted-foreground border border-border hover:bg-secondary disabled:opacity-50">
            Cancelar
          </button>
          <button onClick={commitRows} disabled={busy || items.length === 0}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-black text-white disabled:opacity-60" style={{ background: RED }}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {busy ? 'Gravando…' : `Confirmar e gravar (${items.length})`}
          </button>
        </div>
      </div>
    </div>,
    document.body,
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
