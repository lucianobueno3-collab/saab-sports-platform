'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  getBloodExams, saveBloodExam, updateBloodExamValues, deleteBloodExam, readPdfViaServer,
  type BloodExamRow, type BloodExamValue,
} from '@/lib/supabase/queries'
import { BLOOD_CATEGORIES, BLOOD_MARKERS, flagValue, refLabel, type Sex } from '@/lib/blood-markers'
import { hasExtractableText, extractDateFromText } from '@/lib/parsers/pdf-parser'
import { parseBloodPdfText } from '@/lib/blood-parser'
import { Plus, Trash2, Pencil, X, Loader2, ChevronDown, FlaskConical, Check, Upload } from 'lucide-react'

const RED = 'var(--marca)'
const FLAG_COLOR = { low: '#0088ff', high: '#ef4444', ok: 'var(--foreground)' } as const

function fmt(value: number | null, decimals?: number) {
  if (value == null) return '—'
  return decimals ? value.toFixed(decimals) : (Number.isInteger(value) ? value.toLocaleString('pt-BR') : String(value))
}
function fmtDate(d: string) { return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) }

/** Mini-gráfico de tendência do marcador entre os exames (precisa de 2+ valores). */
function Sparkline({ values }: { values: (number | null)[] }) {
  const pts = values.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v != null)
  if (pts.length < 2) return <span className="w-[54px] shrink-0" />
  const ys = pts.map(p => p.v)
  const min = Math.min(...ys), max = Math.max(...ys)
  const span = max - min || 1
  const W = 54, H = 18
  const x = (i: number) => (values.length === 1 ? 0 : (i / (values.length - 1)) * (W - 2) + 1)
  const y = (v: number) => H - 2 - ((v - min) / span) * (H - 4)
  const d = pts.map((p, k) => `${k === 0 ? 'M' : 'L'}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')
  const first = ys[0], last = ys[ys.length - 1]
  const color = last === first ? '#94a3b8' : last > first ? '#f59e0b' : '#0088ff'
  return (
    <svg width={W} height={H} className="shrink-0" aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(pts[pts.length - 1].i)} cy={y(last)} r="2" fill={color} />
    </svg>
  )
}

export function BloodExams({ athleteId, sex }: { athleteId: string; sex: Sex }) {
  const [exams, setExams] = useState<BloodExamRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)
  const [modal, setModal] = useState<null | { edit?: BloodExamRow }>(null)

  async function load() { setLoading(true); setExams(await getBloodExams(athleteId)); setLoading(false) }
  useEffect(() => { load() /* eslint-disable-next-line */ }, [athleteId])

  const filled = useMemo(() => {
    const s = new Set<string>()
    for (const e of exams) for (const v of e.values) if (v.value != null) s.add(v.marker_key)
    return s
  }, [exams])

  const valOf = (exam: BloodExamRow, key: string) => exam.values.find(v => v.marker_key === key)?.value ?? null

  async function remove(id: string) {
    if (!confirm('Excluir este exame e todos os seus valores?')) return
    await deleteBloodExam(id); load()
  }

  const cats = BLOOD_CATEGORIES
    .map(c => ({ ...c, markers: c.markers.filter(m => showAll || filled.has(m.key)) }))
    .filter(c => c.markers.length > 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-5 h-5 text-primary" />
          <h3 className="text-base font-black text-foreground">Exames de sangue</h3>
        </div>
        <div className="flex items-center gap-2">
          {exams.length > 0 && (
            <button onClick={() => setShowAll(v => !v)} className="text-xs font-bold text-muted-foreground hover:text-foreground px-2 py-1.5">
              {showAll ? 'Só preenchidos' : 'Todos os campos'}
            </button>
          )}
          <button onClick={() => setModal({})} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold text-white" style={{ background: RED }}>
            <Plus className="w-4 h-4" /> Novo exame
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : exams.length === 0 ? (
        <div className="rounded-2xl p-8 text-center text-sm text-muted-foreground" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          Nenhum exame de sangue ainda. Clique em <strong className="text-foreground">Novo exame</strong> para registrar os valores — o histórico e o comparativo aparecem aqui.
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-3 py-2.5 sticky left-0 bg-card z-10 min-w-[190px]">
                    <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Marcador</span>
                  </th>
                  {exams.map(e => (
                    <th key={e.id} className="px-3 py-2 text-center min-w-[92px]">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-xs font-black text-foreground">{fmtDate(e.exam_date)}</span>
                        {e.lab && <span className="text-[9px] text-muted-foreground truncate max-w-[84px]">{e.lab}</span>}
                        <div className="flex items-center gap-1 mt-0.5">
                          <button onClick={() => setModal({ edit: e })} className="p-0.5 text-muted-foreground hover:text-foreground" aria-label="Editar"><Pencil className="w-3 h-3" /></button>
                          <button onClick={() => remove(e.id)} className="p-0.5 text-red-400 hover:text-red-500" aria-label="Excluir"><Trash2 className="w-3 h-3" /></button>
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cats.map(c => (
                  <Fragment key={c.key}>
                    <tr className="bg-secondary/40">
                      <td colSpan={exams.length + 1} className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-primary sticky left-0">{c.label}</td>
                    </tr>
                    {c.markers.map(m => (
                      <tr key={m.key} className="border-b border-border/50">
                        <td className="px-3 py-2 sticky left-0 bg-card z-10">
                          <div className="flex items-center gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-foreground leading-tight">{m.label}</p>
                              <p className="text-[10px] text-muted-foreground">{m.unit || '—'} · ref {refLabel(m, sex)}</p>
                            </div>
                            {/* tendência ao longo dos exames (antigo → recente) */}
                            <Sparkline values={[...exams].reverse().map(e => valOf(e, m.key))} />
                          </div>
                        </td>
                        {exams.map(e => {
                          const v = valOf(e, m.key)
                          const fl = flagValue(m, v, sex)
                          return (
                            <td key={e.id} className="px-3 py-2 text-center font-bold" style={{ color: fl ? FLAG_COLOR[fl] : 'var(--muted-foreground)' }}>
                              {fmt(v, m.decimals)}
                              {fl === 'high' && <span className="text-[9px] align-super">▲</span>}
                              {fl === 'low' && <span className="text-[9px] align-super">▼</span>}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-3 py-2 border-t border-border flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span style={{ color: '#ef4444' }}>▲</span> acima da referência</span>
            <span className="flex items-center gap-1"><span style={{ color: '#0088ff' }}>▼</span> abaixo da referência</span>
          </div>
        </div>
      )}

      {modal && (
        <ExamModal athleteId={athleteId} sex={sex} edit={modal.edit}
          onClose={() => setModal(null)} onSaved={() => { setModal(null); load() }} />
      )}
    </div>
  )
}

// ─── Novo/editar exame ──────────────────────────────────────────────────────
function ExamModal({ athleteId, sex, edit, onClose, onSaved }: {
  athleteId: string; sex: Sex; edit?: BloodExamRow; onClose: () => void; onSaved: () => void
}) {
  const [date, setDate] = useState(edit?.exam_date ?? new Date().toLocaleDateString('en-CA'))
  const [lab, setLab] = useState(edit?.lab ?? '')
  const [notes, setNotes] = useState(edit?.notes ?? '')
  const [vals, setVals] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {}
    for (const v of edit?.values ?? []) if (v.value != null) o[v.marker_key] = String(v.value)
    return o
  })
  const [open, setOpen] = useState<Set<string>>(() => new Set(edit ? BLOOD_CATEGORIES.map(c => c.key) : [BLOOD_CATEGORIES[0].key]))
  const [saving, setSaving] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const [imported, setImported] = useState<Set<string>>(new Set())
  useEffect(() => { setMounted(true) }, [])

  // OCR/leitura do PDF de sangue → pré-preenche os campos para conferência.
  async function importPdf(file: File) {
    setImporting(true); setImportMsg(null)
    try {
      // Extração no SERVIDOR (robusta em qualquer navegador/mobile).
      const res = await readPdfViaServer(file)
      if (!res.ok || res.text == null) {
        setImportMsg(res.error ?? 'Não foi possível ler o PDF.')
        return
      }
      const text = res.text
      if (!hasExtractableText(text)) {
        setImportMsg('Este PDF parece ser uma imagem escaneada (sem texto). Digite os valores manualmente.')
        return
      }
      const found = parseBloodPdfText(text)
      if (found.length === 0) {
        setImportMsg('Não reconheci nenhum marcador neste PDF. Confira se é um exame de sangue ou digite manualmente.')
        return
      }
      setVals(prev => { const o = { ...prev }; for (const f of found) o[f.key] = String(f.value); return o })
      setImported(new Set(found.map(f => f.key)))
      setOpen(new Set(BLOOD_CATEGORIES.filter(c => c.markers.some(m => found.find(f => f.key === m.key))).map(c => c.key)))
      const d = extractDateFromText(text)
      if (d && !edit) setDate(d)
      setImportMsg(`${found.length} valores encontrados — confira e ajuste antes de salvar.`)
    } catch (e) {
      setImportMsg(e instanceof Error ? e.message : 'Falha ao ler o PDF.')
    } finally {
      setImporting(false)
    }
  }

  const toggle = (k: string) => setOpen(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n })
  const setV = (k: string, s: string) => {
    setVals(o => ({ ...o, [k]: s.replace(',', '.') }))
    setImported(im => { if (!im.has(k)) return im; const n = new Set(im); n.delete(k); return n })
  }
  const filledCount = (catKey: string) => BLOOD_CATEGORIES.find(c => c.key === catKey)!.markers.filter(m => vals[m.key]?.trim()).length

  async function save() {
    setSaving(true)
    const values: BloodExamValue[] = Object.entries(vals)
      .map(([k, s]) => ({ marker_key: k, value: s.trim() === '' ? null : parseFloat(s), unit: BLOOD_MARKERS[k]?.unit ?? null }))
      .filter(v => v.value != null && !Number.isNaN(v.value))
    if (edit) {
      await updateBloodExamValues(edit.id, values)
    } else {
      const res = await saveBloodExam({ athlete_id: athleteId, exam_date: date, lab: lab.trim() || null, notes: notes.trim() || null, values })
      if (!res.ok) { setSaving(false); alert(res.error ?? 'Falha ao salvar.'); return }
    }
    setSaving(false); onSaved()
  }

  const inCls = 'w-full rounded-lg px-2.5 py-1.5 text-sm bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--marca-40)]'
  if (!mounted) return null
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full max-w-lg shadow-2xl max-h-[92vh] flex flex-col safe-bottom">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-black text-foreground">{edit ? 'Editar exame' : 'Novo exame de sangue'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-4">
          {/* Importar PDF do laudo (lê a camada de texto e pré-preenche os campos) */}
          <div className="rounded-xl p-3" style={{ background: 'var(--panel)', border: '1px dashed var(--panel-border)' }}>
            <label className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold cursor-pointer ${importing ? 'opacity-60' : ''}`}
              style={{ background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground)' }}>
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4 text-primary" />}
              {importing ? 'Lendo o PDF…' : 'Importar PDF do exame'}
              <input type="file" accept="application/pdf" className="hidden" disabled={importing}
                onChange={e => { const f = e.target.files?.[0]; if (f) importPdf(f); e.target.value = '' }} />
            </label>
            {importMsg
              ? <p className="text-[11px] mt-2 text-center" style={{ color: imported.size ? '#00d084' : '#ef4444' }}>{importMsg}</p>
              : <p className="text-[11px] text-muted-foreground mt-2 text-center">Leia o laudo em PDF e confira os valores — os campos preenchidos ficam destacados.</p>}
          </div>

          {!edit && (
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-semibold text-muted-foreground">Data do exame
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className={`${inCls} mt-1`} />
              </label>
              <label className="text-xs font-semibold text-muted-foreground">Laboratório (opcional)
                <input value={lab} onChange={e => setLab(e.target.value)} placeholder="ex: Fleury" className={`${inCls} mt-1`} />
              </label>
            </div>
          )}

          {BLOOD_CATEGORIES.map(c => {
            const isOpen = open.has(c.key)
            const n = filledCount(c.key)
            return (
              <div key={c.key} className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                <button type="button" onClick={() => toggle(c.key)} className="w-full flex items-center justify-between px-3 py-2.5 bg-secondary/40">
                  <span className="text-sm font-black text-foreground">{c.label}{n > 0 && <span className="ml-2 text-[10px] font-bold text-primary">{n} preench.</span>}</span>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                  <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {c.markers.map(m => (
                      <label key={m.key} className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate">{m.label}</p>
                          <p className="text-[10px] text-muted-foreground">{m.unit || '—'} · ref {refLabel(m, sex)}</p>
                        </div>
                        <input inputMode="decimal" value={vals[m.key] ?? ''} onChange={e => setV(m.key, e.target.value)}
                          placeholder="—" className="w-[84px] shrink-0 rounded-lg px-2 py-1.5 text-sm text-right bg-background border text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--marca-40)]"
                          style={imported.has(m.key) ? { borderColor: RED, boxShadow: `0 0 0 1px ${RED}` } : { borderColor: 'var(--border)' }} />
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          <label className="text-xs font-semibold text-muted-foreground block">Observações (opcional)
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={`${inCls} mt-1 resize-none`} placeholder="notas do exame…" />
          </label>
        </div>

        <div className="flex items-center gap-2 px-5 py-4 border-t border-border">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-bold text-muted-foreground border border-border hover:bg-secondary">Cancelar</button>
          <button onClick={save} disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-black text-white disabled:opacity-60" style={{ background: RED }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}{saving ? 'Salvando…' : 'Salvar exame'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
