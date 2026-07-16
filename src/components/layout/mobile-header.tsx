'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ThemeToggle } from '@/components/ui/theme-toggle'

// Barra de marca fixa no topo, só no celular (a sidebar cobre o desktop)
export function MobileHeader() {
  return (
    <header className="shrink-0 z-40 md:hidden bg-sidebar border-b border-border safe-top">
      <div className="relative flex items-center justify-center h-12">
        <Link href="/dashboard" aria-label="Ir para o início">
          <Image src="/logo-saab.png" alt="SAAB Sports" width={104} height={27} priority className="h-auto w-[104px] invert dark:invert-0" />
        </Link>
        <span className="absolute right-2"><ThemeToggle /></span>
      </div>
    </header>
  )
}
