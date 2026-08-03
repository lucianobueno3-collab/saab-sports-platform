'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  getTrainingPrograms, saveTrainingProgram, deleteTrainingProgram, getWorkoutLibrary,
  bulkCreateLibraryWorkouts,
  type TrainingProgramRow, type WorkoutLibraryRow,
} from '@/lib/supabase/queries'
import { programWorkoutsToLibrary, apenasNovos } from '@/lib/program-to-library'
import { couchTo5k8Weeks, progressao5kIniciantes, type ProgramWeek, type ProgramWorkout } from '@/lib/program-templates'
import { createPortal } from 'react-dom'
import {
  Loader2, Plus, Trash2, Copy, Sparkles, ChevronLeft, Save, X, Footprints, Bike, Waves, Dumbbell, Activity, CalendarDays, Library,
} from 'lucide-react'

const RED = '#e8001c'
const SPORTS = [
  { key: 'running', label: 'Corrida', color: '#ff6b00', icon: Footprints },
  { key: 'cycling', label: 'Ciclismo', color: '#0088ff', icon: Bike },
  { key: 'swimming', label: 'Natação', color: '#00b4d8', icon: Waves },
  { key: 'strength', label: 'Força', color: '#e8001c', icon: Dumbbell },
  { key: 'other', label: 'Outro', color: '#64748b', icon: Activity },
]
const sportInfo = (s: string) => SPORTS.find(x => x.key === s) ?? SPORTS[4]
const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const LEVELS = [{ v: 'iniciante', t: 'Iniciante' }, { v: 'intermediario', t: 'Intermediário' }, { v: 'avancado', t: 'Avançado' }]
const GOALS = [
  { v: '5km', t: '5 km' }, { v: '10km', t: '10 km' }, { v: '21km', t: 'Meia (21 km)' }, { v: '42km', t: 'Maratona (42 km)' },
]
const cls = 'w-full rounded-lg px-3 py-2 text-sm bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-[#e8001c]/40'

