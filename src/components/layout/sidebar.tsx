'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/auth-context'
import {
  LayoutDashboard, Users, Upload, Settings,
  TrendingUp, Heart, LogOut, BellDot, ShieldCheck
} from 'lucide-react'
import { getAthletesForAlerts, getMyRole } from '@/lib/supabase/queries'
import { trainingReadiness, type DailyMetrics } from '@/lib/readiness'
import { useAutoRefresh } from '@/lib/use-auto-refresh'

const navItems = [
  { href: '/dashboard', label: 'Visão Geral', icon: LayoutDashboard },
  { href: '/athletes', label: 'Alunos', icon: Users },
  { href: '/alerts', label: 'Alertas', icon: BellDot, alertBadge: true },
  { href: '/import', label: 'Importar Dados', icon: Upload },
  { href: '/analytics', label: 'Analytics', icon: TrendingUp },
  { href: '/recovery', label: 'Recuperação', icon: Heart },
  { href: '/settings', label: 'Configurações', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const { user, signOut } = useAuth()
  const [criticalCount, setCriticalCount] = useState(0)
  const [isAdmin, setIsAdmin] = useState(false)

  const initials = user?.user_metadata?.full_name
    ? user.user_metadata.full_name.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() ?? 'CO'
  const displayName = user?.user_metadata?.full_name ?? user?.email?.split('@')[0] ?? 'Coach'

  const refreshCriticalCount = () => {
    getAthletesForAlerts().then(rows => {
      let count = 0
      for (const a of rows) {
        if (!a.latest_date) continue
        const days = Math.floor((Date.now() - new Date(a.latest_date).getTime()) / 86400000)
        if (days > 2) continue
        const m: DailyMetrics = {
          date: a.latest_date, hrv_ms: a.hrv_ms, resting_hr_bpm: a.resting_hr,
          body_battery: a.body_battery, stress_avg: a.stress_avg, sleep_hours: a.sleep_hours,
          rem_pct: a.rem_pct, rem_sleep_hours: null, deep_sleep_hours: null, light_sleep_hours: null, weight_kg: null,
        }
        const r = trainingReadiness(m)
        if (r.level === 'VALVULA' || r.level === 'VERMELHO') count++
      }
      setCriticalCount(count)
    }).catch(() => {})
  }

  useEffect(() => {
    refreshCriticalCount()
    getMyRole().then(role => setIsAdmin(role === 'admin')).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useAutoRefresh(refreshCriticalCount)

  return (
    <aside className="hidden md:flex flex-col w-64 shrink-0 overflow-y-auto bg-sidebar border-r border-border">
      {/* Logo */}
      <div className="flex flex-col gap-1.5 px-5 py-5 border-b border-border">
        <Image src="/logo-saab.png" alt="SAAB Sports" width={150} height={39} priority className="h-auto w-[150px] max-w-full invert dark:invert-0" />
        <p className="text-xs text-muted-foreground">Performance Platform</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-primary/15 text-primary border border-primary/25'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.alertBadge && criticalCount > 0 && (
                <span className="flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-[#e8001c] text-white text-[9px] font-black px-1">
                  {criticalCount}
                </span>
              )}
            </Link>
          )
        })}

        {/* Admin-only link */}
        {isAdmin && (
          <>
            <div className="pt-2 pb-1 px-3">
              <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Administração</p>
            </div>
            <Link
              href="/admin"
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                pathname === '/admin'
                  ? 'bg-primary/15 text-primary border border-primary/25'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              )}
            >
              <ShieldCheck className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">Treinadores</span>
            </Link>
          </>
        )}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-border">
        <button onClick={signOut} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-secondary cursor-pointer transition-colors text-left">
          <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email ?? ''}</p>
          </div>
          <LogOut className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        </button>
      </div>
    </aside>
  )
}
