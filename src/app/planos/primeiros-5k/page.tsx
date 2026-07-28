'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import {
  Footprints, CalendarDays, HeartPulse, MessageCircle, Trophy, Check,
  ShieldCheck, Sparkles, Clock, Smartphone,
} from 'lucide-react'

const RED = '#e8001c'
// espaço fino inquebrável evita "5\nkm" / "3\nmeses" no Safari iOS
const NB = '\u00A0'
const PRICE = { amount: `R$${NB}19,90`, period: '/mês', duration: `3${NB}meses`, total: `R$${NB}59,70 no total` }

const INCLUDES = [
  { icon: CalendarDays, t: 'Plano de 12 semanas', d: 'Método corrida/caminhada progressivo, do zero até correr 5 km contínuos.' },
  { icon: HeartPulse, t: 'Anamnese personalizada', d: 'Seu perfil, histórico e objetivos definem a intensidade certa pra você.' },
  { icon: Footprints, t: 'Treinos no seu calendário', d: 'Cada semana no portal, com o que fazer em cada dia — no PC e no celular.' },
  { icon: MessageCircle, t: 'Acompanhamento do treinador', d: 'Ajustes ao longo do caminho conforme sua evolução.' },
]

const STEPS = [
  { t: 'Preencha a anamnese', d: 'Leva 2 minutos. Conta pra gente seu histórico, rotina e o dia que você prefere treinar.' },
  { t: 'O treinador monta seu plano', d: 'Um programa dos primeiros 5 km desenhado pro seu nível e pra sua semana.' },
  { t: 'Você recebe e começa a correr', d: 'Os treinos aparecem no portal, dia a dia. É só seguir e evoluir.' },
]

const HIGHLIGHTS = [
  { icon: Sparkles, t: 'Do zero', d: 'Sem experiência prévia' },
  { icon: Clock, t: '3 dias/sem', d: 'Você escolhe os dias' },
  { icon: Smartphone, t: '100% online', d: 'No celular e no PC' },
  { icon: ShieldCheck, t: 'Acompanhado', d: 'Treinador de verdade' },
]

const FAQ = [
  { q: 'Nunca corri na vida. Serve pra mim?', a: 'Serve — foi feito exatamente pra quem está começando do zero. O método alterna caminhada e corrida e aumenta aos poucos, respeitando seu ritmo.' },
  { q: 'Quantos dias por semana vou treinar?', a: 'Três treinos por semana, e você escolhe os melhores dias na anamnese. O plano se encaixa na sua rotina, não o contrário.' },
  { q: 'Preciso de esteira ou academia?', a: 'Não. Dá pra fazer na rua, no parque ou na esteira. Um tênis confortável já é o suficiente pra começar.' },
  { q: 'Como recebo os treinos?', a: 'Tudo no portal SAAB, pelo celular ou computador. Cada dia mostra o que fazer, e o treinador ajusta conforme você evolui.' },
  { q: 'E se eu não conseguir acompanhar?', a: 'O plano é ajustável. Se precisar, o treinador adapta as semanas pra você seguir com segurança até os 5 km.' },
]

function Cta({ label, variant = 'solid', className = '' }: { label: string; variant?: 'solid' | 'light'; className?: string }) {
  const solid = variant === 'solid'
  return (
    <Link href="/matricula"
      className={`inline-flex items-center justify-center gap-2 rounded-2xl font-black shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.99] ${className}`}
      style={solid ? { background: RED, color: '#fff' } : { background: '#fff', color: RED }}>
      <Footprints className="w-5 h-5 shrink-0" /> {label}
    </Link>
  )
}

