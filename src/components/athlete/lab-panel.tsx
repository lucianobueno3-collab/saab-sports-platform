'use client'

import { useMemo, useState } from 'react'
import { Pencil, X, ChevronDown, Info, TrendingUp, TrendingDown, Minus, LineChart as LineChartIcon } from 'lucide-react'
import type { MedicalExamRow } from '@/lib/supabase/queries'
import { TrendChart } from './trend-chart'
import {
  LAB_MARKERS, CATEGORY_LABEL, CATEGORY_COLOR, findMarker, markerRef,
  classifyValue, STATUS_STYLE, type MarkerCategory, type Sex, type MarkerStatus,
} from '@/lib/lab-markers'

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
}

const CATEGORY_ORDER: MarkerCategory[] = [
  'ferro', 'hematologia', 'hormonal', 'muscular', 'inflamacao',
  'vitaminas', 'metabolico', 'lipidico', 'renal', 'hepatico',
]

interface Props {
  exams: MedicalExamRow[]
  sex: Sex | null
  onEdit: (exam: MedicalExamRow) => void
  onDelete: (id: string) => void
}

export function LabPanel({ exams, sex, onEdit, onDelete }: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  // agrupa exames por nome canônico; mais recente primeiro
  const groups = useMemo(() => {
    const g: Record<string, MedicalExamRow[]> = {}
    for (const e of exams) {
      ;(g[e.exam_name] ??= []).push(e)
    }
    for (const k of Object.keys(g)) g[k].sort((a, b) => b.exam_date.localeCompare(a.exam_date))
    return g
  }, [exams])

  // organiza os grupos por categoria do catálogo (desconhecidos vão para "Outros")
  const byCategory = useMemo(() => {
    const map = new Map<MarkerCategory | 'outros', { name: string; rows: MedicalExamRow[] }[]>()
    for (const [name, rows] of Object.entries(groups)) {
      const marker = findMarker(name)
      const cat = (marker?.category ?? 'outros') as MarkerCategory | 'outros'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push({ name, rows })
    }
    return map
  }, [groups])

  const orderedCats = [...CATEGORY_ORDER, 'outros' as const].filter(c => byCategory.has(c))

  // contagem de alterados para o resumo
  const summary = useMemo(() => {
    let low = 0, high = 0, subopt = 0
    for (const [name, rows] of Object.entries(groups)) {
      const latest = rows[0]
      const marker = findMarker(name)
      const st = classifyValue(marker, latest.value, sex, { min: latest.reference_min, max: latest.reference_max })
      if (st === 'low') low++
      else if (st === 'high') high++
      else if (st === 'suboptimal') subopt++
    }
    return { low, high, subopt }
  }, [groups, sex])

  if (Object.keys(groups).length === 0) {
    return <p className="text-xs text-muted-foreground text-center py-8">Nenhum exame registrado — anexe um PDF ou adicione manualmente</p>
  }

  return (
    <div className="space-y-4">
      {/* Resumo clínico */}
      <div className="flex items-center gap-3 flex-wrap text-xs px-1">
        <span className="font-bold" style={{ color: '#e8001c' }}>{summary.low} abaixo</span>
        <span className="font-bold" style={{ color: '#ffa800' }}>{summary.high} acima</span>
        <span className="font-bold" style={{ color: '#0088ff' }}>{summary.subopt} subótimo{summary.subopt !== 1 ? 's' : ''}</span>
        <span className="text-muted-foreground">· referências {sex === 'F' ? 'femininas' : sex === 'M' ? 'masculinas' : 'padrão'}</span>
      </div>

      {orderedCats.map(cat => {
        const color = cat === 'outros' ? 'var(--muted-foreground)' : CATEGORY_COLOR[cat]
        const label = cat === 'outros' ? 'Outros' : CATEGORY_LABEL[cat]
        const items = byCategory.get(cat)!.sort((a, b) => a.name.localeCompare(b.name))
        return (
          <div key={cat}>
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className="w-2 h-2 rounded-full" style={{ background: color }} />
              <p className="text-[10px] font-black uppercase tracking-wider" style={{ color }}>{label}</p>
              <span className="text-[10px] text-muted-foreground">{items.length}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {items.map(({ name, rows }) => (
                <MarkerCard key={name} name={name} rows={rows} sex={sex}
                  open={!!expanded[name]} onToggle={() => setExpanded(s => ({ ...s, [name]: !s[name] }))}
                  onEdit={onEdit} onDelete={onDelete} />
              ))}
            </div>
          </div>
        )
      })}

      <p className="text-[9px] text-muted-foreground/70 px-1 flex items-center gap-1">
        <Info className="w-3 h-3" /> Faixas do laudo têm prioridade; quando ausentes, usamos referências de mercado. Subótimo = dentro do normal clínico, mas fora do alvo recomendado para atletas.
      </p>
    </div>
  )
}

