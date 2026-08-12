'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  getMedicalClearances, saveMedicalClearance, deleteMedicalClearance, clearanceState, getMyRole,
  type MedicalClearanceRow, type ClearanceStatus,
} from '@/lib/supabase/queries'
import { ShieldCheck, Plus, X, Loader2, Check, Trash2, AlertTriangle, Stethoscope } from 'lucide-react'

const RED = 'var(--marca)'
const STATUS_OPTS: { v: ClearanceStatus; t: string; d: string; c: string }[] = [
  { v: 'apto', t: 'Apto', d: 'Liberado para treinar e competir sem restrições.', c: '#00d084' },
  { v: 'apto_restricao', t: 'Apto com restrição', d: 'Pode treinar, mas com limitações que o treinador precisa respeitar.', c: '#f59e0b' },
  { v: 'inapto', t: 'Inapto', d: 'Não liberado para treinar no momento.', c: '#ef4444' },
]
const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')

/** Selo compacto da situação de liberação — usado na ficha e nas listas. */
export function ClearanceBadge({ clearance }: { clearance: MedicalClearanceRow | null | undefined }) {
  const s = clearanceState(clearance)
  return (
    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded whitespace-nowrap"
      style={{ background: s.color + '22', color: s.color }}>{s.label}</span>
  )
}

