'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  getTrainingOverview, updatePlannedWorkout, rescheduleWorkout, skipWorkout, unskipWorkout,
  getWorkoutComments, addWorkoutComment, markThreadRead, getAthleteUnreadCount,
  type TrainingOverview, type PlannedWorkoutRow, type WorkoutComment,
} from '@/lib/supabase/queries'
import { createClient } from '@/lib/supabase/client'
import { offlineKey, readSnapshot, saveSnapshot, snapshotAge } from '@/lib/offline-cache'
import { WorkoutSteps } from '@/components/athlete/workout-steps'
import { StructureBar } from '@/components/athlete/structured-builder'
import type { Thresholds } from '@/lib/workout-export'
import {
  Footprints, Bike, Waves, Dumbbell, Activity as ActIcon,
  CheckCircle2, Circle, Loader2, Flame, Target, Trophy, Moon, ChevronRight,
  CalendarClock, X, MessageCircle, Send, SkipForward, CloudOff,
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
  const [th, setTh] = useState<Thresholds>({})
  const [notDone, setNotDone] = useState<PlannedWorkoutRow | null>(null)
  const [chat, setChat] = useState<PlannedWorkoutRow | null>(null)
  const [unread, setUnread] = useState(0)

  async function load() {
    setOv(await getTrainingOverview(athleteId)); setLoading(false)
    getAthleteUnreadCount(athleteId).then(setUnread).catch(() => {})
  }
  useEffect(() => {
    load()
    // limiares do atleta: permitem mostrar "Z2 = 7:00–7:40/km" em vez de só "Z2".
    // O builder do Supabase é thenable mas não expõe .catch() — daí o try/catch.
    ;(async () => {
      const chave = offlineKey.thresholds(athleteId)
      try {
        const { data } = await createClient().from('athletes')
          .select('lthr_run_bpm, lthr_bpm, threshold_pace_sec_km').eq('id', athleteId).maybeSingle()
        const a = data as { lthr_run_bpm?: number | null; lthr_bpm?: number | null; threshold_pace_sec_km?: number | null } | null
        if (a) {
          const t: Thresholds = { lthr: a.lthr_run_bpm ?? a.lthr_bpm ?? null, thresholdPaceSecKm: a.threshold_pace_sec_km ?? null }
          setTh(t); saveSnapshot(chave, t)
        }
      } catch {
        // Sem internet: usa os limiares da última visita, para o ritmo por zona continuar aparecendo.
        const copia = readSnapshot<Thresholds>(chave)
        if (copia) setTh(copia.data)
      }
    })()
    /* eslint-disable-next-line */
  }, [athleteId])

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
      {/* Modo offline: dados da última vez que houve conexão */}
      {ov.offlineAt && (
        <div className="rounded-2xl p-3.5 flex items-center gap-3" style={{ background: '#f59e0b14', border: '1px solid #f59e0b44' }}>
          <CloudOff className="w-5 h-5 shrink-0" style={{ color: '#f59e0b' }} />
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground">Você está sem internet</p>
            <p className="text-[11px] text-muted-foreground">
              Mostrando os treinos salvos {snapshotAge(ov.offlineAt)}. Marcar como feito volta quando a conexão voltar.
            </p>
          </div>
        </div>
      )}

      {/* Resposta nova do treinador */}
      {unread > 0 && (
        <div className="rounded-2xl p-3.5 flex items-center gap-3" style={{ background: RED + '14', border: `1px solid ${RED}44` }}>
          <MessageCircle className="w-5 h-5 shrink-0" style={{ color: RED }} />
          <p className="text-sm font-bold text-foreground">
            Seu treinador respondeu {unread > 1 ? `${unread} recados` : 'seu recado'} — abra o treino para ver.
          </p>
        </div>
      )}

      {/* ── Treino de hoje em destaque ──────────────────────────────────── */}
      {hero ? (
        <HeroCard w={hero} th={th} busy={busy === hero.id} extra={ov.today.length - 1}
          onToggle={() => toggle(hero)} onNotDone={() => setNotDone(hero)} onChat={() => setChat(hero)} />
      ) : <RestCard next={nextUp} />}

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

      {notDone && (
        <NotDoneModal w={notDone} onClose={() => setNotDone(null)}
          onDone={() => { setNotDone(null); load() }} />
      )}
      {chat && <ChatModal w={chat} athleteId={athleteId} onClose={() => { setChat(null); load() }} />}

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
                        ? <WorkoutSteps title={w.title} sport={w.sport} structure={w.structure} thresholds={th} />
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

function HeroCard({ w, th, busy, onToggle, onNotDone, onChat, extra }: {
  w: PlannedWorkoutRow; th: Thresholds; busy: boolean
  onToggle: () => void; onNotDone: () => void; onChat: () => void; extra: number
}) {
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
            {showSteps && <div className="mt-2.5"><WorkoutSteps title={w.title} sport={w.sport} structure={w.structure} thresholds={th} /></div>}
          </div>
        )}
        {!w.structure?.length && w.description && (
          <p className="text-sm text-muted-foreground mt-3 whitespace-pre-line">{w.description}</p>
        )}

        {w.skipped ? (
          <div className="mt-4 rounded-xl px-3.5 py-3 text-center" style={{ background: 'var(--panel)', border: '1px solid var(--panel-border)' }}>
            <p className="text-sm font-bold text-foreground">Você pulou este treino — tudo bem.</p>
            {w.skip_reason && <p className="text-[11px] text-muted-foreground mt-0.5">{w.skip_reason}</p>}
            <p className="text-[11px] text-muted-foreground mt-1">Um dia fora não apaga o que você já construiu.</p>
          </div>
        ) : (
          <button onClick={onToggle} disabled={busy}
            className="w-full mt-4 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black transition-colors disabled:opacity-60"
            style={w.completed
              ? { background: 'var(--panel)', color: 'var(--muted-foreground)', border: '1px solid var(--panel-border)' }
              : { background: s.color, color: '#fff' }}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : w.completed ? <Circle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            {w.completed ? 'Marcar como não feito' : 'Concluir treino'}
          </button>
        )}

        <div className="flex items-center gap-2 mt-2">
          {!w.completed && (
            <button onClick={onNotDone}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold text-muted-foreground border border-border hover:bg-secondary transition-colors">
              <CalendarClock className="w-3.5 h-3.5" /> {w.skipped ? 'Mudei de ideia' : 'Não deu hoje'}
            </button>
          )}
          <button onClick={onChat}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold text-muted-foreground border border-border hover:bg-secondary transition-colors">
            <MessageCircle className="w-3.5 h-3.5" /> Falar com o treinador
          </button>
        </div>
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

