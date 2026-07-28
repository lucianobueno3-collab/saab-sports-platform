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
      { day: 2, sport: 'running', title: 'Corrida/caminhada', description: w.base, duration_min: w.dur, tss: w.tss },
      { day: 5, sport: 'running', title: i === 7 ? 'Prova 5 km' : 'Corrida/caminhada (longo)', description: w.long, duration_min: w.longDur, tss: w.longTss },
    ],
  }))
  return {
    name: 'Do 0 aos 5 km — 8 semanas',
    description: 'Programa para iniciantes do zero: método corrida/caminhada progressivo até correr 5 km contínuos. 3 sessões por semana.',
    sport: 'running',
    goal: 'concluir_5_10k',
    level: 'iniciante',
    routing: { currently_running: false, levels: ['iniciante'], goals: ['concluir_5_10k'], min_days: 2, max_days: 3 } as ProgramRouting,
    weeks,
  }
}
