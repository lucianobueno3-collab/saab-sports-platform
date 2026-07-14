'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getAthleteCompetitions, type CompetitionRow } from '@/lib/supabase/queries'
import { todayLocalISO, daysFromToday } from '@/lib/dates'
import { Plus, X, Trophy, Calendar, Target, CheckCircle2 } from 'lucide-react'

const PRIORITY_COLOR = { A: '#ef4444', B: '#fbbf24', C: '#60a5fa' }
const PRIORITY_LABEL = { A: 'Prioridade A', B: 'Prioridade B', C: 'Prioridade C' }

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
}

function fmtTime(minutes: number | null) {
  if (!minutes) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m}min`
}

function sportLabel(s: string | null) {
  if (!s) return ''
  const map: Record<string, string> = { running: 'Corrida', cycling: 'Ciclismo', swimming: 'Natação', triathlon: 'Triathlon', duathlon: 'Duathlon' }
  return map[s] ?? s
}

interface Props { athleteId: string }

export function ProvasTab({ athleteId }: Props) {
  const [competitions, setCompetitions] = useState<CompetitionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '', race_date: '', sport: '', distance_label: '', priority: 'B',
    goal_time_h: '', goal_time_m: '', result_time_h: '', result_time_m: '',
    result_position: '', dnf: false, notes: '',
  })

  useEffect(() => { load() }, [athleteId])

  async function load() {
    setLoading(true)
    setCompetitions(await getAthleteCompetitions(athleteId))
    setLoading(false)
  }

  async function save() {
    if (!form.name || !form.race_date) return
    setSaving(true)
    const sb = createClient()
    const goalMin = form.goal_time_h || form.goal_time_m
      ? (parseInt(form.goal_time_h || '0') * 60 + parseInt(form.goal_time_m || '0')) : null
    const resultMin = form.result_time_h || form.result_time_m
      ? (parseInt(form.result_time_h || '0') * 60 + parseInt(form.result_time_m || '0')) : null
    await sb.from('competitions').insert({
      athlete_id: athleteId,
      name: form.name,
      race_date: form.race_date,
      sport: form.sport || null,
      distance_label: form.distance_label || null,
      priority: form.priority as 'A' | 'B' | 'C',
      goal_time_min: goalMin,
      result_time_min: resultMin,
      result_position: form.result_position ? parseInt(form.result_position) : null,
      dnf: form.dnf,
      notes: form.notes || null,
    })
    setSaving(false)
    setOpen(false)
    setForm({ name: '', race_date: '', sport: '', distance_label: '', priority: 'B', goal_time_h: '', goal_time_m: '', result_time_h: '', result_time_m: '', result_position: '', dnf: false, notes: '' })
    load()
  }

  async function deleteComp(id: string) {
    if (!window.confirm('Excluir esta prova permanentemente?')) return
    const sb = createClient()
    await sb.from('competitions').delete().eq('id', id)
    load()
  }

  const today = todayLocalISO()
  const upcoming = competitions.filter(c => c.race_date >= today).sort((a, b) => a.race_date.localeCompare(b.race_date))
  const past = competitions.filter(c => c.race_date < today)

  if (loading) return <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">Carregando...</div>

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl p-3" style={{ background: '#fbbf2415', border: '1px solid #fbbf2430' }}>
            <Trophy className="w-5 h-5 text-[#fbbf24]" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Calendário de Provas</h3>
            <p className="text-xs text-muted-foreground">{upcoming.length} próximas · {past.length} realizadas</p>
          </div>
        </div>
        <button onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
          style={{ background: '#fbbf2415', border: '1px solid #fbbf2440', color: '#fbbf24' }}>
          <Plus className="w-3 h-3" /> Adicionar Prova
        </button>
      </div>

      {/* Stats */}
      {competitions.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total de Provas', value: competitions.length },
            { label: 'Próximas', value: upcoming.length },
            { label: 'Concluídas', value: past.filter(c => !c.dnf).length },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl px-4 py-3 text-center" style={{ background: '#12121e', border: '1px solid #1e1e2e' }}>
              <p className="text-2xl font-black text-foreground">{value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-border/50">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Próximas Provas</h4>
          </div>
          <div className="divide-y divide-border/40">
            {upcoming.map(c => {
              const daysUntil = daysFromToday(c.race_date)
              const color = PRIORITY_COLOR[c.priority]
              return (
                <div key={c.id} className="flex items-start gap-4 px-5 py-4">
                  <div className="flex-shrink-0 text-center w-12">
                    <div className="text-xs font-bold text-foreground">{new Date(c.race_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {daysUntil === 0 ? 'Hoje!' : daysUntil === 1 ? 'Amanhã' : `${daysUntil}d`}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-bold text-foreground">{c.name}</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: color + '20', color, border: `1px solid ${color}40` }}>
                        {c.priority}
                      </span>
                      {c.distance_label && <span className="text-[10px] text-muted-foreground">{c.distance_label}</span>}
                      {c.sport && <span className="text-[10px] text-muted-foreground">{sportLabel(c.sport)}</span>}
                    </div>
                    {c.goal_time_min && (
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <Target className="w-3 h-3" /> Meta: {fmtTime(c.goal_time_min)}
                      </div>
                    )}
                    {c.notes && <p className="text-[10px] text-muted-foreground/60 mt-1 italic">{c.notes}</p>}
                  </div>
                  <button onClick={() => deleteComp(c.id)}><X className="w-3.5 h-3.5 text-muted-foreground/30 hover:text-muted-foreground/70" /></button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Past results */}
      {past.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-border/50">
            <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground" />
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Resultados</h4>
          </div>
          <div className="divide-y divide-border/40">
            {past.map(c => (
              <div key={c.id} className="flex items-start gap-4 px-5 py-3">
                <div className="flex-shrink-0 text-center w-12">
                  <div className="text-[10px] text-muted-foreground">{fmtDate(c.race_date)}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-foreground">{c.name}</span>
                    {c.dnf && <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440' }}>DNF</span>}
                    {c.distance_label && <span className="text-[10px] text-muted-foreground">{c.distance_label}</span>}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-[10px] text-muted-foreground">
                    {c.result_time_min && <span>⏱ {fmtTime(c.result_time_min)}</span>}
                    {c.goal_time_min && <span>Meta: {fmtTime(c.goal_time_min)}</span>}
                    {c.result_time_min && c.goal_time_min && (
                      <span style={{ color: c.result_time_min <= c.goal_time_min ? '#4ade80' : '#fbbf24' }}>
                        {c.result_time_min <= c.goal_time_min ? '✓ Meta atingida' : `+${fmtTime(c.result_time_min - c.goal_time_min)}`}
                      </span>
                    )}
                    {c.result_position && <span>#{c.result_position}º lugar</span>}
                  </div>
                  {c.notes && <p className="text-[10px] text-muted-foreground/60 mt-0.5 italic">{c.notes}</p>}
                </div>
                <button onClick={() => deleteComp(c.id)}><X className="w-3.5 h-3.5 text-muted-foreground/30 hover:text-muted-foreground/70" /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {competitions.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Trophy className="w-8 h-8 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma prova cadastrada</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Adicione o calendário de competições do atleta</p>
        </div>
      )}

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold">Adicionar Prova</h3>
              <button onClick={() => setOpen(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Nome da Prova *</label>
                <input value={form.name} onChange={e => setForm(v => ({ ...v, name: e.target.value }))}
                  placeholder="ex: Ironman 70.3 Florianópolis" className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Data *</label>
                  <input type="date" value={form.race_date} onChange={e => setForm(v => ({ ...v, race_date: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Prioridade</label>
                  <select value={form.priority} onChange={e => setForm(v => ({ ...v, priority: e.target.value }))} className={inputCls}>
                    <option value="A">A — Principal</option>
                    <option value="B">B — Secundária</option>
                    <option value="C">C — Treinamento</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Modalidade</label>
                  <select value={form.sport} onChange={e => setForm(v => ({ ...v, sport: e.target.value }))} className={inputCls}>
                    <option value="">—</option>
                    {['triathlon', 'running', 'cycling', 'swimming', 'duathlon'].map(s => <option key={s} value={s}>{sportLabel(s)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Distância</label>
                  <input value={form.distance_label} onChange={e => setForm(v => ({ ...v, distance_label: e.target.value }))}
                    placeholder="ex: Half, Sprint, 10km" className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Tempo Meta (h : min)</label>
                <div className="flex items-center gap-2">
                  <input type="number" value={form.goal_time_h} onChange={e => setForm(v => ({ ...v, goal_time_h: e.target.value }))}
                    placeholder="0" min="0" max="24" className={inputCls + ' w-20 text-center'} />
                  <span className="text-muted-foreground font-bold">:</span>
                  <input type="number" value={form.goal_time_m} onChange={e => setForm(v => ({ ...v, goal_time_m: e.target.value }))}
                    placeholder="00" min="0" max="59" className={inputCls + ' w-20 text-center'} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Tempo Resultado (h : min) <span className="text-muted-foreground/50">— preencher após a prova</span></label>
                <div className="flex items-center gap-2">
                  <input type="number" value={form.result_time_h} onChange={e => setForm(v => ({ ...v, result_time_h: e.target.value }))}
                    placeholder="0" min="0" max="24" className={inputCls + ' w-20 text-center'} />
                  <span className="text-muted-foreground font-bold">:</span>
                  <input type="number" value={form.result_time_m} onChange={e => setForm(v => ({ ...v, result_time_m: e.target.value }))}
                    placeholder="00" min="0" max="59" className={inputCls + ' w-20 text-center'} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Colocação</label>
                  <input type="number" value={form.result_position} onChange={e => setForm(v => ({ ...v, result_position: e.target.value }))}
                    placeholder="ex: 42" className={inputCls} />
                </div>
                <div className="flex items-center gap-3 pt-5">
                  <input type="checkbox" id="dnf" checked={form.dnf} onChange={e => setForm(v => ({ ...v, dnf: e.target.checked }))}
                    className="w-4 h-4 accent-primary" />
                  <label htmlFor="dnf" className="text-xs text-muted-foreground">DNF / Abandono</label>
                </div>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Observações</label>
                <textarea value={form.notes} onChange={e => setForm(v => ({ ...v, notes: e.target.value }))}
                  rows={2} placeholder="Análise pós-prova, condições, estratégia..." className={inputCls + ' resize-none'} />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={save} disabled={saving || !form.name || !form.race_date}
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
