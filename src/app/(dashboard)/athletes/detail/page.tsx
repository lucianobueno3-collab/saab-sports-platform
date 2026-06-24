'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Topbar } from '@/components/layout/topbar'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { StatusBadge } from '@/components/dashboard/status-badge'
import { PMCChart } from '@/components/charts/pmc-chart'
import { HRVChart } from '@/components/charts/hrv-chart'
import { ZoneChart } from '@/components/charts/zone-chart'
import { ArrowLeft, Zap, Heart, TrendingUp, Activity, Loader2 } from 'lucide-react'
import Link from 'next/link'
import {
  getAthlete, getAthletePMC, getAthleteActivities, getAthleteHRV,
  type AthleteRow, type PMCRow, type ActivityRow, type DailyMetricRow,
} from '@/lib/supabase/queries'

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
      setPmc(p)
      setActivities(acts)
      setHrv(h)
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
          <div className="flex items-center gap-3 ml-2">
            <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-sm font-bold text-primary">
              {initials}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-foreground">{athlete.full_name}</h2>
                <StatusBadge status={status} />
              </div>
              <p className="text-xs text-muted-foreground">{athlete.email ?? sportLabel(athlete.primary_sport)}</p>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          <KpiCard label="CTL / Fitness" value={last?.ctl?.toFixed(0) ?? '—'} icon={TrendingUp} color="blue" />
          <KpiCard label="ATL / Fadiga" value={last?.atl?.toFixed(0) ?? '—'} icon={Activity} color="red" />
          <KpiCard label="TSB / Forma" value={(tsb >= 0 ? '+' : '') + tsb.toFixed(0)} color={tsb >= 0 ? 'green' : 'yellow'} />
          <KpiCard label="FTP" value={athlete.ftp_watts ? `${athlete.ftp_watts}W` : '—'} sub="Potência Limiar" icon={Zap} color="yellow" />
          <KpiCard label="W/kg" value={wKg} sub="Relação peso/pot." color="purple" />
          <KpiCard label="VO2max" value={athlete.vo2max_ml_kg_min?.toFixed(1) ?? '—'} sub="ml/kg/min" icon={Heart} color="green" />
          <KpiCard label="FC Limiar" value={athlete.lthr_bpm ? `${athlete.lthr_bpm} bpm` : '—'} sub="LTHR" color="red" />
        </div>

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
