'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { publicEnroll, type PublicEnrollInput } from '@/lib/supabase/queries'
import { ChevronLeft, ChevronRight, Check, Loader2, Footprints } from 'lucide-react'

// ─── Funil "Meus primeiros 5 km": cadastro + anamnese (FÓRMULA RIO INICIAL) ──
// Formulário em etapas, com ramificação por "está correndo atualmente?".

type Data = {
  full_name: string; email: string; phone: string; password: string
  age: string; height_cm: string; weight_kg: string
  currently_running: boolean | null
  running_level: string | null
  activity_level: string | null
  days_running: string | null
  weekly_distance: string | null
  goal: string | null
  preferred_days: number[]
  website: string // honeypot
}

const EMPTY: Data = {
  full_name: '', email: '', phone: '', password: '',
  age: '', height_cm: '', weight_kg: '',
  currently_running: null, running_level: null, activity_level: null,
  days_running: null, weekly_distance: null, goal: null, preferred_days: [], website: '',
}

const RUN_LEVELS = [
  { v: 'iniciante', t: 'Iniciante', d: 'Já corri algumas vezes, mas nunca consegui ser constante e atingir meus objetivos.' },
  { v: 'intermediario', t: 'Intermediário', d: 'Tenho uma leve experiência, me sinto confortável correndo, mas quero evoluir meus tempos e distâncias.' },
  { v: 'avancado', t: 'Avançado', d: 'Tenho boa experiência, já me conheço bem e sei administrar meu ritmo em treinos e provas.' },
  { v: 'competitivo', t: 'Competitivo', d: 'Já participei de diversas provas e agora quero estar entre os primeiros da minha categoria.' },
]
const ACT_LEVELS = [
  { v: 'iniciante', t: 'Iniciante', d: 'Tenho pouca experiência com atividades físicas, nunca consegui manter uma rotina.' },
  { v: 'intermediario', t: 'Intermediário', d: 'Pratico atividades físicas, mas com pouca frequência.' },
  { v: 'avancado', t: 'Avançado', d: 'Pratico regularmente e tenho facilidade para começar novas atividades.' },
]
const DAYS_RUNNING = [
  { v: '1_2', t: '1 ou 2' }, { v: '3', t: '3' }, { v: '4', t: '4' }, { v: '5_mais', t: '5 ou mais' },
]
const WEEKLY_DIST = [
  { v: 'ate_15', t: '15 km ou menos' }, { v: '15_30', t: 'De 15 a 30 km' },
  { v: '30_40', t: 'De 30 a 40 km' }, { v: '40_mais', t: '40 km ou mais' },
]
const GOALS = [
  { v: 'concluir_5_10k', t: 'Desenvolver minha capacidade e concluir de 5 a 10 km' },
  { v: 'meia_21k', t: 'Progredir até uma meia maratona (21 km)' },
  { v: 'maratona_42k', t: 'Correr uma maratona (42 km)' },
  { v: 'melhorar_ritmo', t: 'Melhorar meu ritmo nas distâncias que já corro' },
]
const WEEKDAYS = [
  { v: 0, t: 'Segunda' }, { v: 1, t: 'Terça' }, { v: 2, t: 'Quarta' }, { v: 3, t: 'Quinta' },
  { v: 4, t: 'Sexta' }, { v: 5, t: 'Sábado' }, { v: 6, t: 'Domingo' },
]

const RED = '#e8001c'

