// Biblioteca de planos de endurance com periodização gerada (base → específico →
// pico → polimento), com semanas de recuperação e taper — inspirada em modelos
// consagrados de mercado (Friel, Daniels, polarizado 80/20).

import type { WorkoutStructure, Step, Zone } from '@/lib/workout-structure'
import { estimateStructure, structureSummary } from '@/lib/workout-structure'

export type PlanSport = 'running' | 'cycling' | 'triathlon'

export interface PlanDef {
  key: string
  name: string
  sport: PlanSport
  goal: string
  weeks: number
  level: 'iniciante' | 'intermediario' | 'avancado'
  focus: string
  week: { day: number; type: SType }[]   // day: 0=segunda … 6=domingo
}

type SType =
  | 'easy' | 'long' | 'tempo' | 'intervals' | 'recovery'
  | 'walkrun' | 'run_base'
  | 'bike_end' | 'bike_int' | 'bike_long'
  | 'swim' | 'brick' | 'strength'

const BASE: Record<SType, { sport: string; dur: number; tss: number; grow: boolean; title: string; desc: string }> = {
  walkrun:   { sport: 'running', dur: 30,  tss: 22,  grow: false, title: 'Corrida/caminhada',  desc: 'Alterne corrida leve e caminhada (ex.: 2min corre / 1min anda). Total 25–35min, respiração confortável — você consegue conversar.' },
  run_base:  { sport: 'running', dur: 30,  tss: 30,  grow: true,  title: 'Corrida leve contínua', desc: 'Corra contínuo e leve em Z2. Se cansar, intercale caminhadas curtas e volte a correr. O objetivo é o tempo em pé, não a velocidade.' },
  easy:      { sport: 'running', dur: 45,  tss: 40,  grow: false, title: 'Rodagem leve',      desc: 'Ritmo confortável em Z2 (consegue conversar).' },
  long:      { sport: 'running', dur: 80,  tss: 80,  grow: true,  title: 'Longo',             desc: 'Volume aeróbico em Z2. Base de resistência.' },
  tempo:     { sport: 'running', dur: 50,  tss: 65,  grow: false, title: 'Tempo / limiar',    desc: 'Bloco contínuo em Z3–Z4 (ex.: 2–4x 10min limiar).' },
  intervals: { sport: 'running', dur: 55,  tss: 78,  grow: false, title: 'Intervalado (VO2)', desc: 'Séries fortes Z4–Z5 (ex.: 5x1km, rec 2min).' },
  recovery:  { sport: 'running', dur: 30,  tss: 20,  grow: false, title: 'Regenerativo',      desc: 'Muito leve Z1, soltar as pernas.' },
  bike_end:  { sport: 'cycling', dur: 90,  tss: 60,  grow: false, title: 'Pedal base Z2',     desc: 'Endurance constante em Z2, cadência 85–95.' },
  bike_int:  { sport: 'cycling', dur: 75,  tss: 88,  grow: false, title: 'Bike intervalado',  desc: 'Ex.: 4x8min Z4 (rec 4min) ou 5x5min Z5.' },
  bike_long: { sport: 'cycling', dur: 150, tss: 110, grow: true,  title: 'Pedal longo',       desc: 'Volume aeróbico Z2, praticar nutrição em movimento.' },
  swim:      { sport: 'swimming',dur: 45,  tss: 35,  grow: false, title: 'Natação',           desc: 'Educativos + série principal moderada (técnica).' },
  brick:     { sport: 'triathlon',dur: 120,tss: 130, grow: true,  title: 'Brick (bike+run)',  desc: 'Pedal Z2–Z3 emendando corrida curta no ritmo de prova.' },
  strength:  { sport: 'strength',dur: 40,  tss: 25,  grow: false, title: 'Força / prevenção', desc: 'Padrões compostos + core (foco em prevenção).' },
}

// ─── Estrutura por tipo de sessão ───────────────────────────────────────────
// Sem isso o aluno só via a frase da descrição. Cada tipo vira passos de
// verdade, que se ajustam à duração daquela semana do plano.

