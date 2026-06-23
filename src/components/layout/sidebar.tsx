'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Users, Upload, Settings,
  Activity, TrendingUp, Heart, LogOut
} from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Visão Geral', icon: LayoutDashboard },
  { href: '/athletes', label: 'Alunos', icon: Users },
  { href: '/import', label: 'Importar Dados', icon: Upload },
  { href: '/analytics', label: 'Analytics', icon: TrendingUp },
  { href: '/recovery', label: 'Recuperação', icon: Heart },
  { href: '/settings', label: 'Configurações', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex flex-col w-64 min-h-screen bg-[#0d0d14] border-r border-border">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary text-white font-black text-sm tracking-tight">
          SS
        </div>
        <div>
          <p className="text-sm font-bold text-foreground tracking-wide uppercase">Saab Sports</p>
          <p className="text-xs text-muted-foreground">Performance Platform</p>
        </div>
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
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-border">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-secondary cursor-pointer transition-colors">
          <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary">
            CN
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">Coach</p>
            <p className="text-xs text-muted-foreground truncate">saabsports.com.br</p>
          </div>
          <LogOut className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>
    </aside>
  )
}