export function AnamneseFlow({ packageKey = 'primeiros_5k', packageTitle = 'Meus primeiros 5 km' }: { packageKey?: string; packageTitle?: string }) {
  const [d, setD] = useState<Data>(EMPTY)
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const set = (patch: Partial<Data>) => setD(prev => ({ ...prev, ...patch }))

  // Sequência de telas — ramifica conforme "está correndo atualmente?".
  const screens = useMemo(() => {
    const s: string[] = ['contato', 'running_now']
    if (d.currently_running === true) s.push('running_level', 'days_running', 'weekly_distance')
    else if (d.currently_running === false) s.push('activity_level')
    s.push('goal', 'preferred_days', 'review')
    return s
  }, [d.currently_running])

  const key = screens[Math.min(step, screens.length - 1)]
  const progress = Math.round(((step + 1) / screens.length) * 100)

  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email.trim())
  const contatoOk = d.full_name.trim().length > 1 && emailOk && d.password.length >= 6

  function canAdvance(): boolean {
    switch (key) {
      case 'contato': return contatoOk
      case 'running_now': return d.currently_running !== null
      case 'running_level': return !!d.running_level
      case 'activity_level': return !!d.activity_level
      case 'days_running': return !!d.days_running
      case 'weekly_distance': return !!d.weekly_distance
      case 'goal': return !!d.goal
      case 'preferred_days': return d.preferred_days.length > 0
      default: return true
    }
  }

  function next() { setError(null); if (step < screens.length - 1) setStep(step + 1) }
  function back() { setError(null); if (step > 0) setStep(step - 1) }

  // Escolha única que já avança automaticamente (sensação de fluxo/typeform).
  function choose(patch: Partial<Data>) {
    set(patch)
    setError(null)
    setTimeout(() => setStep(s => Math.min(s + 1, screens.length - 1)), 180)
  }

  async function submit() {
    setSubmitting(true); setError(null)
    const input: PublicEnrollInput = {
      full_name: d.full_name.trim(), email: d.email.trim().toLowerCase(),
      phone: d.phone.trim() || undefined, password: d.password, package_key: packageKey,
      age: d.age ? Number(d.age) : null,
      height_cm: d.height_cm ? Number(d.height_cm) : null,
      weight_kg: d.weight_kg ? Number(d.weight_kg) : null,
      currently_running: d.currently_running,
      running_level: d.running_level, activity_level: d.activity_level,
      days_running: d.days_running, weekly_distance: d.weekly_distance,
      goal: d.goal, preferred_days: d.preferred_days, website: d.website,
    }
    const res = await publicEnroll(input)
    if (!res.ok) { setError(res.error ?? 'Não foi possível concluir a matrícula.'); setSubmitting(false); return }

    // Entra automaticamente com a conta recém-criada e leva pro portal.
    try {
      const sb = createClient()
      await sb.auth.signInWithPassword({ email: input.email, password: d.password })
    } catch { /* se falhar, a pessoa pode logar manualmente */ }
    setDone(true)
    setSubmitting(false)
    setTimeout(() => { window.location.href = '/atleta' }, 1600)
  }

  if (done) {
    return (
      <div className="text-center py-14 px-6">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: RED + '22' }}>
          <Check className="w-8 h-8" style={{ color: RED }} />
        </div>
        <h2 className="text-2xl font-black text-foreground">Matrícula concluída! 🎉</h2>
        <p className="text-muted-foreground mt-2 max-w-md mx-auto">
          Recebemos sua anamnese. Vamos montar o seu plano <strong>{packageTitle}</strong> e você já pode acompanhar tudo pelo portal. Redirecionando…
        </p>
        <Loader2 className="w-5 h-5 animate-spin mx-auto mt-6 text-muted-foreground" />
      </div>
    )
  }

  return (
    <div>
      {/* Barra de progresso */}
      <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden mb-6">
        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${progress}%`, background: RED }} />
      </div>

      {/* honeypot (invisível) */}
      <input type="text" tabIndex={-1} autoComplete="off" value={d.website}
        onChange={e => set({ website: e.target.value })}
        className="absolute -left-[9999px] w-0 h-0 opacity-0" aria-hidden="true" />

      <div className="min-h-[320px]">
        {key === 'contato' && (
          <Screen title="Vamos começar" subtitle="Crie seu acesso e conte um pouco sobre você.">
            <div className="space-y-3">
              <Field label="Nome completo"><input value={d.full_name} onChange={e => set({ full_name: e.target.value })} className={inputCls} placeholder="Seu nome" /></Field>
              <Field label="E-mail"><input type="email" value={d.email} onChange={e => set({ email: e.target.value })} className={inputCls} placeholder="voce@email.com" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Telefone / WhatsApp"><input value={d.phone} onChange={e => set({ phone: e.target.value })} className={inputCls} placeholder="(11) 90000-0000" /></Field>
                <Field label="Senha (mín. 6)"><input type="password" value={d.password} onChange={e => set({ password: e.target.value })} className={inputCls} placeholder="••••••" /></Field>
              </div>
              <div className="grid grid-cols-3 gap-3 pt-1">
                <Field label="Idade"><input inputMode="numeric" value={d.age} onChange={e => set({ age: e.target.value.replace(/\D/g, '') })} className={inputCls} placeholder="anos" /></Field>
                <Field label="Altura (cm)"><input inputMode="numeric" value={d.height_cm} onChange={e => set({ height_cm: e.target.value.replace(/\D/g, '') })} className={inputCls} placeholder="175" /></Field>
                <Field label="Peso (kg)"><input inputMode="decimal" value={d.weight_kg} onChange={e => set({ weight_kg: e.target.value.replace(/[^\d.,]/g, '') })} className={inputCls} placeholder="70" /></Field>
              </div>
              {!contatoOk && (d.full_name || d.email || d.password) && (
                <p className="text-[11px] text-muted-foreground">Preencha nome, um e-mail válido e uma senha de pelo menos 6 caracteres.</p>
              )}
            </div>
          </Screen>
        )}

        {key === 'running_now' && (
          <Screen title="Você está correndo atualmente?" subtitle="Isso define o ponto de partida do seu plano.">
            <div className="grid grid-cols-2 gap-3">
              <BigChoice active={d.currently_running === true} onClick={() => choose({ currently_running: true })}>Sim</BigChoice>
              <BigChoice active={d.currently_running === false} onClick={() => choose({ currently_running: false })}>Não</BigChoice>
            </div>
          </Screen>
        )}

        {key === 'running_level' && (
          <Screen title="Como você classifica seu nível na corrida?">
            <ChoiceList options={RUN_LEVELS} selected={d.running_level} onSelect={v => choose({ running_level: v })} />
          </Screen>
        )}

        {key === 'activity_level' && (
          <Screen title="Como você classifica seu nível para atividades físicas?">
            <ChoiceList options={ACT_LEVELS} selected={d.activity_level} onSelect={v => choose({ activity_level: v })} />
          </Screen>
        )}

        {key === 'days_running' && (
          <Screen title="Quantos dias da semana está correndo atualmente?">
            <div className="grid grid-cols-2 gap-3">
              {DAYS_RUNNING.map(o => <BigChoice key={o.v} active={d.days_running === o.v} onClick={() => choose({ days_running: o.v })}>{o.t}</BigChoice>)}
            </div>
          </Screen>
        )}

        {key === 'weekly_distance' && (
          <Screen title="Qual a distância semanal total que está correndo atualmente?">
            <div className="grid grid-cols-2 gap-3">
              {WEEKLY_DIST.map(o => <BigChoice key={o.v} active={d.weekly_distance === o.v} onClick={() => choose({ weekly_distance: o.v })}>{o.t}</BigChoice>)}
            </div>
          </Screen>
        )}

        {key === 'goal' && (
          <Screen title="Qual seu principal objetivo inicial na corrida?">
            <ChoiceList options={GOALS.map(g => ({ v: g.v, t: g.t }))} selected={d.goal} onSelect={v => choose({ goal: v })} />
          </Screen>
        )}

        {key === 'preferred_days' && (
          <Screen title="Quais dias da semana você prefere correr?" subtitle="Pode escolher mais de um.">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {WEEKDAYS.map(o => {
                const on = d.preferred_days.includes(o.v)
                return (
                  <button key={o.v} type="button"
                    onClick={() => set({ preferred_days: on ? d.preferred_days.filter(x => x !== o.v) : [...d.preferred_days, o.v].sort((a, b) => a - b) })}
                    className="rounded-xl px-3 py-3 text-sm font-bold transition-colors border"
                    style={on ? { background: RED, color: '#fff', borderColor: RED } : { background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}>
                    {o.t}
                  </button>
                )
              })}
            </div>
          </Screen>
        )}

        {key === 'review' && (
          <Screen title="Confira antes de enviar" subtitle="Você poderá ajustar os detalhes com o treinador depois.">
            <div className="rounded-xl divide-y divide-border" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <Row k="Nome" v={d.full_name} />
              <Row k="Contato" v={[d.email, d.phone].filter(Boolean).join(' · ')} />
              <Row k="Perfil" v={[d.age && `${d.age} anos`, d.height_cm && `${d.height_cm} cm`, d.weight_kg && `${d.weight_kg} kg`].filter(Boolean).join(' · ') || '—'} />
              <Row k="Corre hoje?" v={d.currently_running === null ? '—' : d.currently_running ? 'Sim' : 'Não'} />
              {d.currently_running
                ? <>
                    <Row k="Nível" v={RUN_LEVELS.find(x => x.v === d.running_level)?.t ?? '—'} />
                    <Row k="Dias/semana" v={DAYS_RUNNING.find(x => x.v === d.days_running)?.t ?? '—'} />
                    <Row k="Volume semanal" v={WEEKLY_DIST.find(x => x.v === d.weekly_distance)?.t ?? '—'} />
                  </>
                : <Row k="Nível de atividade" v={ACT_LEVELS.find(x => x.v === d.activity_level)?.t ?? '—'} />}
              <Row k="Objetivo" v={GOALS.find(x => x.v === d.goal)?.t ?? '—'} />
              <Row k="Dias preferidos" v={d.preferred_days.map(i => WEEKDAYS[i].t).join(', ') || '—'} />
            </div>
            <p className="text-[11px] text-muted-foreground mt-3">Pacote: <strong className="text-foreground">{packageTitle}</strong></p>
          </Screen>
        )}
      </div>

      {error && <p className="text-sm text-red-500 mt-4 rounded-lg px-3 py-2" style={{ background: '#ef444418' }}>{error}</p>}

      {/* Navegação */}
      <div className="flex items-center justify-between gap-3 mt-6">
        <button type="button" onClick={back} disabled={step === 0}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-muted-foreground disabled:opacity-30 hover:bg-secondary transition-colors">
          <ChevronLeft className="w-4 h-4" /> Voltar
        </button>
        {key === 'review' ? (
          <button type="button" onClick={submit} disabled={submitting}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black text-white disabled:opacity-60"
            style={{ background: RED }}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Footprints className="w-4 h-4" />}
            {submitting ? 'Enviando…' : 'Concluir matrícula'}
          </button>
        ) : (
          <button type="button" onClick={next} disabled={!canAdvance()}
            className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-sm font-black text-white disabled:opacity-40"
            style={{ background: RED }}>
            Continuar <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}

const inputCls = 'w-full rounded-lg px-3 py-2.5 text-sm bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-[#e8001c]/40'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-muted-foreground mb-1.5">{label}</span>
      {children}
    </label>
  )
}

function Screen({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xl sm:text-2xl font-black text-foreground leading-tight">{title}</h2>
      {subtitle && <p className="text-sm text-muted-foreground mt-1.5 mb-5">{subtitle}</p>}
      <div className={subtitle ? '' : 'mt-5'}>{children}</div>
    </div>
  )
}

function BigChoice({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className="rounded-2xl px-4 py-5 text-base font-black transition-colors border-2"
      style={active ? { background: RED, color: '#fff', borderColor: RED } : { background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}>
      {children}
    </button>
  )
}

function ChoiceList({ options, selected, onSelect }: { options: { v: string; t: string; d?: string }[]; selected: string | null; onSelect: (v: string) => void }) {
  return (
    <div className="space-y-2.5">
      {options.map(o => {
        const on = selected === o.v
        return (
          <button key={o.v} type="button" onClick={() => onSelect(o.v)}
            className="w-full text-left rounded-2xl px-4 py-3.5 transition-colors border-2"
            style={on ? { background: RED + '12', borderColor: RED } : { background: 'var(--card)', borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-3">
              <span className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center border-2"
                style={on ? { background: RED, borderColor: RED } : { borderColor: 'var(--border)' }}>
                {on && <Check className="w-3 h-3 text-white" />}
              </span>
              <div>
                <p className="text-sm font-bold text-foreground">{o.t}</p>
                {o.d && <p className="text-xs text-muted-foreground mt-0.5">{o.d}</p>}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-2.5">
      <span className="text-xs text-muted-foreground">{k}</span>
      <span className="text-sm font-semibold text-foreground text-right">{v || '—'}</span>
    </div>
  )
}
