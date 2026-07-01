'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Topbar } from '@/components/layout/topbar'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { StatusBadge } from '@/components/dashboard/status-badge'
import { PMCChart } from '@/components/charts/pmc-chart'
import { HRVChart } from '@/components/charts/hrv-chart'
import { ZoneChart } from '@/components/charts/zone-chart'
import { ArrowLeft, Zap, Heart, TrendingUp, Activity, Loader2, Pencil, X, Save, MessageCircle, FileText } from 'lucide-react'
import { GlossaryLegend } from '@/components/ui/glossary-legend'
import { MetricDetailSheet, type MetricKey } from '@/components/ui/metric-detail-sheet'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  getAthlete, getAthletePMC, getAthleteActivities, getAthleteHRV,
  type AthleteRow, type PMCRow, type ActivityRow, type DailyMetricRow,
} from '@/lib/supabase/queries'
import { trainingReadiness } from '@/lib/readiness'

function sportLabel(sport: string) {
  const map: Record<string, string> = {
    running: 'Corrida', cycling: 'Ciclismo', triathlon: 'Triathlon',
    swimming: 'Natação', duathlon: 'Duathlon', other: 'Outro',
  }
  return map[sport] ?? sport
}

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h}h ${m}min` : `${m}min`
}

function AthleteDetailContent() {
  const params = useSearchParams()
  const id = params.get('id')

  const [athlete, setAthlete] = useState<AthleteRow | null>(null)
  const [pmc, setPmc] = useState<PMCRow[]>([])
  const [activities, setActivities] = useState<ActivityRow[]>([])
  const [hrv, setHrv] = useState<DailyMetricRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [editValues, setEditValues] = useState({ ftp_watts: '', lthr_bpm: '', vo2max_ml_kg_min: '', weight_kg: '', primary_sport: '', phone: '', initial_ctl: '', initial_atl: '', initial_date: '' })
  const [recalculating, setRecalculating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [latestMetrics, setLatestMetrics] = useState<DailyMetricRow | null>(null)
  const [metricDetail, setMetricDetail] = useState<{ key: MetricKey; value?: string | number | null; ctx?: Record<string, number | string | null> } | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    Promise.all([
      getAthlete(id),
      getAthletePMC(id, 90),
      getAthleteActivities(id, 6),
      getAthleteHRV(id, 30),
    ]).then(([a, p, acts, h]) => {
      setAthlete(a)
      if (a) setEditValues({
        ftp_watts: a.ftp_watts?.toString() ?? '',
        lthr_bpm: a.lthr_bpm?.toString() ?? '',
        vo2max_ml_kg_min: a.vo2max_ml_kg_min?.toString() ?? '',
        weight_kg: a.weight_kg?.toString() ?? '',
        primary_sport: a.primary_sport ?? '',
        phone: a.phone ?? '',
        initial_ctl: a.initial_ctl?.toString() ?? '',
        initial_atl: a.initial_atl?.toString() ?? '',
        initial_date: a.initial_date ?? '',
      })
      setPmc(p)
      setActivities(acts)
      setHrv(h)
      if (h.length > 0) setLatestMetrics(h[h.length - 1])
      setLoading(false)
    })
  }, [id])

  if (!id) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <p className="text-sm">Atleta não especificado.</p>
        <Link href="/athletes" className="text-xs text-primary mt-2 hover:underline">← Voltar para lista</Link>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-2 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Carregando...</span>
      </div>
    )
  }

  if (!athlete) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <p className="text-sm">Atleta não encontrado.</p>
        <Link href="/athletes" className="text-xs text-primary mt-2 hover:underline">← Voltar para lista</Link>
      </div>
    )
  }

  async function handleSaveEdit() {
    if (!athlete) return
    setSaving(true)
    const sb = createClient()
    const updates = {
      ftp_watts: editValues.ftp_watts ? parseInt(editValues.ftp_watts) : null,
      lthr_bpm: editValues.lthr_bpm ? parseInt(editValues.lthr_bpm) : null,
      vo2max_ml_kg_min: editValues.vo2max_ml_kg_min ? parseFloat(editValues.vo2max_ml_kg_min) : null,
      weight_kg: editValues.weight_kg ? parseFloat(editValues.weight_kg) : null,
      primary_sport: editValues.primary_sport || athlete.primary_sport,
    }
    if (editValues.phone !== undefined) (updates as Record<string, unknown>).phone = editValues.phone.trim().replace(/\s/g, '') || null
    if (editValues.initial_ctl) (updates as Record<string, unknown>).initial_ctl = parseFloat(editValues.initial_ctl)
    if (editValues.initial_atl) (updates as Record<string, unknown>).initial_atl = parseFloat(editValues.initial_atl)
    if (editValues.initial_date) (updates as Record<string, unknown>).initial_date = editValues.initial_date
    await sb.from('athletes').update(updates).eq('id', athlete.id)

    // Recalculate PMC from initial_date with explicit initial values
    if (editValues.initial_date) {
      setRecalculating(true)
      await sb.rpc('recalculate_pmc', {
        p_athlete_id: athlete.id,
        p_from_date: editValues.initial_date,
        p_initial_ctl: editValues.initial_ctl ? parseFloat(editValues.initial_ctl) : null,
        p_initial_atl: editValues.initial_atl ? parseFloat(editValues.initial_atl) : null,
      })
      const newPmc = await import('@/lib/supabase/queries').then(m => m.getAthletePMC(athlete.id, 90))
      setPmc(newPmc)
      setRecalculating(false)
    }

    setAthlete({ ...athlete, ...updates } as AthleteRow)
    setSaving(false)
    setEditOpen(false)
  }

  function handleWhatsApp() {
    if (!athlete) return
    const phone = athlete.phone
    const today = new Date().toLocaleDateString('pt-BR')
    const last = pmc[pmc.length - 1]
    const ctl = last?.ctl?.toFixed(0) ?? '—'
    const atl = last?.atl?.toFixed(0) ?? '—'
    const tsb = last?.tsb != null ? (last.tsb >= 0 ? '+' : '') + last.tsb.toFixed(0) : '—'
    const tsbIcon = last?.tsb != null ? (last.tsb >= 5 ? '✅' : last.tsb >= -10 ? '🟡' : '🔴') : ''

    let rec = ''
    if (latestMetrics) {
      const m = latestMetrics
      const readiness = trainingReadiness({
        date: m.date,
        hrv_ms: m.hrv_ms,
        body_battery: m.body_battery,
        sleep_hours: m.sleep_hours,
        rem_pct: m.rem_pct,
        resting_hr_bpm: m.resting_hr,
        stress_avg: m.stress_avg,
        rem_sleep_hours: null,
        deep_sleep_hours: null,
        light_sleep_hours: null,
        weight_kg: null,
      })
      const hrvIcon = (m.hrv_ms ?? 0) >= 37 ? '🟢' : (m.hrv_ms ?? 0) >= 34 ? '🟡' : '🔴'
      const bbIcon = (m.body_battery ?? 0) >= 50 ? '🟢' : (m.body_battery ?? 0) >= 40 ? '🟡' : '🔴'
      const sleepIcon = (m.sleep_hours ?? 0) >= 8 ? '🟢' : (m.sleep_hours ?? 0) >= 7 ? '🟡' : '🔴'
      const remIcon = (m.rem_pct ?? 0) >= 20 ? '🟢' : (m.rem_pct ?? 0) >= 10 ? '🟡' : '🔴'
      const trafficIcon = readiness.level === 'VERDE' ? '🟢 TREINO LIBERADO' : readiness.level === 'AMARELO' ? '🟡 TREINO ADAPTADO' : readiness.level === 'VALVULA' ? '🔴 VÁLVULA — APENAS RECUPERAÇÃO' : '🔴 TREINO CANCELADO'
      rec = `\n━━━ ❤️ RECUPERAÇÃO (${m.date}) ━━━
