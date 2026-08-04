// Composições de programas de treino (compositor visual) + exemplos prontos.

import { estimateStructure, structureSummary, type WorkoutStructure } from './workout-structure'
import { PROGRESSAO_5K, FASE_DA_SEMANA } from './progressao-5k'
import { FASE_1_FORCA, estimarForca, resumoDeForca } from './fase-1-forca'
import type { LibExercise } from './supabase/queries'

export type ProgramWorkout = {
  day: number            // 0=segunda … 6=domingo
  sport: string
  title: string
  description?: string
  duration_min?: number | null
  tss?: number | null
  structure?: WorkoutStructure | null
  /** Exercícios, quando é treino de força — o equivalente de `structure`. */
  exercises?: LibExercise[] | null
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

// Monta um treino de força já com os exercícios — o equivalente de runWorkout.
function strengthWorkout(day: number, s: { title: string; description: string; duration_min: number; tss: number; exercicios: LibExercise[] }): ProgramWorkout {
  return {
    day, sport: 'strength', title: s.title, description: s.description,
    duration_min: s.duration_min, tss: s.tss, structure: null, exercises: s.exercicios,
  }
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
      strengthWorkout(1, STRENGTH_A),
      strengthWorkout(3, STRENGTH_B),
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

// ─── Força de prevenção que acompanha a corrida ──────────────────────────────
// Estruturadas como as da FASE 1: o aluno vê exercício por exercício, e não
// uma frase corrida que ninguém consegue seguir na academia.

function forca(title: string, foco: string, exercicios: LibExercise[]) {
  const est = estimarForca(exercicios)
  return { title, duration_min: est.min, tss: est.tss, exercicios, description: `${foco} ${resumoDeForca(exercicios)}` }
}

const p = (name: string, muscle: string, sets: string, reps: string, rest_s = 60, note?: string): LibExercise =>
  ({ name, muscle, sets, reps, load: '', rest_s, ...(note ? { note } : {}) })

export const STRENGTH_A = forca(
  'Força A — base do corredor',
  'Força de base e prevenção. Carga moderada, técnica em 1º lugar.',
  [
    p('Agachamento livre', 'Quadríceps / glúteo', '3', '12', 90),
    p('Afundo / passada', 'Unipodal', '3', '10', 60, 'cada perna'),
    p('Ponte de glúteo', 'Glúteo', '3', '15', 45),
    p('Panturrilha em pé', 'Panturrilha', '3', '15', 45),
    p('Prancha isométrica', 'Core', '3', '45s', 45),
  ],
)

export const STRENGTH_B = forca(
  'Força B — estabilidade e core',
  'Estabilidade de quadril e core para a corrida.',
  [
    p('Agachamento búlgaro', 'Unipodal', '3', '10', 90, 'cada perna'),
    p('Stiff / terra romeno leve', 'Posterior de coxa', '3', '12', 90),
    p('Panturrilha unilateral', 'Panturrilha', '3', '12', 45, 'cada perna'),
    p('Prancha lateral', 'Core anti-rotação', '3', '30s', 45, 'cada lado'),
    p('Dead bug / abdominal', 'Core', '3', '12', 45),
  ],
)

/**
 * FASE 1 FORÇA — o programa de sala do treinador: A, B e C girando na semana.
 *
 * 4 semanas porque é o ciclo em que a pirâmide 12/12/10/8 ainda progride pela
 * carga; depois disso o estímulo satura e pede outra fase. Os dias saem
 * segunda/quarta/sexta no modelo, mas quem aplica escolhe os dias reais — os
 * dias do plano são só o ponto de partida.
 */
export function fase1Forca() {
  const sessoes = FASE_1_FORCA.map(s => {
    const est = estimarForca(s.exercicios)
    return {
      sport: 'strength', title: s.titulo,
      description: `${s.foco} ${resumoDeForca(s.exercicios)}`,
      duration_min: est.min, tss: est.tss, structure: null,
      exercises: s.exercicios,
    }
  })
  const DIAS = [0, 2, 4] // seg · qua · sex
  const weeks: ProgramWeek[] = [1, 2, 3, 4].map(n => ({
    label: `Semana ${n}`,
    workouts: sessoes.map((s, i) => ({ ...s, day: DIAS[i] })),
  }))
  return {
    name: 'FASE 1 FORÇA',
    description: 'Programa de sala em 3 sessões que giram na semana: A (costas e bíceps), B (peito e ombros) e C (pernas e glúteos). Quase tudo em 4 séries de 12/12/10/8 — a carga sobe enquanto as repetições caem — com 45s de intervalo; abdômen e panturrilha ficam em 4×15. Cada sessão chega ao aluno com os exercícios série a série.',
    sport: 'strength',
    goal: 'forca',
    level: 'iniciante',
    routing: { levels: ['iniciante', 'intermediario'], goals: ['forca'], min_days: 3, max_days: 3 } as ProgramRouting,
    weeks,
  }
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
export type ExpandedWorkout = { date: string; sport: string; title: string; description: string | null; planned_duration_min: number | null; planned_tss: number | null; structure: WorkoutStructure | null; exercises: LibExercise[] | null }

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
    const semForca = wk.workouts.filter(x => x.sport !== 'strength')
    // Num plano só de sala (FASE 1 FORÇA), a força É o treino principal: sem
    // isso ela caía nos "dias que sobram" e ignorava os dias escolhidos.
    const soDeForca = semForca.length === 0
    const principal = soDeForca ? wk.workouts : semForca
    const strength = soDeForca ? [] : wk.workouts.filter(x => x.sport === 'strength')
    const used = new Set<number>()

    if (pref.length && soDeForca) {
      // Sala não tem "longão": A, B e C caem nos dias escolhidos, na ordem. A
      // sequência é o próprio treino — trocar a ordem juntaria dois dias de
      // perna, ou deixaria as costas duas vezes seguidas.
      principal.forEach((x, i) => {
        const day = pref[i % pref.length]
        used.add(day); push(x, w, day)
      })
    } else if (pref.length) {
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
      structure: x.structure ?? null, exercises: x.exercises ?? null,
    })
  }
}
