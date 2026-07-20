'use client'

import { useEffect, useState } from 'react'
import { Topbar } from '@/components/layout/topbar'
import { useAuth } from '@/context/auth-context'
import { getCoaches, getMyRole, setCoachActive, setCoachRole, type CoachRow } from '@/lib/supabase/queries'
import { CreateAccessModal } from '@/components/access/create-access-modal'
import { UserPlus, Shield, ShieldOff, Users, CheckCircle2, XCircle, Loader2, Mail, Phone, Crown, ChevronDown } from 'lucide-react'
import Link from 'next/link'

function planLabel(p: string) {
  return p === 'elite' ? 'Elite' : p === 'pro' ? 'Pro' : 'Starter'
}

function CoachCard({ coach, currentUserId, onToggleActive, onToggleRole, loading }: {
  coach: CoachRow
  currentUserId: string
  onToggleActive: (id: string, active: boolean) => void
  onToggleRole: (id: string, role: 'coach' | 'admin') => void
  loading: string | null
}) {
  const isSelf = coach.id === currentUserId
  const isAdmin = coach.role === 'admin'
  const initials = (coach.full_name ?? coach.email).split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()

  return (
    <div className="rounded-xl overflow-hidden transition-all" style={{
      background: coach.active ? 'var(--sidebar)' : 'var(--panel)',
      border: `1px solid ${coach.active ? 'var(--panel-border)' : 'var(--panel-border)'}`,
      opacity: coach.active ? 1 : 0.6,
    }}>
      <div className={`h-0.5 w-full ${isAdmin ? 'bg-[#e8001c]' : 'bg-[var(--border)]'}`} />
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0"
              style={isAdmin
                ? { background: '#e8001c22', border: '1.5px solid #e8001c55', color: '#e8001c' }
                : { background: 'var(--panel-border)', border: '1.5px solid var(--border)', color: '#aabbcc' }}>
              {initials}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-foreground">{coach.full_name ?? '—'}</p>
                {isAdmin && <Crown className="w-3 h-3 text-[#e8001c]" />}
                {isSelf && <span className="text-[9px] font-black px-1.5 py-0.5 rounded" style={{ background: 'var(--panel-border)', color: '#6677aa' }}>você</span>}
              </div>
              <p className="text-[10px] text-muted-foreground">{coach.email}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider"
              style={{ background: 'var(--panel-border)', color: '#6677aa', border: '1px solid var(--border)' }}>
              {planLabel(coach.plan)}
            </span>
            <span className={`text-[9px] font-semibold px-2 py-0.5 rounded ${coach.active ? 'text-[#00d084]' : 'text-[#445566]'}`}
              style={{ background: coach.active ? '#00d08415' : 'var(--panel-border)' }}>
              {coach.active ? 'Ativo' : 'Inativo'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="rounded-lg px-3 py-2 text-center" style={{ background: 'var(--background)', border: '1px solid var(--border)' }}>
            <Users className="w-3 h-3 mx-auto mb-1 text-[#445566]" />
            <p className="text-[11px] font-black text-foreground">{coach.athlete_count ?? 0}</p>
            <p className="text-[8px] text-[#445566]">Atletas</p>
          </div>
          <div className="rounded-lg px-3 py-2 text-center" style={{ background: 'var(--background)', border: '1px solid var(--border)' }}>
            <Mail className="w-3 h-3 mx-auto mb-1 text-[#445566]" />
            <p className="text-[10px] font-black text-foreground truncate">{isAdmin ? 'Admin' : 'Coach'}</p>
            <p className="text-[8px] text-[#445566]">Função</p>
          </div>
          <div className="rounded-lg px-3 py-2 text-center" style={{ background: 'var(--background)', border: '1px solid var(--border)' }}>
            <Phone className="w-3 h-3 mx-auto mb-1 text-[#445566]" />
            <p className="text-[10px] font-black" style={{ color: coach.phone ? '#aabbcc' : '#445566' }}>
              {coach.phone ? '✓' : '—'}
            </p>
            <p className="text-[8px] text-[#445566]">WhatsApp</p>
          </div>
        </div>

        {!isSelf && (
          <div className="flex items-center gap-2 pt-1 border-t border-border">
            <button
              onClick={() => onToggleActive(coach.id, !coach.active)}
              disabled={loading === coach.id}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold rounded-lg transition-colors flex-1 justify-center disabled:opacity-50"
              style={coach.active
                ? { background: 'var(--panel-border)', border: '1px solid var(--border)', color: '#6677aa' }
                : { background: '#00d08414', border: '1px solid #00d08433', color: '#00d084' }}>
              {loading === coach.id ? <Loader2 className="w-3 h-3 animate-spin" /> :
                coach.active ? <XCircle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
              {coach.active ? 'Desativar' : 'Reativar'}
            </button>
            <button
              onClick={() => onToggleRole(coach.id, isAdmin ? 'coach' : 'admin')}
              disabled={loading === coach.id}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold rounded-lg transition-colors flex-1 justify-center disabled:opacity-50"
              style={isAdmin
                ? { background: 'var(--panel-border)', border: '1px solid var(--border)', color: '#6677aa' }
                : { background: '#e8001c14', border: '1px solid #e8001c33', color: '#e8001c' }}>
              {isAdmin ? <ShieldOff className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
              {isAdmin ? 'Remover admin' : 'Tornar admin'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AdminPage() {
  const { user } = useAuth()
  const [coaches, setCoaches] = useState<CoachRow[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [notAdmin, setNotAdmin] = useState(false)

  const [showCreate, setShowCreate] = useState(false)

  const load = async () => {
    setLoading(true)
    const [role, coachesList] = await Promise.all([getMyRole(), getCoaches()])
    if (role !== 'admin') { setNotAdmin(true); setLoading(false); return }
    setIsAdmin(true)
    setCoaches(coachesList)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleToggleActive(id: string, active: boolean) {
    setActionLoading(id)
    await setCoachActive(id, active)
    setCoaches(prev => prev.map(c => c.id === id ? { ...c, active } : c))
    setActionLoading(null)
  }

  async function handleToggleRole(id: string, role: 'coach' | 'admin') {
    setActionLoading(id)
    await setCoachRole(id, role)
    setCoaches(prev => prev.map(c => c.id === id ? { ...c, role } : c))
    setActionLoading(null)
  }

  if (loading) return (
    <div className="flex flex-col h-screen">
      <Topbar title="Administração" subtitle="Gestão de treinadores" />
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    </div>
  )

  if (notAdmin) return (
    <div className="flex flex-col h-screen">
      <Topbar title="Administração" subtitle="Gestão de treinadores" />
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
        <Shield className="w-10 h-10 text-[#e8001c] opacity-40" />
        <p className="text-sm font-bold text-foreground">Acesso restrito</p>
        <p className="text-xs text-muted-foreground">Apenas administradores podem acessar esta página.</p>
        <Link href="/dashboard" className="mt-2 text-xs font-semibold text-primary hover:underline">Voltar ao dashboard</Link>
      </div>
    </div>
  )

  const activeCount = coaches.filter(c => c.active).length
  const totalAthletes = coaches.reduce((s, c) => s + (c.athlete_count ?? 0), 0)

  return (
    <div className="flex flex-col h-screen">
      <Topbar title="Administração" subtitle="Gestão de treinadores da consultoria" />

      <div className="flex-1 overflow-auto p-4 md:p-6 space-y-6">

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Treinadores ativos', value: activeCount, color: '#00d084' },
            { label: 'Total de atletas', value: totalAthletes, color: '#aabbcc' },
            { label: 'Administradores', value: coaches.filter(c => c.role === 'admin').length, color: '#e8001c' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl p-4" style={{ background: 'var(--sidebar)', border: '1px solid var(--panel-border)' }}>
              <p className="text-2xl font-black" style={{ color }}>{value}</p>
              <p className="text-[10px] font-semibold text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Cadastro central de acesso */}
        <div className="rounded-xl p-5" style={{ background: 'var(--sidebar)', border: '1px solid var(--panel-border)' }}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-primary" />
              <div>
                <p className="text-sm font-bold text-foreground">Cadastro de acesso</p>
                <p className="text-[11px] text-muted-foreground">Crie o acesso de treinadores, admins ou atletas com senha temporária.</p>
              </div>
            </div>
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-white text-sm font-bold rounded-lg transition-colors flex-shrink-0">
              <UserPlus className="w-4 h-4" /> Novo cadastro
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-3 leading-relaxed">
            Você informa o e-mail e uma senha temporária. A pessoa entra e é obrigada a trocar a senha no primeiro acesso.
          </p>
        </div>

        {/* Coaches list */}
        <div>
          <p className="text-[11px] font-black text-muted-foreground uppercase tracking-wider mb-3">
            Treinadores cadastrados ({coaches.length})
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {coaches.map(coach => (
              <CoachCard
                key={coach.id}
                coach={coach}
                currentUserId={user?.id ?? ''}
                onToggleActive={handleToggleActive}
                onToggleRole={handleToggleRole}
                loading={actionLoading}
              />
            ))}
          </div>
        </div>

      </div>

      {showCreate && (
        <CreateAccessModal variant="staff" canCreateStaff onClose={() => setShowCreate(false)} onSaved={load} />
      )}
    </div>
  )
}