export default function Primeiros5kLanding() {
  return (
    <div className="min-h-screen saab-bg pb-24 sm:pb-0">
      <div className="absolute top-4 right-4 z-20"><ThemeToggle /></div>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="relative max-w-3xl mx-auto px-5 pt-16 pb-10 text-center">
          <Image src="/logo-saab.png" alt="SAAB Sports" width={190} height={48} priority className="h-auto w-[190px] max-w-[60vw] mx-auto invert dark:invert-0" />
          <span className="inline-block mt-8 text-[11px] font-black uppercase tracking-widest px-3 py-1 rounded-full whitespace-nowrap" style={{ background: RED + '22', color: RED }}>
            Programa para iniciantes
          </span>
          <h1 className="text-[2.1rem] leading-[1.06] sm:text-5xl font-black text-foreground mt-4 text-balance [text-wrap:balance]">
            Meus primeiros <span style={{ color: RED }} className="whitespace-nowrap">5{NB}km</span> em 3{NB}meses
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground mt-4 max-w-xl mx-auto text-pretty">
            Sair do sofá e cruzar a linha dos 5 km — com um plano feito pra quem está começando do zero, no seu ritmo e com acompanhamento de verdade.
          </p>

          {/* Selos rápidos */}
          <div className="flex flex-wrap justify-center gap-2 mt-6">
            {HIGHLIGHTS.map(({ icon: Icon, t }) => (
              <span key={t} className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full whitespace-nowrap"
                style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--foreground)' }}>
                <Icon className="w-3.5 h-3.5" style={{ color: RED }} /> {t}
              </span>
            ))}
          </div>

          <div className="mt-7 inline-flex items-baseline flex-wrap justify-center gap-x-1.5 gap-y-0.5 rounded-2xl px-5 py-2.5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <span className="text-3xl font-black text-foreground whitespace-nowrap">{PRICE.amount}</span>
            <span className="text-sm font-bold text-muted-foreground">{PRICE.period}</span>
            <span className="mx-2 text-muted-foreground/40 hidden sm:inline">·</span>
            <span className="text-sm font-bold whitespace-nowrap" style={{ color: RED }}>{PRICE.duration}</span>
          </div>

          <div>
            <Cta label="Quero começar" className="mt-6 px-8 py-4 text-base" />
          </div>
          <p className="text-xs text-muted-foreground mt-3 text-pretty">Preencha a anamnese e garanta sua vaga.</p>
        </div>
      </section>

      {/* O que está incluso */}
      <section className="max-w-4xl mx-auto px-5 py-10">
        <h2 className="text-2xl font-black text-foreground text-center mb-7 text-balance">O que você recebe</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {INCLUDES.map(({ icon: Icon, t, d }) => (
            <div key={t} className="rounded-2xl p-5 bg-card border border-border transition-transform hover:-translate-y-0.5">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: RED + '18' }}>
                <Icon className="w-5 h-5" style={{ color: RED }} />
              </div>
              <h3 className="font-black text-foreground text-pretty">{t}</h3>
              <p className="text-sm text-muted-foreground mt-1 text-pretty">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Como funciona — timeline */}
      <section className="max-w-3xl mx-auto px-5 py-6">
        <h2 className="text-2xl font-black text-foreground text-center mb-7 text-balance">Como funciona</h2>
        <div className="relative space-y-3">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-start gap-4 rounded-2xl p-4 sm:p-5 bg-card border border-border">
              <span className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center font-black text-white" style={{ background: RED }}>{i + 1}</span>
              <div className="min-w-0">
                <p className="font-black text-foreground text-pretty">{s.t}</p>
                <p className="text-sm text-muted-foreground mt-0.5 text-pretty">{s.d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Garantia / risco reverso */}
      <section className="max-w-3xl mx-auto px-5 py-6">
        <div className="flex items-start gap-4 rounded-2xl p-5 bg-card border border-border">
          <span className="w-11 h-11 rounded-xl shrink-0 flex items-center justify-center" style={{ background: RED + '18' }}>
            <ShieldCheck className="w-6 h-6" style={{ color: RED }} />
          </span>
          <div className="min-w-0">
            <p className="font-black text-foreground text-pretty">Feito pra iniciante de verdade</p>
            <p className="text-sm text-muted-foreground mt-0.5 text-pretty">
              Progressão segura, sem pular etapas, com um treinador ajustando o plano conforme você evolui. Sua única meta é chegar aos 5 km — a gente cuida do resto.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-5 py-8">
        <h2 className="text-2xl font-black text-foreground text-center mb-7 text-balance">Perguntas frequentes</h2>
        <div className="space-y-2.5">
          {FAQ.map(({ q, a }) => (
            <details key={q} className="group rounded-2xl bg-card border border-border overflow-hidden">
              <summary className="cursor-pointer list-none flex items-center justify-between gap-3 p-4 font-bold text-foreground text-pretty">
                {q}
                <span className="shrink-0 text-muted-foreground transition-transform group-open:rotate-45 text-xl leading-none">+</span>
              </summary>
              <p className="px-4 pb-4 -mt-1 text-sm text-muted-foreground text-pretty">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Prova / promessa — CTA final */}
      <section className="max-w-3xl mx-auto px-5 py-8">
        <div className="rounded-3xl p-7 sm:p-9 text-center" style={{ background: `linear-gradient(135deg, ${RED}, #7a0010)` }}>
          <Trophy className="w-9 h-9 text-white/90 mx-auto" />
          <p className="text-xl sm:text-2xl font-black text-white mt-3 text-balance">Do primeiro passo à linha de chegada</p>
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-1.5 mt-4 text-white/90 text-sm">
            {['Sem experiência prévia', 'No seu ritmo', 'Plano ajustável', '100% online'].map(x => (
              <span key={x} className="inline-flex items-center gap-1.5 whitespace-nowrap"><Check className="w-4 h-4 shrink-0" /> {x}</span>
            ))}
          </div>
          <div className="mt-5 inline-flex items-baseline flex-wrap justify-center gap-x-1.5 gap-y-0.5">
            <span className="text-3xl font-black text-white whitespace-nowrap">{PRICE.amount}</span>
            <span className="text-sm font-bold text-white/80">{PRICE.period}</span>
            <span className="mx-1 text-white/50 hidden sm:inline">·</span>
            <span className="text-sm font-bold text-white/90 whitespace-nowrap">{PRICE.duration} ({PRICE.total})</span>
          </div>
          <div>
            <Cta label="Começar minha jornada" variant="light" className="mt-5 px-7 py-3.5 text-sm" />
          </div>
        </div>
      </section>

      <footer className="text-center py-8 text-xs text-muted-foreground text-pretty">
        Já tem conta? <Link href="/login" className="font-bold text-foreground underline">Entrar</Link>
        <span className="mx-2">·</span> SAAB Sports Performance
      </footer>

      {/* CTA fixo no mobile */}
      <div className="fixed bottom-0 inset-x-0 z-30 sm:hidden p-3 backdrop-blur-md"
        style={{ background: 'color-mix(in srgb, var(--background) 82%, transparent)', borderTop: '1px solid var(--border)', paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
        <div className="flex items-center gap-3 max-w-md mx-auto">
          <div className="leading-tight">
            <p className="text-sm font-black text-foreground whitespace-nowrap">{PRICE.amount}<span className="text-xs font-bold text-muted-foreground">{PRICE.period}</span></p>
            <p className="text-[11px] font-bold whitespace-nowrap" style={{ color: RED }}>{PRICE.duration}</p>
          </div>
          <Cta label="Quero começar" className="flex-1 px-5 py-3 text-sm" />
        </div>
      </div>
    </div>
  )
}
