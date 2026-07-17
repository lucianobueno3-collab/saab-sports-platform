'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getMyAthleteId, claimAthleteProfile } from '@/lib/supabase/queries'
import Image from 'next/image'

// destino pós-login conforme o papel (atleta → área do atleta)
async function routeAfterLogin() {
  const athleteId = await getMyAthleteId()
  window.location.href = athleteId ? '/atleta' : '/dashboard'
}

type Mode = 'login' | 'register' | 'athlete'

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const sb = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    if (mode === 'login') {
      const { error } = await sb.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message || error.name || 'Erro desconhecido')
        setLoading(false)
      } else {
        await routeAfterLogin()
      }
      return
    }

    if (mode === 'athlete') {
      // cria a conta do atleta e vincula pelo código de acesso
      const codeClean = code.trim()
      const { error: signErr } = await sb.auth.signUp({ email, password, options: { data: { full_name: name } } })
      if (signErr && !signErr.message?.includes('already')) {
        setError(signErr.message || 'Erro ao criar conta.')
        setLoading(false)
        return
      }
      // garante sessão (se signup não logou automaticamente, faz login)
      let { data: sess } = await sb.auth.getSession()
      if (!sess.session) {
        const { error: loginErr } = await sb.auth.signInWithPassword({ email, password })
        if (loginErr) { setError('Conta criada. Agora clique em "Já tenho conta" e entre.'); setMode('login'); setLoading(false); return }
        sess = (await sb.auth.getSession()).data
      }
      const res = await claimAthleteProfile(codeClean)
      if (!res.ok) {
        const msg = res.error === 'codigo_invalido' ? 'Código de acesso inválido. Confira com seu treinador.'
          : res.error === 'ja_vinculado' ? 'Este código já está vinculado a outra conta.'
          : 'Não foi possível vincular. Confira o código.'
        setError(msg); setLoading(false); return
      }
      window.location.href = '/atleta'
      return
    }

    // register (treinador)
    const { error } = await sb.auth.signUp({ email, password, options: { data: { full_name: name } } })
    if (error) {
      if (error.message?.includes('already registered') || error.message?.includes('already exists') || error.message?.includes('User already')) {
        setError('Este email já está cadastrado. Clique em "Fazer login".')
      } else {
        setError(error.message || 'Erro ao criar conta. Tente novamente.')
      }
    } else {
      setMessage('Conta criada com sucesso! Faça login abaixo.')
      setMode('login')
    }
    setLoading(false)
  }

  return (
    <div className="w-full max-w-sm">
      {/* Logo */}
      <div className="flex flex-col items-center gap-2 mb-8">
        <Image src="/logo-saab.png" alt="SAAB Sports" width={210} height={54} priority className="h-auto w-[210px] max-w-[65vw] invert dark:invert-0" />
        <p className="text-xs text-muted-foreground uppercase tracking-widest">Performance Platform</p>
      </div>

      <div className="bg-card border border-border rounded-2xl p-7">
        <h2 className="text-lg font-bold text-foreground mb-1">
          {mode === 'login' ? 'Entrar' : mode === 'athlete' ? 'Sou atleta' : 'Criar conta'}
        </h2>
        <p className="text-xs text-muted-foreground mb-6">
          {mode === 'login' ? 'Acesse sua plataforma de treinamento'
            : mode === 'athlete' ? 'Crie seu acesso com o código que seu treinador enviou'
            : 'Crie sua conta de treinador'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {(mode === 'register' || mode === 'athlete') && (
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Nome completo</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                placeholder={mode === 'athlete' ? 'Seu nome' : 'Luciano Bueno'}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
              />
            </div>
          )}

          {mode === 'athlete' && (
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Código de acesso</label>
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value)}
                required
                placeholder="cole o código que o treinador enviou"
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors font-mono"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="treinador@saabsports.com.br"
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
              minLength={6}
              placeholder="••••••••"
              className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>
          )}
          {message && (
            <p className="text-xs text-[#00d084] bg-[#00d084]/10 border border-[#00d084]/20 rounded-lg px-3 py-2">{message}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-60 text-white font-semibold text-sm rounded-lg transition-colors"
          >
            {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : mode === 'athlete' ? 'Criar meu acesso' : 'Criar conta'}
          </button>
        </form>

        <div className="mt-5 space-y-2 text-center">
          <p className="text-xs text-muted-foreground">
            {mode === 'login' ? 'É treinador e ainda não tem conta?' : 'Já tem conta?'}{' '}
            <button
              onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); setMessage(null) }}
              className="text-primary hover:underline font-medium"
            >
              {mode === 'login' ? 'Criar conta de treinador' : 'Fazer login'}
            </button>
          </p>
          {mode !== 'athlete' && (
            <p className="text-xs text-muted-foreground">
              É atleta?{' '}
              <button onClick={() => { setMode('athlete'); setError(null); setMessage(null) }} className="text-primary hover:underline font-medium">
                Criar acesso com código
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
