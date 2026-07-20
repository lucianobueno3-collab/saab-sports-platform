'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useAuth } from '@/context/auth-context'
import { getMyAthleteId } from '@/lib/supabase/queries'
import { ForcePasswordChange, mustChangePassword } from '@/components/auth/force-password-change'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const [checkingRole, setCheckingRole] = useState(true)

  useEffect(() => {
    if (loading) return
    if (!user) { window.location.href = '/login'; return }
    if (mustChangePassword(user)) { setCheckingRole(false); return }
    // atleta não acessa o painel do treinador — redireciona para a área dele
    getMyAthleteId().then(athleteId => {
      if (athleteId) window.location.href = '/atleta'
      else setCheckingRole(false)
    }).catch(() => setCheckingRole(false))
  }, [user, loading])

  if (loading || (user && checkingRole)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-6">
          <Image
            src="/logo-saab.png"
            alt="SAAB Sports"
            width={220}
            height={57}
            priority
            className="h-auto w-[220px] max-w-[60vw] animate-logo-breathe invert dark:invert-0"
          />
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (!user) return null

  // primeiro acesso: troca de senha obrigatória antes de usar o painel
  if (mustChangePassword(user)) return <ForcePasswordChange />

  return <>{children}</>
}
