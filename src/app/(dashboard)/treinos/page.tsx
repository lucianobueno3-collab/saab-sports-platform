'use client'

import { useEffect, useMemo, useState } from 'react'
import { Topbar } from '@/components/layout/topbar'
import {
  getWorkoutLibrary, createLibraryWorkout, updateLibraryWorkout, deleteLibraryWorkout,
  type WorkoutLibraryRow, type LibExercise,
} from '@/lib/supabase/queries'
import { StructuredBuilder, StructureBar } from '@/components/athlete/structured-builder'
import { WorkoutSteps } from '@/components/athlete/workout-steps'
import { estimateStructure, structureSummary, type WorkoutStructure } from '@/lib/workout-structure'
import { buildWorkoutTCX, downloadFile, slugify } from '@/lib/workout-export'
import {
  Plus, X, Loader2, Trash2, Pencil, Dumbbell, Bike, Footprints, Waves,
  Activity as ActIcon, Clock, Flame, Library, Watch, CalendarDays, Search, ListChecks, LayoutGrid, List,
} from 'lucide-react'
import { ProgramComposer } from '@/components/treinos/program-composer'

const SPORTS = [
  { key: 'strength', label: 'Força', color: '#e8001c', icon: Dumbbell },
  { key: 'running', label: 'Corrida', color: '#ff6b00', icon: Footprints },
  { key: 'cycling', label: 'Ciclismo', color: '#0088ff', icon: Bike },
  { key: 'swimming', label: 'Natação', color: '#00b4d8', icon: Waves },
  { key: 'triathlon', label: 'Triathlon', color: '#8b5cf6', icon: ActIcon },
  { key: 'other', label: 'Outro', color: '#64748b', icon: ActIcon },
]
const sportInfo = (s: string) => SPORTS.find(x => x.key === s) ?? SPORTS[5]

