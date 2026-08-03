// Modelo de treino estruturado (passos por zona) — base para o construtor,
// o gráfico de blocos e a estimativa de TSS (inspirado no TrainingPeaks).

export type Zone = 1 | 2 | 3 | 4 | 5

export const ZONES: Record<Zone, { label: string; name: string; color: string; if: number }> = {
  1: { label: 'Z1', name: 'Recuperação', color: '#94a3b8', if: 0.55 },
  2: { label: 'Z2', name: 'Aeróbico',    color: '#22c55e', if: 0.70 },
  3: { label: 'Z3', name: 'Tempo',       color: '#eab308', if: 0.85 },
  4: { label: 'Z4', name: 'Limiar',      color: '#f97316', if: 0.98 },
  5: { label: 'Z5', name: 'VO2 / anaer.', color: '#ef4444', if: 1.12 },
}

export type StepKind = 'warmup' | 'work' | 'recovery' | 'steady' | 'cooldown'

export const KIND_LABEL: Record<StepKind, string> = {
  warmup: 'Aquecimento', work: 'Principal', recovery: 'Recuperação', steady: 'Constante', cooldown: 'Desaquecimento',
}

export type Step = { kind: StepKind; min: number; zone: Zone; note?: string }
export type Segment =
  | { type: 'step'; step: Step }
  | { type: 'repeat'; times: number; steps: Step[] }
export type WorkoutStructure = Segment[]

/** Expande séries (repeats) numa lista linear de passos. */
export function flattenSteps(st: WorkoutStructure): Step[] {
  const out: Step[] = []
  for (const seg of st) {
    if (seg.type === 'step') out.push(seg.step)
    else for (let i = 0; i < Math.max(1, seg.times); i++) out.push(...seg.steps)
  }
  return out
}

/** Duração total (min) e TSS estimado a partir da estrutura. */
export function estimateStructure(st: WorkoutStructure): { min: number; tss: number } {
  let min = 0, tss = 0
  for (const s of flattenSteps(st)) {
    const dur = Math.max(0, s.min || 0)
    min += dur
    const IF = ZONES[s.zone].if
    tss += (dur / 60) * IF * IF * 100
  }
  return { min: Math.round(min), tss: Math.round(tss) }
}

export type ZoneTotal = { zone: Zone; min: number; pct: number }

/**
 * Quanto tempo o treino passa em cada zona.
 *
 * É o que o aluno mais pergunta ("quanto tempo eu fico forte?") e o que
 * explica a intenção do treino melhor do que a duração total.
 */
export function zoneTotals(st: WorkoutStructure): ZoneTotal[] {
  const porZona = new Map<Zone, number>()
  for (const s of flattenSteps(st)) {
    const dur = Math.max(0, s.min || 0)
    if (dur > 0) porZona.set(s.zone, (porZona.get(s.zone) ?? 0) + dur)
  }
  const total = Array.from(porZona.values()).reduce((a, b) => a + b, 0)
  if (total === 0) return []
  return Array.from(porZona.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([zone, min]) => ({ zone, min: Math.round(min), pct: Math.round((min / total) * 100) }))
}

/**
 * Zona que define o treino: a mais intensa com peso relevante (≥10% do tempo).
 * Sem isso um aquecimento longo faria um treino de tiros parecer leve.
 */
export function dominantZone(st: WorkoutStructure): Zone | null {
  const totais = zoneTotals(st)
  if (totais.length === 0) return null
  const relevantes = totais.filter(t => t.pct >= 10)
  const base = relevantes.length ? relevantes : totais
  return base.reduce((a, b) => (b.zone > a.zone ? b : a)).zone
}

/** Resumo textual curto de uma estrutura (para descrição/legenda). */
export function structureSummary(st: WorkoutStructure): string {
  return st.map(seg => {
    if (seg.type === 'step') return `${seg.step.min}min ${ZONES[seg.step.zone].label}`
    const inner = seg.steps.map(s => `${s.min}min ${ZONES[s.zone].label}`).join(' + ')
    return `${seg.times}x (${inner})`
  }).join(' · ')
}