/** Parecer médico de aptidão: emissão (médico/admin) + histórico (todos). */
export function MedicalClearance({ athleteId }: { athleteId: string }) {
  const [rows, setRows] = useState<MedicalClearanceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<string | null>(null)
  const [modal, setModal] = useState(false)

  async function load() { setLoading(true); setRows(await getMedicalClearances(athleteId)); setLoading(false) }
  useEffect(() => {
    load()
    getMyRole().then(setRole).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [athleteId])

  const canIssue = role === 'doctor' || role === 'admin'
  const current = rows[0] ?? null
  const state = clearanceState(current)

  async function remove(id: string) {
    if (!confirm('Excluir este parecer do histórico?')) return
    await deleteMedicalClearance(id); load()
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
      {/* Situação atual em destaque */}
      <div className="p-5" style={{ borderTop: `3px solid ${state.color}` }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <span className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: state.color + '1f' }}>
              <ShieldCheck className="w-6 h-6" style={{ color: state.color }} />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Liberação médica</p>
              <p className="text-xl font-black leading-tight" style={{ color: state.color }}>{state.label}</p>
              {current && (
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Avaliado em {fmtDate(current.assessed_at)}
                  {current.valid_until && ` · válido até ${fmtDate(current.valid_until)}`}
                  {current.doctor_name && ` · ${current.doctor_name}`}
                  {current.doctor_crm && ` (${current.doctor_crm})`}
                </p>
              )}
            </div>
          </div>
          {canIssue && (
            <button onClick={() => setModal(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold text-white shrink-0" style={{ background: RED }}>
              <Plus className="w-4 h-4" /> Parecer
            </button>
          )}
        </div>

        {current?.restrictions && (
          <div className="mt-3 flex items-start gap-2 rounded-xl px-3.5 py-2.5" style={{ background: '#f59e0b18', border: '1px solid #f59e0b40' }}>
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#b45309' }} />
            <div className="min-w-0">
              <p className="text-xs font-black text-foreground">Restrições</p>
              <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-line">{current.restrictions}</p>
            </div>
          </div>
        )}
        {current?.notes && <p className="text-xs text-muted-foreground mt-3 whitespace-pre-line">{current.notes}</p>}
        {!loading && !current && (
          <p className="text-xs text-muted-foreground mt-3">
            {canIssue ? 'Nenhum parecer emitido. Clique em "Parecer" para avaliar este atleta.' : 'Este atleta ainda não passou por avaliação médica.'}
          </p>
        )}
      </div>

      {/* Histórico */}
      {rows.length > 1 && (
        <div className="border-t border-border px-5 py-3">
          <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-2">Histórico</p>
          <div className="space-y-1.5">
            {rows.slice(1).map(r => {
              const s = clearanceState(r)
              return (
                <div key={r.id} className="flex items-center gap-2.5 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.color }} />
                  <span className="text-muted-foreground w-[74px] shrink-0">{fmtDate(r.assessed_at)}</span>
                  <span className="font-bold shrink-0" style={{ color: s.color }}>{s.label}</span>
                  <span className="text-muted-foreground truncate flex-1">{r.doctor_name ?? ''}</span>
                  {canIssue && (
                    <button onClick={() => remove(r.id)} className="p-0.5 text-red-400 hover:text-red-500 shrink-0" aria-label="Excluir"><Trash2 className="w-3 h-3" /></button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {modal && <ClearanceModal athleteId={athleteId} onClose={() => setModal(false)} onSaved={() => { setModal(false); load() }} />}
    </div>
  )
}

function ClearanceModal({ athleteId, onClose, onSaved }: { athleteId: string; onClose: () => void; onSaved: () => void }) {
  const [status, setStatus] = useState<ClearanceStatus>('apto')
  const [assessedAt, setAssessedAt] = useState(new Date().toLocaleDateString('en-CA'))
  const [validUntil, setValidUntil] = useState('')
  const [crm, setCrm] = useState('')
  const [restrictions, setRestrictions] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  async function save() {
    setSaving(true); setErr(null)
    const res = await saveMedicalClearance({
      athlete_id: athleteId, status, assessed_at: assessedAt,
      valid_until: validUntil || null,
      restrictions: restrictions.trim() || null,
      notes: notes.trim() || null,
      doctor_crm: crm.trim() || null,
    })
    setSaving(false)
    if (!res.ok) { setErr(res.error ?? 'Falha ao salvar o parecer.'); return }
    onSaved()
  }

  const inCls = 'w-full rounded-lg px-2.5 py-2 text-sm bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--marca-40)]'
  if (!mounted) return null
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-2xl max-h-[92vh] flex flex-col safe-bottom">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-black text-foreground flex items-center gap-2"><Stethoscope className="w-4 h-4 text-primary" /> Parecer médico</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-4">
          <div className="space-y-2">
            {STATUS_OPTS.map(o => (
              <button key={o.v} type="button" onClick={() => setStatus(o.v)}
                className="w-full text-left rounded-xl px-3.5 py-3 transition-colors"
                style={status === o.v ? { background: o.c + '14', border: `1.5px solid ${o.c}` } : { background: 'var(--panel)', border: '1px solid var(--panel-border)' }}>
                <div className="flex items-center gap-2.5">
                  <span className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center border-2"
                    style={status === o.v ? { background: o.c, borderColor: o.c } : { borderColor: 'var(--border)' }}>
                    {status === o.v && <Check className="w-2.5 h-2.5 text-white" />}
                  </span>
                  <div>
                    <p className="text-sm font-black" style={{ color: status === o.v ? o.c : 'var(--foreground)' }}>{o.t}</p>
                    <p className="text-[11px] text-muted-foreground">{o.d}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-muted-foreground">Data da avaliação
              <input type="date" value={assessedAt} onChange={e => setAssessedAt(e.target.value)} className={`${inCls} mt-1`} />
            </label>
            <label className="text-xs font-semibold text-muted-foreground">Válido até (opcional)
              <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className={`${inCls} mt-1`} />
            </label>
          </div>

          <label className="text-xs font-semibold text-muted-foreground block">CRM (opcional)
            <input value={crm} onChange={e => setCrm(e.target.value)} placeholder="ex: CRM-SP 123456" className={`${inCls} mt-1`} />
          </label>

          {status !== 'apto' && (
            <label className="text-xs font-semibold text-muted-foreground block">Restrições
              <textarea value={restrictions} onChange={e => setRestrictions(e.target.value)} rows={2}
                placeholder="ex: sem treinos de alta intensidade por 4 semanas" className={`${inCls} mt-1 resize-none`} />
            </label>
          )}

          <label className="text-xs font-semibold text-muted-foreground block">Parecer / observações
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="Avaliação clínica, exames considerados, conduta…" className={`${inCls} mt-1 resize-none`} />
          </label>

          {err && <p className="text-xs text-red-500">{err}</p>}
          <p className="text-[10px] text-muted-foreground">O parecer fica registrado com seu nome e a data. O treinador vê a situação e as restrições, mas não pode alterá-las.</p>
        </div>

        <div className="flex items-center gap-2 px-5 py-4 border-t border-border">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-bold text-muted-foreground border border-border hover:bg-secondary">Cancelar</button>
          <button onClick={save} disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-black text-white disabled:opacity-60" style={{ background: RED }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}{saving ? 'Salvando…' : 'Emitir parecer'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