export default function TreinosPage() {
  const [items, setItems] = useState<WorkoutLibraryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [modal, setModal] = useState<{ edit?: WorkoutLibraryRow } | null>(null)
  const [busca, setBusca] = useState('')
  // Grade ou lista — fica guardado, senão o treinador reescolhe a cada visita.
  const [modo, setModo] = useState<'grade' | 'lista'>('grade')
  useEffect(() => {
    try { const m = localStorage.getItem('saab:biblioteca-modo'); if (m === 'lista' || m === 'grade') setModo(m) } catch { /* modo privado */ }
  }, [])
  function trocarModo(m: 'grade' | 'lista') {
    setModo(m)
    try { localStorage.setItem('saab:biblioteca-modo', m) } catch { /* modo privado */ }
  }
  const [view, setView] = useState<'biblioteca' | 'programas'>('biblioteca')

  async function load() { setLoading(true); setItems(await getWorkoutLibrary()); setLoading(false) }
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return items.filter(i =>
      (filter === 'all' || i.sport === filter) &&
      (!termo || i.title.toLowerCase().includes(termo) || (i.description ?? '').toLowerCase().includes(termo)))
  }, [items, filter, busca])
  const countBySport = useMemo(() => {
    const m: Record<string, number> = {}; for (const i of items) m[i.sport] = (m[i.sport] ?? 0) + 1; return m
  }, [items])
  // Números do topo: o acervo inteiro, não o que está filtrado.
  const totalHoras = useMemo(() => items.reduce((s, i) => s + (i.duration_min ?? 0), 0) / 60, [items])
  const estruturados = useMemo(() => items.filter(i => i.structure?.length).length, [items])

  async function remove(id: string) { await deleteLibraryWorkout(id); load() }

  return (
    <div>
      <Topbar title="Treinos" subtitle="Biblioteca de treinos e planos de treinamento" />
      {/* Seletor Biblioteca / Planos */}
      <div className="px-4 md:px-6 pt-4">
        <div className="flex gap-1 p-1 rounded-xl bg-secondary w-fit">
          <button onClick={() => setView('biblioteca')} className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-colors" style={view === 'biblioteca' ? { background: '#e8001c', color: '#fff' } : { color: 'var(--muted-foreground)' }}>
            <Library className="w-3.5 h-3.5" /> Biblioteca
          </button>
          <button onClick={() => setView('programas')} className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-colors" style={view === 'programas' ? { background: '#e8001c', color: '#fff' } : { color: 'var(--muted-foreground)' }}>
            <CalendarDays className="w-3.5 h-3.5" /> Planos de treinamento
          </button>
        </div>
      </div>

      {view === 'programas' ? <ProgramComposer /> : (
      <div className="p-4 md:p-6 space-y-5">
        {/* Panorama do acervo */}
        {items.length > 0 && (
          <div className="rounded-2xl p-4 md:p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
              <div>
                <p className="text-3xl font-black text-foreground leading-none tabular-nums">{items.length}</p>
                <p className="text-[11px] text-muted-foreground mt-1">treinos na biblioteca</p>
              </div>
              <div>
                <p className="text-3xl font-black text-foreground leading-none tabular-nums">{totalHoras.toFixed(0)}h</p>
                <p className="text-[11px] text-muted-foreground mt-1">de treino acumulado</p>
              </div>
              <div>
                <p className="text-3xl font-black leading-none tabular-nums" style={{ color: '#e8001c' }}>{estruturados}</p>
                <p className="text-[11px] text-muted-foreground mt-1">com passo a passo</p>
              </div>
            </div>
            {/* Barra de composição por modalidade */}
            <div className="flex h-1.5 rounded-full overflow-hidden gap-px mt-4">
              {SPORTS.filter(s => countBySport[s.key]).map(s => (
                <div key={s.key} title={`${s.label}: ${countBySport[s.key]}`}
                  style={{ width: `${(countBySport[s.key] / items.length) * 100}%`, background: s.color }} />
              ))}
            </div>
          </div>
        )}

        {/* Busca + ações */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar treino pelo nome…"
              className="w-full pl-9 pr-9 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary" />
            {busca && (
              <button onClick={() => setBusca('')} aria-label="Limpar busca"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            )}
          </div>
          <button onClick={() => setModal({})} className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90">
            <Plus className="w-4 h-4" /> Novo treino
          </button>
        </div>

        {/* Filtro por modalidade + modo de exibição */}
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div className="flex flex-wrap gap-1.5">
            <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} label={`Todos (${items.length})`} />
            {SPORTS.filter(s => countBySport[s.key]).map(s => (
              <FilterChip key={s.key} active={filter === s.key} onClick={() => setFilter(s.key)} label={`${s.label} (${countBySport[s.key]})`} color={s.color} />
            ))}
          </div>
          <div className="flex gap-1 p-1 rounded-lg bg-secondary shrink-0">
            <button onClick={() => trocarModo('grade')} aria-label="Ver em grade" title="Grade"
              className="p-1.5 rounded-md transition-colors"
              style={modo === 'grade' ? { background: 'var(--card)', color: 'var(--foreground)' } : { color: 'var(--muted-foreground)' }}>
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button onClick={() => trocarModo('lista')} aria-label="Ver em lista" title="Lista"
              className="p-1.5 rounded-md transition-colors"
              style={modo === 'lista' ? { background: 'var(--card)', color: 'var(--foreground)' } : { color: 'var(--muted-foreground)' }}>
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Library className="w-10 h-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-semibold text-foreground">Nenhum treino na biblioteca</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4 max-w-sm">
              Cadastre um treino aqui, ou carregue um plano em <b className="text-foreground">Planos de treinamento</b> — os treinos dele vêm para cá automaticamente.
            </p>
            <button onClick={() => setModal({})} className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg">Criar treino</button>
          </div>
        ) : (
          modo === 'lista' ? (
            <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              {filtered.map((w, i) => (
                <WorkoutRow key={w.id} w={w} primeiro={i === 0} onEdit={() => setModal({ edit: w })} onRemove={() => remove(w.id)} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filtered.map(w => (
                <WorkoutCard key={w.id} w={w} onEdit={() => setModal({ edit: w })} onRemove={() => remove(w.id)} />
              ))}
            </div>
          )
        )}
      </div>
      )}

      {modal && <LibraryModal edit={modal.edit} onClose={() => setModal(null)} onSaved={() => { setModal(null); load() }} />}
    </div>
  )
}

