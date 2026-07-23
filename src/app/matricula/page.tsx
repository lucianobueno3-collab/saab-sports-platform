'use client'

import Link from 'next/link'
import Image from 'next/image'
import { AnamneseFlow } from '@/components/enroll/anamnese-flow'
import { ThemeToggle } from '@/components/ui/theme-toggle'

export default function MatriculaPage() {
  return (
    <div className="relative min-h-screen bg-background flex flex-col items-center px-4 py-8">
      <div className="absolute top-4 right-4"><ThemeToggle /></div>

      <Link href="/planos/primeiros-5k" className="flex flex-col items-center gap-1.5 mb-6">
        <Image src="/logo-saab.png" alt="SAAB Sports" width={170} height={44} priority className="h-auto w-[170px] max-w-[55vw] invert dark:invert-0" />
        <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Performance Platform</span>
      </Link>

      <div className="w-full max-w-lg bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-xl">
        <AnamneseFlow packageKey="primeiros_5k" packageTitle="Meus primeiros 5 km" />
      </div>

      <p className="text-xs text-muted-foreground mt-6">
        Já tem conta? <Link href="/login" className="font-bold text-foreground underline">Entrar</Link>
      </p>
    </div>
  )
}