• HRV: ${m.hrv_ms?.toFixed(0) ?? '—'}ms ${hrvIcon}
• Body Battery: ${m.body_battery?.toFixed(0) ?? '—'} ${bbIcon}
• Sono: ${m.sleep_hours?.toFixed(1) ?? '—'}h ${sleepIcon}
• REM: ${m.rem_pct?.toFixed(0) ?? '—'}% ${remIcon}\n\n━━━ 🎯 PRONTIDÃO ━━━\n${trafficIcon}${readiness.recommendation ? '\n↳ ' + readiness.recommendation : ''}`
    }

    const text = `🏋️ *SAAB Sports — Relatório de Treino*\n📅 ${today}\n\n*${athlete.full_name}* • ${sportLabel(athlete.primary_sport)}\n\n━━━ 📊 PERFORMANCE (PMC) ━━━\n• CTL / Fitness: ${ctl}\n• ATL / Fadiga: ${atl}\n• TSB / Forma: ${tsb} ${tsbIcon}${rec}\n\n_Powered by SAAB Sports Performance Platform_`

    const encoded = encodeURIComponent(text)
    const url = phone ? `https://wa.me/${phone.replace(/\D/g, '')}?text=${encoded}` : `https://wa.me/?text=${encoded}`
    window.open(url, '_blank')
  }

  const last = pmc[pmc.length - 1]
  const tsb = last?.tsb ?? 0
  const status = (athlete.status ?? 'fit') as 'peak' | 'fresh' | 'fit' | 'tired' | 'overreaching'
  const wKg = athlete.ftp_watts && athlete.weight_kg
    ? (athlete.ftp_watts / athlete.weight_kg).toFixed(2)
    : '—'

  const initials = athlete.full_name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()

  const pmcForChart = pmc.map(p => ({ date: p.date, tss: p.daily_tss, ctl: p.ctl, atl: p.atl, tsb: p.tsb }))
  const hrvForChart = hrv
    .filter(h => h.hrv_rmssd != null)
    .map(h => ({ date: h.date, hrv: h.hrv_rmssd! }))

  const zoneData = [
    { zone: 'Z1', name: 'Recuperação', percent: 0, color: '#4ade80' },
    { zone: 'Z2', name: 'Resistência', percent: 0, color: '#86efac' },
    { zone: 'Z3', name: 'Tempo', percent: 0, color: '#fbbf24' },
    { zone: 'Z4', name: 'Limiar', percent: 0, color: '#f97316' },
    { zone: 'Z5', name: 'VO2max', percent: 0, color: '#ef4444' },
  ]

  return (
    <div>
      <Topbar title={athlete.full_name} subtitle={`${sportLabel(athlete.primary_sport)}`} />

      <div className="p-6 space-y-5">
        <div className="flex items-center gap-4">
          <Link href="/athletes" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar
          </Link>
          <div className="flex items-center gap-3 ml-2 flex-1">
            <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-sm font-bold text-primary">
              {initials}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-foreground">{athlete.full_name}</h2>
                <StatusBadge status={status} />
              </div>
              <p className="text-xs text-muted-foreground">{athlete.email ?? sportLabel(athlete.primary_sport)}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={`/report?id=${id}`}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary border border-primary/30 bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors"
              >
                <FileText className="w-3.5 h-3.5" /> Ver Relatório
              </Link>
              <button
                onClick={handleWhatsApp}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#25d366] border border-[#25d366]/30 bg-[#25d366]/10 rounded-lg hover:bg-[#25d366]/20 transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5" /> Enviar Relatório
              </button>
              <button
                onClick={() => setEditOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground border border-border rounded-lg hover:bg-secondary hover:text-foreground transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" /> Editar Perfil
              </button>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          <KpiCard label="CTL / Fitness" value={last?.ctl?.toFixed(0) ?? '—'} icon={TrendingUp} color="blue"
            onClick={() => setMetricDetail({ key: 'ctl', value: last?.ctl?.toFixed(0), ctx: { ctl_prev: last?.ctl ?? 0, tss_today: last?.daily_tss ?? 0 } })} />
          <KpiCard label="ATL / Fadiga" value={last?.atl?.toFixed(0) ?? '—'} icon={Activity} color="red"
            onClick={() => setMetricDetail({ key: 'atl', value: last?.atl?.toFixed(0), ctx: { atl_prev: last?.atl ?? 0, tss_today: last?.daily_tss ?? 0 } })} />
          <KpiCard label="TSB / Forma" value={(tsb >= 0 ? '+' : '') + tsb.toFixed(0)} color={tsb >= 0 ? 'green' : 'yellow'}
            onClick={() => setMetricDetail({ key: 'tsb', value: (tsb >= 0 ? '+' : '') + tsb.toFixed(0), ctx: { ctl: last?.ctl ?? 0, atl: last?.atl ?? 0 } })} />
          <KpiCard label="FTP" value={athlete.ftp_watts ? `${athlete.ftp_watts}W` : '—'} sub="Potência Limiar" icon={Zap} color="yellow"
            onClick={() => setMetricDetail({ key: 'ftp', value: athlete.ftp_watts, ctx: { ftp: athlete.ftp_watts ?? 0 } })} />
          <KpiCard label="W/kg" value={wKg} sub="Relação peso/pot." color="purple"
            onClick={() => setMetricDetail({ key: 'wkg', value: wKg, ctx: { ftp: athlete.ftp_watts ?? 0, weight: athlete.weight_kg ?? 0 } })} />
          <KpiCard label="VO2max" value={athlete.vo2max_ml_kg_min?.toFixed(1) ?? '—'} sub="ml/kg/min" icon={Heart} color="green"
            onClick={() => setMetricDetail({ key: 'vo2max', value: athlete.vo2max_ml_kg_min?.toFixed(1) })} />
          <KpiCard label="FC Limiar" value={athlete.lthr_bpm ? `${athlete.lthr_bpm} bpm` : '—'} sub="LTHR" color="red"
            onClick={() => setMetricDetail({ key: 'lthr', value: athlete.lthr_bpm })} />
        </div>

        {/* Recovery KPIs */}
        {latestMetrics && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <KpiCard label="HRV" value={latestMetrics.hrv_ms?.toFixed(0) ?? '—'} sub="ms — rMSSD noturno" icon={Heart} color="green"
              onClick={() => setMetricDetail({ key: 'hrv', value: latestMetrics.hrv_ms?.toFixed(0), ctx: { hrv: latestMetrics.hrv_ms ?? 0 } })} />
            <KpiCard label="Body Battery" value={latestMetrics.body_battery?.toFixed(0) ?? '—'} sub="Energia disponível" color="purple"
              onClick={() => setMetricDetail({ key: 'body_battery', value: latestMetrics.body_battery?.toFixed(0) })} />
            <KpiCard label="Sono" value={latestMetrics.sleep_hours?.toFixed(1) ?? '—'} sub="horas" icon={Activity} color={( latestMetrics.sleep_hours ?? 0) >= 7 ? 'green' : 'yellow'}
              onClick={() => setMetricDetail({ key: 'sleep', value: latestMetrics.sleep_hours?.toFixed(1), ctx: { sleep: latestMetrics.sleep_hours ?? 0 } })} />
            <KpiCard label="REM" value={latestMetrics.rem_pct?.toFixed(0) ?? '—'} sub="% do sono total" color={(latestMetrics.rem_pct ?? 0) >= 20 ? 'green' : 'yellow'}
              onClick={() => setMetricDetail({ key: 'rem', value: latestMetrics.rem_pct?.toFixed(0), ctx: { rem: latestMetrics.rem_pct ?? 0 } })} />
            <KpiCard label="FC Repouso" value={latestMetrics.resting_hr?.toFixed(0) ?? '—'} sub="bpm" color={(latestMetrics.resting_hr ?? 0) >= 62 ? 'red' : 'default'}
              onClick={() => setMetricDetail({ key: 'rhr', value: latestMetrics.resting_hr?.toFixed(0), ctx: { rhr: latestMetrics.resting_hr ?? 0 } })} />
          </div>
        )}

        {/* PMC + Perfil */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-bold text-foreground mb-1">Performance Management Chart</h3>
            <p className="text-xs text-muted-foreground mb-4">
              {pmcForChart.length > 0 ? `Últimos ${pmcForChart.length} dias` : 'Sem dados — importe treinos para visualizar'}
            </p>
            {pmcForChart.length > 0
              ? <PMCChart data={pmcForChart} />
              : <div className="h-40 flex items-center justify-center text-muted-foreground text-xs">Dados aparecerão após importação de treinos</div>
            }
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-bold text-foreground mb-4">Perfil do Atleta</h3>
            <div className="space-y-3 text-sm">
              {([
                ['Modalidade', sportLabel(athlete.primary_sport)],
                ['Peso', athlete.weight_kg ? `${athlete.weight_kg} kg` : '—'],
                ['FTP', athlete.ftp_watts ? `${athlete.ftp_watts} W` : '—'],
                ['LTHR', athlete.lthr_bpm ? `${athlete.lthr_bpm} bpm` : '—'],
                ['VO2max', athlete.vo2max_ml_kg_min ? `${athlete.vo2max_ml_kg_min} ml/kg/min` : '—'],
                ['W/kg', wKg],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2">
                  <span className="text-muted-foreground text-xs">{k}</span>
                  <span className="text-foreground text-xs font-medium text-right">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* HRV + Zonas + Atividades */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
              <Heart className="w-4 h-4 text-[#00d084]" /> HRV — 30 dias
            </h3>
            <p className="text-xs text-muted-foreground mb-3">RMSSD (ms)</p>
            {hrvForChart.length > 0
              ? <HRVChart data={hrvForChart} baseline={65} />
              : <div className="h-32 flex items-center justify-center text-muted-foreground text-xs">Sem dados de HRV</div>
            }
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#ffa800]" /> Zonas FC
            </h3>
            <p className="text-xs text-muted-foreground mb-4">Semana atual</p>
            <ZoneChart zones={zoneData} />
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-bold text-foreground mb-4">Atividades Recentes</h3>
            {activities.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">Nenhuma atividade importada</p>
            ) : (
              <div className="space-y-3">
                {activities.map((act) => (
                  <div key={act.id} className="flex items-start justify-between gap-2 pb-3 border-b border-border/50 last:border-0 last:pb-0">
                    <div>
                      <p className="text-xs font-semibold text-foreground">{act.name ?? sportLabel(act.sport)}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(act.started_at).toLocaleDateString('pt-BR')} · {formatDuration(act.duration_seconds)}
                      </p>
                      {act.normalized_power && (
                        <p className="text-[10px] text-muted-foreground">
                          NP: {act.normalized_power}W
                          {act.intensity_factor ? ` · IF: ${act.intensity_factor.toFixed(2)}` : ''}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-[#ffa800]">{act.tss?.toFixed(0) ?? '—'}</p>
                      <p className="text-[10px] text-muted-foreground">TSS</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit modal */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold text-foreground">Editar Perfil do Atleta</h3>
              <button onClick={() => setEditOpen(false)} className="p-1 hover:bg-secondary rounded transition-colors">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">WhatsApp <span className="text-muted-foreground/60">(com DDI, ex: +5511999999999)</span></label>
                <input type="tel" value={editValues.phone} onChange={e => setEditValues(v => ({ ...v, phone: e.target.value }))}
                  placeholder="+5511999999999"
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Modalidade principal</label>
                <select
                  value={editValues.primary_sport}
                  onChange={e => setEditValues(v => ({ ...v, primary_sport: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary appearance-none"
                >
                  {['triathlon', 'cycling', 'running', 'swimming', 'duathlon', 'other'].map(s => (
                    <option key={s} value={s}>{sportLabel(s)}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Peso (kg)</label>
                  <input type="number" value={editValues.weight_kg} onChange={e => setEditValues(v => ({ ...v, weight_kg: e.target.value }))}
                    placeholder="ex: 75" className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">FTP (watts)</label>
                  <input type="number" value={editValues.ftp_watts} onChange={e => setEditValues(v => ({ ...v, ftp_watts: e.target.value }))}
                    placeholder="ex: 250" className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">FC Limiar (bpm)</label>
                  <input type="number" value={editValues.lthr_bpm} onChange={e => setEditValues(v => ({ ...v, lthr_bpm: e.target.value }))}
                    placeholder="ex: 162" className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">VO2max (ml/kg/min)</label>
                  <input type="number" step="0.1" value={editValues.vo2max_ml_kg_min} onChange={e => setEditValues(v => ({ ...v, vo2max_ml_kg_min: e.target.value }))}
                    placeholder="ex: 52.5" className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary" />
                </div>
              </div>
              {/* PMC calibration */}
              <div className="pt-3 border-t border-border">
                <p className="text-xs font-bold text-foreground mb-1">Calibração PMC <span className="text-muted-foreground font-normal">(corrigir CTL/ATL inicial)</span></p>
                {athlete.initial_ctl && athlete.initial_date && (
                  <div className="flex items-center gap-3 mb-3 px-3 py-2 rounded-lg" style={{ background: '#071410', border: '1px solid #0f3024' }}>
                    <div className="text-[9px] text-[#00d084] font-black uppercase tracking-wider">Calibração atual</div>
                    <div className="flex gap-3 text-[10px] text-[#aabbcc]">
                      <span>CTL <strong>{athlete.initial_ctl}</strong></span>
                      <span>ATL <strong>{athlete.initial_atl ?? '—'}</strong></span>
                      <span>desde <strong>{new Date(athlete.initial_date + 'T12:00:00').toLocaleDateString('pt-BR')}</strong></span>
                    </div>
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground mb-3 leading-relaxed">
                  Use os valores do TrainingPeaks para ancorar o histórico. O PMC será recalculado a partir da data informada.
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">CTL inicial</label>
                    <input type="number" step="0.1" value={editValues.initial_ctl} onChange={e => setEditValues(v => ({ ...v, initial_ctl: e.target.value }))}
                      placeholder="ex: 58" className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">ATL inicial</label>
                    <input type="number" step="0.1" value={editValues.initial_atl} onChange={e => setEditValues(v => ({ ...v, initial_atl: e.target.value }))}
                      placeholder="ex: 75" className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Data ref.</label>
                    <input type="date" value={editValues.initial_date} onChange={e => setEditValues(v => ({ ...v, initial_date: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary" />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={handleSaveEdit} disabled={saving || recalculating}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors">
                {(saving || recalculating) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {recalculating ? 'Recalculando PMC...' : saving ? 'Salvando...' : 'Salvar e Recalcular'}
              </button>
              <button onClick={() => setEditOpen(false)}
                className="px-4 py-2.5 border border-border text-sm font-medium text-muted-foreground rounded-lg hover:bg-secondary transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="p-6 pt-0">
        <GlossaryLegend terms={['CTL', 'ATL', 'TSB', 'TSS', 'FTP', 'LTHR', 'VO2MAX', 'WKG', 'NP', 'IF']} />
      </div>

      {/* Metric detail sheet */}
      {metricDetail && (
        <MetricDetailSheet
          metricKey={metricDetail.key}
          value={metricDetail.value}
          context={metricDetail.ctx}
          onClose={() => setMetricDetail(null)}
        />
      )}
    </div>
  )
}

export default function AthleteDetailPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64 gap-2 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Carregando...</span>
      </div>
    }>
      <AthleteDetailContent />
    </Suspense>
  )
}