/** Bloco contínuo numa zona só (rodagem, longo, regenerativo). */
function continuo(min: number, zone: Zone, kind: Step['kind'] = 'steady'): WorkoutStructure {
  return [{ type: 'step', step: { kind, min, zone } }]
}

/**
 * Aquecimento + séries + desaquecimento, encaixado na duração pedida.
 *
 * O número de repetições se ajusta ao tempo disponível: numa semana de base o
 * treino é mais curto e sai com menos séries; na semana de pico, com mais.
 * Nunca abaixo de 2 séries — menos que isso não é treino intervalado.
 */
function series(
  total: number, aquece: number, forte: number, zonaForte: Zone,
  recupera: number, desaquece: number, nota?: string,
): WorkoutStructure {
  const paraSeries = Math.max(forte + recupera, total - aquece - desaquece)
  const vezes = Math.max(2, Math.round(paraSeries / (forte + recupera)))
  return [
    { type: 'step', step: { kind: 'warmup', min: aquece, zone: 2 } },
    { type: 'repeat', times: vezes, steps: [
      { kind: 'work', min: forte, zone: zonaForte, note: nota },
      { kind: 'recovery', min: recupera, zone: 1 },
    ] },
    { type: 'step', step: { kind: 'cooldown', min: desaquece, zone: 1 } },
  ]
}

/** Corrida/caminhada do iniciante: alterna trote leve e caminhada. */
function corridaCaminhada(total: number): WorkoutStructure {
  const aquece = 5, desaquece = 5
  const vezes = Math.max(3, Math.round((total - aquece - desaquece) / 3))
  return [
    { type: 'step', step: { kind: 'warmup', min: aquece, zone: 1, note: 'caminhada rápida' } },
    { type: 'repeat', times: vezes, steps: [
      { kind: 'work', min: 2, zone: 2, note: 'trote leve — dá pra conversar' },
      { kind: 'recovery', min: 1, zone: 1, note: 'caminhada' },
    ] },
    { type: 'step', step: { kind: 'cooldown', min: desaquece, zone: 1, note: 'caminhada' } },
  ]
}

/**
 * Faz os passos somarem exatamente a duração prevista.
 *
 * Sem isso o aluno vê "50 min" no card e passos que somam 53 — arredondamento
 * do número de séries. Escala tudo proporcionalmente e joga a sobra num passo
 * solto (aquecimento ou desaquecimento), nunca dentro de uma série, porque ali
 * um minuto a mais vira um minuto vezes o número de repetições.
 */
function ajustarPara(st: WorkoutStructure, total: number): WorkoutStructure {
  const atual = estimateStructure(st).min
  if (atual <= 0 || total <= 0) return st

  const fator = total / atual
  const escalado: WorkoutStructure = st.map(seg => seg.type === 'step'
    ? { type: 'step', step: { ...seg.step, min: Math.max(1, Math.round(seg.step.min * fator)) } }
    : { type: 'repeat', times: seg.times, steps: seg.steps.map(p => ({ ...p, min: Math.max(1, Math.round(p.min * fator)) })) })

  // Sobra do arredondamento: absorvida pelo maior passo solto.
  let sobra = total - estimateStructure(escalado).min
  if (sobra !== 0) {
    const soltos = escalado
      .map((seg, i) => ({ seg, i }))
      .filter(x => x.seg.type === 'step')
      .sort((a, b) => (b.seg as { step: Step }).step.min - (a.seg as { step: Step }).step.min)
    for (const { i } of soltos) {
      if (sobra === 0) break
      const seg = escalado[i] as { type: 'step'; step: Step }
      const novo = Math.max(1, seg.step.min + sobra)
      sobra -= novo - seg.step.min
      escalado[i] = { type: 'step', step: { ...seg.step, min: novo } }
    }
  }
  return escalado
}

