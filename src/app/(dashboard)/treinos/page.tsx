'use client'

import { useEffect, useMemo, useState } from 'react'
import { Topbar } from '@/components/layout/topbar'
import {
  getWorkoutLibrary, createLibraryWorkout, updateLibraryWorkout, deleteLibraryWorkout, bulkCreateLibraryWorkouts,
  type WorkoutLibraryRow, type LibExercise,
} from '@/lib/supabase/queries'
import { StructuredBuilder, StructureBar } from '@/components/athlete/structured-builder'
import { WorkoutSteps } from '@/components/athlete/workout-steps'
import { estimateStructure, structureSummary, type WorkoutStructure } from '@/lib/workout-structure'
import { buildWorkoutTCX, downloadFile, slugify } from '@/lib/workout-export'
import { buildSampleLibraryRows, SAMPLE_COUNT } from '@/lib/sample-workouts'
import {
  Plus, X, Loader2, Trash2, Pencil, Dumbbell, Bike, Footprints, Waves,
  Activity as ActIcon, Clock, Flame, Library, Watch, Sparkles,
} from 'lucide-react'

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
  const [seeding, setSeeding] = useState(false)

  async function load() { setLoading(true); setItems(await getWorkoutLibrary()); setLoading(false) }
  useEffect(() => { load() }, [])

  async function addSamples() {
    if (!confirm(`Adicionar ${SAMPLE_COUNT} treinos de exemplo (corrida, bike e força) à sua biblioteca?`)) return
    setSeeding(true)
    await bulkCreateLibraryWorkouts(buildSampleLibraryRows())
    setSeeding(false)
    load()
  }

  const filtered = useMemo(() => filter === 'all' ? items : items.filter(i => i.sport === filter), [items, filter])
  const countBySport = useMemo(() => {
    const m: Record<string, number> = {}; for (const i of items) m[i.sport] = (m[i.sport] ?? 0) + 1; return m
  }, [items])

  async function remove(id: string) { await deleteLibraryWorkout(id); load() }

  return (
    <div>
      <Topbar title="Treinos" subtitle="Biblioteca central — força, corrida, bike e mais" />
      <div className="p-4 md:p-6 space-y-5">
        {/* Ações + filtro */}
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div className="flex flex-wrap gap-1.5">
            <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} label={`Todos (${items.length})`} />
            {SPORTS.filter(s => countBySport[s.key]).map(s => (
              <FilterChip key={s.key} active={filter === s.key} onClick={() => setFilter(s.key)} label={`${s.label} (${countBySport[s.key]})`} color={s.color} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={addSamples} disabled={seeding} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border border-border text-foreground hover:bg-secondary disabled:opacity-60">
              {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Adicionar exemplos
            </button>
            <button onClick={() => setModal({})} className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90">
              <Plus className="w-4 h-4" /> Novo treino
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Library className="w-10 h-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-semibold text-foreground">Nenhum treino na biblioteca</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4 max-w-xs">Cadastre seus treinos de força, corrida e bike para reutilizar no calendário dos atletas.</p>
            <div className="flex gap-2">
              <button onClick={addSamples} disabled={seeding} className="px-4 py-2 border border-border text-foreground text-sm font-semibold rounded-lg flex items-center gap-2">
                {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Adicionar exemplos de mercado
              </button>
              <button onClick={() => setModal({})} className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg">Criar do zero</button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map(w => {
              const info = sportInfo(w.sport)
              return (
                <div key={w.id} className="rounded-xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)', borderLeft: `3px solid ${info.color}` }}>
                  <div className="flex items-start gap-2">
                    <info.icon className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: info.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground">{w.title}</p>
                      <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: info.color }}>{info.label}</p>
                    </div>
                    {w.structure && w.structure.length > 0 && (
                      <button onClick={() => downloadFile(`${slugify(w.title)}.tcx`, buildWorkoutTCX(w.title, w.sport, w.structure!))}
                        title="Baixar para relógio (.TCX)" className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground"><Watch className="w-3.5 h-3.5" /></button>
                    )}
                    <button onClick={() => setModal({ edit: w })} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => remove(w.id)} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>

                  {(w.duration_min || w.tss) && (
                    <div className="flex gap-3 text-[11px] text-muted-foreground mt-2">
                      {w.duration_min ? <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{w.duration_min}min</span> : null}
                      {w.tss ? <span className="flex items-center gap-1"><Flame className="w-3 h-3" />{w.tss} TSS</span> : null}
                    </div>
                  )}
                  {w.structure && w.structure.length > 0 && <div className="mt-2"><StructureBar structure={w.structure} height={8} /></div>}
                  {w.exercises && w.exercises.length > 0 && (
                    <ul className="mt-2 space-y-0.5">
                      {w.exercises.slice(0, 5).map((e, i) => (
                        <li key={i} className="text-[11px] text-muted-foreground flex justify-between gap-2"><span className="truncate">{e.name}</span><span className="flex-shrink-0">{e.sets}×{e.reps}{e.load ? ` · ${e.load}` : ''}</span></li>
                      ))}
                      {w.exercises.length > 5 && <li className="text-[10px] text-muted-foreground/70">+{w.exercises.length - 5} exercícios</li>}
                    </ul>
                  )}
                  {w.description && !(w.structure?.length) && !(w.exercises?.length) && <p className="text-[11px] text-muted-foreground mt-2 line-clamp-2">{w.description}</p>}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {modal && <LibraryModal edit={modal.edit} onClose={() => setModal(null)} onSaved={() => { setModal(null); load() }} />}
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
