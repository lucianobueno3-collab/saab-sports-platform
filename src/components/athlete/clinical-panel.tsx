'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'
import {
  getBloodExams, getAthleteInjuries, getClinicalNotes, saveClinicalNote, deleteClinicalNote,
  getMedicalClearances, getMyRole, clearanceState,
  type BloodExamRow, type InjuryRow, type ClinicalNoteRow, type MedicalClearanceRow,
} from '@/lib/supabase/queries'
import { assessHealthRisk, outOfRange, type RiskAlert, type RiskLevel } from '@/lib/health-risk'
import { type Sex } from '@/lib/blood-markers'
import {
  Activity, AlertTriangle, Info, Loader2, Plus, X, Check, Trash2,
  Stethoscope, FlaskConical, ShieldCheck, Bandage, ClipboardList,
} from 'lucide-react'

const RED = '#e8001c'
const LEVEL: Record<RiskLevel, { c: string; t: string }> = {
  alto: { c: '#ef4444', t: 'Alto' },
  medio: { c: '#f59e0b', t: 'Atenção' },
  info: { c: '#0088ff', t: 'Info' },
}
const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')

export function ClinicalPanel({ athleteId, sex }: { athleteId: string; sex: Sex }) {
  const [exams, setExams] = useState<BloodExamRow[]>([])
  const [injuries, setInjuries] = useState<InjuryRow[]>([])
  const [notes, setNotes] = useState<ClinicalNoteRow[]>([])
  const [clearances, setClearances] = useState<MedicalClearanceRow[]>([])
  const [vitals, setVitals] = useState<{ tsb: number | null; ctl: number | null; hrv: number | null; hrvBase: number | null; sleep: number | null }>(
    { tsb: null, ctl: null, hrv: null, hrvBase: null, sleep: null })
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<string | null>(null)
  const [modal, setModal] = useState(false)

  async function load() {
    setLoading(true)
    const sb = createClient()
    const [ex, inj, nt, cl] = await Promise.all([
      getBloodExams(athleteId), getAthleteInjuries(athleteId),
      getClinicalNotes(athleteId), getMedicalClearances(athleteId),
    ])
    setExams(ex); setInjuries(inj); setNotes(nt); setClearances(cl)

    // Carga e fisiologia recentes (para cruzar com os exames).
    const [{ data: sum }, { data: days }] = await Promise.all([
      sb.from('v_athlete_summary').select('ctl, atl, tsb').eq('id', athleteId).maybeSingle(),
      sb.from('daily_metrics').select('date, hrv_ms, sleep_hours').eq('athlete_id', athleteId)
        .order('date', { ascending: false }).limit(30),
    ])
    const rows = (days ?? []) as { date: string; hrv_ms: number | null; sleep_hours: number | null }[]
    const hrvs = rows.map(r => r.hrv_ms).filter((v): v is number => typeof v === 'number')
    setVitals({
      tsb: (sum as { tsb?: number } | null)?.tsb ?? null,
      ctl: (sum as { ctl?: number } | null)?.ctl ?? null,
      hrv: hrvs[0] ?? null,
      hrvBase: hrvs.length >= 7 ? hrvs.slice(1, 15).reduce((a, b) => a + b, 0) / Math.max(1, hrvs.slice(1, 15).length) : null,
      sleep: rows.find(r => typeof r.sleep_hours === 'number')?.sleep_hours ?? null,
    })
    setLoading(false)
  }
  useEffect(() => {
    load(); getMyRole().then(setRole).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [athleteId])

  const canWrite = role === 'doctor' || role === 'admin'

  // Valor mais recente de cada marcador (exames vêm ordenados do mais novo).
  const latestBlood = useMemo(() => {
    const out: Record<string, number> = {}
    for (const e of [...exams].reverse()) for (const v of e.values) if (v.value != null) out[v.marker_key] = v.value
    return out
  }, [exams])

  const alerts = useMemo(() => assessHealthRisk({
    sex, blood: latestBlood, bloodDate: exams[0]?.exam_date ?? null,
    tsb: vitals.tsb, ctl: vitals.ctl, hrv: vitals.hrv, hrvBaseline: vitals.hrvBase, sleepHours: vitals.sleep,
    injuries: injuries.map(i => ({ injury_type: i.injury_type, location: i.location, started_at: i.started_at, resolved_at: i.resolved_at })),
  }), [sex, latestBlood, exams, vitals, injuries])

  const flagged = useMemo(() => outOfRange(latestBlood, sex), [latestBlood, sex])
  const counts = { alto: alerts.filter(a => a.level === 'alto').length, medio: alerts.filter(a => a.level === 'medio').length }

  async function removeNote(id: string) {
    if (!confirm('Excluir este registro do prontuário?')) return
    await deleteClinicalNote(id); load()
  }

  if (loading) return <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin" /></div>

  return (
    <div className="space-y-4">
      {/* ── Painel de risco ─────────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between gap-2 px-5 py-3.5 border-b border-border">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            <h3 className="text-base font-black text-foreground">Painel de risco</h3>
          </div>
          <div className="flex items-center gap-1.5">
            {counts.alto > 0 && <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded" style={{ background: '#ef444422', color: '#ef4444' }}>{counts.alto} alto</span>}
            {counts.medio > 0 && <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded" style={{ background: '#f59e0b22', color: '#f59e0b' }}>{counts.medio} atenção</span>}
            {alerts.length === 0 && <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded" style={{ background: '#00d08422', color: '#00d084' }}>Sem alertas</span>}
          </div>
        </div>

        <div className="p-4 space-y-2.5">
          {alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum sinal de alerta com os dados disponíveis. Registre exames e lesões para enriquecer a triagem.
            </p>
          ) : alerts.map(a => <AlertCard key={a.key} alert={a} />)}

          {flagged.length > 0 && (
            <div className="pt-1">
              <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-1.5">Marcadores fora da faixa</p>
              <div className="flex flex-wrap gap-1.5">
                {flagged.map(f => (
                  <span key={f.key} className="text-[11px] font-bold px-2 py-1 rounded-lg"
                    style={{ background: (f.dir === 'high' ? '#ef4444' : '#0088ff') + '18', color: f.dir === 'high' ? '#ef4444' : '#0088ff' }}>
                    {f.label} {f.dir === 'high' ? '▲' : '▼'} {f.value}{f.unit ? ` ${f.unit}` : ''}
                  </span>
                ))}
              </div>
            </div>
          )}
          <p className="text-[10px] text-muted-foreground pt-1">
            Triagem automática a partir dos dados do app — apoio à decisão, não substitui avaliação clínica.
          </p>
        </div>
      </div>

      {/* ── Prontuário / linha do tempo ─────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between gap-2 px-5 py-3.5 border-b border-border">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            <h3 className="text-base font-black text-foreground">Prontuário e linha do tempo</h3>
          </div>
          {canWrite && (
            <button onClick={() => setModal(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold text-white" style={{ background: RED }}>
              <Plus className="w-4 h-4" /> Atendimento
            </button>
          )}
        </div>
        <Timeline notes={notes} injuries={injuries} exams={exams} clearances={clearances} canWrite={canWrite} onRemoveNote={removeNote} />
      </div>

      {modal && <NoteModal athleteId={athleteId} onClose={() => setModal(false)} onSaved={() => { setModal(false); load() }} />}
    </div>
  )
}

function AlertCard({ alert }: { alert: RiskAlert }) {
  const [open, setOpen] = useState(false)
  const l = LEVEL[alert.level]
  return (
    <button onClick={() => setOpen(v => !v)} className="w-full text-left rounded-xl p-3.5 transition-colors"
      style={{ background: l.c + '0f', border: `1px solid ${l.c}40` }}>
      <div className="flex items-start gap-2.5">
        {alert.level === 'info' ? <Info className="w-4 h-4 mt-0.5 shrink-0" style={{ color: l.c }} />
          : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: l.c }} />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-black text-foreground">{alert.title}</p>
            <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded" style={{ background: l.c + '22', color: l.c }}>{l.t}</span>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {alert.evidence.map((e, i) => (
              <span key={i} className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'var(--panel)', color: 'var(--muted-foreground)' }}>{e}</span>
            ))}
          </div>
          {open && (
            <div className="mt-2.5 space-y-1.5">
              <p className="text-xs text-muted-foreground"><strong className="text-foreground">Por quê:</strong> {alert.why}</p>
              <p className="text-xs text-muted-foreground"><strong className="text-foreground">Conduta sugerida:</strong> {alert.action}</p>
            </div>
          )}
          {!open && <p className="text-[10px] text-muted-foreground mt-1.5">Toque para ver o porquê e a conduta</p>}
        </div>
      </div>
    </button>
  )
}

// Linha do tempo unificada: atendimentos + lesões + exames + pareceres.
type TLItem = { date: string; kind: 'nota' | 'lesao' | 'exame' | 'parecer'; node: React.ReactNode }

function Timeline({ notes, injuries, exams, clearances, canWrite, onRemoveNote }: {
  notes: ClinicalNoteRow[]; injuries: InjuryRow[]; exams: BloodExamRow[]
  clearances: MedicalClearanceRow[]; canWrite: boolean; onRemoveNote: (id: string) => void
}) {
  const items: TLItem[] = []

  for (const n of notes) items.push({
    date: n.note_date, kind: 'nota',
    node: (
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-black text-foreground">Atendimento</p>
          {n.private && <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded" style={{ background: 'var(--panel)', color: 'var(--muted-foreground)' }}>Só equipe</span>}
          {n.author_name && <span className="text-[11px] text-muted-foreground">· {n.author_name}</span>}
          {canWrite && <button onClick={() => onRemoveNote(n.id)} className="ml-auto p-0.5 text-red-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>}
        </div>
        <dl className="mt-1.5 space-y-1">
          {n.chief_complaint && <Field k="Queixa" v={n.chief_complaint} />}
          {n.findings && <Field k="Exame físico" v={n.findings} />}
          {n.assessment && <Field k="Hipótese" v={n.assessment} />}
          {n.plan && <Field k="Conduta" v={n.plan} />}
        </dl>
        {n.follow_up_at && <p className="text-[11px] font-bold mt-1.5" style={{ color: RED }}>Retorno em {fmtDate(n.follow_up_at)}</p>}
      </div>
    ),
  })

  for (const i of injuries) items.push({
    date: i.started_at, kind: 'lesao',
    node: (
      <div>
        <p className="text-sm font-black text-foreground">{i.injury_type} — {i.location}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {i.resolved_at ? `Resolvida em ${fmtDate(i.resolved_at)}` : 'Em tratamento'}
          {' · '}{i.severity === 'severe' ? 'Grave' : i.severity === 'moderate' ? 'Moderada' : 'Leve'}
        </p>
        {i.notes && <p className="text-xs text-muted-foreground mt-1">{i.notes}</p>}
      </div>
    ),
  })

  for (const e of exams) items.push({
    date: e.exam_date, kind: 'exame',
    node: (
      <div>
        <p className="text-sm font-black text-foreground">Exame de sangue{e.lab ? ` — ${e.lab}` : ''}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{e.values.filter(v => v.value != null).length} marcadores registrados</p>
      </div>
    ),
  })

  for (const c of clearances) {
    const s = clearanceState(c)
    items.push({
      date: c.assessed_at, kind: 'parecer',
      node: (
        <div>
          <p className="text-sm font-black" style={{ color: s.color }}>Parecer: {s.label}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {c.doctor_name ?? 'Equipe médica'}{c.valid_until ? ` · válido até ${fmtDate(c.valid_until)}` : ''}
          </p>
          {c.restrictions && <p className="text-xs text-muted-foreground mt-1">Restrições: {c.restrictions}</p>}
        </div>
      ),
    })
  }

  items.sort((a, b) => (a.date < b.date ? 1 : -1))

  const ICON = {
    nota: { i: Stethoscope, c: '#8b5cf6' }, lesao: { i: Bandage, c: '#ef4444' },
    exame: { i: FlaskConical, c: '#0088ff' }, parecer: { i: ShieldCheck, c: '#00d084' },
  }

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-10 px-5">Nenhum registro clínico ainda. Atendimentos, lesões, exames e pareceres aparecem aqui em ordem cronológica.</p>
  }

  return (
    <div className="p-4 space-y-0">
      {items.map((it, idx) => {
        const M = ICON[it.kind]
        const Icon = M.i
        const last = idx === items.length - 1
        return (
          <div key={idx} className="flex gap-3">
            <div className="flex flex-col items-center shrink-0">
              <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: M.c + '1f' }}>
                <Icon className="w-4 h-4" style={{ color: M.c }} />
              </span>
              {!last && <span className="w-px flex-1 my-1" style={{ background: 'var(--border)' }} />}
            </div>
            <div className={`min-w-0 flex-1 ${last ? '' : 'pb-4'}`}>
              <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{fmtDate(it.date)}</p>
              <div className="mt-0.5">{it.node}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-1.5 text-xs">
      <dt className="font-bold text-muted-foreground shrink-0">{k}:</dt>
      <dd className="text-foreground whitespace-pre-line min-w-0">{v}</dd>
    </div>
  )
}

function NoteModal({ athleteId, onClose, onSaved }: { athleteId: string; onClose: () => void; onSaved: () => void }) {
  const [date, setDate] = useState(new Date().toLocaleDateString('en-CA'))
  const [complaint, setComplaint] = useState('')
  const [findings, setFindings] = useState('')
  const [assessment, setAssessment] = useState('')
  const [plan, setPlan] = useState('')
  const [followUp, setFollowUp] = useState('')
  const [priv, setPriv] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  async function save() {
    setSaving(true); setErr(null)
    const res = await saveClinicalNote({
      athlete_id: athleteId, note_date: date,
      chief_complaint: complaint.trim() || null, findings: findings.trim() || null,
      assessment: assessment.trim() || null, plan: plan.trim() || null,
      follow_up_at: followUp || null, private: priv,
    })
    setSaving(false)
    if (!res.ok) { setErr(res.error ?? 'Falha ao salvar.'); return }
    onSaved()
  }

  const inCls = 'w-full rounded-lg px-2.5 py-2 text-sm bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-[#e8001c]/40'
  if (!mounted) return null
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full max-w-lg shadow-2xl max-h-[92vh] flex flex-col safe-bottom">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-black text-foreground flex items-center gap-2"><Stethoscope className="w-4 h-4 text-primary" /> Registro de atendimento</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-muted-foreground">Data
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className={`${inCls} mt-1`} />
            </label>
            <label className="text-xs font-semibold text-muted-foreground">Retorno (opcional)
              <input type="date" value={followUp} onChange={e => setFollowUp(e.target.value)} className={`${inCls} mt-1`} />
            </label>
          </div>

          <label className="text-xs font-semibold text-muted-foreground block">Queixa principal <span className="font-normal">(o que o atleta relata)</span>
            <textarea value={complaint} onChange={e => setComplaint(e.target.value)} rows={2} className={`${inCls} mt-1 resize-none`} placeholder="ex: dor na face anterior da tíbia ao correr há 3 semanas" />
          </label>
          <label className="text-xs font-semibold text-muted-foreground block">Exame físico / achados
            <textarea value={findings} onChange={e => setFindings(e.target.value)} rows={2} className={`${inCls} mt-1 resize-none`} placeholder="ex: dor à palpação em terço médio da tíbia, sem edema" />
          </label>
          <label className="text-xs font-semibold text-muted-foreground block">Hipótese diagnóstica
            <textarea value={assessment} onChange={e => setAssessment(e.target.value)} rows={2} className={`${inCls} mt-1 resize-none`} placeholder="ex: síndrome do estresse tibial medial" />
          </label>
          <label className="text-xs font-semibold text-muted-foreground block">Conduta
            <textarea value={plan} onChange={e => setPlan(e.target.value)} rows={2} className={`${inCls} mt-1 resize-none`} placeholder="ex: reduzir volume de impacto 2 semanas, fortalecer panturrilha, reavaliar" />
          </label>

          <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
            <input type="checkbox" checked={priv} onChange={e => setPriv(e.target.checked)} className="accent-primary w-4 h-4" />
            Visível só para a equipe clínica (o atleta não vê)
          </label>
          {err && <p className="text-xs text-red-500">{err}</p>}
        </div>

        <div className="flex items-center gap-2 px-5 py-4 border-t border-border">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-bold text-muted-foreground border border-border hover:bg-secondary">Cancelar</button>
          <button onClick={save} disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-black text-white disabled:opacity-60" style={{ background: RED }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}{saving ? 'Salvando…' : 'Salvar atendimento'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
