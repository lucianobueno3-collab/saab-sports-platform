'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getAthleteInjuries, getAthleteMedicalExams, type InjuryRow, type MedicalExamRow } from '@/lib/supabase/queries'
import { Plus, X, AlertTriangle, FlaskConical, CheckCircle2, Circle } from 'lucide-react'

const SEVERITY_LABEL = { mild: 'Leve', moderate: 'Moderada', severe: 'Grave' }
const SEVERITY_COLOR = { mild: '#4ade80', moderate: '#fbbf24', severe: '#ef4444' }

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
}

function ExamStatus({ value, min, max }: { value: number | null; min: number | null; max: number | null }) {
  if (value == null) return null
  if (min != null && value < min) return <span className="text-xs font-bold" style={{ color: '#ef4444' }}>↓ Baixo</span>
  if (max != null && value > max) return <span className="text-xs font-bold" style={{ color: '#fbbf24' }}>↑ Alto</span>
  return <span className="text-xs font-bold" style={{ color: '#4ade80' }}>✓ Normal</span>
}

interface Props { athleteId: string }

export function SaudeTab({ athleteId }: Props) {
  const [injuries, setInjuries] = useState<InjuryRow[]>([])
  const [exams, setExams] = useState<MedicalExamRow[]>([])
  const [loading, setLoading] = useState(true)

  // Injury modal
  const [injuryOpen, setInjuryOpen] = useState(false)
  const [injuryForm, setInjuryForm] = useState({ location: '', injury_type: '', severity: 'moderate', started_at: '', resolved_at: '', notes: '' })

  // Exam modal
  const [examOpen, setExamOpen] = useState(false)
  const [examForm, setExamForm] = useState({ exam_name: '', exam_date: '', value: '', unit: '', reference_min: '', reference_max: '', notes: '' })

  const [saving, setSaving] = useState(false)

  useEffect(() => {
    load()
  }, [athleteId])

  async function load() {
    setLoading(true)
    const [inj, ex] = await Promise.all([getAthleteInjuries(athleteId), getAthleteMedicalExams(athleteId)])
    setInjuries(inj)
    setExams(ex)
    setLoading(false)
  }

  async function saveInjury() {
    if (!injuryForm.location || !injuryForm.injury_type || !injuryForm.started_at) return
    setSaving(true)
    const sb = createClient()
    await sb.from('injuries').insert({
      athlete_id: athleteId,
      location: injuryForm.location,
      injury_type: injuryForm.injury_type,
      severity: injuryForm.severity,
      started_at: injuryForm.started_at,
      resolved_at: injuryForm.resolved_at || null,
      notes: injuryForm.notes || null,
    })
    setSaving(false)
    setInjuryOpen(false)
    setInjuryForm({ location: '', injury_type: '', severity: 'moderate', started_at: '', resolved_at: '', notes: '' })
    load()
  }

  async function saveExam() {
    if (!examForm.exam_name || !examForm.exam_date) return
    setSaving(true)
    const sb = createClient()
    await sb.from('medical_exams').insert({
      athlete_id: athleteId,
      exam_name: examForm.exam_name,
      exam_date: examForm.exam_date,
      value: examForm.value ? parseFloat(examForm.value) : null,
      unit: examForm.unit || null,
      reference_min: examForm.reference_min ? parseFloat(examForm.reference_min) : null,
      reference_max: examForm.reference_max ? parseFloat(examForm.reference_max) : null,
      notes: examForm.notes || null,
    })
    setSaving(false)
    setExamOpen(false)
    setExamForm({ exam_name: '', exam_date: '', value: '', unit: '', reference_min: '', reference_max: '', notes: '' })
    load()
  }

  async function resolveInjury(id: string) {
    const sb = createClient()
    await sb.from('injuries').update({ resolved_at: new Date().toISOString().slice(0, 10) }).eq('id', id)
    load()
  }

  async function deleteInjury(id: string) {
    const sb = createClient()
    await sb.from('injuries').delete().eq('id', id)
    load()
  }

  async function deleteExam(id: string) {
    const sb = createClient()
    await sb.from('medical_exams').delete().eq('id', id)
    load()
  }

  const activeInjuries = injuries.filter(i => !i.resolved_at)
  const resolvedInjuries = injuries.filter(i => i.resolved_at)

  // Group exams by name, show latest value + history
  const examGroups = exams.reduce<Record<string, MedicalExamRow[]>>((acc, e) => {
    if (!acc[e.exam_name]) acc[e.exam_name] = []
    acc[e.exam_name].push(e)
    return acc
  }, {})

  if (loading) return <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">Carregando...</div>

  return (
    <div className="space-y-6">
      {/* Lesões */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#fbbf24]" />
            <h3 className="text-sm font-bold text-foreground">Histórico de Lesões</h3>
            {activeInjuries.length > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded" style={{ background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440' }}>
                {activeInjuries.length} ativa{activeInjuries.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <button onClick={() => setInjuryOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
            style={{ background: '#fbbf2415', border: '1px solid #fbbf2440', color: '#fbbf24' }}>
            <Plus className="w-3 h-3" /> Registrar Lesão
          </button>
        </div>
        {injuries.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">Nenhuma lesão registrada</p>
        ) : (
          <div className="divide-y divide-border/40">
            {[...activeInjuries, ...resolvedInjuries].map(inj => (
              <div key={inj.id} className="flex items-start gap-3 px-5 py-3">
                <div className="mt-0.5">
                  {inj.resolved_at
                    ? <CheckCircle2 className="w-4 h-4 text-muted-foreground/40" />
                    : <Circle className="w-4 h-4" style={{ color: SEVERITY_COLOR[inj.severity] }} />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-foreground">{inj.injury_type}</span>
                    <span className="text-xs text-muted-foreground">—</span>
                    <span className="text-xs text-muted-foreground">{inj.location}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                      style={{ background: SEVERITY_COLOR[inj.severity] + '20', color: SEVERITY_COLOR[inj.severity], border: `1px solid ${SEVERITY_COLOR[inj.severity]}40` }}>
                      {SEVERITY_LABEL[inj.severity]}
                    </span>
                    {inj.resolved_at && (
                      <span className="text-[10px] text-muted-foreground/50">Resolvida</span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {fmtDate(inj.started_at)}{inj.resolved_at ? ` → ${fmtDate(inj.resolved_at)}` : ' — Em andamento'}
                  </p>
                  {inj.notes && <p className="text-[10px] text-muted-foreground/70 mt-1 italic">{inj.notes}</p>}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {!inj.resolved_at && (
                    <button onClick={() => resolveInjury(inj.id)}
                      className="text-[10px] px-2 py-1 rounded transition-colors"
                      style={{ background: '#4ade8015', border: '1px solid #4ade8040', color: '#4ade80' }}>
                      Resolver
                    </button>
                  )}
                  <button onClick={() => deleteInjury(inj.id)}
                    className="p-1 rounded hover:bg-secondary transition-colors">
                    <X className="w-3 h-3 text-muted-foreground/50" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Exames Médicos */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-[#818cf8]" />
            <h3 className="text-sm font-bold text-foreground">Exames Laboratoriais</h3>
          </div>
          <button onClick={() => setExamOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
            style={{ background: '#818cf815', border: '1px solid #818cf840', color: '#818cf8' }}>
            <Plus className="w-3 h-3" /> Adicionar Exame
          </button>
        </div>
        {Object.keys(examGroups).length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">Nenhum exame registrado</p>
        ) : (
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(examGroups).map(([name, rows]) => {
              const latest = rows[0]
              return (
                <div key={name} className="rounded-xl p-4" style={{ background: '#12121e', border: '1px solid #1e1e2e' }}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-xs font-bold text-foreground">{name}</p>
                    <ExamStatus value={latest.value} min={latest.reference_min} max={latest.reference_max} />
                  </div>
                  <div className="flex items-baseline gap-1.5 mb-1">
                    <span className="text-2xl font-black text-foreground">{latest.value ?? '—'}</span>
                    {latest.unit && <span className="text-xs text-muted-foreground">{latest.unit}</span>}
                  </div>
                  {(latest.reference_min != null || latest.reference_max != null) && (
                    <p className="text-[10px] text-muted-foreground mb-1">
                      Ref: {latest.reference_min ?? '?'} – {latest.reference_max ?? '?'} {latest.unit ?? ''}
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground/60">{fmtDate(latest.exam_date)}</p>
                  {rows.length > 1 && (
                    <div className="mt-2 pt-2 border-t border-border/30">
                      <p className="text-[9px] text-muted-foreground/50 mb-1">Histórico</p>
                      <div className="space-y-1">
                        {rows.slice(1, 4).map(r => (
                          <div key={r.id} className="flex justify-between items-center">
                            <span className="text-[10px] text-muted-foreground/60">{fmtDate(r.exam_date)}</span>
                            <span className="text-[10px] text-muted-foreground">{r.value} {r.unit}</span>
                            <button onClick={() => deleteExam(r.id)} className="p-0.5 hover:opacity-70"><X className="w-2.5 h-2.5 text-muted-foreground/30" /></button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <button onClick={() => deleteExam(latest.id)} className="mt-2 text-[9px] text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors">remover último</button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal Lesão */}
      {injuryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold">Registrar Lesão</h3>
              <button onClick={() => setInjuryOpen(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Tipo de Lesão *</label>
                  <input value={injuryForm.injury_type} onChange={e => setInjuryForm(v => ({ ...v, injury_type: e.target.value }))}
                    placeholder="ex: Tendinite, Distensão" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Localização *</label>
                  <input value={injuryForm.location} onChange={e => setInjuryForm(v => ({ ...v, location: e.target.value }))}
                    placeholder="ex: Joelho esquerdo" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Gravidade</label>
                  <select value={injuryForm.severity} onChange={e => setInjuryForm(v => ({ ...v, severity: e.target.value }))} className={inputCls}>
                    <option value="mild">Leve</option>
                    <option value="moderate">Moderada</option>
                    <option value="severe">Grave</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Data início *</label>
                  <input type="date" value={injuryForm.started_at} onChange={e => setInjuryForm(v => ({ ...v, started_at: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Data resolução</label>
                  <input type="date" value={injuryForm.resolved_at} onChange={e => setInjuryForm(v => ({ ...v, resolved_at: e.target.value }))} className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Observações</label>
                <textarea value={injuryForm.notes} onChange={e => setInjuryForm(v => ({ ...v, notes: e.target.value }))}
                  rows={2} placeholder="Notas clínicas, tratamento..." className={inputCls + ' resize-none'} />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={saveInjury} disabled={saving || !injuryForm.location || !injuryForm.injury_type || !injuryForm.started_at}
                className="flex-1 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg disabled:opacity-50">
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
              <button onClick={() => setInjuryOpen(false)} className="px-4 py-2.5 border border-border text-sm text-muted-foreground rounded-lg hover:bg-secondary">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Exame */}
      {examOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold">Adicionar Exame</h3>
              <button onClick={() => setExamOpen(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Nome do Exame *</label>
                  <input value={examForm.exam_name} onChange={e => setExamForm(v => ({ ...v, exam_name: e.target.value }))}
                    placeholder="ex: Ferritina, Vit. D" className={inputCls} list="exam-suggestions" />
                  <datalist id="exam-suggestions">
                    {['Ferritina', 'Hemoglobina', 'Hematócrito', 'Vitamina D', 'Vitamina B12', 'TSH', 'Testosterona', 'Cortisol', 'Creatinina', 'PCR', 'TGO', 'TGP'].map(s => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Data do Exame *</label>
                  <input type="date" value={examForm.exam_date} onChange={e => setExamForm(v => ({ ...v, exam_date: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Valor</label>
                  <input type="number" step="0.01" value={examForm.value} onChange={e => setExamForm(v => ({ ...v, value: e.target.value }))}
                    placeholder="ex: 45.2" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Unidade</label>
                  <input value={examForm.unit} onChange={e => setExamForm(v => ({ ...v, unit: e.target.value }))}
                    placeholder="ex: ng/mL" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Ref. mín.</label>
                  <input type="number" step="0.01" value={examForm.reference_min} onChange={e => setExamForm(v => ({ ...v, reference_min: e.target.value }))}
                    placeholder="ex: 20" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Ref. máx.</label>
                  <input type="number" step="0.01" value={examForm.reference_max} onChange={e => setExamForm(v => ({ ...v, reference_max: e.target.value }))}
                    placeholder="ex: 300" className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Observações</label>
                <textarea value={examForm.notes} onChange={e => setExamForm(v => ({ ...v, notes: e.target.value }))}
                  rows={2} placeholder="Notas do médico, contexto..." className={inputCls + ' resize-none'} />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={saveExam} disabled={saving || !examForm.exam_name || !examForm.exam_date}
                className="flex-1 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg disabled:opacity-50">
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
              <button onClick={() => setExamOpen(false)} className="px-4 py-2.5 border border-border text-sm text-muted-foreground rounded-lg hover:bg-secondary">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const inputCls = 'w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary'
