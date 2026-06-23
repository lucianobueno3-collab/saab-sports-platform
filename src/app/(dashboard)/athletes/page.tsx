import { Topbar } from '@/components/layout/topbar'
import { StatusBadge } from '@/components/dashboard/status-badge'
import { Plus, Filter } from 'lucide-react'
import Link from 'next/link'

const athletes = [
  { id: '1', initials: 'MR', name: 'Marcos Rocha', email: 'marcos@email.com', sport: 'Ciclismo', age: 32, ctl: 94, atl: 86, tsb: 8, ftp: 295, vo2max: 65, status: 'peak' as const, lastActivity: '2 horas atrás' },
  { id: '2', initials: 'AF', name: 'Ana Ferreira', email: 'ana@email.com', sport: 'Corrida', age: 28, ctl: 71, atl: 83, tsb: -12, ftp: null, vo2max: 58, status: 'tired' as const, lastActivity: '1 dia atrás' },
  { id: '3', initials: 'JS', name: 'João Silva', email: 'joao@email.com', sport: 'Triathlon', age: 41, ctl: 85, atl: 113, tsb: -28, ftp: 260, vo2max: 61, status: 'overreaching' as const, lastActivity: '5 horas atrás' },
  { id: '4', initials: 'CM', name: 'Carla Melo', email: 'carla@email.com', sport: 'Corrida', age: 35, ctl: 62, atl: 57, tsb: 5, ftp: null, vo2max: 54, status: 'fit' as const, lastActivity: '3 dias atrás' },
  { id: '5', initials: 'RP', name: 'Rafael Pinto', email: 'rafael@email.com', sport: 'Ciclismo', age: 29, ctl: 78, atl: 64, tsb: 14, ftp: 310, vo2max: 68, status: 'fresh' as const, lastActivity: '1 hora atrás' },
]

export default function AthletesPage() {
  return (
    <div>
      <Topbar title="Alunos" subtitle={`${athletes.length} alunos cadastrados`} />

      <div className="p-6">
        {/* Actions */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground border border-border rounded-lg hover:bg-secondary transition-colors">
              <Filter className="w-3.5 h-3.5" />
              Filtrar
            </button>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" />
            Novo Aluno
          </button>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
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
              {athletes.map((a) => (
                <tr key={a.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="px-5 py-3.5">
                    <Link href={`/athletes/${a.id}`} className="flex items-center gap-3 group">
                      <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                        {a.initials}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground group-hover:text-primary transition-colors">{a.name}</p>
                        <p className="text-xs text-muted-foreground">{a.email}</p>
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3.5 text-muted-foreground">{a.sport}</td>
                  <td className="px-4 py-3.5 text-center font-bold text-[#0088ff]">{a.ctl}</td>
                  <td className="px-4 py-3.5 text-center font-bold text-primary">{a.atl}</td>
                  <td className="px-4 py-3.5 text-center">
                    <span className={`font-bold ${a.tsb >= 0 ? 'text-[#00d084]' : 'text-[#ffa800]'}`}>
                      {a.tsb > 0 ? '+' : ''}{a.tsb}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-center text-foreground">{a.ftp ? `${a.ftp}W` : '—'}</td>
                  <td className="px-4 py-3.5 text-center text-foreground">{a.vo2max}</td>
                  <td className="px-4 py-3.5"><StatusBadge status={a.status} /></td>
                  <td className="px-4 py-3.5 text-xs text-muted-foreground">{a.lastActivity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
