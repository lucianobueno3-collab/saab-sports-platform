'use client'

import { useState, useEffect } from 'react'
import { Topbar } from '@/components/layout/topbar'
import { ChevronDown, Loader2, AlertTriangle, ShieldAlert, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ComposedChart
} from 'recharts'
import { trainingReadiness, stopProtocol, weeklyScorecard, type DailyMetrics, type WeeklyKpi } from '@/lib/readiness'
import { THRESHOLDS, EVIDENCE } from '@/lib/thresholds'
import { GlossaryLegend } from '@/components/ui/glossary-legend'

type Athlete = { id: string; full_name: string }

function fmtDate(str: string) {
  return new Date(str + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function fmt1(n: number | null, unit = '') {
  if (n === null) return '—'
  return `${n.toFixed(1)}${unit}`
}

function fmt0(n: number | null, unit = '') {
  if (n === null) return '—'
  return `${Math.round(n)}${unit}`
}

const READINESS_CONFIG = {
  VERDE:    { bg: 'bg-[#00d084]/10', border: 'border-[#00d084]/30', text: 'text-[#00d084]', dot: 'bg-[#00d084]', label: 'Treino Liberado' },
  AMARELO:  { bg: 'bg-[#ffa800]/10', border: 'border-[#ffa800]/30', text: 'text-[#ffa800]', dot: 'bg-[#ffa800]', label: 'Treino Adaptado' },
  VERMELHO: { bg: 'bg-primary/10',   border: 'border-primary/30',   text: 'text-primary',   dot: 'bg-primary',   label: 'Descanso Total' },
  VALVULA:  { bg: 'bg-primary/20',   border: 'border-primary/50',   text: 'text-primary',   dot: 'bg-primary',   label: 'Válvula de Segurança' },
}

const KPI_GROUP_LABELS = {
  leadership: 'Liderança — O que você controla',
  result: 'Resultado — Efeito fisiológico',
  safety: 'Segurança — Sinais clínicos',
}

const KPI_STATE_COLORS: Record<string, string> = {
  ok:    'text-[#00d084]',
  amber: 'text-[#ffa800]',
  red:   'text-primary',
}
const KPI_STATE_BG: Record<string, string> = {
  ok:    'bg-[#00d084]/10 border-[#00d084]/20',
  amber: 'bg-[#ffa800]/10 border-[#ffa800]/20',
  red:   'bg-primary/10 border-primary/20',
}

const ChartTip = ({ active, payload, label }: { active?: boolean; payload?: { color: string; name: string; value: number }[]; label?: string }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[var(--sidebar)] border border-border rounded-lg p-3 text-xs shadow-xl">
      <p className="text-muted-foreground mb-1 font-medium">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-bold text-foreground">{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function RecoveryPage() {
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [selected, setSelected] = useState('')
  const [metrics, setMetrics] = useState<DailyMetrics[]>([])
  const [loading, setLoading] = useState(false)
  const [range, setRange] = useState<14 | 30 | 90>(30)

  useEffect(() => {
    createClient().from('athletes').select('id, full_name').eq('active', true).order('full_name')
      .then(({ data }) => {
        const list = data ?? []
        setAthletes(list)
        if (list.length > 0) setSelected(list[0].id)
      })
  }, [])

  useEffect(() => {
    if (!selected) return
    setLoading(true)
    const from = new Date(); from.setDate(from.getDate() - range)
    createClient()
      .from('daily_metrics')
      .select('date, resting_hr_bpm, hrv_ms, body_battery, stress_avg, stress_max, sleep_hours, rem_pct, rem_sleep_hours, deep_sleep_hours, light_sleep_hours, weight_kg')
      .eq('athlete_id', selected)
      .gte('date', from.toISOString().slice(0, 10))
      .order('date')
      .then(({ data }) => {
        setMetrics((data ?? []).map((r: Record<string, unknown>) => ({
          date: r.date as string,
          hrv_ms: r.hrv_ms as number | null,
          resting_hr_bpm: r.resting_hr_bpm as number | null,
          body_battery: r.body_battery as number | null,
          stress_avg: r.stress_avg as number | null,
          stress_max: r.stress_max as number | null,
          sleep_hours: r.sleep_hours as number | null,
          rem_pct: r.rem_pct as number | null,
          rem_sleep_hours: r.rem_sleep_hours as number | null,
          deep_sleep_hours: r.deep_sleep_hours as number | null,
          light_sleep_hours: r.light_sleep_hours as number | null,
          weight_kg: r.weight_kg as number | null,
        })))
        setLoading(false)
      })
  }, [selected, range])

  const today = metrics.length > 0 ? metrics[metrics.length - 1] : null
  const last7 = metrics.slice(-7)
  const readiness = today ? trainingReadiness(today) : null
  const stop = metrics.length >= 2 ? stopProtocol(metrics.slice(-7)) : null
  const scorecard = weeklyScorecard(last7)
  const hasData = metrics.some(m => m.sleep_hours || m.hrv_ms || m.body_battery)

  const chartData = metrics.map(m => ({ ...m, date: fmtDate(m.date) }))

  // Agrupar KPIs
  const kpiGroups = (['leadership', 'result', 'safety'] as const).map(g => ({
    key: g,
    label: KPI_GROUP_LABELS[g],
    items: scorecard.filter(k => k.group === g),
  }))

  const t = THRESHOLDS
  const rCfg = readiness ? READINESS_CONFIG[readiness.level] : null

  return (
    <div>
      <Topbar title="Recuperação" subtitle="Prontidão de treino · HRV · Sono · Body Battery" />
      <div className="p-6 space-y-5">

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <select value={selected} onChange={e => setSelected(e.target.value)}
              className="pl-3 pr-8 py-2 bg-card border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 appearance-none min-w-[180px]">
              {athletes.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-2.5 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
          {([14, 30, 90] as const).map(r => (
            <button key={r} onClick={() => setRange(r)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${range === r ? 'bg-primary text-white' : 'bg-card border border-border text-muted-foreground hover:text-foreground'}`}>
              {r}d
            </button>
          ))}
          {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        </div>

        {!hasData && !loading && (
          <div className="bg-card border border-border rounded-xl p-10 text-center">
            <p className="text-sm font-semibold text-foreground mb-1">Sem dados de recuperação</p>
            <p className="text-xs text-muted-foreground">Importe o MetricsExport do Garmin em <a href="/import" className="text-primary hover:underline">Importar Dados</a></p>
          </div>
        )}

        {hasData && (
          <>
            {/* PROTOCOLO DE INTERRUPÇÃO — alerta crítico */}
            {stop?.abort && (
              <div className="flex items-start gap-3 p-4 bg-primary/10 border border-primary/30 rounded-xl">
                <ShieldAlert className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-black text-primary mb-1">
                    {stop.clinicalFlag ? '🚨 BANDEIRA CLÍNICA — FC repouso ≥62bpm' : '⛔ PROTOCOLO DE INTERRUPÇÃO ATIVADO'}
                  </p>
                  <p className="text-xs text-muted-foreground mb-2">
                    {stop.clinicalFlag
                      ? 'Suspender treino imediatamente. Investigar causa clínica (infecção, overtraining severo).'
                      : `${stop.signals.length} sinais simultâneos detectados — descanso obrigatório.`}
                  </p>
                  <ul className="space-y-0.5">
                    {stop.signals.map(s => (
                      <li key={s} className="text-xs text-primary flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-primary flex-shrink-0" /> {s}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* SEMÁFORO DE PRONTIDÃO */}
            {readiness && rCfg && (
              <div className={`flex items-start gap-4 p-5 ${rCfg.bg} border ${rCfg.border} rounded-xl`}>
                <div className={`w-12 h-12 rounded-full ${rCfg.bg} border-2 ${rCfg.border} flex items-center justify-center flex-shrink-0`}>
                  <span className={`w-5 h-5 rounded-full ${rCfg.dot} animate-pulse`} />
                </div>
                <div className="flex-1">
                  <p className={`text-xs font-semibold uppercase tracking-wider ${rCfg.text} mb-0.5`}>Prontidão de hoje — {today?.date}</p>
                  <p className={`text-xl font-black ${rCfg.text} mb-1`}>{rCfg.label}</p>
                  <p className="text-sm text-foreground">{readiness.recommendation}</p>
                  {readiness.safetyReason && (
                    <p className="text-xs text-muted-foreground mt-1">Válvula: {readiness.safetyReason}</p>
                  )}
                  {today && (
                    <div className="flex flex-wrap gap-3 mt-3">
                      {today.hrv_ms !== null && (
                        <span className="text-xs bg-black/20 rounded-lg px-2 py-1">
                          HRV <span className={`font-bold ${today.hrv_ms >= t.hrv.green_min ? 'text-[#00d084]' : today.hrv_ms >= t.hrv.yellow_min ? 'text-[#ffa800]' : 'text-primary'}`}>{fmt0(today.hrv_ms)}ms</span>
                        </span>
                      )}
                      {today.body_battery !== null && (
                        <span className="text-xs bg-black/20 rounded-lg px-2 py-1">
                          Body Battery <span className={`font-bold ${today.body_battery >= t.bodyBattery.target_min ? 'text-[#00d084]' : today.body_battery >= t.bodyBattery.overtraining_max ? 'text-[#ffa800]' : 'text-primary'}`}>{fmt0(today.body_battery)}</span>
                        </span>
                      )}
                      {today.sleep_hours !== null && (
                        <span className="text-xs bg-black/20 rounded-lg px-2 py-1">
                          Sono <span className={`font-bold ${today.sleep_hours >= t.sleep.target_hours ? 'text-[#00d084]' : today.sleep_hours >= t.sleep.injury_risk_below ? 'text-[#ffa800]' : 'text-primary'}`}>{fmt1(today.sleep_hours)}h</span>
                        </span>
                      )}
                      {today.rem_pct !== null && (
                        <span className="text-xs bg-black/20 rounded-lg px-2 py-1">
                          REM <span className={`font-bold ${today.rem_pct >= t.rem.target_pct_min ? 'text-[#00d084]' : 'text-[#ffa800]'}`}>{fmt0(today.rem_pct)}%</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* WEEKLY SCORECARD */}
            {scorecard.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="text-sm font-bold text-foreground mb-1">Scorecard Semanal</h3>
                <p className="text-xs text-muted-foreground mb-4">KPIs dos últimos 7 dias · separados por grupo de controle</p>
                <div className="space-y-4">
                  {kpiGroups.map(g => g.items.length > 0 && (
                    <div key={g.key}>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">{g.label}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {g.items.map((kpi: WeeklyKpi) => (
                          <div key={kpi.label} className={`border rounded-xl p-3 ${KPI_STATE_BG[kpi.state]}`}>
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-xs text-muted-foreground">{kpi.label}</span>
                              {kpi.dir === 'higher'
                                ? <TrendingUp className={`w-3 h-3 ${KPI_STATE_COLORS[kpi.state]}`} />
                                : <TrendingDown className={`w-3 h-3 ${KPI_STATE_COLORS[kpi.state]}`} />}
                            </div>
                            <p className={`text-xl font-black ${KPI_STATE_COLORS[kpi.state]}`}>
                              {kpi.value !== null ? `${kpi.value.toFixed(kpi.unit === 'h' || kpi.unit === 'ms' ? 1 : 0)}${kpi.unit}` : '—'}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">meta: {kpi.targetLabel}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* HRV Trend */}
            {metrics.some(m => m.hrv_ms) && (
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="text-sm font-bold mb-1">HRV Noturno</h3>
                <p className="text-xs text-muted-foreground mb-4">ms · verde ≥{t.hrv.green_min} · amarelo {t.hrv.yellow_min}–{t.hrv.green_min - 1} · vermelho &lt;{t.hrv.yellow_min}</p>
                <ResponsiveContainer width="100%" height={200}>
                  <ComposedChart data={chartData.filter(m => m.hrv_ms)} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--panel-border)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: '#666680', fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: '#666680', fontSize: 10 }} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                    <Tooltip content={<ChartTip />} />
                    <ReferenceLine y={t.hrv.green_min} stroke="#00d084" strokeDasharray="3 2" label={{ value: `${t.hrv.green_min}`, fill: '#00d084', fontSize: 9 }} />
                    <ReferenceLine y={t.hrv.yellow_min} stroke="#ffa800" strokeDasharray="3 2" label={{ value: `${t.hrv.yellow_min}`, fill: '#ffa800', fontSize: 9 }} />
                    <defs>
                      <linearGradient id="hrvGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0088ff" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#0088ff" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="hrv_ms" name="HRV (ms)" stroke="#0088ff" strokeWidth={2} fill="url(#hrvGrad)" dot={false} connectNulls />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Body Battery */}
            {metrics.some(m => m.body_battery) && (
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="text-sm font-bold mb-1">Body Battery</h3>
                <p className="text-xs text-muted-foreground mb-4">
                  0–100 · meta ≥{t.bodyBattery.target_min} · exaustão &lt;{t.bodyBattery.exhaustion_max} · válvula &lt;{t.bodyBattery.safety_floor}
                </p>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={chartData.filter(m => m.body_battery)} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="bbGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ffa800" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#ffa800" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--panel-border)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: '#666680', fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: '#666680', fontSize: 10 }} tickLine={false} axisLine={false} domain={[0, 100]} />
                    <Tooltip content={<ChartTip />} />
                    <ReferenceLine y={t.bodyBattery.target_min} stroke="#00d084" strokeDasharray="3 2" label={{ value: 'Meta 50', fill: '#00d084', fontSize: 9 }} />
                    <ReferenceLine y={t.bodyBattery.exhaustion_max} stroke="#ffa800" strokeDasharray="3 2" label={{ value: 'Exaustão', fill: '#ffa800', fontSize: 9 }} />
                    <ReferenceLine y={t.bodyBattery.safety_floor} stroke="#e8001c" strokeDasharray="3 2" label={{ value: 'Válvula', fill: '#e8001c', fontSize: 9 }} />
                    <Area type="monotone" dataKey="body_battery" name="Body Battery" stroke="#ffa800" strokeWidth={2} fill="url(#bbGrad)" dot={false} connectNulls />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Sono + REM */}
            {metrics.some(m => m.sleep_hours) && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-card border border-border rounded-xl p-5">
                  <h3 className="text-sm font-bold mb-1">Duração do Sono</h3>
                  <p className="text-xs text-muted-foreground mb-4">horas · meta {t.sleep.target_hours}h · risco lesão &lt;{t.sleep.injury_risk_below}h</p>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={chartData.filter(m => m.sleep_hours)} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--panel-border)" vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: '#666680', fontSize: 10 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fill: '#666680', fontSize: 10 }} tickLine={false} axisLine={false} domain={[0, 10]} />
                      <Tooltip content={<ChartTip />} />
                      <ReferenceLine y={t.sleep.target_hours} stroke="#00d084" strokeDasharray="4 2" label={{ value: `${t.sleep.target_hours}h`, fill: '#00d084', fontSize: 9, position: 'insideTopRight' }} />
                      <ReferenceLine y={t.sleep.injury_risk_below} stroke="#ffa800" strokeDasharray="4 2" label={{ value: `${t.sleep.injury_risk_below}h`, fill: '#ffa800', fontSize: 9, position: 'insideTopRight' }} />
                      <Bar dataKey="sleep_hours" name="Sono (h)" fill="#0088ff" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-card border border-border rounded-xl p-5">
                  <h3 className="text-sm font-bold mb-1">% REM</h3>
                  <p className="text-xs text-muted-foreground mb-4">meta {t.rem.target_pct_min}–{t.rem.target_pct_max}% · válvula &lt;{t.rem.safety_floor_pct}%</p>
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={chartData.filter(m => m.rem_pct)} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="remGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#a855f7" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--panel-border)" vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: '#666680', fontSize: 10 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fill: '#666680', fontSize: 10 }} tickLine={false} axisLine={false} domain={[0, 30]} />
                      <Tooltip content={<ChartTip />} />
                      <ReferenceLine y={t.rem.target_pct_min} stroke="#00d084" strokeDasharray="3 2" label={{ value: `${t.rem.target_pct_min}%`, fill: '#00d084', fontSize: 9 }} />
                      <ReferenceLine y={t.rem.safety_floor_pct} stroke="#e8001c" strokeDasharray="3 2" label={{ value: `${t.rem.safety_floor_pct}%`, fill: '#e8001c', fontSize: 9 }} />
                      <Area type="monotone" dataKey="rem_pct" name="REM (%)" stroke="#a855f7" strokeWidth={2} fill="url(#remGrad)" dot={false} connectNulls />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* FC Repouso + Stress */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {metrics.some(m => m.resting_hr_bpm) && (
                <div className="bg-card border border-border rounded-xl p-5">
                  <h3 className="text-sm font-bold mb-1">FC de Repouso</h3>
                  <p className="text-xs text-muted-foreground mb-4">bpm · alerta ≥{t.rhr.warning_bpm} · clínico ≥{t.rhr.clinical_bpm}</p>
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={chartData.filter(m => m.resting_hr_bpm)} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="rhrGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#e8001c" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#e8001c" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--panel-border)" vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: '#666680', fontSize: 10 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fill: '#666680', fontSize: 10 }} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                      <Tooltip content={<ChartTip />} />
                      <ReferenceLine y={t.rhr.warning_bpm} stroke="#ffa800" strokeDasharray="3 2" label={{ value: `${t.rhr.warning_bpm}`, fill: '#ffa800', fontSize: 9 }} />
                      <ReferenceLine y={t.rhr.clinical_bpm} stroke="#e8001c" strokeDasharray="3 2" label={{ value: `${t.rhr.clinical_bpm}`, fill: '#e8001c', fontSize: 9 }} />
                      <Area type="monotone" dataKey="resting_hr_bpm" name="FC repouso (bpm)" stroke="#e8001c" strokeWidth={2} fill="url(#rhrGrad)" dot={false} connectNulls />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {metrics.some(m => m.stress_avg) && (
                <div className="bg-card border border-border rounded-xl p-5">
                  <h3 className="text-sm font-bold mb-1">Stress</h3>
                  <p className="text-xs text-muted-foreground mb-4">0–100 · meta &lt;{t.stress.target_max} · bloqueia sono profundo acima de {t.stress.blocks_deep_sleep_above}</p>
                  <ResponsiveContainer width="100%" height={180}>
                    <ComposedChart data={chartData.filter(m => m.stress_avg)} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--panel-border)" vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: '#666680', fontSize: 10 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fill: '#666680', fontSize: 10 }} tickLine={false} axisLine={false} domain={[0, 100]} />
                      <Tooltip content={<ChartTip />} />
                      <ReferenceLine y={t.stress.target_max} stroke="#00d084" strokeDasharray="3 2" label={{ value: `Meta ${t.stress.target_max}`, fill: '#00d084', fontSize: 9 }} />
                      <ReferenceLine y={t.stress.blocks_deep_sleep_above} stroke="#ffa800" strokeDasharray="3 2" label={{ value: 'Bloqueia sono', fill: '#ffa800', fontSize: 9 }} />
                      <Bar dataKey="stress_max" name="Stress Máx" fill="#ffa80015" radius={[2, 2, 0, 0]} />
                      <Line type="monotone" dataKey="stress_avg" name="Stress Médio" stroke="#ffa800" strokeWidth={2} dot={false} connectNulls />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Evidência científica */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-bold mb-1">Por que isso importa</h3>
              <p className="text-xs text-muted-foreground mb-4">Referências científicas por trás dos thresholds</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {EVIDENCE.map(ev => {
                  const val = today?.[ev.field as keyof DailyMetrics] as number | null
                  const triggered = val !== null && val < ev.limitValue
                  return (
                    <div key={ev.id} className={`rounded-xl p-4 border ${triggered ? 'bg-primary/10 border-primary/30' : 'bg-secondary/20 border-border'}`}>
                      {triggered && <AlertTriangle className="w-4 h-4 text-primary mb-2" />}
                      <p className={`text-sm font-bold mb-1 ${triggered ? 'text-primary' : 'text-foreground'}`}>{ev.title}</p>
                      <p className="text-xs text-muted-foreground mb-2">{ev.impact}</p>
                      <div className={`text-xs font-mono px-2 py-1 rounded ${triggered ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'}`}>
                        {ev.threshold}{val !== null ? ` · atual: ${val.toFixed(1)}` : ''}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-2">{ev.reference}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}

        <GlossaryLegend terms={['BPM', 'CTL', 'TSB']} />
      </div>
    </div>
  )
}
