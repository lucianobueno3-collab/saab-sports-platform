'use client'

import { useState, useEffect } from 'react'
import { Topbar } from '@/components/layout/topbar'
import { Settings, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/context/auth-context'

export default function SettingsPage() {
  const { user, signOut } = useAuth()
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!user) return
    const sb = createClient()
    sb.from('profiles').select('full_name').eq('id', user.id).single().then(({ data }) => {
      if (data) setFullName(data.full_name ?? '')
    })
  }, [user])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setLoading(true)
    const sb = createClient()
    await sb.from('profiles').update({ full_name: fullName }).eq('id', user.id)
    setLoading(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div>
      <Topbar title="Configurações" subtitle="Perfil e preferências da conta" />
      <div className="p-6 max-w-lg">
        <div className="bg-card border border-border rounded-xl p-6 space-y-5">
          <div className="flex items-center gap-3 pb-4 border-b border-border">
            <div className="w-10 h-10 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-center">
              <Settings className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">Perfil do Treinador</h2>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Nome completo</label>
              <input
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Seu nome"
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Email</label>
              <input
                value={user?.email ?? ''}
                disabled
                className="w-full px-3 py-2.5 bg-secondary/50 border border-border rounded-lg text-sm text-muted-foreground cursor-not-allowed"
              />
            </div>
            <div className="flex gap-3 pt-1">
              <button type="submit" disabled={loading}
                className="flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {saved ? 'Salvo!' : 'Salvar'}
              </button>
              <button type="button" onClick={signOut}
                className="px-4 py-2.5 border border-border text-sm font-semibold text-muted-foreground rounded-lg hover:bg-secondary transition-colors">
                Sair da conta
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
