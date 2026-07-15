'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getAthleteBodyComposition, getAthleteNutritionPlans, type BodyCompositionRow, type NutritionPlanRow } from '@/lib/supabase/queries'
import { extractBodyCompFromText, extractDateFromText } from '@/lib/parsers/pdf-parser'
import { todayLocalISO } from '@/lib/dates'
import { DocsSection } from './docs-section'
import { Plus, X, Scale, Utensils, TrendingDown, TrendingUp, Minus, Pencil } from 'lucide-react'

const PHASE_LABEL: Record<string, string> = {
  base: 'Base', build: 'Build', peak: 'Pico', race: 'Prova', recovery: 'Recuperação', offseason: 'Off-season',
}
const PHASE_COLOR: Record<string, string> = {
  base: '#60a5fa', build: '#fbbf24', peak: '#f97316', race: '#ef4444', recovery: '#4ade80', offseason: '#94a3b8',
}

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
}

/** IMC = peso (kg) / altura² (m) */
export function calcIMC(weightKg: number | null, heightCm: number | null): number | null {
  if (!weightKg || !heightCm || heightCm <= 0) return null
  const h = heightCm / 100
  return Math.round((weightKg / (h * h)) * 100) / 100
}

const EMPTY_COMP_FORM = {
  measured_at: '', weight_kg: '', body_fat_pct: '', muscle_mass_kg: '', bone_mass_kg: '', visceral_fat: '',
  fat_mass_kg: '', lean_mass_kg: '', lean_mass_pct: '', waist_hip_ratio: '', body_density: '',
  skinfold_sum_mm: '', arm_muscle_area: '', arm_fat_area: '', notes: '',
}

interface Props { athleteId: string }

