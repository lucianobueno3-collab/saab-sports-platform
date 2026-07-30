'use client'

import { useEffect, useState } from 'react'
import {
  getTrainingOverview, updatePlannedWorkout,
  type TrainingOverview, type PlannedWorkoutRow,
} from '@/lib/supabase/queries'
import { WorkoutSteps } from '@/components/athlete/workout-steps'
import { StructureBar } from '@/components/athlete/structured-builder'
import {
  Footprints, Bike, Waves, Dumbbell, Activity as ActIcon,
  CheckCircle2, Circle, Loader2, Flame, Target, Trophy, Moon, ChevronRight,
} from 'lucide-react'

const RED = '#e8001c'
const SPORTS: Record<string, { label: string; color: string; icon: typeof Footprints }> = {
  running: { label: 'Corrida', color: '#ff6b00', icon: Footprints },
  cycling: { label: 'Ciclismo', color: '#0088ff', icon: Bike },
  swimming: { label: 'Natação', color: '#00b4d8', icon: Waves },
  strength: { label: 'Força', color: '#e8001c', icon: Dumbbell },
  triathlon: { label: 'Triathlon', color: '#8b5cf6', icon: ActIcon },
}
const sportOf = (s: string) => SPORTS[s] ?? { label: s, color: '#64748b', icon: ActIcon }
const WD = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D']
const fmtDur = (m?: number | null) => (!m ? null : m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, '0') : ''}` : `${m}min`)
const dayLabel = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })

/** Visão moderna de treinos do aluno: o de hoje em destaque, a semana,
 *  o progresso no plano e a constância. */
export function TreinosOverview({ athleteId, onChanged }: { athleteId: string; onChanged?: () => void }) {
  const [ov, setOv] = useState<TrainingOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  async function load() { setOv(await getTrainingOverview(athleteId)); setLoading(false) }
  useEffect(() => { load() /* eslint-disable-next-line */ }, [athleteId])

  async function toggle(w: PlannedWorkoutRow) {
    setBusy(w.id)
    await updatePlannedWorkout(w.id, { completed: !w.completed })
    await load(); setBusy(null); onChanged?.()
  }

  if (loading) return <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /></div>
  if (!ov || ov.all.length === 0) return null

  const todayISO = new Date().toLocaleDateString('en-CA')
  const pending = ov.today.filter(w => !w.completed)
  const hero = pending[0] ?? ov.today[0] ?? null
  const nextUp = !hero ? ov.next[0] ?? null : null

  return (
    <div className="space-y-4">
      {/* ── Treino de hoje em destaque ──────────────────────────────────── */}
      {hero ? <HeroCard w={hero} busy={busy === hero.id} onToggle={() => toggle(hero)} extra={ov.today.length - 1} />
        : <RestCard next={nextUp} />}

      {/* ── Semana ──────────────────────────────────────────────────────── */}
      <div className="rounded-2xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-2.5">Sua semana</p>
        <div className="flex gap-1.5">
          {ov.week.map((d, i) => {
            const isToday = d.date === todayISO
            const done = d.planned.length > 0 && d.planned.every(w => w.completed)
            const some = d.planned.some(w => w.completed)
            const rest = d.planned.length === 0
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5">
                <span className="text-[10px] font-bold" style={{ color: isToday ? RED : 'var(--muted-foreground)' }}>{WD[i]}</span>
                <div className="w-full rounded-xl py-2 flex flex-col items-center gap-1 transition-colors"
                  style={{
                    background: isToday ? RED + '14' : 'var(--panel)',
                    border: `1px solid ${isToday ? RED + '55' : 'var(--panel-border)'}`,
                  }}>
                  {rest ? <Moon className="w-3.5 h-3.5 text-muted-foreground/40" />
                    : done ? <CheckCircle2 className="w-3.5 h-3.5" style={{ color: '#00d084' }} />
                    : <Circle className="w-3.5 h-3.5" style={{ color: some ? '#ffa800' : 'var(--muted-foreground)', opacity: some ? 1 : 0.45 }} />}
                  <div className="flex gap-0.5">
                    {d.planned.slice(0, 3).map(w => (
                      <span key={w.id} className="w-1 h-1 rounded-full" style={{ background: sportOf(w.sport).color }} />
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Progresso e constância ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        {ov.progress && (
          <div className="rounded-2xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-1.5 mb-1">
              <Target className="w-3.5 h-3.5" style={{ color: RED }} />
              <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Progresso</p>
            </div>
            <p className="text-xl font-black text-foreground leading-tight">Semana {ov.progress.weekIndex}<span className="text-sm text-muted-foreground font-bold"> de {ov.progress.weeks}</span></p>
            <div className="h-1.5 rounded-full mt-2 overflow-hidden" style={{ background: 'var(--panel-border)' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${Math.round((ov.progress.done / Math.max(1, ov.progress.total)) * 100)}%`, background: RED }} />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">{ov.progress.done} de {ov.progress.total} treinos</p>
          </div>
        )}
        {ov.adherence && (
          <div className="rounded-2xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-1.5 mb-1">
              <Flame className="w-3.5 h-3.5" style={{ color: ov.adherence.pct >= 80 ? '#00d084' : ov.adherence.pct >= 60 ? '#ffa800' : RED }} />
              <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Constância</p>
            </div>
            <p className="text-xl font-black leading-tight" style={{ color: ov.adherence.pct >= 80 ? '#00d084' : ov.adherence.pct >= 60 ? '#ffa800' : RED }}>
              {ov.adherence.pct}%
            </p>
            <div className="h-1.5 rounded-full mt-2 overflow-hidden" style={{ background: 'var(--panel-border)' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${ov.adherence.pct}%`, background: ov.adherence.pct >= 80 ? '#00d084' : ov.adherence.pct >= 60 ? '#ffa800' : RED }} />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">{ov.adherence.done} de {ov.adherence.planned} · 28 dias</p>
          </div>
        )}
      </div>

      {/* ── Próximos treinos ────────────────────────────────────────────── */}
      {ov.next.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground px-4 pt-4 pb-2">Próximos treinos</p>
          <div className="divide-y divide-border">
            {ov.next.map(w => {
              const s = sportOf(w.sport)
              const Icon = s.icon
              const isOpen = open === w.id
              return (
                <div key={w.id}>
                  <button onClick={() => setOpen(isOpen ? null : w.id)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/40 transition-colors text-left">
                    <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: s.color + '1f' }}>
                      <Icon className="w-4 h-4" style={{ color: s.color }} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-foreground truncate">{w.title}</p>
                      <p className="text-[11px] text-muted-foreground capitalize">
                        {dayLabel(w.date)}{fmtDur(w.planned_duration_min) ? ` · ${fmtDur(w.planned_duration_min)}` : ''}
                      </p>
                    </div>
                    {w.structure && w.structure.length > 0 && (
                      <div className="hidden sm:block w-20 shrink-0"><StructureBar structure={w.structure} height={8} /></div>
                    )}
                    <ChevronRight className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4">
                      {w.structure && w.structure.length > 0
                        ? <WorkoutSteps title={w.title} sport={w.sport} structure={w.structure} />
                        : <p className="text-xs text-muted-foreground whitespace-pre-line">{w.description || 'Sem detalhes adicionais.'}</p>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function HeroCard({ w, busy, onToggle, extra }: { w: PlannedWorkoutRow; busy: boolean; onToggle: () => void; extra: number }) {
  const s = sportOf(w.sport)
  const Icon = s.icon
  const [showSteps, setShowSteps] = useState(false)
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: `1px solid ${s.color}44` }}>
      <div className="p-5" style={{ background: `linear-gradient(135deg, ${s.color}1f, transparent 70%)` }}>
        <div className="flex items-start gap-3">
          <span className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: s.color + '26' }}>
            <Icon className="w-6 h-6" style={{ color: s.color }} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: s.color }}>
              {w.completed ? 'Treino de hoje · concluído' : 'Treino de hoje'}
            </p>
            <h2 className="text-xl font-black text-foreground leading-tight mt-0.5">{w.title}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              {fmtDur(w.planned_duration_min) && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg" style={{ background: 'var(--panel)', color: 'var(--muted-foreground)' }}>{fmtDur(w.planned_duration_min)}</span>
              )}
              {w.planned_tss != null && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg" style={{ background: '#0088ff18', color: '#0088ff' }}>{w.planned_tss} TSS</span>
              )}
              {extra > 0 && <span className="text-[11px] text-muted-foreground">+{extra} treino{extra > 1 ? 's' : ''} hoje</span>}
            </div>
          </div>
        </div>

        {w.structure && w.structure.length > 0 && (
          <div className="mt-3.5">
            <StructureBar structure={w.structure} height={12} />
            <button onClick={() => setShowSteps(v => !v)} className="mt-2 text-[11px] font-bold hover:underline" style={{ color: s.color }}>
              {showSteps ? 'Ocultar passos' : 'Ver passo a passo'}
            </button>
            {showSteps && <div className="mt-2.5"><WorkoutSteps title={w.title} sport={w.sport} structure={w.structure} /></div>}
          </div>
        )}
        {!w.structure?.length && w.description && (
          <p className="text-sm text-muted-foreground mt-3 whitespace-pre-line">{w.description}</p>
        )}

        <button onClick={onToggle} disabled={busy}
          className="w-full mt-4 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black transition-colors disabled:opacity-60"
          style={w.completed
            ? { background: 'var(--panel)', color: 'var(--muted-foreground)', border: '1px solid var(--panel-border)' }
            : { background: s.color, color: '#fff' }}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : w.completed ? <Circle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          {w.completed ? 'Marcar como não feito' : 'Concluir treino'}
        </button>
      </div>
    </div>
  )
}

function RestCard({ next }: { next: PlannedWorkoutRow | null }) {
  const s = next ? sportOf(next.sport) : null
  return (
    <div className="rounded-2xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
      <div className="flex items-start gap-3">
        <span className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#00d08418' }}>
          {next ? <Trophy className="w-6 h-6" style={{ color: '#00d084' }} /> : <Moon className="w-6 h-6" style={{ color: '#00d084' }} />}
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: '#00d084' }}>Hoje</p>
          <h2 className="text-xl font-black text-foreground leading-tight mt-0.5">Dia de descanso</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {next
              ? <>Descanso faz parte do plano — é nele que a adaptação acontece. Próximo treino: <strong className="text-foreground capitalize">{dayLabel(next.date)}</strong>{s ? `, ${next.title}` : ''}.</>
              : 'Sem treinos programados no momento. Seu treinador vai liberar os próximos em breve.'}
          </p>
        </div>
      </div>
    </div>
  )
}
