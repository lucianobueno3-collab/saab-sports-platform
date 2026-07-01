'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { LayoutDashboard, Users, Upload, TrendingUp, BellDot } from 'lucide-react'
import { getAthletesForAlerts } from '@/lib/supabase/queries'
import { trainingReadiness, type DailyMetrics } from '@/lib/readiness'

const navItems = [
  { href: '/dashboard', label: 'Início', icon: LayoutDashboard },
  { href: '/athletes', label: 'Alunos', icon: Users },
  { href: '/alerts', label: 'Alertas', icon: BellDot, alertBadge: true },
  { href: '/import', label: 'Importar', icon: Upload },
  { href: '/analytics', label: 'Analytics', icon: TrendingUp },
]

export function BottomNav() {
  const pathname = usePathname()
  const [criticalCount, setCriticalCount] = useState(0)

  useEffect(() => {
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
  }, [])

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-[#0d0d14] border-t border-border safe-bottom">
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map(item => {
          const Icon = item.icon
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-colors min-w-[52px]',
                active ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <div className={cn('p-1.5 rounded-lg transition-colors relative', active && 'bg-primary/15')}>
                <Icon className="w-5 h-5" />
                {item.alertBadge && criticalCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] rounded-full bg-[#e8001c] text-white text-[8px] font-black flex items-center justify-center px-0.5">
                    {criticalCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
