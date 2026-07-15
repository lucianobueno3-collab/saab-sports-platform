'use client'

import { useEffect, useState } from 'react'
import { Topbar } from '@/components/layout/topbar'
import { useAuth } from '@/context/auth-context'
import { getCoaches, getMyRole, setCoachActive, setCoachRole, type CoachRow } from '@/lib/supabase/queries'
import { createClient } from '@/lib/supabase/client'
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
      background: coach.active ? 'var(--card)' : 'var(--background)',
      border: `1px solid ${coach.active ? 'var(--secondary)' : 'var(--border)'}`,
      opacity: coach.active ? 1 : 0.6,
    }}>
      <div className={`h-0.5 w-full ${isAdmin ? 'bg-[#e8001c]' : 'bg-border'}`} />
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0"
              style={isAdmin
                ? { background: '#e8001c22', border: '1.5px solid #e8001c55', color: '#e8001c' }
                : { background: 'var(--secondary)', border: '1.5px solid var(--border)', color: 'var(--foreground)' }}>
              {initials}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-foreground">{coach.full_name ?? '—'}</p>
                {isAdmin && <Crown className="w-3 h-3 text-[#e8001c]" />}
                {isSelf && <span className="text-[9px] font-black px-1.5 py-0.5 rounded" style={{ background: 'var(--secondary)', color: 'var(--muted-foreground)' }}>você</span>}
              </div>
              <p className="text-[10px] text-muted-foreground">{coach.email}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider"
              style={{ background: 'var(--secondary)', color: 'var(--muted-foreground)', border: '1px solid var(--border)' }}>
              {planLabel(coach.plan)}
            </span>
            <span className={`text-[9px] font-semibold px-2 py-0.5 rounded ${coach.active ? 'text-[#00d084]' : 'text-muted-foreground'}`}
              style={{ background: coach.active ? '#00d08415' : 'var(--secondary)' }}>
              {coach.active ? 'Ativo' : 'Inativo'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="rounded-lg px-3 py-2 text-center" style={{ background: 'var(--background)', border: '1px solid var(--border)' }}>
            <Users className="w-3 h-3 mx-auto mb-1 text-muted-foreground" />
            <p className="text-[11px] font-black text-foreground">{coach.athlete_count ?? 0}</p>
            <p className="text-[8px] text-muted-foreground">Atletas</p>
          </div>
          <div className="rounded-lg px-3 py-2 text-center" style={{ background: 'var(--background)', border: '1px solid var(--border)' }}>
            <Mail className="w-3 h-3 mx-auto mb-1 text-muted-foreground" />
            <p className="text-[10px] font-black text-foreground truncate">{isAdmin ? 'Admin' : 'Coach'}</p>
            <p className="text-[8px] text-muted-foreground">Função</p>
          </div>
          <div className="rounded-lg px-3 py-2 text-center" style={{ background: 'var(--background)', border: '1px solid var(--border)' }}>
            <Phone className="w-3 h-3 mx-auto mb-1 text-muted-foreground" />
            <p className="text-[10px] font-black" style={{ color: coach.phone ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
              {coach.phone ? '✓' : '—'}
            </p>
            <p className="text-[8px] text-muted-foreground">WhatsApp</p>
          </div>
        </div>

        {!isSelf && (
          <div className="flex items-center gap-2 pt-1 border-t border-border">
            <button
              onClick={() => onToggleActive(coach.id, !coach.active)}
              disabled={loading === coach.id}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold rounded-lg transition-colors flex-1 justify-center disabled:opacity-50"
              style={coach.active
                ? { background: 'var(--secondary)', border: '1px solid var(--border)', color: 'var(--muted-foreground)' }
                : { background: '#00d08415', border: '1px solid #00d08445', color: '#00d084' }}>
              {loading === coach.id ? <Loader2 className="w-3 h-3 animate-spin" /> :
                coach.active ? <XCircle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
              {coach.active ? 'Desativar' : 'Reativar'}
            </button>
            <button
              onClick={() => onToggleRole(coach.id, isAdmin ? 'coach' : 'admin')}
              disabled={loading === coach.id}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold rounded-lg transition-colors flex-1 justify-center disabled:opacity-50"
              style={isAdmin
                ? { background: 'var(--secondary)', border: '1px solid var(--border)', color: 'var(--muted-foreground)' }
                : { background: '#e8001c12', border: '1px solid #e8001c45', color: '#e8001c' }}>
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

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteResult, setInviteResult] = useState<{ ok: boolean; msg: string } | null>(null)

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

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteEmail) return
    setInviteLoading(true)
    setInviteResult(null)

    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    const token = session?.access_token ?? ''

    const res = await fetch('/api/invite-coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ email: inviteEmail, full_name: inviteName }),
    })
    const json = await res.json()
    if (res.ok) {
      setInviteResult({ ok: true, msg: `Convite enviado para ${inviteEmail}!` })
      setInviteEmail('')
      setInviteName('')
      load()
    } else {
      setInviteResult({ ok: false, msg: json.error ?? 'Erro ao enviar convite' })
    }
    setInviteLoading(false)
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
            { label: 'Total de atletas', value: totalAthletes, color: 'var(--foreground)' },
            { label: 'Administradores', value: coaches.filter(c => c.role === 'admin').length, color: '#e8001c' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <p className="text-2xl font-black" style={{ color }}>{value}</p>
              <p className="text-[10px] font-semibold text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Invite form */}
        <div className="rounded-xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 mb-4">
            <UserPlus className="w-4 h-4 text-primary" />
            <p className="text-sm font-bold text-foreground">Convidar novo treinador</p>
          </div>
          <form onSubmit={handleInvite} className="flex flex-col md:flex-row gap-3">
            <input
              value={inviteName}
              onChange={e => setInviteName(e.target.value)}
              placeholder="Nome completo"
              className="flex-1 px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
            />
            <input
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              placeholder="e-mail do treinador"
              type="email"
              required
              className="flex-1 px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
            />
            <button type="submit" disabled={inviteLoading || !inviteEmail}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white text-sm font-bold rounded-lg transition-colors flex-shrink-0">
              {inviteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              Enviar convite
            </button>
          </form>
          {inviteResult && (
            <div className="mt-3 flex items-center gap-2 text-[11px] font-semibold px-3 py-2 rounded-lg"
              style={inviteResult.ok
                ? { background: '#00d08415', border: '1px solid #00d08445', color: '#00d084' }
                : { background: '#e8001c12', border: '1px solid #e8001c45', color: '#e8001c' }}>
              {inviteResult.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
              {inviteResult.msg}
            </div>
          )}
          <p className="text-[10px] text-muted-foreground mt-3 leading-relaxed">
            O treinador receberá um e-mail com link para definir a senha e acessar a plataforma. Após o primeiro login, o perfil ficará visível aqui.
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
    </div>
  )
}
