'use client'

import { useEffect, useState } from 'react'
import { Topbar } from '@/components/layout/topbar'
import { useAuth } from '@/context/auth-context'
import { getCoaches, getMyRole, setCoachActive, setCoachRole, updateCoachName, adminResetPassword, getAthletesForAdmin, updateAthleteCoach, type CoachRow, type AthleteLinkRow } from '@/lib/supabase/queries'
import { CreateAccessModal } from '@/components/access/create-access-modal'
import { UserPlus, Shield, ShieldOff, Users, CheckCircle2, XCircle, Loader2, Mail, Phone, Crown, Pencil, KeyRound, RefreshCw, Copy, X, Link2, ChevronDown } from 'lucide-react'
import Link from 'next/link'

function planLabel(p: string) {
  return p === 'elite' ? 'Elite' : p === 'pro' ? 'Pro' : 'Starter'
}

function genTempPassword() {
  const a = 'abcdefghijkmnpqrstuvwxyz', n = '23456789'
  const pick = (s: string, k: number) => Array.from({ length: k }, () => s[Math.floor(Math.random() * s.length)]).join('')
  return pick(a, 1).toUpperCase() + pick(a, 3) + pick(n, 3)
}

function CoachCard({ coach, currentUserId, onToggleActive, onToggleRole, onEdit, loading }: {
  coach: CoachRow
  currentUserId: string
  onToggleActive: (id: string, active: boolean) => void
  onToggleRole: (id: string, role: 'coach' | 'admin') => void
  onEdit: (coach: CoachRow) => void
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
            <button
              onClick={() => onEdit(coach)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold rounded-lg transition-colors flex-1 justify-center"
              style={{ background: 'var(--panel-border)', border: '1px solid var(--border)', color: '#6677aa' }}>
              <Pencil className="w-3 h-3" /> Editar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// Editar treinador/admin: renomear + redefinir senha temporária
function EditCoachModal({ coach, onClose, onSaved }: {
  coach: CoachRow; onClose: () => void; onSaved: () => void
}) {
  const [name, setName] = useState(coach.full_name ?? '')
  const [savingName, setSavingName] = useState(false)
  const [nameSaved, setNameSaved] = useState(false)

  const [pwd, setPwd] = useState(genTempPassword())
  const [resetting, setResetting] = useState(false)
  const [resetDone, setResetDone] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function saveName() {
    setSavingName(true); setError(null)
    const ok = await updateCoachName(coach.id, name.trim())
    setSavingName(false)
    if (ok) { setNameSaved(true); onSaved(); setTimeout(() => setNameSaved(false), 2000) }
    else setError('Não foi possível salvar o nome.')
  }

  async function resetPassword() {
    setResetting(true); setError(null); setResetDone(false)
    const res = await adminResetPassword(coach.id, pwd)
    setResetting(false)
    if (res.ok) setResetDone(true)
    else setError(res.error ?? 'Falha ao redefinir senha')
  }

  function copyCreds() {
    navigator.clipboard?.writeText(`Acesso ao app SAAB\nE-mail: ${coach.email}\nSenha temporária: ${pwd}\n(troque a senha no primeiro acesso)`)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-sm font-bold text-foreground">Editar acesso</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">E-mail (login)</label>
            <input value={coach.email} disabled className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-muted-foreground" />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Nome completo</label>
            <div className="flex gap-2">
              <input value={name} onChange={e => setName(e.target.value)}
                className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary" />
              <button onClick={saveName} disabled={savingName || !name.trim()}
                className="px-4 rounded-lg bg-secondary text-foreground text-xs font-bold disabled:opacity-50 flex items-center gap-1.5">
                {savingName ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : nameSaved ? <CheckCircle2 className="w-3.5 h-3.5 text-[#00d084]" /> : null}
                {nameSaved ? 'Salvo' : 'Salvar'}
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-border">
            <div className="flex items-center gap-1.5 mb-2"><KeyRound className="w-3.5 h-3.5 text-primary" /><p className="text-xs font-bold text-foreground">Redefinir senha</p></div>
            {resetDone ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-[#00d084] text-xs font-bold"><CheckCircle2 className="w-4 h-4" /> Senha redefinida!</div>
                <div className="rounded-xl bg-background border border-border p-3 text-sm space-y-1">
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">E-mail</span><span className="font-semibold text-foreground break-all">{coach.email}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Nova senha</span><span className="font-mono font-bold text-foreground">{pwd}</span></div>
                </div>
                <button onClick={copyCreds} className="w-full py-2 border border-border text-xs font-semibold text-foreground rounded-lg hover:bg-secondary flex items-center justify-center gap-2">
                  {copied ? <><CheckCircle2 className="w-4 h-4 text-[#00d084]" /> Copiado!</> : <><Copy className="w-4 h-4" /> Copiar dados de acesso</>}
                </button>
                <p className="text-[11px] text-muted-foreground">A pessoa vai trocar esta senha no próximo login.</p>
              </div>
            ) : (
              <div>
                <div className="flex gap-2">
                  <input value={pwd} onChange={e => setPwd(e.target.value)} minLength={6}
                    className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary" />
                  <button onClick={() => setPwd(genTempPassword())} title="Gerar nova senha"
                    className="px-3 rounded-lg border border-border text-muted-foreground hover:bg-secondary"><RefreshCw className="w-4 h-4" /></button>
                </div>
                <button onClick={resetPassword} disabled={resetting || pwd.length < 6}
                  className="w-full mt-2 py-2 bg-primary text-white text-xs font-bold rounded-lg disabled:opacity-50 flex items-center justify-center gap-2">
                  {resetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />} Redefinir senha
                </button>
              </div>
            )}
          </div>

          {error && <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>}

          <button onClick={onClose} className="w-full py-2.5 border border-border text-sm font-semibold text-muted-foreground rounded-lg hover:bg-secondary">Fechar</button>
        </div>
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
  const [editing, setEditing] = useState<CoachRow | null>(null)
  const [links, setLinks] = useState<AthleteLinkRow[]>([])
  const [reassigning, setReassigning] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    const [role, coachesList] = await Promise.all([getMyRole(), getCoaches()])
    if (role !== 'admin') { setNotAdmin(true); setLoading(false); return }
    setIsAdmin(true)
    setCoaches(coachesList)
    setLinks(await getAthletesForAdmin())
    setLoading(false)
  }

  async function handleReassign(athleteId: string, coachId: string) {
    setReassigning(athleteId)
    const ok = await updateAthleteCoach(athleteId, coachId)
    if (ok) {
      setLinks(prev => prev.map(l => l.id === athleteId ? { ...l, coach_id: coachId } : l))
      getCoaches().then(setCoaches)   // atualiza contagem de atletas por treinador
    }
    setReassigning(null)
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
                onEdit={setEditing}
                loading={actionLoading}
              />
            ))}
          </div>
        </div>

        {/* Vínculo treinador ⇄ atleta */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Link2 className="w-4 h-4 text-primary" />
            <p className="text-[11px] font-black text-muted-foreground uppercase tracking-wider">
              Vínculo treinador ⇄ atleta ({links.length})
            </p>
          </div>
          {links.length === 0 ? (
            <p className="text-xs text-muted-foreground rounded-xl p-4" style={{ background: 'var(--sidebar)', border: '1px solid var(--panel-border)' }}>
              Nenhum atleta cadastrado ainda.
            </p>
          ) : (
            <div className="rounded-xl overflow-hidden" style={{ background: 'var(--sidebar)', border: '1px solid var(--panel-border)' }}>
              {links.map((l, i) => (
                <div key={l.id} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: i === 0 ? 'none' : '1px solid var(--panel-border)' }}>
                  <Users className="w-3.5 h-3.5 text-[#445566] flex-shrink-0" />
                  <span className="text-sm font-semibold text-foreground flex-1 min-w-0 truncate">
                    {l.full_name}{!l.active && <span className="text-[10px] text-muted-foreground ml-2">(inativo)</span>}
                  </span>
                  <span className="text-[10px] text-muted-foreground hidden sm:inline">Treinador:</span>
                  <div className="relative flex items-center">
                    <select
                      value={l.coach_id}
                      disabled={reassigning === l.id}
                      onChange={e => handleReassign(l.id, e.target.value)}
                      className="text-xs font-semibold text-foreground bg-background border border-border rounded-lg pl-2.5 pr-7 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary disabled:opacity-50 appearance-none">
                      {coaches.map(c => (
                        <option key={c.id} value={c.id}>{c.full_name ?? c.email}{c.role === 'admin' ? ' (admin)' : ''}</option>
                      ))}
                    </select>
                    {reassigning === l.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground absolute right-2 pointer-events-none" />
                      : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground absolute right-2 pointer-events-none" />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {showCreate && (
        <CreateAccessModal variant="staff" canCreateStaff onClose={() => setShowCreate(false)} onSaved={load} />
      )}
      {editing && (
        <EditCoachModal coach={editing} onClose={() => setEditing(null)} onSaved={load} />
      )}
    </div>
  )
}
