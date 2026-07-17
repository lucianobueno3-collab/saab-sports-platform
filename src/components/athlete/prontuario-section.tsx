'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  getMedicalRecords, getMedicalProfile,
  type MedicalRecordRow, type MedicalProfileRow, type MedicalExamRow,
} from '@/lib/supabase/queries'
import { todayLocalISO } from '@/lib/dates'
import {
  Plus, X, Pencil, Stethoscope, ShieldCheck, ShieldAlert, CalendarClock,
  ClipboardList, TrendingUp, TrendingDown, Minus, HeartPulse, Info,
} from 'lucide-react'

// ─── Tipos de avaliação com validade padrão de mercado (medicina esportiva) ──
const RECORD_TYPES: { key: string; label: string; defaultMonths: number | null }[] = [
  { key: 'atestado',       label: 'Atestado de aptidão',   defaultMonths: 12 },
  { key: 'ergometrico',    label: 'Teste ergométrico',      defaultMonths: 12 },
  { key: 'ecg',            label: 'ECG de repouso',         defaultMonths: 12 },
  { key: 'ecocardiograma', label: 'Ecocardiograma',         defaultMonths: 24 },
  { key: 'laboratorial',   label: 'Exames laboratoriais',   defaultMonths: 6 },
  { key: 'densitometria',  label: 'Densitometria óssea',    defaultMonths: 24 },
  { key: 'consulta',       label: 'Consulta médica',        defaultMonths: null },
  { key: 'outro',          label: 'Outro',                  defaultMonths: null },
]

const RESULT_LABEL: Record<string, { label: string; color: string }> = {
  apto:            { label: 'Apto',                color: '#00d084' },
  apto_restricoes: { label: 'Apto c/ restrições',  color: '#ffa800' },
  inapto:          { label: 'Inapto',              color: '#e8001c' },
}

type Validity = { status: 'valid' | 'expiring' | 'expired' | 'none'; days: number | null }

function validity(expiresAt: string | null): Validity {
  if (!expiresAt) return { status: 'none', days: null }
  const days = Math.ceil((new Date(expiresAt + 'T12:00:00').getTime() - Date.now()) / 86400000)
  if (days < 0) return { status: 'expired', days }
  if (days <= 30) return { status: 'expiring', days }
  return { status: 'valid', days }
}

const VALIDITY_STYLE: Record<Validity['status'], { label: (d: number | null) => string; color: string }> = {
  valid:    { label: () => 'Válido',                                        color: '#00d084' },
  expiring: { label: d => (d === 0 ? 'Vence hoje' : `Vence em ${d}d`),      color: '#ffa800' },
  expired:  { label: d => `Vencido há ${Math.abs(d ?? 0)}d`,                color: '#e8001c' },
  none:     { label: () => 'Sem validade',                                  color: 'var(--muted-foreground)' },
}

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
}

