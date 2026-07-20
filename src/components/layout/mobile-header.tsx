'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Menu, Settings, Heart, Shield, LogOut, X, Dumbbell } from 'lucide-react'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { createClient } from '@/lib/supabase/client'
import { getMyRole } from '@/lib/supabase/queries'

// Barra de marca fixa no topo, só no celular (a sidebar cobre o desktop).
// O menu dá acesso às páginas que não estão na barra inferior
// (Recuperação, Configurações, Administração) + Sair.
export function MobileHeader() {
  const [open, setOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    getMyRole().then(r => setIsAdmin(r === 'admin')).catch(() => {})
  }, [])

  async function logout() {
    await createClient().auth.signOut()
    window.location.href = '/login'
  }

  const items = [
    { href: '/treinos', label: 'Treinos', icon: Dumbbell },
    { href: '/recovery', label: 'Recuperação', icon: Heart },
    { href: '/settings', label: 'Configurações', icon: Settings },
    ...(isAdmin ? [{ href: '/admin', label: 'Administração', icon: Shield }] : []),
  ]

  return (
    <header className={`shrink-0 md:hidden bg-sidebar border-b border-border safe-top ${open ? 'z-[60]' : 'z-40'}`}>
      <div className="relative flex items-center justify-center h-12">
        <button onClick={() => setOpen(true)} aria-label="Menu" className="absolute left-2 p-2 rounded-lg hover:bg-secondary transition-colors">
          <Menu className="w-5 h-5 text-muted-foreground" />
        </button>
        <Link href="/dashboard" aria-label="Ir para o início">
          <Image src="/logo-saab.png" alt="SAAB Sports" width={104} height={27} priority className="h-auto w-[104px] invert dark:invert-0" />
        </Link>
        <span className="absolute right-2"><ThemeToggle /></span>
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/50" onClick={() => setOpen(false)} />
          <div className="fixed top-0 left-0 bottom-0 z-[61] w-64 max-w-[80vw] bg-sidebar border-r border-border safe-top flex flex-col">
            <div className="flex items-center justify-between px-4 h-12 border-b border-border">
              <Image src="/logo-saab.png" alt="SAAB Sports" width={92} height={24} className="h-auto w-[92px] invert dark:invert-0" />
              <button onClick={() => setOpen(false)} aria-label="Fechar" className="p-2 rounded-lg hover:bg-secondary"><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>
            <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
              {items.map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href} onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-foreground hover:bg-secondary transition-colors">
                  <Icon className="w-4 h-4 text-muted-foreground" /> {label}
                </Link>
              ))}
            </nav>
            <div className="p-2 border-t border-border safe-bottom">
              <button onClick={logout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-primary hover:bg-secondary transition-colors">
                <LogOut className="w-4 h-4" /> Sair da conta
              </button>
            </div>
          </div>
        </>
      )}
    </header>
  )
}
