'use client'

import { useEffect, useState } from 'react'
import { Topbar } from '@/components/layout/topbar'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { StatusBadge } from '@/components/dashboard/status-badge'
import { Users, TrendingUp, AlertTriangle, Activity, Loader2 } from 'lucide-react'
import { GlossaryLegend } from '@/components/ui/glossary-legend'
import Link from 'next/link'
import { getDashboardSummary } from '@/lib/supabase/queries'
import { MetricDetailSheet, type MetricKey } from '@/components/ui/metric-detail-sheet'

type AthleteSummary = {
  id: string
  full_name: string
  primary_sport: string
  ctl: number | null
  atl: number | null
  tsb: number | null
  status: string | null
  watts_per_kg: number | null
}

function sportLabel(sport: string) {
  const map: Record<string, string> = {
    running: 'Corrida', cycling: 'Ciclismo', triathlon: 'Triathlon',
    swimming: 'Natação', duathlon: 'Duathlon', other: 'Outro',
  }
  return map[sport] ?? sport
}

export default function DashboardPage() {
  const [athletes, setAthletes] = useState<AthleteSummary[]>([])
  const [weeklyActivities, setWeeklyActivities] = useState(0)
  const [loading, setLoading] = useState(true)
  const [metricDetail, setMetricDetail] = useState<{ key: MetricKey } | null>(null)

  useEffect(() => {
    getDashboardSummary().then(({ athletes, weeklyActivities }) => {
      setAthletes(athletes)
      setWeeklyActivities(weeklyActivities)
      setLoading(false)
    })
  }, [])

  const alertAthletes = athletes.filter(a => a.status === 'overreaching' || a.status === 'tired')
  const avgCTL = athletes.length > 0
    ? (athletes.reduce((s, a) => s + (a.ctl ?? 0), 0) / athletes.length).toFixed(0)
    : '—'

  return (
    <div>
      <Topbar
        title="Visão Geral"
        subtitle={new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
      />

      <div className="p-6 space-y-6">
        {/* KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Alunos Ativos" value={loading ? '—' : athletes.length} sub="total cadastrado" icon={Users} color="blue" />
          <KpiCard label="CTL Médio Grupo" value={loading ? '—' : avgCTL} sub="Fitness coletivo" icon={TrendingUp} color="green"
            onClick={() => setMetricDetail({ key: 'ctl' })} />
          <KpiCard label="Em Alerta" value={loading ? '—' : alertAthletes.length} sub="TSB crítico" icon={AlertTriangle} color="yellow"
            onClick={() => setMetricDetail({ key: 'tsb' })} />
          <KpiCard label="Treinos — 7 dias" value={loading ? '—' : weeklyActivities} sub="Todos os alunos" icon={Activity} color="red" />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Carregando dados...</span>
          </div>
        ) : athletes.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-10 text-center">
            <p className="text-sm font-semibold text-foreground mb-1">Nenhum aluno cadastrado ainda</p>
            <p className="text-xs text-muted-foreground mb-4">Vá até a aba Alunos e cadastre seus primeiros atletas</p>
            <Link href="/athletes" className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors">
              Ir para Alunos →
            </Link>
          </div>
        ) : (
          <>
            {/* Alertas + Lista */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-foreground">Todos os Alunos</h3>
                  <Link href="/athletes" className="text-xs text-primary hover:underline">Ver detalhes →</Link>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {athletes.map((a) => {
                    const tsb = a.tsb ?? 0
                    const status = (a.status ?? 'fit') as 'peak' | 'fresh' | 'fit' | 'tired' | 'overreaching'
                    const initials = a.full_name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
                    return (
                      <Link key={a.id} href={`/athletes/detail?id=${a.id}`}>
                        <div className="bg-secondary/30 hover:bg-secondary border border-border hover:border-primary/30 rounded-lg p-3 transition-all cursor-pointer">
                          <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary mb-2">
                            {initials}
                          </div>
                          <p className="text-sm font-semibold text-foreground truncate">{a.full_name}</p>
                          <p className="text-[11px] text-muted-foreground mb-2">{sportLabel(a.primary_sport)}</p>
                          <div className="flex justify-between text-[10px] mb-1">
                            <span className="text-muted-foreground">CTL</span>
                            <span className="font-bold text-[#0088ff]">{a.ctl?.toFixed(0) ?? '—'}</span>
                          </div>
                          <div className="flex justify-between text-[10px] mb-2">
                            <span className="text-muted-foreground">TSB</span>
                            <span className={`font-bold ${tsb >= 0 ? 'text-[#00d084]' : 'text-[#ffa800]'}`}>
                              {tsb > 0 ? '+' : ''}{tsb.toFixed(0)}
                            </span>
                          </div>
                          <StatusBadge status={status} />
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>

              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="text-sm font-bold text-foreground mb-4">
                  Alunos em Alerta
                  {alertAthletes.length > 0 && (
                    <span className="ml-2 text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full">{alertAthletes.length}</span>
                  )}
                </h3>
                {alertAthletes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-center">
                    <p className="text-[#00d084] text-2xl mb-1">✓</p>
                    <p className="text-xs font-semibold text-foreground">Todos em boa forma</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Nenhum atleta em sobrecarga</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {alertAthletes.map((a) => {
                      const tsb = a.tsb ?? 0
                      const status = (a.status ?? 'tired') as 'tired' | 'overreaching'
                      const initials = a.full_name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
                      return (
                        <Link key={a.id} href={`/athletes/detail?id=${a.id}`}>
                          <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary transition-colors cursor-pointer">
                            <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                              {initials}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate">{a.full_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {sportLabel(a.primary_sport)} · TSB {tsb > 0 ? '+' : ''}{tsb.toFixed(0)}
                              </p>
                            </div>
                            <StatusBadge status={status} />
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        <GlossaryLegend terms={['CTL', 'TSB', 'TSS', 'ATL']} />
      </div>

      {metricDetail && (
        <MetricDetailSheet
          metricKey={metricDetail.key}
          onClose={() => setMetricDetail(null)}
        />
      )}
    </div>
  )
}