/**
 * Card de um treino da biblioteca.
 *
 * A barra de estrutura sobe para o topo e ganha altura: ela é a assinatura
 * visual do treino — dá para reconhecer um intervalado de um longão de relance,
 * sem ler o nome. As ações só aparecem no hover, para o cartão respirar.
 */
function WorkoutCard({ w, onEdit, onRemove }: { w: WorkoutLibraryRow; onEdit: () => void; onRemove: () => void }) {
  const info = sportInfo(w.sport)
  const temEstrutura = Boolean(w.structure?.length)
  const passos = w.structure?.length ?? 0

  return (
    <div className="group relative rounded-2xl overflow-hidden transition-all hover:-translate-y-0.5"
      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
      {/* Assinatura visual: a forma do treino */}
      {temEstrutura
        ? <StructureBar structure={w.structure!} height={6} />
        : <div className="h-1.5" style={{ background: info.color }} />}

      <div className="p-4">
        <div className="flex items-start gap-2.5">
          <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: info.color + '1a' }}>
            <info.icon className="w-4 h-4" style={{ color: info.color }} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-foreground leading-tight">{w.title}</p>
            <p className="text-[10px] font-bold uppercase tracking-wide mt-0.5" style={{ color: info.color }}>{info.label}</p>
          </div>

          {/* Ações discretas, visíveis ao passar o mouse (sempre no toque) */}
          <div className="flex gap-0.5 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
            {temEstrutura && (
              <button onClick={() => downloadFile(`${slugify(w.title)}.tcx`, buildWorkoutTCX(w.title, w.sport, w.structure!))}
                title="Baixar para relógio (.TCX)" className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground"><Watch className="w-3.5 h-3.5" /></button>
            )}
            <button onClick={onEdit} title="Editar" className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground"><Pencil className="w-3.5 h-3.5" /></button>
            <button onClick={onRemove} title="Excluir" className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        </div>

        {/* Números numa fileira só */}
        {(w.duration_min || w.tss || temEstrutura) && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground mt-2.5 tabular-nums">
            {w.duration_min ? <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{w.duration_min} min</span> : null}
            {w.tss ? <span className="flex items-center gap-1"><Flame className="w-3 h-3" />{w.tss} TSS</span> : null}
            {temEstrutura ? <span className="flex items-center gap-1"><ListChecks className="w-3 h-3" />{passos} {passos === 1 ? 'bloco' : 'blocos'}</span> : null}
          </div>
        )}

        {w.exercises && w.exercises.length > 0 && (
          <ul className="mt-2.5 space-y-0.5">
            {w.exercises.slice(0, 4).map((e, i) => (
              <li key={i} className="text-[11px] text-muted-foreground flex justify-between gap-2">
                <span className="truncate">{e.name}</span>
                <span className="shrink-0 tabular-nums">{e.sets}×{e.reps}</span>
              </li>
            ))}
            {w.exercises.length > 4 && <li className="text-[10px] text-muted-foreground/70">+{w.exercises.length - 4} exercícios</li>}
          </ul>
        )}

        {w.description && !(w.exercises?.length) && (
          <p className="text-[11px] text-muted-foreground/80 mt-2 line-clamp-2 leading-relaxed">{w.description}</p>
        )}
      </div>
    </div>
  )
}

/**
 * Uma linha da visão em lista: densa, para bater o olho em muitos treinos.
 *
 * A grade mostra bem cada treino, mas com 25 itens vindos de um plano o
 * treinador quer comparar duração e carga de relance — e aí a lista ganha.
 */
