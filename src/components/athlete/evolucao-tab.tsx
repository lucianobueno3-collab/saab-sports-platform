'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getAthleteGoals, type GoalRow } from '@/lib/supabase/queries'
import { Plus, X, Target, CheckCircle2, Circle, XCircle } from 'lucide-react'

const CATEGORY_LABEL: Record<string, string> = {
  performance: 'Performance', health: 'Saúde', race: 'Prova', lifestyle: 'Estilo de Vida', body: 'Composição', other: 'Outro',
}
const CATEGORY_COLOR: Record<string, string> = {
  performance: '#60a5fa', health: '#4ade80', race: '#fbbf24', lifestyle: '#a78bfa', body: '#f97316', other: '#94a3b8',
}
const STATUS_CONFIG = {
  active: { label: 'Em andamento', icon: Circle, color: '#60a5fa' },
  achieved: { label: 'Conquistada', icon: CheckCircle2, color: '#4ade80' },
  cancelled: { label: 'Cancelada', icon: XCircle, color: '#ef4444' },
}

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
}

function ProgressBar({ current, target }: { current: number | null; target: number | null }) {
  if (!current || !target || target <= 0) return null
  const pct = Math.min((current / target) * 100, 100)
  return (
    <div className="mt-2">
      <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
        <span>Progresso</span>
        <span>{pct.toFixed(0)}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-border overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: '#60a5fa' }} />
      </div>
    </div>
  )
}

interface Props { athleteId: string }

