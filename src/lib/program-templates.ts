// Composições de programas de treino (compositor visual) + exemplos prontos.

import { estimateStructure, structureSummary, type WorkoutStructure } from './workout-structure'
import { PROGRESSAO_5K, FASE_DA_SEMANA } from './progressao-5k'

export type ProgramWorkout = {
  day: number            // 0=segunda … 6=domingo
  sport: string
  title: string
  description?: string
  duration_min?: number | null
  tss?: number | null
  structure?: WorkoutStructure | null
}
export type ProgramWeek = { label: string; workouts: ProgramWorkout[] }
export type ProgramRouting = {
  currently_running?: boolean | null
  levels?: string[]
  goals?: string[]
  min_days?: number | null
  max_days?: number | null
}

// ─── Montagem dos treinos do programa ───────────────────────────────────────

// Monta um treino de corrida estruturado, derivando duração e TSS da estrutura.
function runWorkout(day: number, title: string, structure: WorkoutStructure): ProgramWorkout {
  const est = estimateStructure(structure)
  return { day, sport: 'running', title, description: structureSummary(structure), duration_min: est.min, tss: est.tss, structure }
}

/**
 * PROGRESSÃO 5K INICIANTES — o programa do treinador, transcrito treino a
 * treino em % do ritmo limite. 3 corridas por semana + as 2 sessões de força
 * de prevenção, que caem nos dias livres.
 */
export function progressao5kIniciantes() {
  const semanas = [...new Set(PROGRESSAO_5K.map(c => c.semana))].sort((a, b) => a - b)
  const weeks: ProgramWeek[] = semanas.map(n => ({
    label: `Semana ${n} · ${FASE_DA_SEMANA[n] ?? ''}`.trim().replace(/ ·$/, ''),
    workouts: [
      ...PROGRESSAO_5K.filter(c => c.semana === n).map(c => runWorkout(c.dia, c.titulo, c.structure)),
      { day: 1, sport: 'strength', title: STRENGTH_A.title, description: STRENGTH_A.description, duration_min: STRENGTH_A.duration_min, tss: STRENGTH_A.tss, structure: null },
      { day: 3, sport: 'strength', title: STRENGTH_B.title, description: STRENGTH_B.description, duration_min: STRENGTH_B.duration_min, tss: STRENGTH_B.tss, structure: null },
    ],
  }))
  return {
    name: 'PROGRESSÃO 5K INICIANTES',
    description: 'Programa de 8 semanas, 3 corridas por semana, com cada trecho prescrito em % do ritmo limite (100% = ritmo de limiar). Evolui de tiros de 1 minuto até blocos de 15 minutos, e fecha com os 5 km direto. Inclui 2 sessões de força de prevenção nos dias livres. Os dias de corrida seguem a preferência da anamnese.',
    sport: 'running',
    goal: '5km',
    level: 'iniciante',
    routing: { currently_running: false, levels: ['iniciante'], goals: ['5km'], min_days: 3, max_days: 3 } as ProgramRouting,
    weeks,
  }
}

// ─── Treino de força para corredores (base de mercado, prevenção) ────────────
export const STRENGTH_A = {
  title: 'Força A — base do corredor',
  duration_min: 40, tss: 25,
  description: 'Agachamento livre 3×12 · Afundo/passada 3×10 (cada perna) · Ponte de glúteo 3×15 · Panturrilha em pé 3×15 · Prancha 3×30–45s. Foco: força de base e prevenção. Carga moderada, técnica em 1º lugar.',
}
export const STRENGTH_B = {
  title: 'Força B — estabilidade e core',
  duration_min: 40, tss: 25,
  description: 'Agachamento búlgaro 3×10 (cada) · Stiff/terra romeno leve 3×12 · Panturrilha unilateral 3×12 · Prancha lateral 3×30s (cada) · Dead bug/abdominal 3×12. Foco: estabilidade de quadril e core para a corrida.',
}

// ─── Roteamento pela anamnese: escolhe o melhor programa ─────────────────────
type AnamneseLike = {
  currently_running?: boolean | null
  running_level?: string | null
  activity_level?: string | null
  goal?: string | null
}
type ProgramLike = { id: string; routing: ProgramRouting | null; level?: string | null; goal?: string | null; active?: boolean }

