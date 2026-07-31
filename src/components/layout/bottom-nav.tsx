'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Users, ClipboardList, Dumbbell, BellDot, Upload, TrendingUp,
  Heart, Settings, Shield, MoreHorizontal, X, Users2,
} from 'lucide-react'
import { getAthletesForAlerts, getEnrollments, getMyAccess } from '@/lib/supabase/queries'
import { trainingReadiness, type DailyMetrics } from '@/lib/readiness'
import { useAutoRefresh } from '@/lib/use-auto-refresh'

type Item = { href: string; label: string; icon: typeof LayoutDashboard; alertBadge?: boolean; enrollBadge?: boolean; adminOnly?: boolean }

const primary: Item[] = [
  { href: '/dashboard', label: 'Início', icon: LayoutDashboard },
  { href: '/athletes', label: 'Alunos', icon: Users },
  { href: '/matriculas', label: 'Matrículas', icon: ClipboardList, enrollBadge: true },
  { href: '/treinos', label: 'Treinos', icon: Dumbbell },
]
const moreItems: Item[] = [
  { href: '/encontros', label: 'Treinar junto', icon: Users2 },
  { href: '/alerts', label: 'Alertas', icon: BellDot, alertBadge: true },
  { href: '/import', label: 'Importar Dados', icon: Upload },
  { href: '/analytics', label: 'Analytics', icon: TrendingUp },
  { href: '/recovery', label: 'Recuperação', icon: Heart },
  { href: '/settings', label: 'Configurações', icon: Settings },
  { href: '/admin', label: 'Admin', icon: Shield, adminOnly: true },
]

export function BottomNav() {
  const pathname = usePathname()
  const [criticalCount, setCriticalCount] = useState(0)
  const [pendingEnrolls, setPendingEnrolls] = useState(0)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isDoctor, setIsDoctor] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)

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
    getMyAccess().then(({ role }) => { setIsAdmin(role === 'admin'); setIsDoctor(role === 'doctor') }).catch(() => {})
    getEnrollments('pending').then(rows => setPendingEnrolls(rows.length)).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useAutoRefresh(refreshCriticalCount)

  // Médico: navegação clínica (sem matrículas, treinos, importação, config, admin).
  const DOCTOR_HREFS = ['/dashboard', '/athletes', '/alerts', '/recovery']
  const visiblePrimary = isDoctor ? primary.filter(i => DOCTOR_HREFS.includes(i.href)) : primary
  const visibleMore = isDoctor
    ? moreItems.filter(i => DOCTOR_HREFS.includes(i.href))
    : moreItems.filter(i => !i.adminOnly || isAdmin)
  const moreActive = visibleMore.some(i => pathname === i.href || pathname.startsWith(i.href + '/'))
  const badge = (item: Item) => item.alertBadge ? criticalCount : item.enrollBadge ? pendingEnrolls : 0

  const cell = (item: Item, onClick?: () => void) => {
    const Icon = item.icon
    const active = pathname === item.href || pathname.startsWith(item.href + '/')
    const n = badge(item)
    return (
      <Link key={item.href} href={item.href} onClick={onClick}
        className={cn('flex flex-col items-center gap-0.5 px-2 py-2 rounded-xl transition-colors min-w-[52px]', active ? 'text-primary' : 'text-muted-foreground')}>
        <div className={cn('p-1.5 rounded-lg transition-colors relative', active && 'bg-primary/15')}>
          <Icon className="w-5 h-5" />
          {n > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] rounded-full bg-[#e8001c] text-white text-[8px] font-black flex items-center justify-center px-0.5">{n}</span>
          )}
        </div>
        <span className="text-[10px] font-medium">{item.label}</span>
      </Link>
    )
  }

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-sidebar border-t border-border safe-bottom">
        <div className="flex items-center justify-around px-1 py-2">
          {visiblePrimary.map(item => cell(item))}
          {/* Mais */}
          <button onClick={() => setMoreOpen(true)}
            className={cn('flex flex-col items-center gap-0.5 px-2 py-2 rounded-xl transition-colors min-w-[52px]', moreActive ? 'text-primary' : 'text-muted-foreground')}>
            <div className={cn('p-1.5 rounded-lg transition-colors relative', moreActive && 'bg-primary/15')}>
              <MoreHorizontal className="w-5 h-5" />
              {criticalCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] rounded-full bg-[#e8001c] text-white text-[8px] font-black flex items-center justify-center px-0.5">{criticalCount}</span>
              )}
            </div>
            <span className="text-[10px] font-medium">Mais</span>
          </button>
        </div>
      </nav>

      {moreOpen && createPortal(
        <div className="fixed inset-0 z-[60] md:hidden flex items-end bg-black/50 backdrop-blur-sm" onClick={() => setMoreOpen(false)}>
          <div className="w-full bg-card border-t border-border rounded-t-2xl p-4 safe-bottom" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-black text-foreground">Mais</p>
              <button onClick={() => setMoreOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {visibleMore.map(item => {
                const Icon = item.icon
                const active = pathname === item.href || pathname.startsWith(item.href + '/')
                const n = badge(item)
                return (
                  <Link key={item.href} href={item.href} onClick={() => setMoreOpen(false)}
                    className={cn('flex flex-col items-center justify-center gap-1.5 rounded-xl py-4 text-center transition-colors', active ? 'bg-primary/15 text-primary' : 'bg-background text-foreground hover:bg-secondary')}
                    style={{ border: '1px solid var(--border)' }}>
                    <div className="relative">
                      <Icon className="w-5 h-5" />
                      {n > 0 && <span className="absolute -top-1.5 -right-2 min-w-[15px] h-[15px] rounded-full bg-[#e8001c] text-white text-[8px] font-black flex items-center justify-center px-0.5">{n}</span>}
                    </div>
                    <span className="text-[11px] font-semibold">{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