// ─── "Não deu hoje": remarcar ou pular sem culpa ────────────────────────────
// O rastro de treinos vermelhos é a causa nº1 de abandono. Aqui a falha vira
// decisão: o aluno escolhe o novo dia ou assume que pulou — sem punição.
function NotDoneModal({ w, onClose, onDone }: { w: PlannedWorkoutRow; onClose: () => void; onDone: () => void }) {
  const [mode, setMode] = useState<'move' | 'skip'>('move')
  const [newDate, setNewDate] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toLocaleDateString('en-CA') })
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  async function confirm() {
    setSaving(true)
    if (w.skipped) await unskipWorkout(w.id)
    else if (mode === 'move') await rescheduleWorkout(w.id, w.date, newDate)
    else await skipWorkout(w.id, reason.trim() || null)
    setSaving(false); onDone()
  }

  const inCls = 'w-full rounded-lg px-2.5 py-2 text-sm bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-[#e8001c]/40'
  if (!mounted) return null
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-2xl safe-bottom">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-black text-foreground">{w.skipped ? 'Retomar o treino' : 'Não deu hoje?'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {w.skipped ? (
            <p className="text-sm text-muted-foreground">Este treino está marcado como pulado. Quer trazê-lo de volta para a sua lista?</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Sem problema — acontece com todo mundo. Escolha o que faz mais sentido:
              </p>
              <div className="space-y-2">
                <button onClick={() => setMode('move')} className="w-full text-left rounded-xl px-3.5 py-3 transition-colors"
                  style={mode === 'move' ? { background: RED + '12', border: `1.5px solid ${RED}` } : { background: 'var(--panel)', border: '1px solid var(--panel-border)' }}>
                  <p className="text-sm font-black text-foreground flex items-center gap-2"><CalendarClock className="w-4 h-4" style={{ color: RED }} /> Remarcar para outro dia</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">O treino muda de data e continua no seu plano.</p>
                </button>
                <button onClick={() => setMode('skip')} className="w-full text-left rounded-xl px-3.5 py-3 transition-colors"
                  style={mode === 'skip' ? { background: RED + '12', border: `1.5px solid ${RED}` } : { background: 'var(--panel)', border: '1px solid var(--panel-border)' }}>
                  <p className="text-sm font-black text-foreground flex items-center gap-2"><SkipForward className="w-4 h-4" style={{ color: RED }} /> Pular sem culpa</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Uma semana não define o processo. Segue o plano a partir do próximo.</p>
                </button>
              </div>

              {mode === 'move' ? (
                <label className="text-xs font-semibold text-muted-foreground block">Novo dia
                  <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className={`${inCls} mt-1`} />
                </label>
              ) : (
                <label className="text-xs font-semibold text-muted-foreground block">Motivo (opcional — ajuda seu treinador)
                  <input value={reason} onChange={e => setReason(e.target.value)} placeholder="ex: trabalho, dor no joelho, viagem" className={`${inCls} mt-1`} />
                </label>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-2 px-5 py-4 border-t border-border">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-bold text-muted-foreground border border-border hover:bg-secondary">Cancelar</button>
          <button onClick={confirm} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-black text-white disabled:opacity-60" style={{ background: RED }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {saving ? 'Salvando…' : w.skipped ? 'Retomar' : mode === 'move' ? 'Remarcar' : 'Pular'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ─── Recado no treino: a dúvida fica presa ao treino certo ──────────────────
function ChatModal({ w, athleteId, onClose }: { w: PlannedWorkoutRow; athleteId: string; onClose: () => void }) {
  const [items, setItems] = useState<WorkoutComment[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [mounted, setMounted] = useState(false)

  async function load() { setItems(await getWorkoutComments(w.id)); setLoading(false) }
  useEffect(() => {
    setMounted(true); load()
    markThreadRead(w.id, 'athlete').catch(() => {})
    /* eslint-disable-next-line */
  }, [w.id])

  async function send() {
    if (!text.trim()) return
    setSending(true)
    await addWorkoutComment(w.id, athleteId, text)
    setText(''); await load(); setSending(false)
  }

  if (!mounted) return null
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-2xl max-h-[85vh] flex flex-col safe-bottom">
        <div className="flex items-start justify-between gap-2 px-5 py-4 border-b border-border">
          <div className="min-w-0">
            <h2 className="text-base font-black text-foreground">Falar com o treinador</h2>
            <p className="text-[11px] text-muted-foreground truncate">Sobre: {w.title}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground shrink-0"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2.5 min-h-[140px]">
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum recado ainda. Pergunte o que quiser sobre este treino — seu treinador responde por aqui.
            </p>
          ) : items.map(c => {
            const staff = c.author_role === 'coach' || c.author_role === 'admin' || c.author_role === 'doctor'
            return (
              <div key={c.id} className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${staff ? 'ml-auto' : ''}`}
                style={staff ? { background: RED + '18', border: `1px solid ${RED}33` } : { background: 'var(--panel)', border: '1px solid var(--panel-border)' }}>
                <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: staff ? RED : 'var(--muted-foreground)' }}>
                  {staff ? (c.author_name ?? 'Treinador') : (c.author_name ?? 'Você')}
                </p>
                <p className="text-sm text-foreground mt-0.5 whitespace-pre-line">{c.body}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{new Date(c.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            )
          })}
        </div>

        <div className="flex items-center gap-2 px-5 py-4 border-t border-border">
          <input value={text} onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Escreva seu recado…"
            className="flex-1 rounded-lg px-3 py-2.5 text-sm bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-[#e8001c]/40" />
          <button onClick={send} disabled={sending || !text.trim()}
            className="p-2.5 rounded-lg text-white disabled:opacity-50 shrink-0" style={{ background: RED }} aria-label="Enviar">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