/** Pontua cada programa contra a anamnese e devolve o melhor (ou null). */
export function recommendProgram<T extends ProgramLike>(anamnese: AnamneseLike, programs: T[]): T | null {
  const level = anamnese.currently_running ? anamnese.running_level : anamnese.activity_level
  let best: T | null = null, bestScore = -1
  for (const p of programs) {
    if (p.active === false) continue
    const r = p.routing ?? {}
    let score = 0
    if (r.goals && anamnese.goal && r.goals.includes(anamnese.goal)) score += 3
    else if (p.goal && anamnese.goal && p.goal === anamnese.goal) score += 3
    if (r.levels && level && r.levels.includes(level)) score += 2
    else if (p.level && level && p.level === level) score += 2
    if (typeof r.currently_running === 'boolean' && typeof anamnese.currently_running === 'boolean' && r.currently_running === anamnese.currently_running) score += 2
    if (score > bestScore) { bestScore = score; best = p }
  }
  return bestScore >= 3 ? best : null // exige ao menos casar o objetivo
}

// ─── Encaixe flutuante: sessões → dias reais conforme a anamnese ─────────────
export type ExpandedWorkout = { date: string; sport: string; title: string; description: string | null; planned_duration_min: number | null; planned_tss: number | null; structure: WorkoutStructure | null }

function ymd(d: Date) { return d.toLocaleDateString('en-CA') }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x }

/**
 * Expande um programa em treinos datados, com DIAS FLUTUANTES escolhidos pelo aluno:
 * - O treino LONGO (maior corrida da semana) vai para o dia escolhido para o longão.
 * - As demais corridas ocupam os outros dias preferidos.
 * - A força vai para os dias que sobram na semana.
 * `startDate` deve ser uma segunda-feira. Dias: 0=seg … 6=dom. `longRunDay` opcional.
 */
export function expandProgram(
  weeks: ProgramWeek[],
  startDate: Date,
  preferredDays: number[],
  longRunDay?: number | null,
): ExpandedWorkout[] {
  const rows: ExpandedWorkout[] = []
  const pref = [...new Set(preferredDays)].filter(d => d >= 0 && d <= 6).sort((a, b) => a - b)
  weeks.forEach((wk, w) => {
    const principal = wk.workouts.filter(x => x.sport !== 'strength')
    const strength = wk.workouts.filter(x => x.sport === 'strength')
    const used = new Set<number>()

    if (pref.length) {
      // Dia do longão: o escolhido (se estiver entre os preferidos) senão o último preferido.
      const longDay = (longRunDay != null && pref.includes(longRunDay)) ? longRunDay : pref[pref.length - 1]
      // Sessão mais longa (o "longão"): maior duração entre as corridas.
      let longIdx = 0
      principal.forEach((x, i) => { if ((x.duration_min ?? 0) > (principal[longIdx].duration_min ?? 0)) longIdx = i })
      // Demais dias preferidos, na ordem, para as corridas curtas.
      const otherDays = pref.filter(d => d !== longDay)
      let oi = 0
      principal.forEach((x, i) => {
        const day = i === longIdx ? longDay : (otherDays[oi++] ?? longDay)
        used.add(day); push(x, w, day)
      })
    } else {
      // Sem preferência informada: usa os dias originais do template.
      principal.forEach(x => { used.add(x.day); push(x, w, x.day) })
    }

    // Força: nos dias que sobram na semana.
    const free = [0, 1, 2, 3, 4, 5, 6].filter(d => !used.has(d))
    strength.forEach((x, j) => {
      const day = free[j] ?? free[free.length - 1] ?? x.day
      used.add(day); push(x, w, day)
    })
  })
  return rows.sort((a, b) => (a.date < b.date ? -1 : 1))

  function push(x: ProgramWorkout, week: number, day: number) {
    rows.push({
      date: ymd(addDays(startDate, week * 7 + day)),
      sport: x.sport, title: x.title, description: x.description ?? null,
      planned_duration_min: x.duration_min ?? null, planned_tss: x.tss ?? null,
      structure: x.structure ?? null,
    })
  }
}