function MarkerCard({ name, rows, sex, open, onToggle, onEdit, onDelete }: {
  name: string; rows: MedicalExamRow[]; sex: Sex | null; open: boolean
  onToggle: () => void; onEdit: (e: MedicalExamRow) => void; onDelete: (id: string) => void
}) {
  const latest = rows[0]
  const prev = rows[1]
  const marker = findMarker(name)
  const status: MarkerStatus = classifyValue(marker, latest.value, sex, { min: latest.reference_min, max: latest.reference_max })
  const st = STATUS_STYLE[status]

  // referência exibida: laudo > catálogo
  const ref = (latest.reference_min != null || latest.reference_max != null)
    ? { min: latest.reference_min, max: latest.reference_max }
    : marker ? markerRef(marker, sex) : { min: null, max: null }
  const unit = latest.unit ?? marker?.unit ?? ''

  const delta = latest.value != null && prev?.value != null && prev.value !== 0
    ? ((latest.value - prev.value) / Math.abs(prev.value)) * 100 : null

  return (
    <div className="rounded-xl p-3.5" style={{ background: 'var(--panel)', border: `1px solid ${status === 'normal' || status === 'unknown' ? 'var(--panel-border)' : st.color + '55'}` }}>
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="min-w-0">
          <p className="text-xs font-bold text-foreground truncate">{name}</p>
          {marker?.aka && <p className="text-[9px] text-muted-foreground/70">{marker.aka}</p>}
        </div>
        <span className="text-[9px] font-black px-1.5 py-0.5 rounded flex-shrink-0 uppercase"
          style={{ background: st.color === 'var(--muted-foreground)' ? 'var(--secondary)' : st.color + '20', color: st.color, border: `1px solid ${st.color === 'var(--muted-foreground)' ? 'var(--border)' : st.color + '45'}` }}>
          {status === 'low' ? '↓ ' : status === 'high' ? '↑ ' : ''}{st.label}
        </span>
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-black" style={{ color: status === 'normal' || status === 'unknown' ? 'var(--foreground)' : st.color, fontVariantNumeric: 'tabular-nums' }}>
          {latest.value ?? '—'}
        </span>
        {unit && <span className="text-[10px] text-muted-foreground">{unit}</span>}
        {delta != null && Math.abs(delta) >= 0.05 && (
          <span className="ml-auto inline-flex items-center gap-0.5 text-[10px] font-bold"
            style={{ color: delta > 0 ? '#0088ff' : '#ffa800' }}>
            {delta > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {delta > 0 ? '+' : ''}{delta.toFixed(0)}%
          </span>
        )}
        {delta != null && Math.abs(delta) < 0.05 && <Minus className="w-3 h-3 ml-auto text-muted-foreground/40" />}
      </div>

      {(ref.min != null || ref.max != null) && (
        <p className="text-[10px] text-muted-foreground mt-0.5">Ref: {ref.min ?? '<'} – {ref.max ?? '∞'} {unit}</p>
      )}
      <p className="text-[9px] text-muted-foreground/60 mt-0.5">{fmtDate(latest.exam_date)}</p>

      {status === 'suboptimal' && marker?.athleteOptimal && (
        <p className="text-[9px] mt-2 leading-relaxed rounded px-2 py-1.5" style={{ background: '#0088ff12', color: '#0088ff' }}>
          {marker.athleteOptimal.note}
        </p>
      )}
      {(status === 'low' || status === 'high') && marker?.athleteOptimal && (
        <p className="text-[9px] mt-2 leading-relaxed rounded px-2 py-1.5" style={{ background: st.color + '12', color: st.color }}>
          {marker.athleteOptimal.note}
        </p>
      )}

      <div className="mt-2 flex items-center gap-3">
        {rows.length > 1 && (
          <button onClick={onToggle} className="text-[9px] text-muted-foreground/60 hover:text-foreground flex items-center gap-0.5">
            <ChevronDown className={`w-2.5 h-2.5 transition-transform ${open ? 'rotate-180' : ''}`} /> {rows.length} coletas
          </button>
        )}
        <button onClick={() => onEdit(latest)} className="text-[9px] text-muted-foreground/40 hover:text-foreground flex items-center gap-0.5 ml-auto"><Pencil className="w-2.5 h-2.5" /> editar</button>
        <button onClick={() => onDelete(latest.id)} className="text-[9px] text-muted-foreground/40 hover:text-[#e8001c]"><X className="w-2.5 h-2.5" /></button>
      </div>

      {open && rows.length > 1 && (
        <div className="mt-2 pt-2 border-t border-border/30 space-y-1">
          {rows.length >= 2 && (
            <div className="mb-2">
              <p className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-muted-foreground mb-1">
                <LineChartIcon className="w-2.5 h-2.5" /> Evolução
              </p>
              <TrendChart
                points={rows.filter(r => r.value != null).map(r => ({ date: r.exam_date, value: r.value as number }))}
                color={st.color === 'var(--muted-foreground)' ? '#0088ff' : st.color}
                unit={unit}
                refMin={ref.min}
                refMax={ref.max}
                height={120}
              />
            </div>
          )}
          {rows.slice(1).map(r => (
            <div key={r.id} className="flex justify-between items-center">
              <span className="text-[10px] text-muted-foreground/60">{fmtDate(r.exam_date)}</span>
              <span className="text-[10px] text-muted-foreground" style={{ fontVariantNumeric: 'tabular-nums' }}>{r.value} {r.unit}</span>
              <span className="flex items-center gap-1">
                <button onClick={() => onEdit(r)} className="p-0.5 hover:opacity-70"><Pencil className="w-2.5 h-2.5 text-muted-foreground/30" /></button>
                <button onClick={() => onDelete(r.id)} className="p-0.5 hover:opacity-70"><X className="w-2.5 h-2.5 text-muted-foreground/30" /></button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// exportado para o modal de adicionar exame (autocomplete + auto-fill)
export const MARKER_OPTIONS = LAB_MARKERS.map(m => m.name)