export function ProgramComposer() {
  const [programs, setPrograms] = useState<TrainingProgramRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<TrainingProgramRow | 'new' | null>(null)
  const [busy, setBusy] = useState(false)

  const [aviso, setAviso] = useState<{ texto: string; ok: boolean } | null>(null)

  async function load() { setLoading(true); setPrograms(await getTrainingPrograms()); setLoading(false) }
  useEffect(() => { load() }, [])

  /**
   * Grava um modelo pronto no banco e abre para edição.
   *
   * Se já existe um programa com o mesmo nome, ATUALIZA aquele em vez de criar
   * outro. Sem isso, cada clique deixava um duplicado para trás e o treinador
   * não sabia qual dos dois estava sendo aplicado aos alunos.
   */
  async function sincronizarModelo(modelo: () => ReturnType<typeof couchTo5k8Weeks>) {
    setBusy(true); setAviso(null)
    const ex = modelo()
    const existente = programs.find(p => p.name.trim().toLowerCase() === ex.name.trim().toLowerCase())
    const res = await saveTrainingProgram({
      ...ex, id: existente?.id, package_key: existente?.package_key ?? 'primeiros_5k', active: true,
    })
    setBusy(false)
    if (!res.ok) { setAviso({ texto: res.error ?? 'Não foi possível gravar o plano.', ok: false }); return }
    const list = await getTrainingPrograms()
    setPrograms(list)
    setAviso({
      texto: existente
        ? `"${ex.name}" atualizado no banco com ${ex.weeks.length} semanas.`
        : `"${ex.name}" criado com ${ex.weeks.length} semanas.`,
      ok: true,
    })
    const alvo = list.find(p => p.id === res.id)
    if (alvo) setEditing(alvo)
  }
  /**
   * Copia os treinos do plano para a biblioteca, para o treinador usar cada um
   * solto. Só grava os que ainda não existem, então clicar de novo não duplica.
   */
  async function enviarParaBiblioteca(p: TrainingProgramRow) {
    setBusy(true); setAviso(null)
    const candidatos = programWorkoutsToLibrary(p.weeks)
    const novos = apenasNovos(candidatos, await getWorkoutLibrary())
    if (novos.length === 0) {
      setBusy(false)
      setAviso({ texto: `Os ${candidatos.length} treinos de "${p.name}" já estão na biblioteca.`, ok: true })
      return
    }
    const gravados = await bulkCreateLibraryWorkouts(novos)
    setBusy(false)
    setAviso({
      texto: `${gravados} treino${gravados > 1 ? 's' : ''} de "${p.name}" ${gravados > 1 ? 'foram enviados' : 'foi enviado'} para a biblioteca.`
        + (candidatos.length > gravados ? ` Os outros ${candidatos.length - gravados} já estavam lá.` : ''),
      ok: true,
    })
  }

  const createExample = () => sincronizarModelo(couchTo5k8Weeks)
  const criarProgressao5k = () => sincronizarModelo(progressao5kIniciantes)

  if (editing) return <ProgramEditor program={editing === 'new' ? null : editing} onClose={() => { setEditing(null); load() }} />

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-black text-foreground">Planos de treinamento</h2>
          <p className="text-xs text-muted-foreground">Semanas × treinos, reutilizáveis e aplicáveis aos alunos. Os treinos podem ir para a biblioteca e ser usados soltos.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={criarProgressao5k} disabled={busy} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border border-border text-foreground hover:bg-secondary disabled:opacity-60">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Carregar PROGRESSÃO 5K INICIANTES
          </button>
          <button onClick={createExample} disabled={busy} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border border-border text-foreground hover:bg-secondary disabled:opacity-60">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Criar exemplo (0 aos 5 km)
          </button>
          <button onClick={() => setEditing('new')} className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90">
            <Plus className="w-4 h-4" /> Novo plano
          </button>
        </div>
      </div>

      {aviso && (
        <p className="text-xs font-semibold rounded-lg px-3 py-2.5"
          style={{ background: aviso.ok ? '#00d08414' : '#ef444414', color: aviso.ok ? '#00d084' : '#ef4444' }}>
          {aviso.texto}
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : programs.length === 0 ? (
        <div className="rounded-2xl p-10 text-center" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <CalendarDays className="w-9 h-9 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-semibold text-foreground">Nenhum plano de treinamento ainda</p>
          <p className="text-xs text-muted-foreground mt-1 mb-4">Comece por um modelo pronto ou monte do zero.</p>
          <button onClick={criarProgressao5k} disabled={busy} className="px-4 py-2 bg-primary text-white text-sm font-bold rounded-lg inline-flex items-center gap-2">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Criar "PROGRESSÃO 5K INICIANTES"
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {programs.map(p => {
            const info = sportInfo(p.sport)
            const sessions = p.weeks.reduce((s, w) => s + w.workouts.length, 0)
            return (
              <div key={p.id} className="rounded-2xl overflow-hidden flex flex-col"
                style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                <div className="h-1.5" style={{ background: info.color }} />
                <button onClick={() => setEditing(p)} className="text-left p-4 flex-1">
                  <div className="flex items-center gap-2">
                    <info.icon className="w-4 h-4 flex-shrink-0" style={{ color: info.color }} />
                    <span className="font-black text-foreground flex-1 min-w-0 truncate">{p.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.description}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <Tag>{p.weeks.length} semanas</Tag>
                    <Tag>{sessions} treinos</Tag>
                    {p.level && <Tag>{LEVELS.find(l => l.v === p.level)?.t ?? p.level}</Tag>}
                  </div>
                </button>
                <button onClick={() => enviarParaBiblioteca(p)} disabled={busy}
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-[11px] font-bold border-t border-border text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-60">
                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Library className="w-3.5 h-3.5" />}
                  Enviar treinos para a biblioteca
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: 'var(--secondary)', color: 'var(--muted-foreground)' }}>{children}</span>
}

// ─── Editor de um programa ───────────────────────────────────────────────────
function ProgramEditor({ program, onClose }: { program: TrainingProgramRow | null; onClose: () => void }) {
  const [name, setName] = useState(program?.name ?? '')
  const [description, setDescription] = useState(program?.description ?? '')
  const [sport, setSport] = useState(program?.sport ?? 'running')
  const [level, setLevel] = useState(program?.level ?? 'iniciante')
  const [goal, setGoal] = useState(program?.goal ?? '5km')
  const [currentlyRunning, setCurrentlyRunning] = useState<boolean | null>(program?.routing?.currently_running ?? null)
  const [weeks, setWeeks] = useState<ProgramWeek[]>(program?.weeks ?? [{ label: 'Semana 1', workouts: [] }])
  const [library, setLibrary] = useState<WorkoutLibraryRow[]>([])
  const [adding, setAdding] = useState<{ w: number; day: number } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { getWorkoutLibrary().then(setLibrary).catch(() => {}) }, [])

  const setWeek = (i: number, patch: Partial<ProgramWeek>) => setWeeks(ws => ws.map((w, k) => (k === i ? { ...w, ...patch } : w)))
  const addWeek = () => setWeeks(ws => [...ws, { label: `Semana ${ws.length + 1}`, workouts: [] }])
  const dupWeek = (i: number) => setWeeks(ws => { const c = { ...ws[i], label: `Semana ${ws.length + 1}`, workouts: ws[i].workouts.map(x => ({ ...x })) }; return [...ws, c] })
  const removeWeek = (i: number) => setWeeks(ws => ws.filter((_, k) => k !== i))
  const addWorkout = (i: number, wo: ProgramWorkout) => setWeek(i, { workouts: [...weeks[i].workouts, wo].sort((a, b) => a.day - b.day) })
  const removeWorkout = (i: number, idx: number) => setWeek(i, { workouts: weeks[i].workouts.filter((_, k) => k !== idx) })

  const totals = useMemo(() => {
    let sessions = 0, tss = 0
    for (const w of weeks) for (const x of w.workouts) { sessions++; tss += x.tss ?? 0 }
    return { sessions, tss }
  }, [weeks])

  async function save() {
    if (!name.trim()) { setError('Dê um nome ao plano.'); return }
    setSaving(true); setError(null)
    const res = await saveTrainingProgram({
      id: program?.id, name: name.trim(), description: description.trim() || null, sport, level, goal,
      routing: { currently_running: currentlyRunning, levels: [level], goals: [goal] },
      weeks, package_key: program?.package_key ?? null, active: true,
    })
    setSaving(false)
    if (!res.ok) { setError(res.error ?? 'Falha ao salvar.'); return }
    onClose()
  }

  async function remove() {
    if (!program?.id || !confirm('Excluir este plano de treinamento?')) return
    await deleteTrainingProgram(program.id); onClose()
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center gap-2">
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground"><ChevronLeft className="w-5 h-5" /></button>
        <h2 className="text-lg font-black text-foreground flex-1">{program ? 'Editar plano' : 'Novo plano'}</h2>
        {program && <button onClick={remove} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground" title="Excluir"><Trash2 className="w-4 h-4" /></button>}
        <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-bold rounded-lg disabled:opacity-60">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar
        </button>
      </div>

      {/* Metadados + roteamento */}
      <div className="rounded-2xl p-4 space-y-3" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block"><span className="block text-xs font-semibold text-muted-foreground mb-1">Nome</span><input value={name} onChange={e => setName(e.target.value)} className={cls} placeholder="Ex.: Do 0 aos 5 km — 8 semanas" /></label>
          <label className="block"><span className="block text-xs font-semibold text-muted-foreground mb-1">Modalidade</span>
            <select value={sport} onChange={e => setSport(e.target.value)} className={cls}>{SPORTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}</select>
          </label>
        </div>
        <label className="block"><span className="block text-xs font-semibold text-muted-foreground mb-1">Descrição</span><input value={description} onChange={e => setDescription(e.target.value)} className={cls} placeholder="Resumo do plano" /></label>
        <div className="pt-1">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Roteamento pela anamnese (quando aplicar este plano)</p>
          <div className="grid sm:grid-cols-3 gap-3">
            <label className="block"><span className="block text-xs font-semibold text-muted-foreground mb-1">Nível</span>
              <select value={level} onChange={e => setLevel(e.target.value)} className={cls}>{LEVELS.map(l => <option key={l.v} value={l.v}>{l.t}</option>)}</select>
            </label>
            <label className="block"><span className="block text-xs font-semibold text-muted-foreground mb-1">Objetivo</span>
              <select value={goal} onChange={e => setGoal(e.target.value)} className={cls}>{GOALS.map(g => <option key={g.v} value={g.v}>{g.t}</option>)}</select>
            </label>
            <label className="block"><span className="block text-xs font-semibold text-muted-foreground mb-1">Já corre?</span>
              <select value={currentlyRunning === null ? '' : currentlyRunning ? 'sim' : 'nao'} onChange={e => setCurrentlyRunning(e.target.value === '' ? null : e.target.value === 'sim')} className={cls}>
                <option value="">Tanto faz</option><option value="nao">Não corre</option><option value="sim">Já corre</option>
              </select>
            </label>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">{weeks.length} semanas · {totals.sessions} treinos · {totals.tss} TSS total</p>
      </div>

      {/* Semanas */}
      <div className="space-y-3">
        {weeks.map((wk, i) => (
          <div key={i} className="rounded-2xl p-3" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2 mb-2">
              <input value={wk.label} onChange={e => setWeek(i, { label: e.target.value })} className="text-sm font-black text-foreground bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none flex-1 min-w-0" />
              <button onClick={() => dupWeek(i)} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground" title="Duplicar semana"><Copy className="w-3.5 h-3.5" /></button>
              <button onClick={() => removeWeek(i)} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground" title="Remover semana"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5">
              {WEEKDAYS.map((wd, day) => {
                const dayWorkouts = wk.workouts.map((x, idx) => ({ x, idx })).filter(o => o.x.day === day)
                return (
                  <div key={day} className="rounded-lg p-1.5 min-h-[72px] flex flex-col" style={{ background: 'var(--panel)', border: '1px solid var(--panel-border)' }}>
                    <span className="text-[10px] font-bold text-muted-foreground mb-1">{wd}</span>
                    <div className="space-y-1 flex-1">
                      {dayWorkouts.map(({ x, idx }) => {
                        const info = sportInfo(x.sport)
                        return (
                          <div key={idx} className="rounded px-1.5 py-1 group relative" style={{ background: info.color + '1e' }}>
                            <div className="flex items-start gap-1">
                              <info.icon className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: info.color }} />
                              <span className="text-[11px] font-semibold text-foreground leading-tight flex-1 min-w-0">{x.title}</span>
                              <button onClick={() => removeWorkout(i, idx)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500"><X className="w-3 h-3" /></button>
                            </div>
                            {(x.duration_min || x.tss) && <p className="text-[9px] text-muted-foreground mt-0.5 pl-4">{[x.duration_min ? `${x.duration_min}min` : null, x.tss ? `${x.tss} TSS` : null].filter(Boolean).join(' · ')}</p>}
                          </div>
                        )
                      })}
                    </div>
                    <button onClick={() => setAdding({ w: i, day })} className="mt-1 w-full text-[10px] text-muted-foreground/70 hover:text-foreground rounded border border-dashed border-border py-1">+ treino</button>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
        <div className="flex gap-2">
          <button onClick={addWeek} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border border-border text-foreground hover:bg-secondary">
            <Plus className="w-4 h-4" /> Adicionar semana
          </button>
          {weeks.length > 0 && (
            <button onClick={() => dupWeek(weeks.length - 1)} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border border-border text-foreground hover:bg-secondary">
              <Copy className="w-4 h-4" /> Duplicar última
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {adding && (
        <AddWorkoutModal
          library={library} defaultSport={sport}
          onClose={() => setAdding(null)}
          onAdd={wo => { addWorkout(adding.w, { ...wo, day: adding.day }); setAdding(null) }}
        />
      )}
    </div>
  )
}

// ─── Modal: adicionar treino a um dia ────────────────────────────────────────
function AddWorkoutModal({ library, defaultSport, onClose, onAdd }: {
  library: WorkoutLibraryRow[]; defaultSport: string
  onClose: () => void; onAdd: (wo: Omit<ProgramWorkout, 'day'>) => void
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  const [sport, setSport] = useState(defaultSport)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dur, setDur] = useState('')
  const [tss, setTss] = useState('')

  const libForSport = library.filter(l => l.sport === sport)
  function applyLib(id: string) {
    const w = library.find(l => l.id === id); if (!w) return
    setTitle(w.title); setDescription(w.description ?? ''); setDur(w.duration_min?.toString() ?? ''); setTss(w.tss?.toString() ?? '')
  }
  function confirm() {
    if (!title.trim()) return
    onAdd({ sport, title: title.trim(), description: description.trim() || undefined, duration_min: dur ? Number(dur) : null, tss: tss ? Number(tss) : null })
  }
  if (!mounted) return null
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h3 className="font-black text-foreground">Adicionar treino</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-3">
          <label className="block"><span className="block text-xs font-semibold text-muted-foreground mb-1">Modalidade</span>
            <select value={sport} onChange={e => setSport(e.target.value)} className={cls}>{SPORTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}</select>
          </label>
          {libForSport.length > 0 && (
            <label className="block"><span className="block text-xs font-semibold text-muted-foreground mb-1">Usar da biblioteca (opcional)</span>
              <select defaultValue="" onChange={e => { if (e.target.value) applyLib(e.target.value) }} className={cls}>
                <option value="">— escolher treino salvo —</option>
                {libForSport.map(w => <option key={w.id} value={w.id}>{w.title}</option>)}
              </select>
            </label>
          )}
          <label className="block"><span className="block text-xs font-semibold text-muted-foreground mb-1">Título</span><input value={title} onChange={e => setTitle(e.target.value)} className={cls} placeholder="Ex.: Corrida/caminhada" /></label>
          <label className="block"><span className="block text-xs font-semibold text-muted-foreground mb-1">Descrição</span><textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className={cls} placeholder="Ex.: 8× (1 min corrida + 2 min caminhada)" /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="block text-xs font-semibold text-muted-foreground mb-1">Duração (min)</span><input inputMode="numeric" value={dur} onChange={e => setDur(e.target.value.replace(/\D/g, ''))} className={cls} placeholder="30" /></label>
            <label className="block"><span className="block text-xs font-semibold text-muted-foreground mb-1">TSS</span><input inputMode="numeric" value={tss} onChange={e => setTss(e.target.value.replace(/\D/g, ''))} className={cls} placeholder="25" /></label>
          </div>
          <button onClick={confirm} disabled={!title.trim()} className="w-full py-2.5 rounded-lg bg-primary text-white text-sm font-bold disabled:opacity-50" style={{ background: RED }}>Adicionar</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
