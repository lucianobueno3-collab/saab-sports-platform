'use client'

import { useEffect, useMemo, useState } from 'react'
import { getAthleteMetrics, deleteAthleteMetric, type AthleteMetricRow } from '@/lib/supabase/queries'
import { Loader2, Ruler, Scale, Activity, ChevronDown, TrendingUp, TrendingDown, Minus, Trash2 } from 'lucide-react'

const CATS: { key: string; label: string; icon: typeof Scale; color: string }[] = [
  { key: 'composicao', label: 'Composição corporal', icon: Scale, color: '#e8001c' },
  { key: 'circunferencia', label: 'Circunferências', icon: Ruler, color: '#0088ff' },
  { key: 'dobra', label: 'Dobras cutâneas', icon: Activity, color: '#00b4d8' },
]

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}
const fmtVal = (v: number, unit: string | null) => `${(Math.round(v * 100) / 100).toLocaleString('pt-BR')}${unit ? ` ${unit}` : ''}`

export function MetricasTab({ athleteId, readOnly = false }: { athleteId: string; readOnly?: boolean }) {
  const [rows, setRows] = useState<AthleteMetricRow[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState<string | null>(null)

  async function load() { setLoading(true); setRows(await getAthleteMetrics(athleteId)); setLoading(false) }
  useEffect(() => { load() /* eslint-disable-next-line */ }, [athleteId])

  // Agrupa por métrica (chave), ordenado por data desc — a 1ª é a mais recente.
  const byKey = useMemo(() => {
    const m = new Map<string, AthleteMetricRow[]>()
    for (const r of rows) { const a = m.get(r.metric_key) ?? []; a.push(r); m.set(r.metric_key, a) }
    for (const a of m.values()) a.sort((x, y) => (x.measured_at < y.measured_at ? 1 : -1))
    return m
  }, [rows])

  const keysByCat = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const [key, arr] of byKey) { const c = arr[0].category; const a = m.get(c) ?? []; a.push(key); m.set(c, a) }
    return m
  }, [byKey])

  async function removeMetric(key: string) {
    if (!window.confirm('Excluir todo o histórico desta métrica?')) return
    const arr = byKey.get(key) ?? []
    for (const r of arr) await deleteAthleteMetric(r.id)
    load()
  }

  if (loading) return <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin" /></div>

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl p-8 text-center text-sm text-muted-foreground" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        Nenhuma métrica ainda. Importe um exame/laudo em <strong className="text-foreground">Nutrição → Preencher medição</strong> para que os dados apareçam aqui com histórico.
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {CATS.map(cat => {
        const keys = keysByCat.get(cat.key)
        if (!keys || keys.length === 0) return null
        return (
          <div key={cat.key}>
            <div className="flex items-center gap-2 mb-2.5">
              <cat.icon className="w-4 h-4" style={{ color: cat.color }} />
              <h2 className="text-sm font-black text-foreground">{cat.label}</h2>
              <span className="text-[11px] text-muted-foreground">({keys.length})</span>
            </div>
            <div className="grid sm:grid-cols-2 gap-2.5">
              {keys.map(key => {
                const hist = byKey.get(key)!
                const latest = hist[0]
                const prev = hist[1]
                const delta = prev ? Math.round((latest.value - prev.value) * 100) / 100 : null
                const isOpen = open === key
                return (
                  <div key={key} className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                    <button onClick={() => setOpen(isOpen ? null : key)} className="w-full text-left p-3.5 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground truncate">{latest.label}</p>
                        <p className="text-lg font-black text-foreground">{fmtVal(latest.value, latest.unit)}</p>
                        <p className="text-[10px] text-muted-foreground">{fmtDate(latest.measured_at)}</p>
                      </div>
                      {delta != null && delta !== 0 && (
                        <span className="flex items-center gap-0.5 text-xs font-bold" style={{ color: delta < 0 ? '#00d084' : '#ffa800' }}>
                          {delta < 0 ? <TrendingDown className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
                          {delta > 0 ? '+' : ''}{delta.toLocaleString('pt-BR')}
                        </span>
                      )}
                      {delta === 0 && <Minus className="w-3.5 h-3.5 text-muted-foreground" />}
                      {hist.length > 1 && <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />}
                    </button>
                    {isOpen && hist.length > 1 && (
                      <div className="px-3.5 pb-3 space-y-1 border-t border-border/50 pt-2">
                        {hist.map(h => (
                          <div key={h.id} className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">{fmtDate(h.measured_at)}</span>
                            <span className="font-semibold text-foreground">{fmtVal(h.value, h.unit)}</span>
                          </div>
                        ))}
                        {!readOnly && (
                          <button onClick={() => removeMetric(key)} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-red-500 mt-1.5">
                            <Trash2 className="w-3 h-3" /> Excluir métrica
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