/** Monta a estrutura de uma sessão já sabendo quantos minutos ela terá. */
export function structureFor(type: SType, min: number): WorkoutStructure {
  return ajustarPara(estruturaBruta(type, min), min)
}

function estruturaBruta(type: SType, min: number): WorkoutStructure {
  switch (type) {
    case 'walkrun':   return corridaCaminhada(min)
    case 'run_base':  return [
      { type: 'step', step: { kind: 'warmup', min: 5, zone: 1 } },
      { type: 'step', step: { kind: 'steady', min: Math.max(10, min - 10), zone: 2, note: 'se cansar, caminhe um pouco e volte a correr' } },
      { type: 'step', step: { kind: 'cooldown', min: 5, zone: 1 } },
    ]
    case 'easy':      return continuo(min, 2)
    case 'long':      return continuo(min, 2, 'steady')
    case 'recovery':  return continuo(min, 1, 'steady')
    case 'tempo':     return series(min, 15, 10, 4, 3, 10, 'ritmo forte e constante, sem sprintar')
    case 'intervals': return series(min, 15, 4, 5, 3, 10, 'forte — respiração pesada, sem conversa')
    case 'bike_end':  return continuo(min, 2, 'steady')
    case 'bike_long': return continuo(min, 2, 'steady')
    case 'bike_int':  return series(min, 15, 8, 4, 4, 10, 'cadência firme, sem oscilar a força')
    case 'swim':      return [
      { type: 'step', step: { kind: 'warmup', min: 10, zone: 1, note: 'educativos e técnica' } },
      { type: 'step', step: { kind: 'work', min: Math.max(10, min - 20), zone: 3, note: 'série principal moderada' } },
      { type: 'step', step: { kind: 'cooldown', min: 10, zone: 1, note: 'soltura' } },
    ]
    case 'brick':     return [
      { type: 'step', step: { kind: 'warmup', min: 10, zone: 1, note: 'bike, soltando as pernas' } },
      { type: 'step', step: { kind: 'work', min: Math.max(20, Math.round(min * 0.65)), zone: 3, note: 'bike no ritmo de prova' } },
      { type: 'step', step: { kind: 'work', min: Math.max(10, Math.round(min * 0.25)), zone: 3, note: 'trocar rápido e emendar a corrida' } },
      { type: 'step', step: { kind: 'cooldown', min: 5, zone: 1 } },
    ]
    case 'strength':  return [
      { type: 'step', step: { kind: 'warmup', min: 8, zone: 1, note: 'mobilidade e ativação' } },
      { type: 'step', step: { kind: 'work', min: Math.max(10, min - 13), zone: 2, note: 'padrões compostos + core' } },
      { type: 'step', step: { kind: 'cooldown', min: 5, zone: 1 } },
    ]
  }
}

/**
 * Estrutura de um treino já salvo que ficou sem passos.
 *
 * Os planos aplicados antes desta versão gravaram só a frase da descrição, e
 * o aluno via um treino inteiro resumido em uma linha. Como o título vem deste
 * mesmo catálogo, dá para remontar os passos sem adivinhar nada: é a mesma
 * definição que gerou o treino, aplicada à duração que ficou salva.
 *
 * Devolve null para treino escrito à mão pelo treinador — aí não há o que
 * remontar, e inventar passos seria pior do que não mostrar.
 */
export function structureForTitle(title: string, min: number | null | undefined): WorkoutStructure | null {
  if (!min || min <= 0) return null
  const alvo = title.trim().toLowerCase()
  const achado = (Object.keys(BASE) as SType[]).find(t => BASE[t].title.toLowerCase() === alvo)
  return achado ? structureFor(achado, min) : null
}

export interface GenWorkout {
  day: number; sport: string; title: string; description: string
  duration_min: number; tss: number; structure: WorkoutStructure
}
export interface GenWeek { week: number; phase: string; workouts: GenWorkout[] }

function taperWeeks(weeks: number) { return weeks >= 12 ? 2 : 1 }

