'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import {
  getAthleteMetrics, saveAthleteMetrics, deleteAthleteMetric, readPdfViaServer,
  type AthleteMetricRow,
} from '@/lib/supabase/queries'
import {
  BODY_METRICS, BODY_METRIC_BY_KEY, BODY_CATEGORY_LABEL, BODY_CATEGORY_COLOR,
  deltaColor, type BodyCategory,
} from '@/lib/body-metrics'
import { extractAnthropometryMetrics, extractBodyCompFromText, extractDateFromText, hasExtractableText } from '@/lib/parsers/pdf-parser'
import { Scale, Upload, Loader2, Trash2, Plus, X, Check, TrendingUp } from 'lucide-react'

const RED = '#e8001c'
const CATS: BodyCategory[] = ['composicao', 'circunferencia', 'dobra']
const todayISO = () => new Date().toLocaleDateString('en-CA')
const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
const fmtVal = (v: number | null, dec?: number) => (v == null ? '—' : dec != null ? v.toFixed(dec) : String(Math.round(v * 100) / 100))

/** Histórico de medidas corporais (impedância/antropometria) em formato
 *  comparativo — mesma lógica do exame de sangue: medida × datas. */
export function MetricasTab({ athleteId, readOnly = false }: { athleteId: string; readOnly?: boolean }) {
  const [rows, setRows] = useState<AthleteMetricRow[]>([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null)
  const [manual, setManual] = useState(false)

  async function load() { setLoading(true); setRows(await getAthleteMetrics(athleteId)); setLoading(false) }
  useEffect(() => { load() /* eslint-disable-next-line */ }, [athleteId])

  // Datas de medição (mais recente primeiro) e valores indexados
  const dates = useMemo(() => [...new Set(rows.map(r => r.measured_at))].sort().reverse(), [rows])
  const byKeyDate = useMemo(() => {
    const m = new Map<string, Map<string, AthleteMetricRow>>()
    for (const r of rows) {
      if (!m.has(r.metric_key)) m.set(r.metric_key, new Map())
      m.get(r.metric_key)!.set(r.measured_at, r)
    }
    return m
  }, [rows])

  // Ordena as medidas pelo catálogo; o que não está no catálogo entra ao final
  const grouped = useMemo(() => {
    const present = new Set(rows.map(r => r.metric_key))
    const out: { cat: BodyCategory; keys: string[] }[] = []
    for (const cat of CATS) {
      const known = BODY_METRICS.filter(m => m.category === cat && present.has(m.key)).map(m => m.key)
      const extra = [...present].filter(k => !BODY_METRIC_BY_KEY[k] && rows.find(r => r.metric_key === k)?.category === cat)
      const keys = [...known, ...extra]
      if (keys.length) out.push({ cat, keys })
    }
    return out
  }, [rows])

  async function importPdf(file: File) {
    setImporting(true); setMsg(null)
    try {
      const res = await readPdfViaServer(file)
      if (!res.ok || res.text == null) { setMsg({ t: res.error ?? 'Não foi possível ler o PDF.', ok: false }); return }
      const text = res.text
      if (!hasExtractableText(text)) { setMsg({ t: 'Este PDF parece ser uma imagem escaneada (sem texto). Lance os valores manualmente.', ok: false }); return }

      const fallbackDate = extractDateFromText(text) ?? todayISO()
      const collected = new Map<string, { category: string; metric_key: string; label: string; value: number; unit: string }>()

      // Layout homologado (comparativo antropométrico): composição + circunferências
      const anthro = extractAnthropometryMetrics(text)
      for (const m of anthro?.metrics ?? []) {
        collected.set(m.key, { category: m.category, metric_key: m.key, label: m.label, value: m.value, unit: m.unit })
      }
      // Composição corporal genérica (outras balanças de impedância)
      const comp = extractBodyCompFromText(text)
      const fromComp: [string, number | null | undefined][] = [
        ['peso', comp.weight_kg], ['percentual_gordura', comp.body_fat_pct],
        ['massa_muscular', comp.muscle_mass_kg], ['massa_ossea', comp.bone_mass_kg],
        ['gordura_visceral', comp.visceral_fat],
      ]
      for (const [key, v] of fromComp) {
        if (v == null || collected.has(key)) continue
        const def = BODY_METRIC_BY_KEY[key]
        collected.set(key, { category: 'composicao', metric_key: key, label: def?.label ?? key, value: v, unit: def?.unit ?? '' })
      }

      const list = [...collected.values()]
      if (list.length === 0) { setMsg({ t: 'Não reconheci medidas neste PDF. Lance os valores manualmente.', ok: false }); return }

      const measured_at = anthro?.measured_at ?? fallbackDate
      const saved = await saveAthleteMetrics(athleteId, list.map(m => ({ measured_at, ...m })), file.name)
      if (!saved.ok) { setMsg({ t: saved.error ?? 'Falha ao salvar as medidas.', ok: false }); return }
      setMsg({ t: `${saved.count} medidas importadas (${fmtDate(measured_at)}).`, ok: true })
      load()
    } catch (e) {
      setMsg({ t: e instanceof Error ? e.message : 'Falha ao importar.', ok: false })
    } finally { setImporting(false) }
  }

  async function removeDate(date: string) {
    if (!confirm(`Excluir todas as medidas de ${fmtDate(date)}?`)) return
    const ids = rows.filter(r => r.measured_at === date).map(r => r.id)
    for (const id of ids) await deleteAthleteMetric(id)
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Scale className="w-5 h-5 text-primary" />
          <h3 className="text-base font-black text-foreground">Medidas corporais</h3>
        </div>
        {!readOnly && (
          <div className="flex items-center gap-2">
            <button onClick={() => setManual(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold text-muted-foreground border border-border hover:bg-secondary">
              <Plus className="w-4 h-4" /> Lançar
            </button>
            <label className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold text-white cursor-pointer ${importing ? 'opacity-60' : ''}`} style={{ background: RED }}>
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {importing ? 'Lendo…' : 'Importar PDF'}
              <input type="file" accept="application/pdf" className="hidden" disabled={importing}
                onChange={e => { const f = e.target.files?.[0]; if (f) importPdf(f); e.target.value = '' }} />
            </label>
          </div>
        )}
      </div>

      {msg && (
        <p className="text-xs font-semibold rounded-lg px-3 py-2"
          style={{ background: msg.ok ? '#00d08418' : '#ef444418', color: msg.ok ? '#00d084' : '#ef4444' }}>{msg.t}</p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : dates.length === 0 ? (
        <div className="rounded-2xl p-8 text-center text-sm text-muted-foreground" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          Nenhuma medição registrada. {readOnly ? 'Seu treinador vai lançar as medidas aqui.' : <>Importe o PDF da <strong className="text-foreground">bioimpedância</strong> ou lance os valores manualmente — o comparativo aparece aqui.</>}
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-3 py-2.5 sticky left-0 bg-card z-10 min-w-[178px]">
                    <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Medida</span>
                  </th>
                  <th className="px-2 py-2.5 text-center min-w-[64px]">
                    <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Var.</span>
                  </th>
                  {dates.map(d => (
                    <th key={d} className="px-3 py-2 text-center min-w-[84px]">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-xs font-black text-foreground">{fmtDate(d)}</span>
                        {!readOnly && (
                          <button onClick={() => removeDate(d)} className="p-0.5 text-red-400 hover:text-red-500" aria-label="Excluir medição"><Trash2 className="w-3 h-3" /></button>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grouped.map(({ cat, keys }) => (
                  <Fragment key={cat}>
                    <tr style={{ background: BODY_CATEGORY_COLOR[cat] + '12' }}>
                      <td colSpan={dates.length + 2} className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider sticky left-0"
                        style={{ color: BODY_CATEGORY_COLOR[cat] }}>{BODY_CATEGORY_LABEL[cat]}</td>
                    </tr>
                    {keys.map(key => {
                      const def = BODY_METRIC_BY_KEY[key]
                      const vals = byKeyDate.get(key)
                      const any = vals ? [...vals.values()][0] : null
                      const label = def?.label ?? any?.label ?? key
                      const unit = def?.unit ?? any?.unit ?? ''
                      // variação: medição mais recente vs. a anterior que tenha valor
                      const series = dates.map(d => vals?.get(d)?.value ?? null)
                      const idxNew = series.findIndex(v => v != null)
                      const idxOld = series.findIndex((v, i) => v != null && i > idxNew)
                      const delta = idxNew >= 0 && idxOld > idxNew ? series[idxNew]! - series[idxOld]! : null
                      return (
                        <tr key={key} className="border-b border-border/50">
                          <td className="px-3 py-2 sticky left-0 bg-card z-10">
                            <div className="flex items-center gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-foreground leading-tight">{label}</p>
                                <p className="text-[10px] text-muted-foreground">{unit || '—'}</p>
                              </div>
                              <Sparkline values={[...series].reverse()} />
                            </div>
                          </td>
                          <td className="px-2 py-2 text-center">
                            {delta == null ? <span className="text-[11px] text-muted-foreground">—</span> : (
                              <span className="text-[11px] font-black whitespace-nowrap" style={{ color: deltaColor(def, delta) }}>
                                {delta > 0 ? '+' : ''}{fmtVal(delta, def?.decimals ?? 1)}
                              </span>
                            )}
                          </td>
                          {dates.map(d => (
                            <td key={d} className="px-3 py-2 text-center font-bold text-foreground">
                              {fmtVal(vals?.get(d)?.value ?? null, def?.decimals)}
                            </td>
                          ))}
                        </tr>
                      )
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-3 py-2 border-t border-border text-[10px] text-muted-foreground">
            A coluna <strong className="text-foreground">Var.</strong> compara a medição mais recente com a anterior. Verde = evoluindo na direção desejada.
          </div>
        </div>
      )}

      {manual && <ManualModal athleteId={athleteId} onClose={() => setManual(false)} onSaved={() => { setManual(false); load() }} />}
    </div>
  )
}

function Sparkline({ values }: { values: (number | null)[] }) {
  const pts = values.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v != null)
  if (pts.length < 2) return <span className="w-[52px] shrink-0" />
  const ys = pts.map(p => p.v)
  const min = Math.min(...ys), max = Math.max(...ys)
  const span = max - min || 1
  const W = 52, H = 18
  const x = (i: number) => (values.length === 1 ? 0 : (i / (values.length - 1)) * (W - 2) + 1)
  const y = (v: number) => H - 2 - ((v - min) / span) * (H - 4)
  const d = pts.map((p, k) => `${k === 0 ? 'M' : 'L'}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')
  const last = ys[ys.length - 1]
  const color = last === ys[0] ? '#94a3b8' : last > ys[0] ? '#f59e0b' : '#0088ff'
  return (
    <svg width={W} height={H} className="shrink-0" aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(pts[pts.length - 1].i)} cy={y(last)} r="2" fill={color} />
    </svg>
  )
}

// ─── Lançamento manual de uma medição ───────────────────────────────────────
function ManualModal({ athleteId, onClose, onSaved }: { athleteId: string; onClose: () => void; onSaved: () => void }) {
  const [date, setDate] = useState(todayISO())
  const [vals, setVals] = useState<Record<string, string>>({})
  const [open, setOpen] = useState<Set<BodyCategory>>(new Set<BodyCategory>(['composicao']))
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const toggle = (c: BodyCategory) => setOpen(s => { const n = new Set(s); if (n.has(c)) n.delete(c); else n.add(c); return n })

  async function save() {
    const list = BODY_METRICS
      .filter(m => (vals[m.key] ?? '').trim() !== '')
      .map(m => ({ measured_at: date, category: m.category, metric_key: m.key, label: m.label, value: parseFloat(vals[m.key].replace(',', '.')), unit: m.unit }))
      .filter(m => !Number.isNaN(m.value))
    if (list.length === 0) { setErr('Preencha ao menos uma medida.'); return }
    setSaving(true); setErr(null)
    const res = await saveAthleteMetrics(athleteId, list, 'manual')
    setSaving(false)
    if (!res.ok) { setErr(res.error ?? 'Falha ao salvar.'); return }
    onSaved()
  }

  const inCls = 'w-full rounded-lg px-2.5 py-2 text-sm bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-[#e8001c]/40'
  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full max-w-lg shadow-2xl max-h-[92vh] flex flex-col safe-bottom">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-black text-foreground flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> Nova medição</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-4">
          <label className="text-xs font-semibold text-muted-foreground block">Data da medição
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className={`${inCls} mt-1`} />
          </label>

          {CATS.map(cat => {
            const isOpen = open.has(cat)
            const list = BODY_METRICS.filter(m => m.category === cat)
            const n = list.filter(m => (vals[m.key] ?? '').trim()).length
            return (
              <div key={cat} className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                <button type="button" onClick={() => toggle(cat)} className="w-full flex items-center justify-between px-3 py-2.5" style={{ background: BODY_CATEGORY_COLOR[cat] + '12' }}>
                  <span className="text-sm font-black" style={{ color: BODY_CATEGORY_COLOR[cat] }}>
                    {BODY_CATEGORY_LABEL[cat]}{n > 0 && <span className="ml-2 text-[10px] text-muted-foreground">{n} preench.</span>}
                  </span>
                  <span className="text-muted-foreground text-sm font-black">{isOpen ? '−' : '+'}</span>
                </button>
                {isOpen && (
                  <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {list.map(m => (
                      <label key={m.key} className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate">{m.label}</p>
                          <p className="text-[10px] text-muted-foreground">{m.unit || '—'}</p>
                        </div>
                        <input inputMode="decimal" value={vals[m.key] ?? ''} onChange={e => setVals(v => ({ ...v, [m.key]: e.target.value }))}
                          placeholder="—" className="w-[80px] shrink-0 rounded-lg px-2 py-1.5 text-sm text-right bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-[#e8001c]/40" />
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          {err && <p className="text-xs text-red-500">{err}</p>}
        </div>

        <div className="flex items-center gap-2 px-5 py-4 border-t border-border">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-bold text-muted-foreground border border-border hover:bg-secondary">Cancelar</button>
          <button onClick={save} disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-black text-white disabled:opacity-60" style={{ background: RED }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}{saving ? 'Salvando…' : 'Salvar medição'}
          </button>
        </div>
      </div>
    </div>
  )
}
