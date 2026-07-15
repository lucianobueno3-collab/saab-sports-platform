'use client'

import { useState, useEffect } from 'react'
import { Topbar } from '@/components/layout/topbar'
import { createClient } from '@/lib/supabase/client'
import { Loader2, ChevronDown, TrendingUp, Activity, Zap, Calendar } from 'lucide-react'
import { GlossaryLegend } from '@/components/ui/glossary-legend'
import { MetricDetailSheet, type MetricKey } from '@/components/ui/metric-detail-sheet'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, ComposedChart
} from 'recharts'

type Athlete = { id: string; full_name: string; ftp_watts: number | null }
type PMCRow = { date: string; ctl: number; atl: number; tsb: number; daily_tss: number }
type ActivityRow = { started_at: string; tss: number | null; sport: string; duration_seconds: number; normalized_power: number | null }

const SPORT_COLORS: Record<string, string> = {
  cycling: '#0088ff', running: '#00d084', swimming: '#a855f7',
  triathlon: '#ffa800', other: 'var(--muted-foreground)',
}

function weekKey(dateStr: string) {
  const d = new Date(dateStr)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const mon = new Date(d.setDate(diff))
  return mon.toISOString().slice(0, 10)
}

function fmtDate(str: string) {
  return new Date(str).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

const Tip = ({ active, payload, label }: { active?: boolean; payload?: { color: string; name: string; value: number }[]; label?: string }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-popover border border-border rounded-lg p-3 text-xs shadow-xl">
      <p className="text-muted-foreground mb-2 font-medium">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 mb-0.5">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-bold text-foreground">{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function AnalyticsPage() {
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [selected, setSelected] = useState('')
  const [pmc, setPmc] = useState<PMCRow[]>([])
  const [acts, setActs] = useState<ActivityRow[]>([])
  const [loading, setLoading] = useState(false)
  const [range, setRange] = useState<30 | 90 | 180>(90)
  const [metricDetail, setMetricDetail] = useState<{ key: MetricKey; value?: string | null; ctx?: Record<string, number | string | null> } | null>(null)

  useEffect(() => {
    createClient().from('athletes').select('id, full_name, ftp_watts').eq('active', true).order('full_name')
      .then(({ data }) => {
        const list = data ?? []
        setAthletes(list)
        if (list.length > 0) setSelected(list[0].id)
      })
  }, [])

  useEffect(() => {
    if (!selected) return
    setLoading(true)
    const sb = createClient()
    const from = new Date(); from.setDate(from.getDate() - range)
    const fromStr = from.toISOString().slice(0, 10)

    Promise.all([
      sb.from('daily_metrics').select('date, ctl, atl, tsb, daily_tss').eq('athlete_id', selected).gte('date', fromStr).order('date'),
      sb.from('activities').select('started_at, tss, sport, duration_seconds, normalized_power').eq('athlete_id', selected).gte('started_at', from.toISOString()).order('started_at'),
    ]).then(([pmcRes, actRes]) => {
      setPmc(pmcRes.data ?? [])
      setActs(actRes.data ?? [])
      setLoading(false)
    })
  }, [selected, range])

  const athlete = athletes.find(a => a.id === selected)

  // PMC chart data
  const pmcData = pmc.map(p => ({
    date: fmtDate(p.date),
    CTL: Math.round(p.ctl),
    ATL: Math.round(p.atl),
    TSB: Math.round(p.tsb),
    TSS: p.daily_tss ? Math.round(p.daily_tss) : 0,
  }))

  // Weekly volume
  const weekMap: Record<string, { tss: number; duration: number; count: number }> = {}
  for (const a of acts) {
    const wk = weekKey(a.started_at)
    if (!weekMap[wk]) weekMap[wk] = { tss: 0, duration: 0, count: 0 }
    weekMap[wk].tss += a.tss ?? 0
    weekMap[wk].duration += a.duration_seconds
    weekMap[wk].count++
  }
  const weeklyData = Object.entries(weekMap).sort(([a], [b]) => a.localeCompare(b)).map(([wk, v]) => ({
    semana: fmtDate(wk),
    TSS: Math.round(v.tss),
    Horas: Math.round(v.duration / 3600 * 10) / 10,
    Atividades: v.count,
  }))

  // Sport distribution
  const sportMap: Record<string, number> = {}
  for (const a of acts) {
    sportMap[a.sport] = (sportMap[a.sport] ?? 0) + a.duration_seconds
  }
  const sportData = Object.entries(sportMap).map(([sport, sec]) => ({
    sport: sport === 'cycling' ? 'Ciclismo' : sport === 'running' ? 'Corrida' : sport === 'swimming' ? 'Natação' : sport,
    horas: Math.round(sec / 3600 * 10) / 10,
    fill: SPORT_COLORS[sport] ?? 'var(--muted-foreground)',
  })).sort((a, b) => b.horas - a.horas)

  // NP trend (cycling only)
  const npTrend = acts
    .filter(a => a.sport === 'cycling' && a.normalized_power)
    .map(a => ({ data: fmtDate(a.started_at), NP: a.normalized_power! }))
    .slice(-20)

  const totalTSS = acts.reduce((s, a) => s + (a.tss ?? 0), 0)
  const totalHours = Math.round(acts.reduce((s, a) => s + a.duration_seconds, 0) / 3600 * 10) / 10
  const lastCtl = pmc.length ? Math.round(pmc[pmc.length - 1].ctl) : null
  const lastTsb = pmc.length ? Math.round(pmc[pmc.length - 1].tsb) : null

  const hasData = pmc.length > 0 || acts.length > 0

  return (
    <div>
      <Topbar title="Analytics" subtitle="Análise de performance por atleta" />
      <div className="p-6 space-y-5">

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <select value={selected} onChange={e => setSelected(e.target.value)}
              className="pl-3 pr-8 py-2 bg-card border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary appearance-none min-w-[180px]">
              {athletes.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-2.5 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
          <div className="flex gap-1">
            {([30, 90, 180] as const).map(r => (
              <button key={r} onClick={() => setRange(r)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${range === r ? 'bg-primary text-white' : 'bg-card border border-border text-muted-foreground hover:text-foreground'}`}>
                {r}d
              </button>
            ))}
          </div>
          {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        </div>

        {!hasData && !loading && (
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <TrendingUp className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-semibold text-foreground mb-1">Sem dados para exibir</p>
            <p className="text-xs text-muted-foreground">Importe treinos em <a href="/import" className="text-primary hover:underline">Importar Dados</a> para ver os gráficos</p>
          </div>
        )}

        {hasData && (
          <>
            {/* KPI row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {([
                { label: 'CTL atual', value: lastCtl != null ? String(lastCtl) : '—', sub: 'Fitness', icon: TrendingUp, color: '#0088ff', mkey: 'ctl' as MetricKey, ctx: { ctl_prev: lastCtl ?? 0, tss_today: pmc[pmc.length - 1]?.daily_tss ?? 0 } },
                { label: 'TSB atual', value: lastTsb != null ? (lastTsb >= 0 ? '+' : '') + lastTsb : '—', sub: 'Forma', icon: Activity, color: lastTsb != null && lastTsb >= 0 ? '#00d084' : '#ffa800', mkey: 'tsb' as MetricKey, ctx: { ctl: pmc[pmc.length - 1]?.ctl ?? 0, atl: pmc[pmc.length - 1]?.atl ?? 0 } },
                { label: `TSS (${range}d)`, value: Math.round(totalTSS).toLocaleString('pt-BR'), sub: 'Total de stress', icon: Zap, color: '#ffa800', mkey: 'tss' as MetricKey, ctx: { ftp: athlete?.ftp_watts ?? 0 } },
                { label: `Volume (${range}d)`, value: `${totalHours}h`, sub: `${acts.length} atividades`, icon: Calendar, color: '#00d084', mkey: null, ctx: {} },
              ] as { label: string; value: string; sub: string; icon: React.ElementType; color: string; mkey: MetricKey | null; ctx: Record<string, number | string | null> }[]).map(k => (
                <div key={k.label}
                  className={`bg-card border border-border rounded-xl p-4 transition-colors ${k.mkey ? 'cursor-pointer hover:bg-secondary/50' : ''}`}
                  onClick={k.mkey ? () => setMetricDetail({ key: k.mkey!, value: k.value, ctx: k.ctx }) : undefined}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground">{k.label}</span>
                    <div className="flex items-center gap-1.5">
                      {k.mkey && <span className="text-[8px] text-muted-foreground/40">ⓘ</span>}
                      <k.icon className="w-4 h-4" style={{ color: k.color }} />
                    </div>
                  </div>
                  <p className="text-2xl font-black" style={{ color: k.color }}>{k.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{k.sub}</p>
                </div>
              ))}
            </div>

            {/* PMC Chart */}
            {pmcData.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="text-sm font-bold text-foreground mb-1">Performance Management Chart</h3>
                <p className="text-xs text-muted-foreground mb-4">CTL (Fitness) · ATL (Fadiga) · TSB (Forma) · TSS diário</p>
                <ResponsiveContainer width="100%" height={260}>
                  <ComposedChart data={pmcData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip content={<Tip />} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} formatter={(v) => <span style={{ color: 'var(--muted-foreground)' }}>{v}</span>} />
                    <ReferenceLine y={0} stroke="var(--border)" />
                    <Bar dataKey="TSS" fill="var(--border)" radius={[2, 2, 0, 0]} />
                    <Line type="monotone" dataKey="CTL" stroke="#0088ff" strokeWidth={2.5} dot={false} />
                    <Line type="monotone" dataKey="ATL" stroke="#e8001c" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="TSB" stroke="#00d084" strokeWidth={2} dot={false} strokeDasharray="4 2" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Weekly volume + sport distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {weeklyData.length > 0 && (
                <div className="bg-card border border-border rounded-xl p-5">
                  <h3 className="text-sm font-bold text-foreground mb-1">Volume Semanal</h3>
                  <p className="text-xs text-muted-foreground mb-4">TSS e horas por semana</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={weeklyData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="semana" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} tickLine={false} axisLine={false} />
                      <Tooltip content={<Tip />} />
                      <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} formatter={(v) => <span style={{ color: 'var(--muted-foreground)' }}>{v}</span>} />
                      <Bar dataKey="TSS" fill="#0088ff" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="Horas" fill="#00d084" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {sportData.length > 0 && (
                <div className="bg-card border border-border rounded-xl p-5">
                  <h3 className="text-sm font-bold text-foreground mb-1">Volume por Modalidade</h3>
                  <p className="text-xs text-muted-foreground mb-4">Horas totais no período</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={sportData} layout="vertical" margin={{ top: 4, right: 8, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                      <XAxis type="number" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} tickLine={false} axisLine={false} />
                      <YAxis dataKey="sport" type="category" tick={{ fill: '#aaaacc', fontSize: 11 }} tickLine={false} axisLine={false} width={70} />
                      <Tooltip content={<Tip />} />
                      <Bar dataKey="horas" name="Horas" radius={[0, 4, 4, 0]}>
                        {sportData.map((entry, i) => (
                          <rect key={i} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* NP trend (only when cycling data exists) */}
            {npTrend.length > 1 && (
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="text-sm font-bold text-foreground mb-1">Potência Normalizada — Ciclismo</h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Últimas {npTrend.length} atividades · FTP: {athlete?.ftp_watts ? `${athlete.ftp_watts}W` : 'não definido'}
                </p>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={npTrend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="npGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0088ff" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#0088ff" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="data" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                    <Tooltip content={<Tip />} />
                    {athlete?.ftp_watts && <ReferenceLine y={athlete.ftp_watts} stroke="#ffa800" strokeDasharray="4 2" label={{ value: 'FTP', fill: '#ffa800', fontSize: 10 }} />}
                    <Area type="monotone" dataKey="NP" stroke="#0088ff" strokeWidth={2} fill="url(#npGrad)" dot={{ fill: '#0088ff', r: 3 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}

        <GlossaryLegend terms={['CTL', 'ATL', 'TSB', 'TSS', 'FTP', 'NP', 'IF', 'PMC']} />
      </div>

      {metricDetail && (
        <MetricDetailSheet
          metricKey={metricDetail.key}
          value={metricDetail.value ?? undefined}
          context={metricDetail.ctx}
          onClose={() => setMetricDetail(null)}
        />
      )}
    </div>
  )
}