function WorkoutRow({ w, primeiro, onEdit, onRemove }: {
  w: WorkoutLibraryRow; primeiro: boolean; onEdit: () => void; onRemove: () => void
}) {
  const info = sportInfo(w.sport)
  const temEstrutura = Boolean(w.structure?.length)

  return (
    <div className="group flex items-center gap-3 px-3 md:px-4 py-2.5 hover:bg-secondary/40 transition-colors"
      style={primeiro ? undefined : { borderTop: '1px solid var(--border)' }}>
      <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: info.color + '1a' }}>
        <info.icon className="w-3.5 h-3.5" style={{ color: info.color }} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold text-foreground truncate">{w.title}</p>
        {w.description && <p className="text-[11px] text-muted-foreground truncate">{w.description}</p>}
      </div>

      {/* Assinatura do treino, só onde há largura para ela */}
      {temEstrutura && <div className="hidden lg:block w-28 shrink-0"><StructureBar structure={w.structure!} height={6} /></div>}

      <div className="hidden sm:flex items-center gap-3 text-[11px] text-muted-foreground tabular-nums shrink-0 w-32 justify-end">
        {w.duration_min ? <span>{w.duration_min} min</span> : null}
        {w.tss ? <span>{w.tss} TSS</span> : null}
      </div>

      <div className="flex gap-0.5 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
        {temEstrutura && (
          <button onClick={() => downloadFile(`${slugify(w.title)}.tcx`, buildWorkoutTCX(w.title, w.sport, w.structure!))}
            title="Baixar para relógio (.TCX)" className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground"><Watch className="w-3.5 h-3.5" /></button>
        )}
        <button onClick={onEdit} title="Editar" className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground"><Pencil className="w-3.5 h-3.5" /></button>
        <button onClick={onRemove} title="Excluir" className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  )
}

function FilterChip({ active, onClick, label, color }: { active: boolean; onClick: () => void; label: string; color?: string }) {
  return (
    <button onClick={onClick} className="px-3 py-1.5 text-xs font-bold rounded-lg transition-colors"
      style={active ? { background: color ?? '#7c3aed', color: '#fff' } : { background: 'var(--secondary)', color: 'var(--muted-foreground)' }}>{label}</button>
  )
}

