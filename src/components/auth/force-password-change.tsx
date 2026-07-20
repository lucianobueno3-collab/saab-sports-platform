'use client'

import { useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { KeyRound, Loader2, CheckCircle2 } from 'lucide-react'

/**
 * Tela de troca de senha obrigatória no primeiro acesso.
 * Aparece quando user_metadata.must_change_password === true.
 */
export function ForcePasswordChange({ onDone }: { onDone?: () => void }) {
  const sb = createClient()
  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (p1.length < 6) { setError('A nova senha deve ter ao menos 6 caracteres.'); return }
    if (p1 !== p2) { setError('As senhas não coincidem.'); return }
    setLoading(true)
    const { error } = await sb.auth.updateUser({ password: p1, data: { must_change_password: false } })
    setLoading(false)
    if (error) {
      setError(/different from the old|should be different/i.test(error.message)
        ? 'A nova senha precisa ser diferente da temporária.'
        : error.message)
      return
    }
    if (onDone) onDone()
    else window.location.reload()
  }

  async function logout() {
    await sb.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-2 mb-8">
          <Image src="/logo-saab.png" alt="SAAB Sports" width={180} height={46} priority className="h-auto w-[180px] max-w-[55vw] invert dark:invert-0" />
        </div>
        <div className="bg-card border border-border rounded-2xl p-7">
          <div className="flex items-center gap-2 mb-1">
            <KeyRound className="w-4 h-4 text-primary" />
            <h2 className="text-lg font-bold text-foreground">Defina sua senha</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-6">Este é seu primeiro acesso. Crie uma senha pessoal para continuar.</p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Nova senha</label>
              <input type="password" value={p1} onChange={e => setP1(e.target.value)} required minLength={6} placeholder="••••••••"
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors" />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Confirme a nova senha</label>
              <input type="password" value={p2} onChange={e => setP2(e.target.value)} required minLength={6} placeholder="••••••••"
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors" />
            </div>

            {error && <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>}

            <button type="submit" disabled={loading}
              className="w-full py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-60 text-white font-semibold text-sm rounded-lg transition-colors flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {loading ? 'Salvando...' : 'Salvar e entrar'}
            </button>
          </form>

          <button onClick={logout} className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground">Sair</button>
        </div>
      </div>
    </div>
  )
}

/** true se a conta logada ainda precisa trocar a senha temporária. */
export function mustChangePassword(user: { user_metadata?: Record<string, unknown> } | null): boolean {
  return !!user?.user_metadata?.must_change_password
}