function phaseOf(week: number, weeks: number): string {
  const t = taperWeeks(weeks)
  if (week > weeks - t) return 'Polimento'
  if (week > weeks * 0.72) return 'Pico'
  if (week > weeks * 0.42) return 'Específico'
  return 'Base'
}

// Carga relativa da semana (ramp + deload a cada 4ª semana + taper no fim)
function weekLoad(week: number, weeks: number): number {
  const t = taperWeeks(weeks)
  if (week > weeks - t) {
    const into = week - (weeks - t)              // 1..t
    return 0.6 - 0.12 * (into - 1)               // taper decrescente
  }
  const rampEnd = weeks - t
  const ramp = 0.82 + 0.42 * ((week - 1) / Math.max(1, rampEnd - 1)) // 0.82 → ~1.24
  const isDeload = week % 4 === 0
  return isDeload ? ramp * 0.62 : ramp
}

export function generatePlan(def: PlanDef): GenWeek[] {
  const weeks: GenWeek[] = []
  for (let w = 1; w <= def.weeks; w++) {
    const load = weekLoad(w, def.weeks)
    const progress = (w - 1) / Math.max(1, def.weeks - 1)
    const workouts: GenWorkout[] = def.week.map(({ day, type }) => {
      const b = BASE[type]
      const factor = b.grow ? load * (0.8 + 0.55 * progress) : load
      const dur = Math.max(20, Math.round((b.dur * factor) / 5) * 5)
      const structure = structureFor(type, dur)
      // A duração real é a soma dos passos: melhor o número bater com o que o
      // aluno vai fazer do que com o alvo teórico da semana.
      const est = estimateStructure(structure)
      return {
        day, sport: b.sport, title: b.title,
        description: `${b.desc}\n\n${structureSummary(structure)}`,
        duration_min: est.min, tss: Math.max(10, est.tss || Math.round(b.tss * factor)),
        structure,
      }
    })
    weeks.push({ week: w, phase: phaseOf(w, def.weeks), workouts })
  }
  return weeks
}

export function planTotals(def: PlanDef) {
  const gen = generatePlan(def)
  let sessions = 0, tss = 0, minutes = 0
  for (const wk of gen) for (const s of wk.workouts) { sessions++; tss += s.tss; minutes += s.duration_min }
  return { sessions, tss, hours: Math.round(minutes / 60), perWeek: def.week.length }
}

