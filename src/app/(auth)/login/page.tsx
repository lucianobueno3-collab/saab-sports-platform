'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getMyAthleteId } from '@/lib/supabase/queries'
import { ForcePasswordChange, mustChangePassword } from '@/components/auth/force-password-change'
import Image from 'next/image'

// destino pós-login conforme o papel (atleta → área do atleta)
async function routeAfterLogin() {
  const athleteId = await getMyAthleteId()
  window.location.href = athleteId ? '/atleta' : '/dashboard'
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [needsPassword, setNeedsPassword] = useState(false)

  const sb = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data, error } = await sb.auth.signInWithPassword({ email, password })
    if (error) {
      setError(/invalid login/i.test(error.message) ? 'E-mail ou senha incorretos.' : (error.message || 'Erro ao entrar.'))
      setLoading(false)
      return
    }
    // Primeiro acesso: força a troca da senha temporária antes de seguir
    if (mustChangePassword(data.user)) {
      setNeedsPassword(true)
      setLoading(false)
      return
    }
    await routeAfterLogin()
  }

  if (needsPassword) {
    return <ForcePasswordChange onDone={routeAfterLogin} />
  }

  return (
    <div className="w-full max-w-sm">
      {/* Logo */}
      <div className="flex flex-col items-center gap-2 mb-8">
        <Image src="/logo-saab.png" alt="SAAB Sports" width={210} height={54} priority className="h-auto w-[210px] max-w-[65vw] invert dark:invert-0" />
        <p className="text-xs text-muted-foreground uppercase tracking-widest">Performance Platform</p>
      </div>

      <div className="bg-card border border-border rounded-2xl p-7">
        <h2 className="text-lg font-bold text-foreground mb-1">Entrar</h2>
        <p className="text-xs text-muted-foreground mb-6">Acesse com o e-mail e a senha que você recebeu.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="voce@email.com"
              className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Senha</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-60 text-white font-semibold text-sm rounded-lg transition-colors"
          >
            {loading ? 'Aguarde...' : 'Entrar'}
          </button>
        </form>

        <p className="text-[11px] text-muted-foreground mt-5 text-center">
          Não tem acesso? Peça ao seu treinador ou administrador para criar o seu.
        </p>
      </div>
    </div>
  )
}
