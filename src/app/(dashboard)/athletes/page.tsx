'use client'

import { useEffect, useState } from 'react'
import { Topbar } from '@/components/layout/topbar'
import { StatusBadge } from '@/components/dashboard/status-badge'
import { Plus, Filter, Loader2, KeyRound } from 'lucide-react'
import Link from 'next/link'
import { getAthletes, type AthleteRow } from '@/lib/supabase/queries'
import { AddAthleteModal } from '@/components/athletes/add-athlete-modal'
import { CreateAccessModal } from '@/components/access/create-access-modal'

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

function sportLabel(sport: string) {
  const map: Record<string, string> = {
    running: 'Corrida', cycling: 'Ciclismo', triathlon: 'Triathlon',
    swimming: 'Natação', duathlon: 'Duathlon', other: 'Outro',
  }
  return map[sport] ?? sport
}

function lastActivityLabel(isoDate: string | null) {
  if (!isoDate) return '—'
  const diff = Date.now() - new Date(isoDate).getTime()
  const h = Math.floor(diff / 3600000)
  if (h < 1) return 'Agora há pouco'
  if (h < 24) return `${h}h atrás`
  const d = Math.floor(h / 24)
  if (d === 1) return '1 dia atrás'
  return `${d} dias atrás`
}

export default function AthletesPage() {
  const [athletes, setAthletes] = useState<AthleteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [showAccess, setShowAccess] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const data = await getAthletes()
      setAthletes(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div>
      <Topbar
        title="Alunos"
        subtitle={loading ? 'Carregando...' : `${athletes.length} aluno${athletes.length !== 1 ? 's' : ''} cadastrado${athletes.length !== 1 ? 's' : ''}`}
      />

      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground border border-border rounded-lg hover:bg-secondary transition-colors">
              <Filter className="w-3.5 h-3.5" />
              Filtrar
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAccess(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border border-border text-foreground hover:bg-secondary transition-colors"
            >
              <KeyRound className="w-4 h-4" />
              Gerar acesso
            </button>
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Novo Aluno
            </button>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20 gap-2 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Carregando atletas...</span>
            </div>
          ) : athletes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-sm font-semibold text-foreground mb-1">Nenhum aluno cadastrado</p>
              <p className="text-xs text-muted-foreground mb-4">Clique em "Novo Aluno" para começar</p>
              <button
                onClick={() => setShowAdd(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Novo Aluno
              </button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Atleta</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Modalidade</th>
                  <th className="text-center px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">CTL</th>
                  <th className="text-center px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">ATL</th>
                  <th className="text-center px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">TSB</th>
                  <th className="text-center px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">FTP</th>
                  <th className="text-center px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">VO2max</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Último Treino</th>
                </tr>
              </thead>
              <tbody>
                {athletes.map((a) => {
                  const tsb = a.tsb ?? 0
                  const status = (a.status ?? 'fit') as 'peak' | 'fresh' | 'fit' | 'tired' | 'overreaching'
                  return (
                    <tr key={a.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                      <td className="px-5 py-3.5">
                        <Link href={`/athletes/detail?id=${a.id}`} className="flex items-center gap-3 group">
                          <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                            {initials(a.full_name)}
                          </div>
                          <div>
                            <p className="font-semibold text-foreground group-hover:text-primary transition-colors">{a.full_name}</p>
                            <p className="text-xs text-muted-foreground">{a.email ?? '—'}</p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3.5 text-muted-foreground">{sportLabel(a.primary_sport)}</td>
                      <td className="px-4 py-3.5 text-center font-bold text-[#0088ff]">{a.ctl?.toFixed(0) ?? '—'}</td>
                      <td className="px-4 py-3.5 text-center font-bold text-primary">{a.atl?.toFixed(0) ?? '—'}</td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`font-bold ${tsb >= 0 ? 'text-[#00d084]' : 'text-[#ffa800]'}`}>
                          {tsb > 0 ? '+' : ''}{tsb.toFixed(0)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center text-foreground">{a.ftp_watts ? `${a.ftp_watts}W` : '—'}</td>
                      <td className="px-4 py-3.5 text-center text-foreground">{a.vo2max_ml_kg_min?.toFixed(1) ?? '—'}</td>
                      <td className="px-4 py-3.5"><StatusBadge status={status} /></td>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground">{lastActivityLabel(a.last_activity_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showAdd && <AddAthleteModal onClose={() => setShowAdd(false)} onSaved={load} />}
      {showAccess && <CreateAccessModal variant="athlete" canCreateStaff={false} onClose={() => setShowAccess(false)} onSaved={load} />}
    </div>
  )
}
