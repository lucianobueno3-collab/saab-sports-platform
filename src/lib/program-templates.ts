// Composições de programas de treino (compositor visual) + exemplos prontos.

export type ProgramWorkout = {
  day: number            // 0=segunda … 6=domingo
  sport: string
  title: string
  description?: string
  duration_min?: number | null
  tss?: number | null
}
export type ProgramWeek = { label: string; workouts: ProgramWorkout[] }
export type ProgramRouting = {
  currently_running?: boolean | null
  levels?: string[]
  goals?: string[]
  min_days?: number | null
  max_days?: number | null
}

// ─── Exemplo: Do 0 aos 5 km em 8 semanas (método corrida/caminhada) ──────────
// 3 sessões por semana (seg / qua / sáb). Progressão do run/walk até 5 km contínuos.
const C25K: { label: string; base: string; dur: number; tss: number; long: string; longDur: number; longTss: number }[] = [
  { label: 'Base',        base: '8× (1 min corrida leve + 2 min caminhada). Respiração confortável.', dur: 30, tss: 20, long: '9× (1 min corrida + 2 min caminhada).', longDur: 33, longTss: 24 },
  { label: 'Base',        base: '7× (1min30 corrida + 2 min caminhada).', dur: 30, tss: 24, long: '8× (1min30 corrida + 2 min caminhada).', longDur: 33, longTss: 28 },
  { label: 'Adaptação',   base: '6× (2 min corrida + 2 min caminhada).', dur: 32, tss: 28, long: '6× (2 min corrida + 1min30 caminhada).', longDur: 32, longTss: 32 },
  { label: 'Adaptação',   base: '5× (3 min corrida + 2 min caminhada).', dur: 33, tss: 32, long: '4× (4 min corrida + 2 min caminhada).', longDur: 34, longTss: 36 },
  { label: 'Desenvolvimento', base: '4× (5 min corrida + 2 min caminhada).', dur: 34, tss: 38, long: '3× (6 min corrida + 2 min caminhada).', longDur: 34, longTss: 42 },
  { label: 'Desenvolvimento', base: '3× (8 min corrida + 2 min caminhada).', dur: 34, tss: 44, long: '2× (10 min corrida + 2 min caminhada) + 5 min leve.', longDur: 35, longTss: 48 },
  { label: 'Específico',  base: '2× (12 min corrida + 2 min caminhada).', dur: 33, tss: 50, long: '20 min corrida contínua leve (caminhe se precisar).', longDur: 30, longTss: 52 },
  { label: 'Prova',       base: '10 min aquecendo + 15 min corrida contínua.', dur: 28, tss: 48, long: 'Prova: 5 km contínuos no seu ritmo. 🎉', longDur: 35, longTss: 60 },
]

export function couchTo5k8Weeks() {
  const weeks: ProgramWeek[] = C25K.map((w, i) => ({
    label: `Semana ${i + 1} · ${w.label}`,
    workouts: [
      { day: 0, sport: 'running', title: 'Corrida/caminhada', description: w.base, duration_min: w.dur, tss: w.tss },
      { day: 1, sport: 'strength', title: STRENGTH_A.title, description: STRENGTH_A.description, duration_min: STRENGTH_A.duration_min, tss: STRENGTH_A.tss },
      { day: 2, sport: 'running', title: 'Corrida/caminhada', description: w.base, duration_min: w.dur, tss: w.tss },
      { day: 3, sport: 'strength', title: STRENGTH_B.title, description: STRENGTH_B.description, duration_min: STRENGTH_B.duration_min, tss: STRENGTH_B.tss },
      { day: 5, sport: 'running', title: i === 7 ? 'Prova 5 km' : 'Corrida/caminhada (longo)', description: w.long, duration_min: w.longDur, tss: w.longTss },
    ],
  }))
  return {
    name: 'Do 0 aos 5 km — 8 semanas (com força)',
    description: 'Iniciante do zero: método corrida/caminhada progressivo até 5 km contínuos + 2 sessões de força de prevenção. Os dias são definidos pela anamnese (corrida nos dias preferidos, força nos dias que sobram).',
    sport: 'running',
    goal: '5km',
    level: 'iniciante',
    routing: { currently_running: false, levels: ['iniciante'], goals: ['5km'], min_days: 2, max_days: 3 } as ProgramRouting,
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
export type ExpandedWorkout = { date: string; sport: string; title: string; description: string | null; planned_duration_min: number | null; planned_tss: number | null }

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
    })
  }
}