export function NutricaoTab({ athleteId }: Props) {
  const [bodyComp, setBodyComp] = useState<BodyCompositionRow[]>([])
  const [plans, setPlans] = useState<NutritionPlanRow[]>([])
  const [loading, setLoading] = useState(true)
  const [heightCm, setHeightCm] = useState<number | null>(null)
  const [heightInput, setHeightInput] = useState('')

  const [compOpen, setCompOpen] = useState(false)
  const [compForm, setCompForm] = useState({ ...EMPTY_COMP_FORM })
  const [editingCompId, setEditingCompId] = useState<string | null>(null)

  const [planOpen, setPlanOpen] = useState(false)
  const [planForm, setPlanForm] = useState({ phase: 'base', calories_target: '', protein_g: '', carbs_g: '', fat_g: '', hydration_ml: '', notes: '' })
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null)

  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [athleteId])

  async function load() {
    setLoading(true)
    const sb = createClient()
    const [bc, pl, { data: ath }] = await Promise.all([
      getAthleteBodyComposition(athleteId),
      getAthleteNutritionPlans(athleteId),
      sb.from('athletes').select('height_cm').eq('id', athleteId).single(),
    ])
    setBodyComp(bc)
    setPlans(pl)
    const h = (ath as { height_cm: number | null } | null)?.height_cm ?? null
    setHeightCm(h)
    setHeightInput(h?.toString() ?? '')
    setLoading(false)
  }

  const num = (s: string) => (s ? parseFloat(s) : null)

  async function saveBodyComp() {
    if (!compForm.measured_at) return
    setSaving(true)
    const sb = createClient()

    // Altura salva no perfil do atleta (constante entre medições)
    if (heightInput && parseFloat(heightInput) !== heightCm) {
      await sb.from('athletes').update({ height_cm: parseFloat(heightInput) }).eq('id', athleteId)
    }

    // Massa gorda/magra derivadas do peso e % quando não informadas
    const weight = num(compForm.weight_kg)
    const fatPct = num(compForm.body_fat_pct)
    const fatMass = num(compForm.fat_mass_kg) ?? (weight && fatPct ? Math.round(weight * fatPct) / 100 : null)
    const leanPct = num(compForm.lean_mass_pct) ?? (fatPct != null ? Math.round((100 - fatPct) * 100) / 100 : null)
    const leanMass = num(compForm.lean_mass_kg) ?? (weight && leanPct ? Math.round(weight * leanPct) / 100 : null)

    const payload = {
      measured_at: compForm.measured_at,
      weight_kg: weight,
      body_fat_pct: fatPct,
      muscle_mass_kg: num(compForm.muscle_mass_kg),
      bone_mass_kg: num(compForm.bone_mass_kg),
      visceral_fat: compForm.visceral_fat ? parseInt(compForm.visceral_fat) : null,
      fat_mass_kg: fatMass,
      lean_mass_kg: leanMass,
      lean_mass_pct: leanPct,
      waist_hip_ratio: num(compForm.waist_hip_ratio),
      body_density: num(compForm.body_density),
      skinfold_sum_mm: num(compForm.skinfold_sum_mm),
      arm_muscle_area: num(compForm.arm_muscle_area),
      arm_fat_area: num(compForm.arm_fat_area),
      notes: compForm.notes || null,
    }
    const { error } = editingCompId
      ? await sb.from('body_composition').update(payload).eq('id', editingCompId)
      : await sb.from('body_composition').insert({ athlete_id: athleteId, ...payload })
    if (error) console.error('[nutricao-tab]', error.message)
    setSaving(false)
    setCompOpen(false)
    setCompForm({ ...EMPTY_COMP_FORM })
    setEditingCompId(null)
    load()
  }

  function openEditComp(bc: BodyCompositionRow) {
    setCompForm({
      measured_at: bc.measured_at,
      weight_kg: bc.weight_kg?.toString() ?? '',
      body_fat_pct: bc.body_fat_pct?.toString() ?? '',
      muscle_mass_kg: bc.muscle_mass_kg?.toString() ?? '',
      bone_mass_kg: bc.bone_mass_kg?.toString() ?? '',
      visceral_fat: bc.visceral_fat?.toString() ?? '',
      fat_mass_kg: bc.fat_mass_kg?.toString() ?? '',
      lean_mass_kg: bc.lean_mass_kg?.toString() ?? '',
      lean_mass_pct: bc.lean_mass_pct?.toString() ?? '',
      waist_hip_ratio: bc.waist_hip_ratio?.toString() ?? '',
      body_density: bc.body_density?.toString() ?? '',
      skinfold_sum_mm: bc.skinfold_sum_mm?.toString() ?? '',
      arm_muscle_area: bc.arm_muscle_area?.toString() ?? '',
      arm_fat_area: bc.arm_fat_area?.toString() ?? '',
      notes: bc.notes ?? '',
    })
    setEditingCompId(bc.id)
    setCompOpen(true)
  }

  async function savePlan() {
    if (!planForm.phase) return
    setSaving(true)
    const sb = createClient()
    const payload = {
      phase: planForm.phase,
      calories_target: planForm.calories_target ? parseInt(planForm.calories_target) : null,
      protein_g: planForm.protein_g ? parseInt(planForm.protein_g) : null,
      carbs_g: planForm.carbs_g ? parseInt(planForm.carbs_g) : null,
      fat_g: planForm.fat_g ? parseInt(planForm.fat_g) : null,
      hydration_ml: planForm.hydration_ml ? parseInt(planForm.hydration_ml) : null,
      notes: planForm.notes || null,
    }
    if (editingPlanId) {
      // Edição: mantém o status ativo/inativo do plano
      await sb.from('nutrition_plans').update(payload).eq('id', editingPlanId)
    } else {
      // Novo plano vira o ativo; desativa os demais
      await sb.from('nutrition_plans').update({ active: false }).eq('athlete_id', athleteId)
      await sb.from('nutrition_plans').insert({ athlete_id: athleteId, ...payload, active: true })
    }
    setSaving(false)
    setPlanOpen(false)
    setEditingPlanId(null)
    setPlanForm({ phase: 'base', calories_target: '', protein_g: '', carbs_g: '', fat_g: '', hydration_ml: '', notes: '' })
    load()
  }

  function openEditPlan(plan: NutritionPlanRow) {
    setPlanForm({
      phase: plan.phase,
      calories_target: plan.calories_target?.toString() ?? '',
      protein_g: plan.protein_g?.toString() ?? '',
      carbs_g: plan.carbs_g?.toString() ?? '',
      fat_g: plan.fat_g?.toString() ?? '',
      hydration_ml: plan.hydration_ml?.toString() ?? '',
      notes: plan.notes ?? '',
    })
    setEditingPlanId(plan.id)
    setPlanOpen(true)
  }

  function handlePdfText(text: string, fileName: string) {
    const comp = extractBodyCompFromText(text)
    const found = Object.values(comp).some(v => v != null)
    if (!found) {
      window.alert('Nenhum dado de composição corporal detectado neste PDF (peso, % gordura, massa muscular...). Preencha manualmente.')
      return
    }
    // Pré-preenche o formulário de medição e abre o modal para revisão
    setEditingCompId(null)
    setCompForm({
      ...EMPTY_COMP_FORM,
      measured_at: extractDateFromText(text) ?? todayLocalISO(),
      weight_kg: comp.weight_kg?.toString() ?? '',
      body_fat_pct: comp.body_fat_pct?.toString() ?? '',
      muscle_mass_kg: comp.muscle_mass_kg?.toString() ?? '',
      bone_mass_kg: comp.bone_mass_kg?.toString() ?? '',
      visceral_fat: comp.visceral_fat?.toString() ?? '',
      notes: `Importado de: ${fileName}`,
    })
    setCompOpen(true)
  }

  async function deleteBodyComp(id: string) {
    if (!window.confirm('Excluir esta medição permanentemente?')) return
    const sb = createClient()
    await sb.from('body_composition').delete().eq('id', id)
    load()
  }

  async function deletePlan(id: string) {
    if (!window.confirm('Excluir este plano nutricional permanentemente?')) return
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
      {/* Documentos PDF */}
      <DocsSection
        athleteId={athleteId}
        area="nutricao"
        extractLabel="Preencher medição"
        onExtractText={handlePdfText}
      />

      {/* Composição Corporal */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-[#60a5fa]" />
            <h3 className="text-sm font-bold text-foreground">Composição Corporal</h3>
          </div>
          <button onClick={() => { setEditingCompId(null); setCompForm({ ...EMPTY_COMP_FORM }); setCompOpen(true) }}
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
                { label: 'IMC', value: calcIMC(latestComp.weight_kg, heightCm)?.toFixed(2) ?? '—', trend: null },
                { label: '% Massa Gorda', value: latestComp.body_fat_pct != null ? `${latestComp.body_fat_pct}%` : '—', trend: null },
                { label: 'Massa Magra', value: latestComp.lean_mass_kg != null ? `${latestComp.lean_mass_kg} kg` : '—', trend: null },
              ].map(({ label, value, trend }) => (
                <div key={label} className="rounded-xl px-4 py-3" style={{ background: 'var(--secondary)', border: '1px solid var(--border)' }}>
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
            <p className="text-[10px] text-muted-foreground mb-3">
              Última medição: {fmtDate(latestComp.measured_at)}
              {heightCm ? ` · Altura: ${(heightCm / 100).toFixed(2).replace('.', ',')} m` : ''}
            </p>

            {/* Evolução por data */}
            <EvolutionTable bodyComp={bodyComp} heightCm={heightCm} onDelete={deleteBodyComp} onEdit={openEditComp} />
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
          <button onClick={() => { setEditingPlanId(null); setPlanForm({ phase: 'base', calories_target: '', protein_g: '', carbs_g: '', fat_g: '', hydration_ml: '', notes: '' }); setPlanOpen(true) }}
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
                <div key={plan.id} className="rounded-xl p-4" style={{ background: 'var(--secondary)', border: `1px solid ${plan.active ? color + '40' : 'var(--border)'}` }}>
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
                    <span className="flex items-center gap-1.5">
                      <button onClick={() => openEditPlan(plan)} title="Editar"><Pencil className="w-3.5 h-3.5 text-muted-foreground/40 hover:text-[#4ade80]" /></button>
                      <button onClick={() => deletePlan(plan.id)}><X className="w-3.5 h-3.5 text-muted-foreground/40 hover:text-muted-foreground/80" /></button>
                    </span>
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
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold">{editingCompId ? `Editar Medição — ${fmtDate(compForm.measured_at)}` : 'Nova Medição Corporal'}</h3>
              <button onClick={() => { setCompOpen(false); setEditingCompId(null) }}><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Data *</label>
                  <input type="date" value={compForm.measured_at} onChange={e => setCompForm(v => ({ ...v, measured_at: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Altura (cm)</label>
                  <input type="number" step="0.1" value={heightInput} onChange={e => setHeightInput(e.target.value)}
                    placeholder="191" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Peso (kg)</label>
                  <input type="number" step="0.1" value={compForm.weight_kg} onChange={e => setCompForm(v => ({ ...v, weight_kg: e.target.value }))}
                    placeholder="108.1" className={inputCls} />
                </div>
              </div>

              {/* IMC calculado ao vivo */}
              {(() => {
                const imc = calcIMC(compForm.weight_kg ? parseFloat(compForm.weight_kg) : null, heightInput ? parseFloat(heightInput) : null)
                if (imc == null) return null
                const cls = imc < 18.5 ? ['Abaixo do peso', '#fbbf24'] : imc < 25 ? ['Eutrófico', '#4ade80'] : imc < 30 ? ['Sobrepeso', '#fbbf24'] : ['Obesidade', '#ef4444']
                return (
                  <div className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: 'var(--secondary)', border: '1px solid var(--border)' }}>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">IMC calculado</span>
                    <span className="text-lg font-black text-foreground">{imc.toFixed(2).replace('.', ',')}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: cls[1] + '20', color: cls[1], border: `1px solid ${cls[1]}40` }}>{cls[0]}</span>
                  </div>
                )
              })()}

              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Composição</p>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { label: 'Massa Gorda (kg)', key: 'fat_mass_kg', placeholder: 'auto: peso × %' },
                    { label: '% Massa Gorda', key: 'body_fat_pct', placeholder: '22.61' },
                    { label: 'Massa Magra (kg)', key: 'lean_mass_kg', placeholder: 'auto: peso × %' },
                    { label: '% Massa Magra', key: 'lean_mass_pct', placeholder: 'auto: 100 − % gorda' },
                    { label: 'Massa Muscular (kg)', key: 'muscle_mass_kg', placeholder: '58.0' },
                    { label: 'Massa Óssea (kg)', key: 'bone_mass_kg', placeholder: '3.2' },
                  ] as { label: string; key: keyof typeof compForm; placeholder: string }[]).map(({ label, key, placeholder }) => (
                    <div key={key}>
                      <label className="block text-xs text-muted-foreground mb-1">{label}</label>
                      <input type="number" step="0.01" value={compForm[key]} onChange={e => setCompForm(v => ({ ...v, [key]: e.target.value }))}
                        placeholder={placeholder} className={inputCls} />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Antropometria</p>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { label: 'Razão cintura/quadril', key: 'waist_hip_ratio', placeholder: '0.88' },
                    { label: 'Densidade Corporal', key: 'body_density', placeholder: '1.05' },
                    { label: 'Soma de dobras (mm)', key: 'skinfold_sum_mm', placeholder: '153' },
                    { label: 'Gordura Visceral (nível)', key: 'visceral_fat', placeholder: '5' },
                    { label: 'Área Muscular Braço (AMB)', key: 'arm_muscle_area', placeholder: '79.76' },
                    { label: 'Área Gordura Braço (AGB)', key: 'arm_fat_area', placeholder: '29.18' },
                  ] as { label: string; key: keyof typeof compForm; placeholder: string }[]).map(({ label, key, placeholder }) => (
                    <div key={key}>
                      <label className="block text-xs text-muted-foreground mb-1">{label}</label>
                      <input type="number" step="0.01" value={compForm[key]} onChange={e => setCompForm(v => ({ ...v, [key]: e.target.value }))}
                        placeholder={placeholder} className={inputCls} />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-1">Observações</label>
                <textarea value={compForm.notes} onChange={e => setCompForm(v => ({ ...v, notes: e.target.value }))}
                  rows={2} className={inputCls + ' resize-none'} />
              </div>
              <p className="text-[10px] text-muted-foreground/70">
                💡 Massa gorda/magra em kg e % magra são calculadas automaticamente a partir do peso e % de gordura quando deixadas em branco.
              </p>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={saveBodyComp} disabled={saving || !compForm.measured_at}
                className="flex-1 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg disabled:opacity-50">
                {saving ? 'Salvando...' : editingCompId ? 'Salvar Alterações' : 'Salvar'}
              </button>
              <button onClick={() => { setCompOpen(false); setEditingCompId(null) }} className="px-4 py-2.5 border border-border text-sm text-muted-foreground rounded-lg hover:bg-secondary">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Plano */}
      {planOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold">{editingPlanId ? 'Editar Plano Nutricional' : 'Novo Plano Nutricional'}</h3>
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
                {saving ? 'Salvando...' : editingPlanId ? 'Salvar Alterações' : 'Salvar e Ativar'}
              </button>
              <button onClick={() => setPlanOpen(false)} className="px-4 py-2.5 border border-border text-sm text-muted-foreground rounded-lg hover:bg-secondary">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tabela de evolução por data ─────────────────────────────────────────────
// Linhas = métricas, colunas = medições ordenadas por data, com delta vs anterior.

type MetricDef = {
  label: string
  get: (bc: BodyCompositionRow) => number | null
  unit: string
  decimals: number
  /** 'down' = queda é boa (verde); 'up' = aumento é bom */
  goodDirection: 'down' | 'up' | null
}

function EvolutionTable({ bodyComp, heightCm, onDelete, onEdit }: {
  bodyComp: BodyCompositionRow[]
  heightCm: number | null
  onDelete: (id: string) => void
  onEdit: (bc: BodyCompositionRow) => void
}) {
  const sorted = [...bodyComp].sort((a, b) => a.measured_at.localeCompare(b.measured_at))

  const metrics: MetricDef[] = [
    { label: 'Peso', get: bc => bc.weight_kg, unit: 'kg', decimals: 1, goodDirection: 'down' },
    { label: 'IMC', get: bc => calcIMC(bc.weight_kg, heightCm), unit: '', decimals: 2, goodDirection: 'down' },
    { label: 'Massa Gorda', get: bc => bc.fat_mass_kg, unit: 'kg', decimals: 2, goodDirection: 'down' },
    { label: '% Massa Gorda', get: bc => bc.body_fat_pct, unit: '%', decimals: 2, goodDirection: 'down' },
    { label: 'Massa Magra', get: bc => bc.lean_mass_kg, unit: 'kg', decimals: 2, goodDirection: 'up' },
    { label: '% Massa Magra', get: bc => bc.lean_mass_pct, unit: '%', decimals: 2, goodDirection: 'up' },
    { label: 'Massa Muscular', get: bc => bc.muscle_mass_kg, unit: 'kg', decimals: 2, goodDirection: 'up' },
    { label: 'Razão cintura/quadril', get: bc => bc.waist_hip_ratio, unit: '', decimals: 2, goodDirection: 'down' },
    { label: 'Densidade Corporal', get: bc => bc.body_density, unit: '', decimals: 2, goodDirection: 'up' },
    { label: 'Soma de dobras', get: bc => bc.skinfold_sum_mm, unit: 'mm', decimals: 0, goodDirection: 'down' },
    { label: 'Área Muscular do Braço (AMB)', get: bc => bc.arm_muscle_area, unit: '', decimals: 2, goodDirection: 'up' },
    { label: 'Área de Gordura do Braço (AGB)', get: bc => bc.arm_fat_area, unit: '', decimals: 2, goodDirection: 'down' },
    { label: 'Gordura Visceral', get: bc => bc.visceral_fat, unit: '', decimals: 0, goodDirection: 'down' },
  ]

  // Só mostra linhas que têm pelo menos um valor
  const visibleMetrics = metrics.filter(m => sorted.some(bc => m.get(bc) != null))
  if (sorted.length === 0 || visibleMetrics.length === 0) return null

  const fmt = (v: number, decimals: number) => v.toFixed(decimals).replace('.', ',')

  return (
    <div className="mt-2 pt-3 border-t border-border/30">
      <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Evolução</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs" style={{ minWidth: 140 + sorted.length * 110 }}>
          <thead>
            <tr>
              <th className="text-left py-2 pr-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider sticky left-0 bg-card">Data</th>
              {sorted.map(bc => (
                <th key={bc.id} className="text-right py-2 px-2 text-[10px] font-bold text-foreground whitespace-nowrap">
                  {fmtDate(bc.measured_at)}
                  <button onClick={() => onEdit(bc)} className="ml-1.5 align-middle" title="Editar medição">
                    <Pencil className="w-2.5 h-2.5 inline text-muted-foreground/40 hover:text-[#60a5fa]" />
                  </button>
                  <button onClick={() => onDelete(bc.id)} className="ml-1 align-middle" title="Excluir medição">
                    <X className="w-2.5 h-2.5 inline text-muted-foreground/40 hover:text-muted-foreground" />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {visibleMetrics.map(m => (
              <tr key={m.label}>
                <td className="py-2 pr-3 text-[11px] text-muted-foreground whitespace-nowrap sticky left-0 bg-card">{m.label}</td>
                {sorted.map((bc, i) => {
                  const v = m.get(bc)
                  if (v == null) return <td key={bc.id} className="text-right py-2 px-2 text-muted-foreground/30">—</td>
                  // Delta vs medição anterior que tenha valor
                  let delta: number | null = null
                  for (let j = i - 1; j >= 0; j--) {
                    const prev = m.get(sorted[j])
                    if (prev != null) { delta = v - prev; break }
                  }
                  const deltaGood = delta != null && m.goodDirection != null
                    ? (m.goodDirection === 'down' ? delta < 0 : delta > 0)
                    : null
                  return (
                    <td key={bc.id} className="text-right py-2 px-2 whitespace-nowrap">
                      <span className="font-semibold text-foreground">{fmt(v, m.decimals)}{m.unit ? ` ${m.unit}` : ''}</span>
                      {delta != null && Math.abs(delta) >= 0.005 && (
                        <span className="block text-[10px]"
                          style={{ color: deltaGood == null ? '#64748b' : deltaGood ? '#4ade80' : '#fbbf24' }}>
                          ({delta > 0 ? '+' : ''}{fmt(delta, m.decimals)})
                        </span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const inputCls = 'w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary'
