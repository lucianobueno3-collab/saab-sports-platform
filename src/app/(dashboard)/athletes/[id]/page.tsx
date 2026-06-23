import { Topbar } from '@/components/layout/topbar'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { StatusBadge } from '@/components/dashboard/status-badge'
import { PMCChart } from '@/components/charts/pmc-chart'
import { HRVChart } from '@/components/charts/hrv-chart'
import { ZoneChart } from '@/components/charts/zone-chart'
import { buildPMC } from '@/lib/calculations/pmc'
import { ArrowLeft, Zap, Heart, Timer, TrendingUp, Activity } from 'lucide-react'
import Link from 'next/link'

// Mock — will come from Supabase
const athlete = {
  id: '1', initials: 'MR', name: 'Marcos Rocha', email: 'marcos@email.com',
  sport: 'Ciclismo', category: 'Age Group 35-39', age: 32, weight: 77.5, height: 178,
  ftp: 295, lthr: 163, vo2max: 65, maxHR: 183, threshold_pace: null,
  goal: 'Gran Fondo SP — Outubro 2025', status: 'peak' as const,
}

const mockActivities = Array.from({ length: 120 }, (_, i) => {
  const date = new Date(); date.setDate(date.getDate() - (120 - i))
  return { date: date.toISOString().slice(0, 10), tss: Math.floor(Math.random() * 130) + (i % 7 === 6 ? 0 : 15) }
})
const pmcData = buildPMC(mockActivities, 35, 40)
const last = pmcData[pmcData.length - 1]

const mockHRV = Array.from({ length: 30 }, (_, i) => {
  const date = new Date(); date.setDate(date.getDate() - (30 - i))
  return { date: date.toISOString().slice(0, 10), hrv: 60 + Math.random() * 25 }
})

const zoneData = [
  { zone: 'Z1', name: 'Recuperação', percent: 28, color: '#4ade80' },
  { zone: 'Z2', name: 'Resistência', percent: 48, color: '#86efac' },
  { zone: 'Z3', name: 'Tempo', percent: 12, color: '#fbbf24' },
  { zone: 'Z4', name: 'Limiar', percent: 8, color: '#f97316' },
  { zone: 'Z5', name: 'VO2max', percent: 4, color: '#ef4444' },
]

const recentActivities = [
  { name: 'Ride Endurance', date: 'Hoje', duration: '2h 18min', tss: 95, np: '242W', if: '0.82' },
  { name: 'Ride Tempo', date: 'Ontem', duration: '1h 45min', tss: 118, np: '278W', if: '0.94' },
  { name: 'Ride Fácil', date: '3 dias atrás', duration: '1h 10min', tss: 42, np: '198W', if: '0.67' },
  { name: 'Ride Intervalos', date: '4 dias atrás', duration: '1h 55min', tss: 134, np: '304W', if: '1.03' },
]

export default function AthleteDetailPage({ params }: { params: { id: string } }) {
  const wKg = (athlete.ftp / athlete.weight).toFixed(2)

  return (
    <div>
      <Topbar title={athlete.name} subtitle={`${athlete.sport} · ${athlete.category}`} />

      <div className="p-6 space-y-5">
        {/* Back + Header */}
        <div className="flex items-center gap-4">
          <Link href="/athletes" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar
          </Link>
          <div className="flex items-center gap-3 ml-2">
            <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-sm font-bold text-primary">
              {athlete.initials}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-foreground">{athlete.name}</h2>
                <StatusBadge status={athlete.status} />
              </div>
              <p className="text-xs text-muted-foreground">{athlete.goal}</p>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          <KpiCard label="CTL / Fitness" value={last?.ctl?.toFixed(0) ?? '—'} icon={TrendingUp} color="blue" />
          <KpiCard label="ATL / Fadiga" value={last?.atl?.toFixed(0) ?? '—'} icon={Activity} color="red" />
          <KpiCard label="TSB / Forma" value={(last?.tsb >= 0 ? '+' : '') + (last?.tsb?.toFixed(0) ?? '—')} color={last?.tsb >= 0 ? 'green' : 'yellow'} />
          <KpiCard label="FTP" value={`${athlete.ftp}W`} sub="Potência Limiar" icon={Zap} color="yellow" />
          <KpiCard label="W/kg" value={wKg} sub="Relação peso/pot." color="purple" />
          <KpiCard label="VO2max" value={athlete.vo2max} sub="ml/kg/min" icon={Heart} color="green" />
          <KpiCard label="FC Limiar" value={`${athlete.lthr} bpm`} sub="LTHR" color="red" />
        </div>

        {/* PMC + Perfil */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-bold text-foreground mb-1">Performance Management Chart</h3>
            <p className="text-xs text-muted-foreground mb-4">Últimos 90 dias</p>
            <PMCChart data={pmcData.slice(-90)} />
          </div>
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-bold text-foreground mb-4">Perfil do Atleta</h3>
            <div className="space-y-3 text-sm">
              {[
                ['Modalidade', athlete.sport],
                ['Categoria', athlete.category],
                ['Idade', `${athlete.age} anos`],
                ['Peso', `${athlete.weight} kg`],
                ['Altura', `${athlete.height} cm`],
                ['FC Máxima', `${athlete.maxHR} bpm`],
                ['Objetivo', athlete.goal],
              ].map(([k, v]) => (
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
            <HRVChart data={mockHRV} baseline={65} />
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
            <div className="space-y-3">
              {recentActivities.map((act, i) => (
                <div key={i} className="flex items-start justify-between gap-2 pb-3 border-b border-border/50 last:border-0 last:pb-0">
                  <div>
                    <p className="text-xs font-semibold text-foreground">{act.name}</p>
                    <p className="text-[10px] text-muted-foreground">{act.date} · {act.duration}</p>
                    <p className="text-[10px] text-muted-foreground">NP: {act.np} · IF: {act.if}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-[#ffa800]">{act.tss}</p>
                    <p className="text-[10px] text-muted-foreground">TSS</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
