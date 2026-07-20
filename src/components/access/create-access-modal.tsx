'use client'

import { useEffect, useMemo, useState } from 'react'
import { X, Loader2, CheckCircle2, RefreshCw, Copy } from 'lucide-react'
import { adminCreateUser, getAthletesWithoutAccess, type AdminCreateUserInput } from '@/lib/supabase/queries'

type Variant = 'staff' | 'athlete'   // staff = treinador/admin (só admin); athlete = atleta (admin+treinador)

// Gera uma senha temporária legível (fácil de ditar por telefone)
function genPassword() {
  const a = 'abcdefghijkmnpqrstuvwxyz', n = '23456789'
  const pick = (s: string, k: number) => Array.from({ length: k }, () => s[Math.floor(Math.random() * s.length)]).join('')
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  return `${cap(pick(a, 4))}${pick(n, 3)}`
}

export function CreateAccessModal({ variant, canCreateStaff, onClose, onSaved }: {
  variant: Variant
  canCreateStaff: boolean          // true só para admin (habilita papel treinador/admin)
  onClose: () => void
  onSaved: () => void
}) {
  const [role, setRole] = useState<'athlete' | 'coach' | 'admin'>(variant === 'staff' ? 'coach' : 'athlete')
  // atleta: 'new' cria do zero, 'existing' vincula a um já cadastrado
  const [athleteMode, setAthleteMode] = useState<'new' | 'existing'>('existing')
  const [existing, setExisting] = useState<{ id: string; full_name: string; email: string | null }[]>([])
  const [athleteId, setAthleteId] = useState('')

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState(genPassword())
  const [sport, setSport] = useState('running')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ email: string; password: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const isAthlete = role === 'athlete'

  useEffect(() => {
    if (isAthlete) getAthletesWithoutAccess().then(list => {
      setExisting(list)
      if (list.length === 0) setAthleteMode('new')
    })
  }, [isAthlete])

  // Prefill do e-mail ao escolher um atleta existente
  const selected = useMemo(() => existing.find(a => a.id === athleteId), [existing, athleteId])
  useEffect(() => { if (selected?.email) setEmail(selected.email) }, [selected])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const input: AdminCreateUserInput = { role, email: email.trim(), password, full_name: fullName.trim() }
    if (isAthlete && athleteMode === 'existing') {
      if (!athleteId) { setError('Escolha um atleta.'); setLoading(false); return }
      input.athlete_id = athleteId
      input.full_name = selected?.full_name ?? ''
    } else if (isAthlete) {
      input.athlete = { primary_sport: sport }
    }

    const res = await adminCreateUser(input)
    setLoading(false)
    if (!res.ok) { setError(res.error ?? 'Falha ao criar cadastro'); return }
    setDone({ email: email.trim(), password })
    onSaved()
  }

  function copyCreds() {
    if (!done) return
    navigator.clipboard?.writeText(`Acesso ao app SAAB\nE-mail: ${done.email}\nSenha temporária: ${done.password}\n(troque a senha no primeiro acesso)`)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const title = variant === 'staff' ? 'Novo cadastro de acesso' : 'Gerar acesso de atleta'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card">
          <h2 className="text-sm font-bold text-foreground">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors"><X className="w-4 h-4" /></button>
        </div>

        {done ? (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-2 text-[#00d084]"><CheckCircle2 className="w-5 h-5" /><p className="text-sm font-bold">Acesso criado!</p></div>
            <p className="text-xs text-muted-foreground">Envie estes dados para a pessoa. Ela vai <b>trocar a senha</b> no primeiro login.</p>
            <div className="rounded-xl bg-background border border-border p-4 space-y-1.5 text-sm">
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">E-mail</span><span className="font-semibold text-foreground break-all">{done.email}</span></div>
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">Senha temporária</span><span className="font-mono font-bold text-foreground">{done.password}</span></div>
            </div>
            <button onClick={copyCreds} className="w-full py-2.5 border border-border text-sm font-semibold text-foreground rounded-lg hover:bg-secondary transition-colors flex items-center justify-center gap-2">
              {copied ? <><CheckCircle2 className="w-4 h-4 text-[#00d084]" /> Copiado!</> : <><Copy className="w-4 h-4" /> Copiar dados de acesso</>}
            </button>
            <button onClick={onClose} className="w-full py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors">Concluir</button>
          </div>
        ) : (
          <form onSubmit={submit} className="p-6 space-y-4">
            {/* Papel — só admin escolhe treinador/admin */}
            {variant === 'staff' && canCreateStaff && (
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">Tipo de acesso</label>
                <div className="flex gap-1 p-1 rounded-xl bg-background border border-border">
                  {([['coach', 'Treinador'], ['admin', 'Admin'], ['athlete', 'Atleta']] as const).map(([r, label]) => (
                    <button type="button" key={r} onClick={() => setRole(r)}
                      className="flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors"
                      style={role === r ? { background: '#e8001c', color: '#fff' } : { color: 'var(--muted-foreground)' }}>{label}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Atleta: novo x existente */}
            {isAthlete && (
              <div>
                <div className="flex gap-1 p-1 rounded-xl bg-background border border-border mb-3">
                  <button type="button" onClick={() => setAthleteMode('existing')} disabled={existing.length === 0}
                    className="flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors disabled:opacity-40"
                    style={athleteMode === 'existing' ? { background: '#e8001c', color: '#fff' } : { color: 'var(--muted-foreground)' }}>Atleta existente</button>
                  <button type="button" onClick={() => setAthleteMode('new')}
                    className="flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors"
                    style={athleteMode === 'new' ? { background: '#e8001c', color: '#fff' } : { color: 'var(--muted-foreground)' }}>Atleta novo</button>
                </div>

                {athleteMode === 'existing' ? (
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">Atleta *</label>
                    <select required value={athleteId} onChange={e => setAthleteId(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary">
                      <option value="">Selecione…</option>
                      {existing.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
                    </select>
                    {existing.length === 0 && <p className="text-[11px] text-muted-foreground mt-1">Todos os seus atletas já têm acesso.</p>}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-foreground mb-1.5">Nome completo *</label>
                      <input required value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Nome do atleta"
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-foreground mb-1.5">Modalidade *</label>
                      <select required value={sport} onChange={e => setSport(e.target.value)}
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary">
                        <option value="running">Corrida</option><option value="cycling">Ciclismo</option>
                        <option value="triathlon">Triathlon</option><option value="swimming">Natação</option>
                        <option value="duathlon">Duathlon</option><option value="other">Outro</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Nome (treinador/admin) */}
            {!isAthlete && (
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">Nome completo *</label>
                <input required value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Nome"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary" />
              </div>
            )}

            {/* E-mail */}
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">E-mail (login) *</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="pessoa@email.com"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary" />
            </div>

            {/* Senha temporária */}
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Senha temporária *</label>
              <div className="flex gap-2">
                <input required minLength={6} value={password} onChange={e => setPassword(e.target.value)}
                  className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary" />
                <button type="button" onClick={() => setPassword(genPassword())} title="Gerar nova senha"
                  className="px-3 rounded-lg border border-border text-muted-foreground hover:bg-secondary transition-colors"><RefreshCw className="w-4 h-4" /></button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">A pessoa troca esta senha no primeiro acesso.</p>
            </div>

            {error && <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-border text-sm font-semibold text-muted-foreground rounded-lg hover:bg-secondary transition-colors">Cancelar</button>
              <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}{loading ? 'Criando...' : 'Criar acesso'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
