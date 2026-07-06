'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getAthleteBodyComposition, getAthleteNutritionPlans, type BodyCompositionRow, type NutritionPlanRow } from '@/lib/supabase/queries'
import { Plus, X, Scale, Utensils, TrendingDown, TrendingUp, Minus } from 'lucide-react'

const PHASE_LABEL: Record<string, string> = {
  base: 'Base', build: 'Build', peak: 'Pico', race: 'Prova', recovery: 'Recuperação', offseason: 'Off-season',
}
const PHASE_COLOR: Record<string, string> = {
  base: '#60a5fa', build: '#fbbf24', peak: '#f97316', race: '#ef4444', recovery: '#4ade80', offseason: '#94a3b8',
}

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
}

interface Props { athleteId: string; currentWeight?: number | null }

export function NutricaoTab({ athleteId, currentWeight }: Props) {
  const [bodyComp, setBodyComp] = useState<BodyCompositionRow[]>([])
  const [plans, setPlans] = useState<NutritionPlanRow[]>([])
  const [loading, setLoading] = useState(true)

  const [compOpen, setCompOpen] = useState(false)
  const [compForm, setCompForm] = useState({ measured_at: '', weight_kg: '', body_fat_pct: '', muscle_mass_kg: '', bone_mass_kg: '', visceral_fat: '', notes: '' })

  const [planOpen, setPlanOpen] = useState(false)
  const [planForm, setPlanForm] = useState({ phase: 'base', calories_target: '', protein_g: '', carbs_g: '', fat_g: '', hydration_ml: '', notes: '' })

  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [athleteId])

  async function load() {
    setLoading(true)
    const [bc, pl] = await Promise.all([getAthleteBodyComposition(athleteId), getAthleteNutritionPlans(athleteId)])
    setBodyComp(bc)
    setPlans(pl)
    setLoading(false)
  }

  async function saveBodyComp() {
    if (!compForm.measured_at) return
    setSaving(true)
    const sb = createClient()
    await sb.from('body_composition').insert({
      athlete_id: athleteId,
      measured_at: compForm.measured_at,
      weight_kg: compForm.weight_kg ? parseFloat(compForm.weight_kg) : null,
      body_fat_pct: compForm.body_fat_pct ? parseFloat(compForm.body_fat_pct) : null,
      muscle_mass_kg: compForm.muscle_mass_kg ? parseFloat(compForm.muscle_mass_kg) : null,
      bone_mass_kg: compForm.bone_mass_kg ? parseFloat(compForm.bone_mass_kg) : null,
      visceral_fat: compForm.visceral_fat ? parseInt(compForm.visceral_fat) : null,
      notes: compForm.notes || null,
    })
    setSaving(false)
    setCompOpen(false)
    setCompForm({ measured_at: '', weight_kg: '', body_fat_pct: '', muscle_mass_kg: '', bone_mass_kg: '', visceral_fat: '', notes: '' })
    load()
  }

  async function savePlan() {
    if (!planForm.phase) return
    setSaving(true)
    const sb = createClient()
    // Deactivate other plans first
    await sb.from('nutrition_plans').update({ active: false }).eq('athlete_id', athleteId)
    await sb.from('nutrition_plans').insert({
      athlete_id: athleteId,
      phase: planForm.phase,
      calories_target: planForm.calories_target ? parseInt(planForm.calories_target) : null,
      protein_g: planForm.protein_g ? parseInt(planForm.protein_g) : null,
      carbs_g: planForm.carbs_g ? parseInt(planForm.carbs_g) : null,
      fat_g: planForm.fat_g ? parseInt(planForm.fat_g) : null,
      hydration_ml: planForm.hydration_ml ? parseInt(planForm.hydration_ml) : null,
      notes: planForm.notes || null,
      active: true,
    })
    setSaving(false)
    setPlanOpen(false)
    setPlanForm({ phase: 'base', calories_target: '', protein_g: '', carbs_g: '', fat_g: '', hydration_ml: '', notes: '' })
    load()
  }

  async function deleteBodyComp(id: string) {
    const sb = createClient()
    await sb.from('body_composition').delete().eq('id', id)
    load()
  }

  async function deletePlan(id: string) {
    const sb = createClient()
    await sb.from('nutrition_plans').delete().eq('id', id)
    load()
  }

  const activePlan = plans.find(p => p.active)
  const latestComp = bodyComp[0]
  const prevComp = bodyComp[1]
  const weightTrend = latestComp?.weight_kg && prevComp?.weight_kg
    ? latestComp.weight_kg - prevComp.weight_kg : null

  if (loading) return <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">Carregando...</div>

  return (
    <div className="space-y-6">
      {/* Composição Corporal */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-[#60a5fa]" />
            <h3 className="text-sm font-bold text-foreground">Composição Corporal</h3>
          </div>
          <button onClick={() => setCompOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
            style={{ background: '#60a5fa15', border: '1px solid #60a5fa40', color: '#60a5fa' }}>
            <Plus className="w-3 h-3" /> Nova Medição
          </button>
        </div>

        {!latestComp ? (
          <p className="text-xs text-muted-foreground text-center py-8">Nenhuma medição registrada</p>
        ) : (
          <div className="p-5">
            {/* Latest summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {[
                { label: 'Peso', value: latestComp.weight_kg != null ? `${latestComp.weight_kg} kg` : '—', trend: weightTrend },
                { label: 'Gordura', value: latestComp.body_fat_pct != null ? `${latestComp.body_fat_pct}%` : '—', trend: null },
                { label: 'Massa Muscular', value: latestComp.muscle_mass_kg != null ? `${latestComp.muscle_mass_kg} kg` : '—', trend: null },
                { label: 'Gordura Visceral', value: latestComp.visceral_fat != null ? `Nível ${latestComp.visceral_fat}` : '—', trend: null },
              ].map(({ label, value, trend }) => (
                <div key={label} className="rounded-xl px-4 py-3" style={{ background: '#12121e', border: '1px solid #1e1e2e' }}>
                  <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xl font-black text-foreground">{value}</span>
                    {trend != null && (
                      trend > 0 ? <TrendingUp className="w-3.5 h-3.5 text-[#fbbf24]" />
                      : trend < 0 ? <TrendingDown className="w-3.5 h-3.5 text-[#4ade80]" />
                      : <Minus className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                  </div>
                  {trend != null && (
                    <p className="text-[10px] mt-0.5" style={{ color: trend > 0 ? '#fbbf24' : trend < 0 ? '#4ade80' : '#64748b' }}>
                      {trend > 0 ? '+' : ''}{trend.toFixed(1)} kg vs anterior
                    </p>
                  )}
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mb-2">Última medição: {fmtDate(latestComp.measured_at)}</p>

            {/* History */}
            {bodyComp.length > 1 && (
              <div className="mt-3 pt-3 border-t border-border/30">
                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Histórico</p>
                <div className="space-y-1.5">
                  {bodyComp.map(bc => (
                    <div key={bc.id} className="flex items-center gap-3 text-xs">
                      <span className="text-muted-foreground/60 w-20 flex-shrink-0">{fmtDate(bc.measured_at)}</span>
                      <span className="text-foreground font-medium">{bc.weight_kg != null ? `${bc.weight_kg} kg` : '—'}</span>
                      {bc.body_fat_pct != null && <span className="text-muted-foreground">{bc.body_fat_pct}% gord.</span>}
                      {bc.muscle_mass_kg != null && <span className="text-muted-foreground">{bc.muscle_mass_kg} kg musc.</span>}
                      <button onClick={() => deleteBodyComp(bc.id)} className="ml-auto"><X className="w-3 h-3 text-muted-foreground/30 hover:text-muted-foreground/70" /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Plano Nutricional */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Utensils className="w-4 h-4 text-[#4ade80]" />
            <h3 className="text-sm font-bold text-foreground">Planos Nutricionais</h3>
          </div>
          <button onClick={() => setPlanOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
            style={{ background: '#4ade8015', border: '1px solid #4ade8040', color: '#4ade80' }}>
            <Plus className="w-3 h-3" /> Novo Plano
          </button>
        </div>

        {plans.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">Nenhum plano cadastrado</p>
        ) : (
          <div className="p-5 space-y-3">
            {plans.map(plan => {
              const color = PHASE_COLOR[plan.phase] ?? '#94a3b8'
              const total = (plan.protein_g ?? 0) * 4 + (plan.carbs_g ?? 0) * 4 + (plan.fat_g ?? 0) * 9
              return (
                <div key={plan.id} className="rounded-xl p-4" style={{ background: '#12121e', border: `1px solid ${plan.active ? color + '40' : '#1e1e2e'}` }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{ background: color + '20', color, border: `1px solid ${color}40` }}>
                        {PHASE_LABEL[plan.phase] ?? plan.phase}
                      </span>
                      {plan.active && (
                        <span className="text-[9px] font-bold text-[#4ade80] uppercase tracking-wider">● Ativo</span>
                      )}
                    </div>
                    <button onClick={() => deletePlan(plan.id)}><X className="w-3.5 h-3.5 text-muted-foreground/40 hover:text-muted-foreground/80" /></button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Calorias', value: plan.calories_target ? `${plan.calories_target} kcal` : '—' },
                      { label: 'Proteína', value: plan.protein_g ? `${plan.protein_g}g` : '—' },
                      { label: 'Carboidrato', value: plan.carbs_g ? `${plan.carbs_g}g` : '—' },
                      { label: 'Gordura', value: plan.fat_g ? `${plan.fat_g}g` : '—' },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</p>
                        <p className="text-sm font-bold text-foreground mt-0.5">{value}</p>
                      </div>
                    ))}
                  </div>
                  {total > 0 && plan.calories_target && (
                    <div className="mt-3 flex gap-1 h-1.5 rounded-full overflow-hidden">
                      <div style={{ width: `${(((plan.protein_g ?? 0) * 4) / plan.calories_target) * 100}%`, background: '#60a5fa' }} />
                      <div style={{ width: `${(((plan.carbs_g ?? 0) * 4) / plan.calories_target) * 100}%`, background: '#fbbf24' }} />
                      <div style={{ width: `${(((plan.fat_g ?? 0) * 9) / plan.calories_target) * 100}%`, background: '#f97316' }} />
                    </div>
                  )}
                  {total > 0 && plan.calories_target && (
                    <div className="flex gap-4 mt-1">
                      {[
                        { label: 'P', pct: (((plan.protein_g ?? 0) * 4) / plan.calories_target * 100).toFixed(0), color: '#60a5fa' },
                        { label: 'C', pct: (((plan.carbs_g ?? 0) * 4) / plan.calories_target * 100).toFixed(0), color: '#fbbf24' },
                        { label: 'G', pct: (((plan.fat_g ?? 0) * 9) / plan.calories_target * 100).toFixed(0), color: '#f97316' },
                      ].map(({ label, pct, color: c }) => (
                        <span key={label} className="text-[9px]" style={{ color: c }}>{label} {pct}%</span>
                      ))}
                    </div>
                  )}
                  {plan.hydration_ml && (
                    <p className="text-[10px] text-muted-foreground mt-2">💧 Hidratação: {(plan.hydration_ml / 1000).toFixed(1)}L/dia</p>
                  )}
                  {plan.notes && <p className="text-[10px] text-muted-foreground/60 mt-1 italic">{plan.notes}</p>}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal Composição */}
      {compOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold">Nova Medição Corporal</h3>
              <button onClick={() => setCompOpen(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Data da medição *</label>
                <input type="date" value={compForm.measured_at} onChange={e => setCompForm(v => ({ ...v, measured_at: e.target.value }))} className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { label: 'Peso (kg)', key: 'weight_kg', placeholder: '75.0' },
                  { label: '% Gordura', key: 'body_fat_pct', placeholder: '18.5' },
                  { label: 'Massa Muscular (kg)', key: 'muscle_mass_kg', placeholder: '58.0' },
                  { label: 'Massa Óssea (kg)', key: 'bone_mass_kg', placeholder: '3.2' },
                  { label: 'Gordura Visceral (nível)', key: 'visceral_fat', placeholder: '5' },
                ] as { label: string; key: keyof typeof compForm; placeholder: string }[]).map(({ label, key, placeholder }) => (
                  <div key={key}>
                    <label className="block text-xs text-muted-foreground mb-1">{label}</label>
                    <input type="number" step="0.1" value={compForm[key]} onChange={e => setCompForm(v => ({ ...v, [key]: e.target.value }))}
                      placeholder={placeholder} className={inputCls} />
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Observações</label>
                <textarea value={compForm.notes} onChange={e => setCompForm(v => ({ ...v, notes: e.target.value }))}
                  rows={2} className={inputCls + ' resize-none'} />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={saveBodyComp} disabled={saving || !compForm.measured_at}
                className="flex-1 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg disabled:opacity-50">
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
              <button onClick={() => setCompOpen(false)} className="px-4 py-2.5 border border-border text-sm text-muted-foreground rounded-lg hover:bg-secondary">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Plano */}
      {planOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold">Novo Plano Nutricional</h3>
              <button onClick={() => setPlanOpen(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Fase de treino</label>
                <select value={planForm.phase} onChange={e => setPlanForm(v => ({ ...v, phase: e.target.value }))} className={inputCls}>
                  {Object.entries(PHASE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { label: 'Calorias (kcal/dia)', key: 'calories_target', placeholder: '2800' },
                  { label: 'Proteína (g)', key: 'protein_g', placeholder: '160' },
                  { label: 'Carboidrato (g)', key: 'carbs_g', placeholder: '340' },
                  { label: 'Gordura (g)', key: 'fat_g', placeholder: '80' },
                  { label: 'Hidratação (mL)', key: 'hydration_ml', placeholder: '3000' },
                ] as { label: string; key: keyof typeof planForm; placeholder: string }[]).map(({ label, key, placeholder }) => (
                  <div key={key}>
                    <label className="block text-xs text-muted-foreground mb-1">{label}</label>
                    <input type="number" value={planForm[key]} onChange={e => setPlanForm(v => ({ ...v, [key]: e.target.value }))}
                      placeholder={placeholder} className={inputCls} />
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Orientações / Notas</label>
                <textarea value={planForm.notes} onChange={e => setPlanForm(v => ({ ...v, notes: e.target.value }))}
                  rows={3} placeholder="Instruções do nutricionista, alimentos evitar, horários..." className={inputCls + ' resize-none'} />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={savePlan} disabled={saving}
                className="flex-1 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg disabled:opacity-50">
                {saving ? 'Salvando...' : 'Salvar e Ativar'}
              </button>
              <button onClick={() => setPlanOpen(false)} className="px-4 py-2.5 border border-border text-sm text-muted-foreground rounded-lg hover:bg-secondary">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const inputCls = 'w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary'