// ─── Catálogo (dias: 0=seg,1=ter,2=qua,3=qui,4=sex,5=sáb,6=dom) ──────────────
export const PLAN_LIBRARY: PlanDef[] = [
  {
    key: 'run_first5k_12', name: 'Meus primeiros 5 km — 12 semanas', sport: 'running', goal: 'Concluir 5 km', weeks: 12, level: 'iniciante',
    focus: 'Método corrida/caminhada progressivo (couch-to-5k) para quem está começando do zero. 3 sessões por semana, evoluindo de intervalos curtos até correr 5 km contínuos.',
    week: [{ day: 0, type: 'walkrun' }, { day: 2, type: 'walkrun' }, { day: 5, type: 'run_base' }],
  },
  {
    key: 'run_10k_8', name: '10 km — 8 semanas', sport: 'running', goal: 'Prova de 10 km', weeks: 8, level: 'iniciante',
    focus: 'Base aeróbica + limiar. 4 sessões/semana, modelo 80/20 (maioria leve).',
    week: [{ day: 1, type: 'intervals' }, { day: 3, type: 'tempo' }, { day: 4, type: 'easy' }, { day: 6, type: 'long' }],
  },
  {
    key: 'run_21k_12', name: 'Meia maratona — 12 semanas', sport: 'running', goal: '21 km', weeks: 12, level: 'intermediario',
    focus: 'Volume progressivo + limiar e ritmo de prova. 5 sessões, longo crescente até ~1h50.',
    week: [{ day: 0, type: 'easy' }, { day: 1, type: 'intervals' }, { day: 3, type: 'tempo' }, { day: 4, type: 'easy' }, { day: 6, type: 'long' }],
  },
  {
    key: 'run_42k_16', name: 'Maratona — 16 semanas', sport: 'running', goal: '42 km', weeks: 16, level: 'avancado',
    focus: 'Grande volume aeróbico, longos com blocos no ritmo de maratona, taper de 2 semanas.',
    week: [{ day: 0, type: 'easy' }, { day: 1, type: 'intervals' }, { day: 3, type: 'tempo' }, { day: 4, type: 'easy' }, { day: 5, type: 'recovery' }, { day: 6, type: 'long' }],
  },
  {
    key: 'run_5k_6', name: '5 km rápido — 6 semanas', sport: 'running', goal: '5 km (velocidade)', weeks: 6, level: 'intermediario',
    focus: 'Bloco curto e intenso: VO2max e ritmo de 5k. Ideal para afiar a velocidade.',
    week: [{ day: 1, type: 'intervals' }, { day: 3, type: 'tempo' }, { day: 4, type: 'easy' }, { day: 6, type: 'long' }],
  },
  {
    key: 'bike_base_8', name: 'Ciclismo — Base 8 semanas', sport: 'cycling', goal: 'Base aeróbica', weeks: 8, level: 'iniciante',
    focus: 'Construção de base em Z2 com toques de limiar. Fundamento para qualquer objetivo.',
    week: [{ day: 1, type: 'bike_int' }, { day: 3, type: 'bike_end' }, { day: 5, type: 'bike_long' }, { day: 6, type: 'bike_end' }],
  },
  {
    key: 'bike_granfondo_12', name: 'Gran Fondo — 12 semanas', sport: 'cycling', goal: 'Prova de longa distância', weeks: 12, level: 'intermediario',
    focus: 'Resistência para provas longas: dois longos no fim de semana + força específica no pedal.',
    week: [{ day: 1, type: 'bike_int' }, { day: 2, type: 'strength' }, { day: 3, type: 'bike_end' }, { day: 5, type: 'bike_long' }, { day: 6, type: 'bike_long' }],
  },
  {
    key: 'tri_sprint_8', name: 'Triathlon Sprint — 8 semanas', sport: 'triathlon', goal: '750m / 20km / 5km', weeks: 8, level: 'iniciante',
    focus: 'Introdução ao triathlon: três modalidades + um brick semanal. 6 sessões.',
    week: [{ day: 0, type: 'swim' }, { day: 1, type: 'bike_int' }, { day: 2, type: 'easy' }, { day: 3, type: 'swim' }, { day: 5, type: 'brick' }, { day: 6, type: 'long' }],
  },
  {
    key: 'tri_olimpico_12', name: 'Triathlon Olímpico — 12 semanas', sport: 'triathlon', goal: '1,5km / 40km / 10km', weeks: 12, level: 'intermediario',
    focus: 'Volume equilibrado nas 3 modalidades, brick crescente e força preventiva.',
    week: [{ day: 0, type: 'swim' }, { day: 1, type: 'bike_int' }, { day: 2, type: 'intervals' }, { day: 3, type: 'swim' }, { day: 4, type: 'strength' }, { day: 5, type: 'brick' }, { day: 6, type: 'bike_long' }],
  },
  {
    key: 'tri_703_16', name: 'Meio Ironman (70.3) — 16 semanas', sport: 'triathlon', goal: '1,9km / 90km / 21km', weeks: 16, level: 'avancado',
    focus: 'Alto volume, longos de bike e corrida, bricks específicos e taper de 2 semanas.',
    week: [{ day: 0, type: 'swim' }, { day: 1, type: 'bike_int' }, { day: 2, type: 'intervals' }, { day: 3, type: 'swim' }, { day: 4, type: 'bike_end' }, { day: 5, type: 'brick' }, { day: 6, type: 'long' }],
  },
]

export const PLAN_SPORT_LABEL: Record<PlanSport, string> = {
  running: 'Corrida', cycling: 'Ciclismo', triathlon: 'Triathlon',
}