export function EvolucaoTab({ athleteId }: Props) {
  const [goals, setGoals] = useState<GoalRow[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title: '', category: 'performance', target_date: '', target_value: '', target_unit: '', current_value: '', notes: '',
  })

  useEffect(() => { load() }, [athleteId])

  async function load() {
    setLoading(true)
    setGoals(await getAthleteGoals(athleteId))
    setLoading(false)
  }

  async function save() {
    if (!form.title) return
    setSaving(true)
    const sb = createClient()
    await sb.from('athlete_goals').insert({
      athlete_id: athleteId,
      title: form.title,
      category: form.category,
      target_date: form.target_date || null,
      target_value: form.target_value ? parseFloat(form.target_value) : null,
      target_unit: form.target_unit || null,
      current_value: form.current_value ? parseFloat(form.current_value) : null,
      notes: form.notes || null,
      status: 'active',
    })
    setSaving(false)
    setOpen(false)
    setForm({ title: '', category: 'performance', target_date: '', target_value: '', target_unit: '', current_value: '', notes: '' })
    load()
  }

  async function updateStatus(id: string, status: 'active' | 'achieved' | 'cancelled') {
    const sb = createClient()
    await sb.from('athlete_goals').update({ status }).eq('id', id)
    load()
  }

  async function updateCurrent(id: string, current_value: number) {
    const sb = createClient()
    await sb.from('athlete_goals').update({ current_value }).eq('id', id)
    load()
  }

  async function deleteGoal(id: string) {
    const sb = createClient()
    await sb.from('athlete_goals').delete().eq('id', id)
    load()
  }

  const active = goals.filter(g => g.status === 'active')
  const achieved = goals.filter(g => g.status === 'achieved')
  const cancelled = goals.filter(g => g.status === 'cancelled')

  if (loading) return <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">Carregando...</div>

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl p-3" style={{ background: '#60a5fa15', border: '1px solid #60a5fa30' }}>
            <Target className="w-5 h-5 text-[#60a5fa]" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Metas e Evolução</h3>
            <p className="text-xs text-muted-foreground">{active.length} ativa{active.length !== 1 ? 's' : ''} · {achieved.length} conquistada{achieved.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <button onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
          style={{ background: '#60a5fa15', border: '1px solid #60a5fa40', color: '#60a5fa' }}>
          <Plus className="w-3 h-3" /> Nova Meta
        </button>
      </div>

      {/* Active goals */}
      {active.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Em Andamento</h4>
          {active.map(goal => {
            const catColor = CATEGORY_COLOR[goal.category] ?? '#94a3b8'
            return (
              <div key={goal.id} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-bold text-foreground">{goal.title}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                        style={{ background: catColor + '20', color: catColor, border: `1px solid ${catColor}40` }}>
                        {CATEGORY_LABEL[goal.category] ?? goal.category}
                      </span>
                    </div>
                    {goal.target_date && (
                      <p className="text-[10px] text-muted-foreground mb-1">📅 Meta para: {fmtDate(goal.target_date)}</p>
                    )}
                    {(goal.target_value || goal.current_value) && (
                      <div className="flex items-center gap-3 text-xs mb-1">
                        {goal.current_value != null && (
                          <span className="text-foreground font-medium">{goal.current_value} {goal.target_unit}</span>
                        )}
                        {goal.target_value != null && (
                          <span className="text-muted-foreground">/ {goal.target_value} {goal.target_unit}</span>
                        )}
                      </div>
                    )}
                    <ProgressBar current={goal.current_value} target={goal.target_value} />
                    {goal.notes && <p className="text-[10px] text-muted-foreground/60 mt-2 italic">{goal.notes}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button onClick={() => updateStatus(goal.id, 'achieved')}
                      className="text-[9px] px-2 py-1 rounded font-bold transition-colors"
                      style={{ background: '#4ade8015', border: '1px solid #4ade8040', color: '#4ade80' }}
                      title="Marcar como conquistada">
                      ✓
                    </button>
                    <button onClick={() => updateStatus(goal.id, 'cancelled')}
                      className="text-[9px] px-2 py-1 rounded font-bold transition-colors"
                      style={{ background: '#ef444415', border: '1px solid #ef444440', color: '#ef4444' }}
                      title="Cancelar meta">
                      ✕
                    </button>
                    <button onClick={() => deleteGoal(goal.id)}><X className="w-3.5 h-3.5 text-muted-foreground/30 hover:text-muted-foreground/70" /></button>
                  </div>
                </div>

                {/* Update current value inline */}
                {goal.target_value != null && (
                  <div className="mt-3 pt-3 border-t border-border/30 flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">Atualizar valor atual:</span>
                    <input
                      type="number"
                      defaultValue={goal.current_value ?? ''}
                      step="0.1"
                      className="w-20 px-2 py-1 bg-background border border-border rounded text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
                      onBlur={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) updateCurrent(goal.id, v) }}
                    />
                    <span className="text-[10px] text-muted-foreground">{goal.target_unit}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Achieved */}
      {achieved.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#4ade80]" /> Conquistadas
          </h4>
          {achieved.map(goal => (
            <div key={goal.id} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: '#4ade8008', border: '1px solid #4ade8025' }}>
              <CheckCircle2 className="w-4 h-4 text-[#4ade80] flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground">{goal.title}</p>
                {goal.target_date && <p className="text-[10px] text-muted-foreground">{fmtDate(goal.target_date)}</p>}
              </div>
              <button onClick={() => updateStatus(goal.id, 'active')} className="text-[9px] text-muted-foreground/50 hover:text-muted-foreground transition-colors">reabrir</button>
              <button onClick={() => deleteGoal(goal.id)}><X className="w-3 h-3 text-muted-foreground/30 hover:text-muted-foreground/70" /></button>
            </div>
          ))}
        </div>
      )}

      {goals.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Target className="w-8 h-8 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma meta cadastrada</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Defina objetivos mensuráveis para acompanhar a evolução</p>
        </div>
      )}

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold">Nova Meta</h3>
              <button onClick={() => setOpen(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Título da Meta *</label>
                <input value={form.title} onChange={e => setForm(v => ({ ...v, title: e.target.value }))}
                  placeholder="ex: Baixar FTP para 280W, Completar Ironman..." className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Categoria</label>
                  <select value={form.category} onChange={e => setForm(v => ({ ...v, category: e.target.value }))} className={inputCls}>
                    {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Data alvo</label>
                  <input type="date" value={form.target_date} onChange={e => setForm(v => ({ ...v, target_date: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Valor alvo</label>
                  <input type="number" step="0.1" value={form.target_value} onChange={e => setForm(v => ({ ...v, target_value: e.target.value }))}
                    placeholder="ex: 280" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Unidade</label>
                  <input value={form.target_unit} onChange={e => setForm(v => ({ ...v, target_unit: e.target.value }))}
                    placeholder="ex: W, kg, min/km" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Valor atual</label>
                  <input type="number" step="0.1" value={form.current_value} onChange={e => setForm(v => ({ ...v, current_value: e.target.value }))}
                    placeholder="ex: 250" className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Observações</label>
                <textarea value={form.notes} onChange={e => setForm(v => ({ ...v, notes: e.target.value }))}
                  rows={2} placeholder="Detalhes, estratégia, contexto..." className={inputCls + ' resize-none'} />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={save} disabled={saving || !form.title}
                className="flex-1 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg disabled:opacity-50">
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
              <button onClick={() => setOpen(false)} className="px-4 py-2.5 border border-border text-sm text-muted-foreground rounded-lg hover:bg-secondary">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const inputCls = 'w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary'
