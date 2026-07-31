'use client'

import Image from 'next/image'
import Link from 'next/link'
import { InstallPageBody } from '@/components/pwa/install-app'
import { ThemeToggle } from '@/components/ui/theme-toggle'

/**
 * Página que o treinador manda para o aluno no WhatsApp.
 * O passo a passo se adapta sozinho ao aparelho de quem abrir.
 */
export function InstalarView() {
  return (
    <div className="relative min-h-screen saab-bg flex flex-col items-center px-4 py-8">
      <div className="absolute top-4 right-4"><ThemeToggle /></div>

      <Link href="/atleta" className="flex flex-col items-center gap-1.5 mb-6">
        <Image src="/logo-saab.png" alt="SAAB Sports" width={170} height={44} priority className="h-auto w-[170px] max-w-[55vw] invert dark:invert-0" />
        <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Performance Platform</span>
      </Link>

      <div className="w-full max-w-md">
        <h1 className="text-2xl font-black text-foreground text-center text-balance [text-wrap:balance]">
          Deixe a SAAB na tela do seu celular
        </h1>
        <p className="text-sm text-muted-foreground text-center mt-2 mb-6 leading-relaxed">
          Em poucos toques o app fica junto dos seus outros aplicativos — você abre direto,
          sem precisar procurar o link toda vez.
        </p>

        <InstallPageBody />

        <p className="text-[11px] text-muted-foreground text-center mt-6 leading-relaxed">
          Não passa pela loja de aplicativos e quase não ocupa espaço. Para tirar, é só apagar
          o ícone como faria com qualquer app.
        </p>
        <p className="text-[11px] text-muted-foreground text-center mt-2 leading-relaxed">
          Na primeira vez que abrir pelo ícone, o app pode pedir seu login de novo. É normal e
          acontece só uma vez.
        </p>
      </div>
    </div>
  )
}