function LibraryModal({ edit, onClose, onSaved }: { edit?: WorkoutLibraryRow; onClose: () => void; onSaved: () => void }) {
  const [sport, setSport] = useState(edit?.sport ?? 'strength')
  const [title, setTitle] = useState(edit?.title ?? '')
  const [desc, setDesc] = useState(edit?.description ?? '')
  const [dur, setDur] = useState(edit?.duration_min?.toString() ?? '')
  const [tss, setTss] = useState(edit?.tss?.toString() ?? '')
  const [structured, setStructured] = useState(!!edit?.structure && edit.structure.length > 0)
  const [structure, setStructure] = useState<WorkoutStructure>(edit?.structure ?? [])
  const [exercises, setExercises] = useState<LibExercise[]>(edit?.exercises ?? [{ name: '', sets: '3', reps: '10', load: '' }])
  const [saving, setSaving] = useState(false)

  const isStrength = sport === 'strength'
  const est = structured ? estimateStructure(structure) : null

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const useStruct = !isStrength && structured && structure.length > 0
    const cleanEx = exercises.filter(x => x.name.trim())
    const payload: Omit<WorkoutLibraryRow, 'id'> = {
      sport, title: title.trim(),
      description: desc.trim() || (useStruct ? structureSummary(structure) : '') || null,
      duration_min: useStruct ? est!.min : (dur ? parseInt(dur) : null),
      tss: useStruct ? est!.tss : (tss ? parseInt(tss) : null),
      structure: useStruct ? structure : null,
      exercises: isStrength ? cleanEx : null,
    }
    const ok = edit ? await updateLibraryWorkout(edit.id, payload) : await createLibraryWorkout(payload)
    setSaving(false)
    if (ok) onSaved()
  }

  const cls = 'w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary'
  function setEx(i: number, patch: Partial<LibExercise>) { setExercises(a => a.map((x, j) => j === i ? { ...x, ...patch } : x)) }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="text-sm font-bold text-foreground">{edit ? 'Editar treino' : 'Novo treino'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={save} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Modalidade *</label>
            <div className="grid grid-cols-3 gap-1.5">
              {SPORTS.map(s => (
                <button type="button" key={s.key} onClick={() => setSport(s.key)}
                  className="flex flex-col items-center gap-1 py-2 rounded-lg text-[10px] font-bold transition-colors"
                  style={sport === s.key ? { background: s.color + '22', border: `1.5px solid ${s.color}`, color: s.color } : { background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--muted-foreground)' }}>
                  <s.icon className="w-4 h-4" />{s.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Título *</label>
            <input required value={title} onChange={e => setTitle(e.target.value)} placeholder={isStrength ? 'ex: Força — inferiores A' : 'ex: Intervalado 5x1km Z4'} className={cls} />
          </div>

          {isStrength ? (
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Exercícios</label>
              <div className="space-y-2">
                {exercises.map((ex, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <input value={ex.name} onChange={e => setEx(i, { name: e.target.value })} placeholder="Exercício" className={cls + ' flex-1'} />
                    <input value={ex.sets} onChange={e => setEx(i, { sets: e.target.value })} placeholder="3" className={cls + ' w-12 text-center px-1'} />
                    <span className="text-muted-foreground text-xs">×</span>
                    <input value={ex.reps} onChange={e => setEx(i, { reps: e.target.value })} placeholder="10" className={cls + ' w-14 text-center px-1'} />
                    <input value={ex.load} onChange={e => setEx(i, { load: e.target.value })} placeholder="carga" className={cls + ' w-16 px-1'} />
                    <button type="button" onClick={() => setExercises(a => a.filter((_, j) => j !== i))} className="p-1 text-muted-foreground hover:text-red-400"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => setExercises(a => [...a, { name: '', sets: '3', reps: '10', load: '' }])}
                className="mt-2 text-[11px] font-bold text-muted-foreground hover:text-foreground flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> exercício</button>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div><label className="block text-xs font-medium text-foreground mb-1.5">Duração (min)</label><input type="number" min="0" value={dur} onChange={e => setDur(e.target.value)} placeholder="45" className={cls} /></div>
                <div><label className="block text-xs font-medium text-foreground mb-1.5">TSS (opcional)</label><input type="number" min="0" value={tss} onChange={e => setTss(e.target.value)} placeholder="30" className={cls} /></div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: 'var(--panel)', border: '1px solid var(--panel-border)' }}>
                <label className="text-xs font-semibold text-foreground">Treino estruturado (passo a passo)</label>
                <button type="button" onClick={() => setStructured(v => !v)} className="relative w-10 h-5 rounded-full transition-colors" style={{ background: structured ? '#7c3aed' : 'var(--border)' }}>
                  <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all" style={{ left: structured ? '22px' : '2px' }} />
                </button>
              </div>
              {structured ? <StructuredBuilder value={structure} onChange={setStructure} /> : (
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs font-medium text-foreground mb-1.5">Duração (min)</label><input type="number" min="0" value={dur} onChange={e => setDur(e.target.value)} placeholder="60" className={cls} /></div>
                  <div><label className="block text-xs font-medium text-foreground mb-1.5">TSS alvo</label><input type="number" min="0" value={tss} onChange={e => setTss(e.target.value)} placeholder="70" className={cls} /></div>
                </div>
              )}
              {structured && structure.length > 0 && (
                <div className="rounded-lg p-3" style={{ background: 'var(--panel)', border: '1px solid var(--panel-border)' }}>
                  <p className="text-[11px] font-black text-muted-foreground uppercase tracking-wide mb-2">Passos (para o relógio)</p>
                  <WorkoutSteps title={title || 'Treino'} sport={sport} structure={structure} compact />
                </div>
              )}
            </>
          )}

          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">{isStrength ? 'Observações' : 'Observações (opcional)'}</label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} placeholder="notas…" className={cls + ' resize-none'} />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-border text-sm font-semibold text-muted-foreground rounded-lg hover:bg-secondary">Cancelar</button>
            <button type="submit" disabled={saving || !title.trim()} className="flex-1 py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-60 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}{saving ? 'Salvando...' : 'Salvar treino'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