function addMonths(iso: string, months: number): string {
  const d = new Date(iso + 'T12:00:00')
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

function typeLabel(key: string) {
  return RECORD_TYPES.find(t => t.key === key)?.label ?? key
}

// ─── Comparativo de exames laboratoriais (versão a versão) ──────────────────

function ExamComparison({ exams }: { exams: MedicalExamRow[] }) {
  const [onlyChanged, setOnlyChanged] = useState(false)

  // datas distintas, em ordem cronológica, últimas 4
  const dates = [...new Set(exams.map(e => e.exam_date))].sort().slice(-4)
  if (dates.length === 0) return null

  // marcador → { data → linha }
  const byMarker = new Map<string, Map<string, MedicalExamRow>>()
  for (const e of exams) {
    if (!dates.includes(e.exam_date) || e.value == null) continue
    if (!byMarker.has(e.exam_name)) byMarker.set(e.exam_name, new Map())
    const m = byMarker.get(e.exam_name)!
    if (!m.has(e.exam_date)) m.set(e.exam_date, e)
  }

  let markers = [...byMarker.keys()].sort((a, b) => a.localeCompare(b))
  if (onlyChanged) {
    markers = markers.filter(name => {
      const m = byMarker.get(name)!
      const vals = dates.map(d => m.get(d)?.value).filter((v): v is number => v != null)
      return vals.length >= 2 && vals.some(v => v !== vals[0])
    })
  }
  if (markers.length === 0) return null

  const outOfRange = (e: MedicalExamRow) =>
    e.value != null && ((e.reference_min != null && e.value < e.reference_min) || (e.reference_max != null && e.value > e.reference_max))

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-border/50 flex-wrap">
        <div className="flex items-center gap-2">
          <HeartPulse className="w-4 h-4 text-[#0088ff]" />
          <h3 className="text-sm font-bold text-foreground">Comparativo entre versões</h3>
          <span className="text-[10px] text-muted-foreground">últimas {dates.length} coletas</span>
        </div>
        <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer select-none">
          <input type="checkbox" checked={onlyChanged} onChange={e => setOnlyChanged(e.target.checked)} className="accent-[#e8001c]" />
          Somente marcadores que mudaram
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs" style={{ minWidth: 480 }}>
          <thead>
            <tr className="border-b border-border/50">
              <th className="text-left px-5 py-2.5 font-bold text-muted-foreground text-[10px] uppercase tracking-wider sticky left-0 bg-card">Marcador</th>
              {dates.map(d => (
                <th key={d} className="text-right px-4 py-2.5 font-bold text-muted-foreground text-[10px] whitespace-nowrap">{fmtDate(d)}</th>
              ))}
              <th className="text-right px-5 py-2.5 font-bold text-muted-foreground text-[10px] uppercase tracking-wider whitespace-nowrap">Variação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {markers.map(name => {
              const m = byMarker.get(name)!
              const cells = dates.map(d => m.get(d) ?? null)
              const present = cells.filter((c): c is MedicalExamRow => c?.value != null)
              const last = present[present.length - 1]
              const prev = present.length >= 2 ? present[present.length - 2] : null
              const delta = last?.value != null && prev?.value != null && prev.value !== 0
                ? ((last.value - prev.value) / Math.abs(prev.value)) * 100
                : null
              return (
                <tr key={name}>
                  <td className="px-5 py-2.5 font-semibold text-foreground sticky left-0 bg-card whitespace-nowrap">
                    {name}
                    {last?.unit && <span className="text-muted-foreground font-normal ml-1">({last.unit})</span>}
                    {last && (last.reference_min != null || last.reference_max != null) && (
                      <span className="block text-[9px] text-muted-foreground/70 font-normal">
                        ref: {last.reference_min ?? '—'} – {last.reference_max ?? '—'}
                      </span>
                    )}
                  </td>
                  {cells.map((c, i) => (
                    <td key={i} className="text-right px-4 py-2.5 whitespace-nowrap">
                      {c?.value == null
                        ? <span className="text-muted-foreground/40">—</span>
                        : <span className="font-bold" style={{ color: outOfRange(c) ? '#e8001c' : 'var(--foreground)' }}>
                            {c.value}
                            {outOfRange(c) && <span className="ml-0.5" title="Fora da referência">⚠</span>}
                          </span>}
                    </td>
                  ))}
                  <td className="text-right px-5 py-2.5 whitespace-nowrap">
                    {delta == null
                      ? <Minus className="w-3 h-3 inline text-muted-foreground/40" />
                      : (
                        <span className="inline-flex items-center gap-1 font-bold"
                          style={{ color: Math.abs(delta) < 0.05 ? 'var(--muted-foreground)' : delta > 0 ? '#0088ff' : '#ffa800' }}>
                          {Math.abs(delta) < 0.05 ? <Minus className="w-3 h-3" /> : delta > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {delta > 0 ? '+' : ''}{delta.toFixed(1)}%
                        </span>
                      )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="px-5 py-2.5 text-[9px] text-muted-foreground border-t border-border/40">
        ⚠ = fora da faixa de referência · Variação compara a coleta mais recente com a anterior · Valores importados dos PDFs ou lançados manualmente
      </p>
    </div>
  )
}

// ─── Seção principal do prontuário ──────────────────────────────────────────

interface Props {
  athleteId: string
  exams: MedicalExamRow[]
}

export function ProntuarioSection({ athleteId, exams }: Props) {
  const [records, setRecords] = useState<MedicalRecordRow[] | null>([])
  const [profile, setProfile] = useState<MedicalProfileRow | null>(null)
  const [migrationMissing, setMigrationMissing] = useState(false)
  const [saving, setSaving] = useState(false)

  // modal de avaliação
  const [recordOpen, setRecordOpen] = useState(false)
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null)
  const emptyRecord = { record_type: 'atestado', title: '', performed_at: '', expires_at: '', doctor_name: '', lab_name: '', result: '', notes: '' }
  const [recordForm, setRecordForm] = useState(emptyRecord)

  // modal de anamnese
  const [profileOpen, setProfileOpen] = useState(false)
  const emptyProfile = { blood_type: '', allergies: '', medications: '', surgeries: '', conditions: '', family_history: '', emergency_contact: '' }
  const [profileForm, setProfileForm] = useState(emptyProfile)

  useEffect(() => { load() }, [athleteId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    const [recs, prof] = await Promise.all([getMedicalRecords(athleteId), getMedicalProfile(athleteId)])
    setMigrationMissing(recs === null)
    setRecords(recs)
    setProfile(prof)
  }

  function openNewRecord() {
    const t = todayLocalISO()
    setRecordForm({ ...emptyRecord, performed_at: t, expires_at: addMonths(t, 12) })
    setEditingRecordId(null)
    setRecordOpen(true)
  }

  function openEditRecord(r: MedicalRecordRow) {
    setRecordForm({
      record_type: r.record_type, title: r.title ?? '', performed_at: r.performed_at,
      expires_at: r.expires_at ?? '', doctor_name: r.doctor_name ?? '', lab_name: r.lab_name ?? '',
      result: r.result ?? '', notes: r.notes ?? '',
    })
    setEditingRecordId(r.id)
    setRecordOpen(true)
  }

  function onTypeChange(key: string) {
    const t = RECORD_TYPES.find(x => x.key === key)
    setRecordForm(f => ({
      ...f,
      record_type: key,
      expires_at: t?.defaultMonths && f.performed_at ? addMonths(f.performed_at, t.defaultMonths) : f.expires_at,
      result: key === 'atestado' ? (f.result || 'apto') : f.result,
    }))
  }

  async function saveRecord() {
    if (!recordForm.record_type || !recordForm.performed_at) return
    setSaving(true)
    const sb = createClient()
    const payload = {
      record_type: recordForm.record_type,
      title: recordForm.title || null,
      performed_at: recordForm.performed_at,
      expires_at: recordForm.expires_at || null,
      doctor_name: recordForm.doctor_name || null,
      lab_name: recordForm.lab_name || null,
      result: recordForm.result || null,
      notes: recordForm.notes || null,
    }
    if (editingRecordId) await sb.from('medical_records').update(payload).eq('id', editingRecordId)
    else await sb.from('medical_records').insert({ athlete_id: athleteId, ...payload })
    setSaving(false)
    setRecordOpen(false)
    load()
  }

  async function deleteRecord(id: string) {
    if (!window.confirm('Excluir esta avaliação permanentemente?')) return
    const sb = createClient()
    await sb.from('medical_records').delete().eq('id', id)
    load()
  }

  function openProfile() {
    setProfileForm({
      blood_type: profile?.blood_type ?? '', allergies: profile?.allergies ?? '',
      medications: profile?.medications ?? '', surgeries: profile?.surgeries ?? '',
      conditions: profile?.conditions ?? '', family_history: profile?.family_history ?? '',
      emergency_contact: profile?.emergency_contact ?? '',
    })
    setProfileOpen(true)
  }

  async function saveProfile() {
    setSaving(true)
    const sb = createClient()
    await sb.from('athlete_medical_profile').upsert({
      athlete_id: athleteId,
      blood_type: profileForm.blood_type || null,
      allergies: profileForm.allergies || null,
      medications: profileForm.medications || null,
      surgeries: profileForm.surgeries || null,
      conditions: profileForm.conditions || null,
      family_history: profileForm.family_history || null,
      emergency_contact: profileForm.emergency_contact || null,
      updated_at: new Date().toISOString(),
    })
    setSaving(false)
    setProfileOpen(false)
    load()
  }

  if (migrationMissing) {
    return (
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl" style={{ background: '#ffa80012', border: '1px solid #ffa80045' }}>
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#ffa800' }} />
        <p className="text-[11px]" style={{ color: '#ffa800' }}>
          <strong>Prontuário aguardando o banco:</strong> execute a migração <strong>013_prontuario_medico.sql</strong> no SQL Editor do Supabase para ativar aptidão, validade de exames e anamnese.
        </p>
      </div>
    )
  }

  const recs = records ?? []
  // aptidão: atestado mais recente
  const latestAtestado = recs.find(r => r.record_type === 'atestado') ?? null
  const atestadoValidity = latestAtestado ? validity(latestAtestado.expires_at) : null
  const counts = {
    valid: recs.filter(r => validity(r.expires_at).status === 'valid').length,
    expiring: recs.filter(r => validity(r.expires_at).status === 'expiring').length,
    expired: recs.filter(r => validity(r.expires_at).status === 'expired').length,
  }
  const profileFilled = profile && [profile.allergies, profile.medications, profile.conditions, profile.surgeries, profile.blood_type].some(Boolean)

  const inputCls = 'w-full px-3 py-2 text-xs rounded-lg bg-background border border-border text-foreground outline-none focus:border-[#e8001c]'
  const labelCls = 'block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1'

  return (
    <div className="space-y-4">
      {/* ── Resumo do prontuário ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Aptidão */}
        <div className="rounded-xl p-4 bg-card border border-border">
          <div className="flex items-center gap-2 mb-2">
            {latestAtestado && atestadoValidity?.status !== 'expired' && latestAtestado.result !== 'inapto'
              ? <ShieldCheck className="w-4 h-4 text-[#00d084]" />
              : <ShieldAlert className="w-4 h-4 text-[#e8001c]" />}
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Aptidão médica</p>
          </div>
          {latestAtestado ? (
            <>
              <p className="text-sm font-black" style={{ color: RESULT_LABEL[latestAtestado.result ?? '']?.color ?? 'var(--foreground)' }}>
                {RESULT_LABEL[latestAtestado.result ?? '']?.label ?? 'Registrado'}
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: VALIDITY_STYLE[atestadoValidity!.status].color }}>
                {latestAtestado.expires_at ? `${VALIDITY_STYLE[atestadoValidity!.status].label(atestadoValidity!.days)} · até ${fmtDate(latestAtestado.expires_at)}` : 'Sem validade definida'}
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Nenhum atestado registrado</p>
          )}
        </div>

        {/* Validades */}
        <div className="rounded-xl p-4 bg-card border border-border">
          <div className="flex items-center gap-2 mb-2">
            <CalendarClock className="w-4 h-4 text-[#8b5cf6]" />
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Validade dos exames</p>
          </div>
          <div className="flex items-center gap-3 text-xs font-bold">
            <span style={{ color: '#00d084' }}>{counts.valid} válido{counts.valid !== 1 ? 's' : ''}</span>
            <span style={{ color: '#ffa800' }}>{counts.expiring} a vencer</span>
            <span style={{ color: '#e8001c' }}>{counts.expired} vencido{counts.expired !== 1 ? 's' : ''}</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">A vencer = próximos 30 dias</p>
        </div>

        {/* Anamnese */}
        <button onClick={openProfile} className="rounded-xl p-4 bg-card border border-border text-left transition-all hover:border-[#e8001c]/50">
          <div className="flex items-center gap-2 mb-2">
            <ClipboardList className="w-4 h-4 text-[#0088ff]" />
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Anamnese</p>
            <Pencil className="w-3 h-3 text-muted-foreground/50 ml-auto" />
          </div>
          {profileFilled ? (
            <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2">
              {[
                profile?.blood_type && `Sangue ${profile.blood_type}`,
                profile?.allergies && `Alergias: ${profile.allergies}`,
                profile?.medications && `Medicações: ${profile.medications}`,
                profile?.conditions && `Condições: ${profile.conditions}`,
              ].filter(Boolean).join(' · ')}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Toque para preencher o histórico médico</p>
          )}
        </button>
      </div>

      {/* ── Avaliações com validade ── */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Stethoscope className="w-4 h-4 text-[#00d084]" />
            <h3 className="text-sm font-bold text-foreground">Avaliações e atestados</h3>
          </div>
          <button onClick={openNewRecord}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
            style={{ background: '#00d08415', border: '1px solid #00d08445', color: '#00d084' }}>
            <Plus className="w-3 h-3" /> Registrar
          </button>
        </div>
        {recs.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">Nenhuma avaliação registrada — comece pelo atestado de aptidão</p>
        ) : (
          <div className="divide-y divide-border/40">
            {recs.map(r => {
              const v = validity(r.expires_at)
              const vs = VALIDITY_STYLE[v.status]
              return (
                <div key={r.id} className="flex items-start gap-3 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-foreground">{r.title || typeLabel(r.record_type)}</span>
                      {r.record_type === 'atestado' && r.result && RESULT_LABEL[r.result] && (
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded uppercase"
                          style={{ background: RESULT_LABEL[r.result].color + '20', color: RESULT_LABEL[r.result].color, border: `1px solid ${RESULT_LABEL[r.result].color}45` }}>
                          {RESULT_LABEL[r.result].label}
                        </span>
                      )}
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded uppercase"
                        style={{ background: vs.color === 'var(--muted-foreground)' ? 'var(--secondary)' : vs.color + '18', color: vs.color, border: `1px solid ${vs.color === 'var(--muted-foreground)' ? 'var(--border)' : vs.color + '45'}` }}>
                        {vs.label(v.days)}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {typeLabel(r.record_type)} · realizado em {fmtDate(r.performed_at)}
                      {r.expires_at && ` · válido até ${fmtDate(r.expires_at)}`}
                      {r.doctor_name && ` · Dr(a). ${r.doctor_name}`}
                      {r.lab_name && ` · ${r.lab_name}`}
                    </p>
                    {r.notes && <p className="text-[10px] text-muted-foreground/80 mt-1">{r.notes}</p>}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => openEditRecord(r)} title="Editar"><Pencil className="w-3.5 h-3.5 text-muted-foreground/40 hover:text-[#00d084]" /></button>
                    <button onClick={() => deleteRecord(r.id)} title="Excluir"><X className="w-3.5 h-3.5 text-muted-foreground/40 hover:text-[#e8001c]" /></button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Comparativo laboratorial ── */}
      <ExamComparison exams={exams} />

      {/* ── Modal: avaliação ── */}
      {recordOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setRecordOpen(false)}>
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-foreground">{editingRecordId ? 'Editar avaliação' : 'Registrar avaliação'}</h3>
              <button onClick={() => setRecordOpen(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Tipo</label>
                <select value={recordForm.record_type} onChange={e => onTypeChange(e.target.value)} className={inputCls}>
                  {RECORD_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </div>
              {recordForm.record_type === 'atestado' && (
                <div>
                  <label className={labelCls}>Resultado</label>
                  <select value={recordForm.result} onChange={e => setRecordForm(f => ({ ...f, result: e.target.value }))} className={inputCls}>
                    <option value="apto">Apto</option>
                    <option value="apto_restricoes">Apto com restrições</option>
                    <option value="inapto">Inapto</option>
                  </select>
                </div>
              )}
              <div>
                <label className={labelCls}>Título (opcional)</label>
                <input value={recordForm.title} onChange={e => setRecordForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex.: Teste ergométrico — esteira" className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Realizado em</label>
                  <input type="date" value={recordForm.performed_at}
                    onChange={e => {
                      const t = RECORD_TYPES.find(x => x.key === recordForm.record_type)
                      setRecordForm(f => ({ ...f, performed_at: e.target.value, expires_at: t?.defaultMonths ? addMonths(e.target.value, t.defaultMonths) : f.expires_at }))
                    }} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Válido até</label>
                  <input type="date" value={recordForm.expires_at} onChange={e => setRecordForm(f => ({ ...f, expires_at: e.target.value }))} className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Médico(a)</label>
                  <input value={recordForm.doctor_name} onChange={e => setRecordForm(f => ({ ...f, doctor_name: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Clínica/Lab</label>
                  <input value={recordForm.lab_name} onChange={e => setRecordForm(f => ({ ...f, lab_name: e.target.value }))} className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Observações</label>
                <textarea value={recordForm.notes} onChange={e => setRecordForm(f => ({ ...f, notes: e.target.value }))} rows={2} className={inputCls} />
              </div>
              <button onClick={saveRecord} disabled={saving || !recordForm.performed_at}
                className="w-full py-2.5 text-xs font-bold rounded-lg bg-primary text-white disabled:opacity-50">
                {saving ? 'Salvando...' : 'Salvar avaliação'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: anamnese ── */}
      {profileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setProfileOpen(false)}>
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-foreground">Anamnese — histórico médico</h3>
              <button onClick={() => setProfileOpen(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Tipo sanguíneo</label>
                  <select value={profileForm.blood_type} onChange={e => setProfileForm(f => ({ ...f, blood_type: e.target.value }))} className={inputCls}>
                    <option value="">—</option>
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Contato de emergência</label>
                  <input value={profileForm.emergency_contact} onChange={e => setProfileForm(f => ({ ...f, emergency_contact: e.target.value }))} placeholder="Nome · telefone" className={inputCls} />
                </div>
              </div>
              {([
                ['allergies', 'Alergias'],
                ['medications', 'Medicamentos em uso'],
                ['conditions', 'Condições / diagnósticos'],
                ['surgeries', 'Cirurgias prévias'],
                ['family_history', 'Histórico familiar'],
              ] as const).map(([key, label]) => (
                <div key={key}>
                  <label className={labelCls}>{label}</label>
                  <textarea value={profileForm[key]} onChange={e => setProfileForm(f => ({ ...f, [key]: e.target.value }))} rows={2} className={inputCls} />
                </div>
              ))}
              <button onClick={saveProfile} disabled={saving}
                className="w-full py-2.5 text-xs font-bold rounded-lg bg-primary text-white disabled:opacity-50">
                {saving ? 'Salvando...' : 'Salvar anamnese'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
