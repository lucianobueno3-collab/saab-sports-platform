'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  getStrengthPrograms, getStrengthPRs, getStrengthLogs,
  type StrengthProgramRow, type StrengthPRRow, type StrengthLogRow,
} from '@/lib/supabase/queries'
import { todayLocalISO } from '@/lib/dates'
import {
  STRENGTH_TEMPLATES, GOAL_LABEL, GOAL_COLOR, estimateOneRM,
  type StrengthTemplate, type StrengthDay,
} from '@/lib/strength-templates'
import {
  Plus, X, Dumbbell, Info, Trophy, Calculator, Trash2, ChevronDown,
  Clock, Repeat, Gauge, LineChart as LineChartIcon, ClipboardCheck,
} from 'lucide-react'
import { TrendChart } from './trend-chart'

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
}

interface Props { athleteId: string; weightKg: number | null }

export function ForcaTab({ athleteId, weightKg }: Props) {
  const [programs, setPrograms] = useState<StrengthProgramRow[] | null>([])
  const [prs, setPrs] = useState<StrengthPRRow[]>([])
  const [logs, setLogs] = useState<StrengthLogRow[]>([])
  const [migrationMissing, setMigrationMissing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [openProgram, setOpenProgram] = useState<string | null>(null)

  const [pickerOpen, setPickerOpen] = useState(false)
  const [prOpen, setPrOpen] = useState(false)

  useEffect(() => { load() }, [athleteId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    const [progs, records, sessionLogs] = await Promise.all([
      getStrengthPrograms(athleteId), getStrengthPRs(athleteId), getStrengthLogs(athleteId),
    ])
    setMigrationMissing(progs === null)
    setPrograms(progs)
    setPrs(records)
    setLogs(sessionLogs ?? [])
  }

  async function createFromTemplate(t: StrengthTemplate) {
    setSaving(true)
    const sb = createClient()
    await sb.from('strength_programs').insert({
      athlete_id: athleteId,
      name: t.name,
      template_key: t.key,
      goal: t.goal,
      phase: 'base',
      active: true,
      structure: t.structure,
      notes: t.focus,
    })
    setSaving(false)
    setPickerOpen(false)
    load()
  }

  async function deleteProgram(id: string) {
    if (!window.confirm('Excluir este programa de força?')) return
    const sb = createClient()
    await sb.from('strength_programs').delete().eq('id', id)
    load()
  }

  async function toggleActive(p: StrengthProgramRow) {
    const sb = createClient()
    await sb.from('strength_programs').update({ active: !p.active }).eq('id', p.id)
    load()
  }

  if (migrationMissing) {
    return (
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl" style={{ background: '#ffa80012', border: '1px solid #ffa80045' }}>
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#ffa800' }} />
        <p className="text-[11px]" style={{ color: '#ffa800' }}>
          <strong>Treino de força aguardando o banco:</strong> execute a migração <strong>014_strength_training.sql</strong> no SQL Editor do Supabase para ativar programas e recordes de 1RM.
        </p>
      </div>
    )
  }

  const progs = programs ?? []

  return (
    <div className="space-y-4">
      {/* Ações */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Dumbbell className="w-4 h-4 text-[#e8001c]" />
          <h3 className="text-sm font-bold text-foreground">Treino de força</h3>
          <span className="text-[10px] text-muted-foreground">{progs.length} programa{progs.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setPrOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
            style={{ background: '#ffa80015', border: '1px solid #ffa80045', color: '#ffa800' }}>
            <Trophy className="w-3 h-3" /> Registrar 1RM
          </button>
          <button onClick={() => setPickerOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-primary text-white">
            <Plus className="w-3 h-3" /> Novo programa
          </button>
        </div>
      </div>

      {/* Recordes de força (1RM) */}
      {prs.length > 0 && <PRPanel prs={prs} weightKg={weightKg} onDelete={async (id) => {
        const sb = createClient(); await sb.from('strength_prs').delete().eq('id', id); load()
      }} />}

      {/* Aderência — treinos registrados pelo atleta no portal */}
      {logs.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-border/50">
            <ClipboardCheck className="w-4 h-4 text-[#00d084]" />
            <h4 className="text-xs font-bold text-foreground">Treinos registrados pelo atleta</h4>
            <span className="text-[10px] text-muted-foreground">via portal</span>
          </div>
          <div className="divide-y divide-border/40">
            {logs.slice(0, 8).map(l => {
              const doneN = l.completed.filter(e => e.done).length
              const withLoad = l.completed.filter(e => e.done && e.load)
              return (
                <div key={l.id} className="px-5 py-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-foreground">{l.day_label ?? 'Treino'}</span>
                    <span className="text-[10px] text-muted-foreground">{fmtDate(l.performed_at)}</span>
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded uppercase ml-auto" style={{ background: '#00d08420', color: '#00d084' }}>{doneN} exercícios</span>
                    {l.rpe != null && <span className="text-[9px] font-black px-1.5 py-0.5 rounded uppercase" style={{ background: '#ffa80020', color: '#ffa800' }}>RPE {l.rpe}</span>}
                  </div>
                  {withLoad.length > 0 && (
                    <p className="text-[10px] text-muted-foreground mt-1">{withLoad.map(e => `${e.name}: ${e.load}`).join(' · ')}</p>
                  )}
                  {l.notes && <p className="text-[10px] text-muted-foreground/80 mt-1 italic">{l.notes}</p>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Programas */}
      {progs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Dumbbell className="w-10 h-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-semibold text-foreground">Nenhum programa de força</p>
          <p className="text-xs text-muted-foreground mt-1 mb-4 max-w-xs">Comece por um template de mercado e ajuste conforme a fase do atleta</p>
          <button onClick={() => setPickerOpen(true)} className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg">Escolher template</button>
        </div>
      ) : (
        <div className="space-y-3">
          {progs.map(p => {
            const color = p.goal ? GOAL_COLOR[p.goal as keyof typeof GOAL_COLOR] ?? '#e8001c' : '#e8001c'
            const isOpen = openProgram === p.id
            const totalExercises = p.structure.reduce((s, d) => s + d.exercises.length, 0)
            return (
              <div key={p.id} className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                <div className="flex items-center gap-3 px-5 py-4">
                  <div className="w-1 self-stretch rounded-full" style={{ background: color }} />
                  <button onClick={() => setOpenProgram(isOpen ? null : p.id)} className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-foreground">{p.name}</span>
                      {p.active && <span className="text-[9px] font-black px-1.5 py-0.5 rounded uppercase" style={{ background: '#00d08420', color: '#00d084' }}>Ativo</span>}
                      {p.goal && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase" style={{ background: color + '20', color }}>{GOAL_LABEL[p.goal as keyof typeof GOAL_LABEL] ?? p.goal}</span>}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{p.structure.length} dia{p.structure.length !== 1 ? 's' : ''} · {totalExercises} exercícios · criado em {fmtDate(p.created_at.slice(0, 10))}</p>
                  </button>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => toggleActive(p)} title={p.active ? 'Arquivar' : 'Ativar'}
                      className="text-[10px] font-semibold px-2 py-1 rounded" style={{ color: 'var(--muted-foreground)' }}>
                      {p.active ? 'Arquivar' : 'Ativar'}
                    </button>
                    <button onClick={() => deleteProgram(p.id)}><Trash2 className="w-3.5 h-3.5 text-muted-foreground/40 hover:text-[#e8001c]" /></button>
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </div>
                </div>
                {isOpen && (
                  <div className="px-5 pb-5 space-y-4 border-t border-border/40 pt-4">
                    {p.notes && <p className="text-[11px] text-muted-foreground italic">{p.notes}</p>}
                    {p.structure.map((day) => <DayBlock key={day.day} day={day} color={color} />)}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {pickerOpen && <TemplatePicker saving={saving} onPick={createFromTemplate} onClose={() => setPickerOpen(false)} />}
      {prOpen && <PRModal athleteId={athleteId} onClose={() => setPrOpen(false)} onSaved={() => { setPrOpen(false); load() }} />}
    </div>
  )
}

function DayBlock({ day, color }: { day: StrengthDay; color: string }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black flex-shrink-0" style={{ background: color + '20', color }}>{day.day}</span>
        <p className="text-xs font-bold text-foreground">{day.label}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]" style={{ minWidth: 440 }}>
          <thead>
            <tr className="text-muted-foreground text-[9px] uppercase tracking-wider border-b border-border/40">
              <th className="text-left py-1.5 font-bold">Exercício</th>
              <th className="text-center px-2 font-bold"><Repeat className="w-3 h-3 inline" /> Séries×Reps</th>
              <th className="text-center px-2 font-bold"><Gauge className="w-3 h-3 inline" /> Carga</th>
              <th className="text-center px-2 font-bold"><Clock className="w-3 h-3 inline" /> Desc.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {day.exercises.map((ex, i) => (
              <tr key={i}>
                <td className="py-2 pr-2">
                  <p className="font-semibold text-foreground">{ex.name}</p>
                  <p className="text-[9px] text-muted-foreground">{ex.muscle}{ex.notes ? ` · ${ex.notes}` : ''}</p>
                </td>
                <td className="text-center px-2 font-bold text-foreground whitespace-nowrap" style={{ fontVariantNumeric: 'tabular-nums' }}>{ex.sets} × {ex.reps}</td>
                <td className="text-center px-2 text-muted-foreground whitespace-nowrap">{ex.load ?? '—'}{ex.rpe ? ` · RPE ${ex.rpe}` : ''}</td>
                <td className="text-center px-2 text-muted-foreground whitespace-nowrap">{ex.rest_s ? `${ex.rest_s}s` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PRPanel({ prs, weightKg, onDelete }: { prs: StrengthPRRow[]; weightKg: number | null; onDelete: (id: string) => void }) {
  const [openEx, setOpenEx] = useState<string | null>(null)

  // agrupa por exercício; latest primeiro (prs já vem ordenado desc)
  const byExercise = useMemo(() => {
    const m = new Map<string, StrengthPRRow[]>()
    for (const r of prs) (m.get(r.exercise) ?? m.set(r.exercise, []).get(r.exercise)!).push(r)
    return m
  }, [prs])

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-border/50">
        <Trophy className="w-4 h-4 text-[#ffa800]" />
        <h4 className="text-xs font-bold text-foreground">Recordes de força (1RM)</h4>
        <span className="text-[10px] text-muted-foreground">toque para ver evolução</span>
      </div>
      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
        {[...byExercise.entries()].map(([exercise, rows]) => {
          const r = rows[0]
          const isOpen = openEx === exercise
          const best = Math.max(...rows.map(x => x.one_rm_kg))
          return (
            <div key={exercise} className={`rounded-lg p-3 relative group ${isOpen ? 'col-span-2 lg:col-span-2' : ''}`}
              style={{ background: 'var(--panel)', border: `1px solid ${isOpen ? '#ffa80055' : 'var(--panel-border)'}` }}>
              <button onClick={() => setOpenEx(isOpen ? null : exercise)} className="w-full text-left">
                <p className="text-[10px] font-bold text-foreground truncate pr-4">{r.exercise}</p>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-xl font-black text-foreground" style={{ fontVariantNumeric: 'tabular-nums' }}>{r.one_rm_kg}</span>
                  <span className="text-[10px] text-muted-foreground">kg</span>
                  {rows.length > 1 && <LineChartIcon className="w-3 h-3 ml-auto text-muted-foreground/50" />}
                </div>
                {weightKg ? <p className="text-[9px] text-[#ffa800] font-bold mt-0.5">{(r.one_rm_kg / weightKg).toFixed(2)}× peso corporal</p> : null}
                <p className="text-[9px] text-muted-foreground/60 mt-0.5">{fmtDate(r.measured_at)}{r.estimated ? ' · estimado' : ''}{rows.length > 1 ? ` · recorde ${best}kg` : ''}</p>
              </button>
              <button onClick={() => onDelete(r.id)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3 text-muted-foreground/50 hover:text-[#e8001c]" /></button>
              {isOpen && rows.length > 1 && (
                <div className="mt-2 pt-2 border-t border-border/30">
                  <TrendChart points={rows.map(x => ({ date: x.measured_at, value: x.one_rm_kg }))} color="#ffa800" unit="kg" height={120} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TemplatePicker({ saving, onPick, onClose }: { saving: boolean; onPick: (t: StrengthTemplate) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[88vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-bold text-foreground">Templates de mercado</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <p className="text-[11px] text-muted-foreground mb-4">Escolha um modelo pronto — você pode arquivar/excluir e criar quantos quiser por atleta.</p>
        <div className="space-y-2.5">
          {STRENGTH_TEMPLATES.map(t => {
            const color = GOAL_COLOR[t.goal]
            return (
              <button key={t.key} onClick={() => onPick(t)} disabled={saving}
                className="w-full text-left rounded-xl p-4 transition-all hover:border-[color:var(--tw)] disabled:opacity-50"
                style={{ background: 'var(--panel)', border: '1px solid var(--panel-border)' }}>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-sm font-bold text-foreground">{t.name}</span>
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded uppercase" style={{ background: color + '20', color }}>{GOAL_LABEL[t.goal]}</span>
                  <span className="text-[9px] text-muted-foreground">{t.frequency} · {t.level}</span>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">{t.focus}</p>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function PRModal({ athleteId, onClose, onSaved }: { athleteId: string; onClose: () => void; onSaved: () => void }) {
  const [mode, setMode] = useState<'direct' | 'estimate'>('estimate')
  const [exercise, setExercise] = useState('')
  const [oneRM, setOneRM] = useState('')
  const [load, setLoad] = useState('')
  const [reps, setReps] = useState('')
  const [date, setDate] = useState(todayLocalISO())
  const [saving, setSaving] = useState(false)

  const estimated = mode === 'estimate' && load && reps ? estimateOneRM(parseFloat(load), parseInt(reps)) : null
  const finalValue = mode === 'direct' ? parseFloat(oneRM) : estimated
  const inputCls = 'w-full px-3 py-2 text-xs rounded-lg bg-background border border-border text-foreground outline-none focus:border-[#e8001c]'
  const labelCls = 'block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1'

  const commonExercises = ['Agachamento livre', 'Levantamento terra', 'Supino reto', 'Desenvolvimento militar', 'Agachamento frontal', 'Barra fixa']

  async function save() {
    if (!exercise || !finalValue || isNaN(finalValue)) return
    setSaving(true)
    const sb = createClient()
    await sb.from('strength_prs').insert({
      athlete_id: athleteId, exercise, measured_at: date,
      one_rm_kg: finalValue, estimated: mode === 'estimate',
    })
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2"><Trophy className="w-4 h-4 text-[#ffa800]" /> Registrar 1RM</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Exercício</label>
            <input value={exercise} onChange={e => setExercise(e.target.value)} placeholder="Ex.: Agachamento livre" className={inputCls} list="pr-ex" />
            <datalist id="pr-ex">{commonExercises.map(e => <option key={e} value={e} />)}</datalist>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setMode('estimate')} className="flex-1 py-1.5 text-[11px] font-bold rounded-lg" style={mode === 'estimate' ? { background: '#e8001c', color: '#fff' } : { background: 'var(--secondary)', color: 'var(--muted-foreground)' }}>
              <Calculator className="w-3 h-3 inline mr-1" /> Estimar
            </button>
            <button onClick={() => setMode('direct')} className="flex-1 py-1.5 text-[11px] font-bold rounded-lg" style={mode === 'direct' ? { background: '#e8001c', color: '#fff' } : { background: 'var(--secondary)', color: 'var(--muted-foreground)' }}>
              Valor direto
            </button>
          </div>
          {mode === 'estimate' ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Carga (kg)</label>
                  <input type="number" value={load} onChange={e => setLoad(e.target.value)} placeholder="100" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Repetições</label>
                  <input type="number" value={reps} onChange={e => setReps(e.target.value)} placeholder="5" className={inputCls} />
                </div>
              </div>
              {estimated != null && (
                <div className="rounded-lg px-3 py-2 text-center" style={{ background: '#ffa80012', border: '1px solid #ffa80040' }}>
                  <span className="text-[10px] text-muted-foreground">1RM estimado (Epley): </span>
                  <span className="text-sm font-black text-[#ffa800]">{estimated} kg</span>
                </div>
              )}
            </>
          ) : (
            <div>
              <label className={labelCls}>1RM (kg)</label>
              <input type="number" value={oneRM} onChange={e => setOneRM(e.target.value)} placeholder="120" className={inputCls} />
            </div>
          )}
          <div>
            <label className={labelCls}>Data</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
          </div>
          <button onClick={save} disabled={saving || !exercise || !finalValue || isNaN(finalValue as number)}
            className="w-full py-2.5 text-xs font-bold rounded-lg bg-primary text-white disabled:opacity-50">
            {saving ? 'Salvando...' : 'Salvar recorde'}
          </button>
        </div>
      </div>
    </div>
  )
}
