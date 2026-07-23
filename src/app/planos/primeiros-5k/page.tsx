'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { Footprints, CalendarDays, HeartPulse, MessageCircle, Trophy, Check } from 'lucide-react'

const RED = '#e8001c'

const INCLUDES = [
  { icon: CalendarDays, t: 'Plano de 12 semanas', d: 'Método corrida/caminhada progressivo, do zero até correr 5 km contínuos.' },
  { icon: HeartPulse, t: 'Anamnese personalizada', d: 'Seu perfil, histórico e objetivos definem a intensidade certa pra você.' },
  { icon: Footprints, t: 'Treinos no seu calendário', d: 'Cada semana no portal, com o que fazer em cada dia — no PC e no celular.' },
  { icon: MessageCircle, t: 'Acompanhamento do treinador', d: 'Ajustes ao longo do caminho conforme sua evolução.' },
]

const STEPS = [
  'Preencha a anamnese (leva 2 minutos)',
  'O treinador monta seu plano dos primeiros 5 km',
  'Você recebe os treinos no portal e começa a correr',
]

export default function Primeiros5kLanding() {
  return (
    <div className="min-h-screen bg-background">
      <div className="absolute top-4 right-4 z-10"><ThemeToggle /></div>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 opacity-90" style={{ background: `radial-gradient(1200px 500px at 50% -10%, ${RED}26, transparent)` }} />
        <div className="relative max-w-3xl mx-auto px-5 pt-16 pb-10 text-center">
          <Image src="/logo-saab.png" alt="SAAB Sports" width={190} height={48} priority className="h-auto w-[190px] max-w-[60vw] mx-auto invert dark:invert-0" />
          <span className="inline-block mt-8 text-[11px] font-black uppercase tracking-widest px-3 py-1 rounded-full" style={{ background: RED + '22', color: RED }}>
            Programa para iniciantes
          </span>
          <h1 className="text-4xl sm:text-5xl font-black text-foreground mt-4 leading-[1.05]">
            Meus primeiros <span style={{ color: RED }}>5 km</span><br />em 3 meses
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground mt-4 max-w-xl mx-auto">
            Sair do sofá e cruzar a linha dos 5 km — com um plano feito pra quem está começando do zero, no seu ritmo e com acompanhamento de verdade.
          </p>
          <Link href="/matricula"
            className="inline-flex items-center gap-2 mt-8 px-8 py-4 rounded-2xl text-base font-black text-white shadow-lg transition-transform hover:scale-[1.02]"
            style={{ background: RED }}>
            <Footprints className="w-5 h-5" /> Quero começar
          </Link>
          <p className="text-xs text-muted-foreground mt-3">Preencha a anamnese e garanta sua vaga.</p>
        </div>
      </section>

      {/* O que está incluso */}
      <section className="max-w-3xl mx-auto px-5 py-10">
        <h2 className="text-2xl font-black text-foreground text-center mb-7">O que você recebe</h2>
        <div className="grid sm:grid-cols-2 gap-3.5">
          {INCLUDES.map(({ icon: Icon, t, d }) => (
            <div key={t} className="rounded-2xl p-5 bg-card border border-border">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: RED + '18' }}>
                <Icon className="w-5 h-5" style={{ color: RED }} />
              </div>
              <h3 className="font-black text-foreground">{t}</h3>
              <p className="text-sm text-muted-foreground mt-1">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Como funciona */}
      <section className="max-w-3xl mx-auto px-5 py-6">
        <h2 className="text-2xl font-black text-foreground text-center mb-7">Como funciona</h2>
        <div className="space-y-3">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-4 rounded-2xl p-4 bg-card border border-border">
              <span className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center font-black text-white" style={{ background: RED }}>{i + 1}</span>
              <p className="text-sm font-semibold text-foreground">{s}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Prova / promessa */}
      <section className="max-w-3xl mx-auto px-5 py-8">
        <div className="rounded-3xl p-7 text-center" style={{ background: `linear-gradient(135deg, ${RED}, #7a0010)` }}>
          <Trophy className="w-9 h-9 text-white/90 mx-auto" />
          <p className="text-xl font-black text-white mt-3">Do primeiro passo à linha de chegada</p>
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-1.5 mt-4 text-white/90 text-sm">
            {['Sem experiência prévia', 'No seu ritmo', 'Plano ajustável', '100% online'].map(x => (
              <span key={x} className="inline-flex items-center gap-1.5"><Check className="w-4 h-4" /> {x}</span>
            ))}
          </div>
          <Link href="/matricula" className="inline-flex items-center gap-2 mt-6 px-7 py-3.5 rounded-2xl text-sm font-black bg-white" style={{ color: RED }}>
            <Footprints className="w-4 h-4" /> Começar minha jornada
          </Link>
        </div>
      </section>

      <footer className="text-center py-8 text-xs text-muted-foreground">
        Já tem conta? <Link href="/login" className="font-bold text-foreground underline">Entrar</Link>
        <span className="mx-2">·</span> SAAB Sports Performance
      </footer>
    </div>
  )
}
