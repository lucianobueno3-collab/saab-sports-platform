import { Topbar } from '@/components/layout/topbar'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { StatusBadge } from '@/components/dashboard/status-badge'
import { PMCChart } from '@/components/charts/pmc-chart'
import { HRVChart } from '@/components/charts/hrv-chart'
import { ZoneChart } from '@/components/charts/zone-chart'
import { Users, TrendingUp, AlertTriangle, Activity, Heart, Zap, Timer } from 'lucide-react'
import Link from 'next/link'
import { buildPMC, getAthleteStatus } from '@/lib/calculations/pmc'

// Mock data — will come from Supabase
const mockActivities = Array.from({ length: 90 }, (_, i) => {
  const date = new Date()
  date.setDate(date.getDate() - (90 - i))
  const tss = Math.floor(Math.random() * 120) + (i % 7 === 6 ? 0 : 20)
  return { date: date.toISOString().slice(0, 10), tss }
})
const pmcData = buildPMC(mockActivities, 40, 45)
const last = pmcData[pmcData.length - 1]

const mockHRV = Array.from({ length: 30 }, (_, i) => {
  const date = new Date()
  date.setDate(date.getDate() - (30 - i))
  return { date: date.toISOString().slice(0, 10), hrv: 55 + Math.random() * 30 - (i > 20 && i < 25 ? 15 : 0) }
})

const zoneData = [
  { zone: 'Z1', name: 'Recuperação', percent: 32, color: '#4ade80' },
  { zone: 'Z2', name: 'Resistência', percent: 44, color: '#86efac' },
  { zone: 'Z3', name: 'Tempo', percent: 11, color: '#fbbf24' },
  { zone: 'Z4', name: 'Limiar', percent: 9, color: '#f97316' },
  { zone: 'Z5', name: 'VO2max', percent: 4, color: '#ef4444' },
]

const mockAthletes = [
  { id: '1', initials: 'MR', name: 'Marcos Rocha', sport: 'Ciclismo', ctl: 94, tsb: 8, status: 'peak' as const },
  { id: '2', initials: 'AF', name: 'Ana Ferreira', sport: 'Corrida', ctl: 71, tsb: -12, status: 'tired' as const },
  { id: '3', initials: 'JS', name: 'João Silva', sport: 'Triathlon', ctl: 85, tsb: -28, status: 'overreaching' as const },
  { id: '4', initials: 'CM', name: 'Carla Melo', sport: 'Corrida', ctl: 62, tsb: 5, status: 'fit' as const },
  { id: '5', initials: 'RP', name: 'Rafael Pinto', sport: 'Ciclismo', ctl: 78, tsb: 14, status: 'fresh' as const },
]

const status = getAthleteStatus(last?.tsb ?? 0, last?.ctl ?? 0) as 'peak' | 'fit' | 'fresh' | 'tired' | 'overreaching'

export default function DashboardPage() {
  return (
    <div>
      <Topbar title="Visão Geral" subtitle={`${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}`} />

      <div className="p-6 space-y-6">
        {/* KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Alunos Ativos" value={mockAthletes.length} sub="30 alunos no total" delta="2 novos este mês" deltaUp icon={Users} color="blue" />
          <KpiCard label="CTL Médio Grupo" value={last?.ctl?.toFixed(0) ?? '—'} sub="Fitness coletivo" icon={TrendingUp} color="green" />
          <KpiCard label="Em Alerta" value={mockAthletes.filter(a => a.status === 'overreaching' || a.status === 'tired').length} sub="TSB crítico" icon={AlertTriangle} color="yellow" />
          <KpiCard label="Treinos Semana" value={48} sub="Todos os alunos" icon={Activity} color="red" />
        </div>

        {/* PMC + Alertas */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-foreground">Performance Management Chart</h3>
                <p className="text-xs text-muted-foreground">CTL · ATL · TSB — últimos 90 dias</p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Status:</span>
                <StatusBadge status={status} />
              </div>
            </div>
            <PMCChart data={pmcData.slice(-60)} />
            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="bg-secondary/50 rounded-lg p-3 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">CTL/Fitness</p>
                <p className="text-xl font-extrabold text-[#0088ff]">{last?.ctl?.toFixed(0)}</p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-3 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">ATL/Fadiga</p>
                <p className="text-xl font-extrabold text-primary">{last?.atl?.toFixed(0)}</p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-3 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">TSB/Forma</p>
                <p className={`text-xl font-extrabold ${(last?.tsb ?? 0) >= 0 ? 'text-[#00d084]' : 'text-[#ffa800]'}`}>
                  {last?.tsb >= 0 ? '+' : ''}{last?.tsb?.toFixed(0)}
                </p>
              </div>
            </div>
          </div>

          {/* Alertas */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-bold text-foreground mb-4">Alunos em Alerta</h3>
            <div className="space-y-3">
              {mockAthletes.filter(a => a.status !== 'fit' && a.status !== 'peak').map((a) => (
                <Link key={a.id} href={`/athletes/${a.id}`}>
                  <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary transition-colors cursor-pointer">
                    <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                      {a.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{a.name}</p>
                      <p className="text-xs text-muted-foreground">{a.sport} · TSB {a.tsb > 0 ? '+' : ''}{a.tsb}</p>
                    </div>
                    <StatusBadge status={a.status} />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* HRV + Zonas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Heart className="w-4 h-4 text-[#00d084]" />
                  HRV Trend — 30 dias
                </h3>
                <p className="text-xs text-muted-foreground">Heart Rate Variability (RMSSD)</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-extrabold text-[#00d084]">72ms</p>
                <p className="text-[10px] text-muted-foreground">Última medição</p>
              </div>
            </div>
            <HRVChart data={mockHRV} baseline={62} />
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#ffa800]" />
                  Distribuição de Zonas
                </h3>
                <p className="text-xs text-muted-foreground">FC — Semana atual</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-extrabold text-[#ffa800]">76%</p>
                <p className="text-[10px] text-muted-foreground">Z1+Z2 (aeróbio)</p>
              </div>
            </div>
            <ZoneChart zones={zoneData} />
          </div>
        </div>

        {/* Athletes Grid */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-foreground">Todos os Alunos</h3>
            <Link href="/athletes" className="text-xs text-primary hover:underline">Ver todos →</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {mockAthletes.map((a) => (
              <Link key={a.id} href={`/athletes/${a.id}`}>
                <div className="bg-secondary/30 hover:bg-secondary border border-border hover:border-primary/30 rounded-lg p-3 transition-all cursor-pointer">
                  <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary mb-2">
                    {a.initials}
                  </div>
                  <p className="text-sm font-semibold text-foreground truncate">{a.name}</p>
                  <p className="text-[11px] text-muted-foreground mb-2">{a.sport}</p>
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-muted-foreground">CTL</span>
                    <span className="font-bold text-[#0088ff]">{a.ctl}</span>
                  </div>
                  <div className="flex justify-between text-[10px] mb-2">
                    <span className="text-muted-foreground">TSB</span>
                    <span className={`font-bold ${a.tsb >= 0 ? 'text-[#00d084]' : 'text-[#ffa800]'}`}>
                      {a.tsb > 0 ? '+' : ''}{a.tsb}
                    </span>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
