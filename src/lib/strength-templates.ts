// Templates de treino de força baseados em modelos consagrados de mercado,
// com ênfase em atletas de endurance (força, prevenção, potência).

export interface StrengthExercise {
  name: string
  muscle: string          // grupo muscular / padrão de movimento
  sets: number
  reps: string            // "5", "8-12", "AMRAP", "30s"
  load?: string           // "75% 1RM", "RPE 8", "corporal", "kettlebell 16kg"
  rest_s?: number
  rpe?: number | null
  notes?: string
}

export interface StrengthDay {
  day: number
  label: string
  exercises: StrengthExercise[]
}

export interface StrengthTemplate {
  key: string
  name: string
  goal: 'forca_max' | 'hipertrofia' | 'potencia' | 'resistencia' | 'prevencao'
  frequency: string       // "3x/semana"
  level: 'iniciante' | 'intermediario' | 'avancado'
  focus: string           // descrição curta
  structure: StrengthDay[]
}

export const GOAL_LABEL: Record<StrengthTemplate['goal'], string> = {
  forca_max: 'Força máxima',
  hipertrofia: 'Hipertrofia',
  potencia: 'Potência',
  resistencia: 'Resistência muscular',
  prevencao: 'Prevenção de lesões',
}

export const GOAL_COLOR: Record<StrengthTemplate['goal'], string> = {
  forca_max: '#e8001c',
  hipertrofia: '#8b5cf6',
  potencia: '#ffa800',
  resistencia: '#0088ff',
  prevencao: '#00d084',
}

export const STRENGTH_TEMPLATES: StrengthTemplate[] = [
  {
    key: 'endurance_base_2x',
    name: 'Força de base para endurance (2x)',
    goal: 'forca_max',
    frequency: '2x/semana',
    level: 'intermediario',
    focus: 'Fase base: força máxima com baixo volume para não competir com o volume aeróbico. Padrões compostos + core.',
    structure: [
      {
        day: 1, label: 'A — Inferiores + empurrar',
        exercises: [
          { name: 'Agachamento livre', muscle: 'Quadríceps / glúteo', sets: 4, reps: '5', load: '80-85% 1RM', rest_s: 180, rpe: 8 },
          { name: 'Levantamento terra romeno', muscle: 'Posterior de coxa', sets: 3, reps: '6', load: 'RPE 8', rest_s: 150, rpe: 8 },
          { name: 'Supino reto', muscle: 'Peitoral', sets: 3, reps: '6', load: '80% 1RM', rest_s: 120, rpe: 8 },
          { name: 'Prancha isométrica', muscle: 'Core', sets: 3, reps: '45s', load: 'corporal', rest_s: 60 },
        ],
      },
      {
        day: 2, label: 'B — Unipodal + puxar',
        exercises: [
          { name: 'Afundo búlgaro', muscle: 'Quadríceps / glúteo', sets: 3, reps: '8 / perna', load: 'RPE 8', rest_s: 120, rpe: 8 },
          { name: 'Levantamento terra', muscle: 'Cadeia posterior', sets: 4, reps: '4', load: '85% 1RM', rest_s: 180, rpe: 8 },
          { name: 'Barra fixa', muscle: 'Dorsais', sets: 3, reps: '6-8', load: 'corporal / assistida', rest_s: 120 },
          { name: 'Elevação pélvica', muscle: 'Glúteo', sets: 3, reps: '10', load: 'RPE 7', rest_s: 90, rpe: 7 },
        ],
      },
    ],
  },
  {
    key: 'full_body_3x',
    name: 'Full Body 3x (força geral)',
    goal: 'forca_max',
    frequency: '3x/semana',
    level: 'iniciante',
    focus: 'Corpo inteiro 3x na semana, progressão linear de carga. Base sólida para quem está começando na sala.',
    structure: [
      {
        day: 1, label: 'Treino A',
        exercises: [
          { name: 'Agachamento livre', muscle: 'Pernas', sets: 3, reps: '5', load: 'progressivo', rest_s: 150, rpe: 7 },
          { name: 'Supino reto', muscle: 'Peitoral', sets: 3, reps: '5', load: 'progressivo', rest_s: 120, rpe: 7 },
          { name: 'Remada curvada', muscle: 'Dorsais', sets: 3, reps: '8', load: 'RPE 7', rest_s: 90, rpe: 7 },
        ],
      },
      {
        day: 2, label: 'Treino B',
        exercises: [
          { name: 'Levantamento terra', muscle: 'Cadeia posterior', sets: 3, reps: '5', load: 'progressivo', rest_s: 180, rpe: 7 },
          { name: 'Desenvolvimento militar', muscle: 'Ombros', sets: 3, reps: '5', load: 'progressivo', rest_s: 120, rpe: 7 },
          { name: 'Barra fixa', muscle: 'Dorsais', sets: 3, reps: '6-8', load: 'corporal', rest_s: 90 },
        ],
      },
      {
        day: 3, label: 'Treino C',
        exercises: [
          { name: 'Agachamento frontal', muscle: 'Quadríceps', sets: 3, reps: '6', load: 'RPE 7', rest_s: 150, rpe: 7 },
          { name: 'Supino inclinado', muscle: 'Peitoral superior', sets: 3, reps: '8', load: 'RPE 7', rest_s: 120, rpe: 7 },
          { name: 'Prancha isométrica', muscle: 'Core', sets: 3, reps: '45s', load: 'corporal', rest_s: 60 },
        ],
      },
    ],
  },
  {
    key: 'upper_lower_4x',
    name: 'Upper / Lower (4x)',
    goal: 'hipertrofia',
    frequency: '4x/semana',
    level: 'intermediario',
    focus: 'Divisão superior/inferior 2x cada, volume moderado para ganho de massa mantendo frequência.',
    structure: [
      {
        day: 1, label: 'Inferiores A',
        exercises: [
          { name: 'Agachamento livre', muscle: 'Quadríceps / glúteo', sets: 4, reps: '6-8', load: 'RPE 8', rest_s: 150, rpe: 8 },
          { name: 'Levantamento terra romeno', muscle: 'Posterior', sets: 3, reps: '8-10', load: 'RPE 8', rest_s: 120, rpe: 8 },
          { name: 'Cadeira extensora', muscle: 'Quadríceps', sets: 3, reps: '12', load: 'RPE 9', rest_s: 60, rpe: 9 },
          { name: 'Panturrilha em pé', muscle: 'Panturrilha', sets: 4, reps: '12-15', load: 'RPE 9', rest_s: 45, rpe: 9 },
        ],
      },
      {
        day: 2, label: 'Superiores A',
        exercises: [
          { name: 'Supino reto', muscle: 'Peitoral', sets: 4, reps: '6-8', load: 'RPE 8', rest_s: 120, rpe: 8 },
          { name: 'Barra fixa', muscle: 'Dorsais', sets: 4, reps: '8-10', load: 'corporal', rest_s: 120 },
          { name: 'Desenvolvimento halteres', muscle: 'Ombros', sets: 3, reps: '10', load: 'RPE 8', rest_s: 90, rpe: 8 },
          { name: 'Rosca direta', muscle: 'Bíceps', sets: 3, reps: '12', load: 'RPE 9', rest_s: 60, rpe: 9 },
        ],
      },
      {
        day: 3, label: 'Inferiores B',
        exercises: [
          { name: 'Levantamento terra', muscle: 'Cadeia posterior', sets: 4, reps: '5', load: 'RPE 8', rest_s: 180, rpe: 8 },
          { name: 'Afundo búlgaro', muscle: 'Unipodal', sets: 3, reps: '10 / perna', load: 'RPE 8', rest_s: 90, rpe: 8 },
          { name: 'Mesa flexora', muscle: 'Posterior', sets: 3, reps: '12', load: 'RPE 9', rest_s: 60, rpe: 9 },
          { name: 'Prancha lateral', muscle: 'Core', sets: 3, reps: '40s / lado', load: 'corporal', rest_s: 45 },
        ],
      },
      {
        day: 4, label: 'Superiores B',
        exercises: [
          { name: 'Supino inclinado halteres', muscle: 'Peitoral superior', sets: 4, reps: '8-10', load: 'RPE 8', rest_s: 120, rpe: 8 },
          { name: 'Remada curvada', muscle: 'Dorsais', sets: 4, reps: '8-10', load: 'RPE 8', rest_s: 90, rpe: 8 },
          { name: 'Elevação lateral', muscle: 'Ombros', sets: 3, reps: '15', load: 'RPE 9', rest_s: 45, rpe: 9 },
          { name: 'Tríceps corda', muscle: 'Tríceps', sets: 3, reps: '12', load: 'RPE 9', rest_s: 60, rpe: 9 },
        ],
      },
    ],
  },
  {
    key: 'runner_prevention',
    name: 'Prevenção para corredores',
    goal: 'prevencao',
    frequency: '2-3x/semana',
    level: 'iniciante',
    focus: 'Fortalecimento de glúteo, posterior e core com ênfase unipodal — reduz lesões típicas da corrida (joelho, canela, tendão).',
    structure: [
      {
        day: 1, label: 'Circuito preventivo',
        exercises: [
          { name: 'Elevação pélvica unipodal', muscle: 'Glúteo', sets: 3, reps: '12 / perna', load: 'corporal', rest_s: 45 },
          { name: 'Agachamento unipodal (pistol assistido)', muscle: 'Quadríceps / equilíbrio', sets: 3, reps: '8 / perna', load: 'corporal', rest_s: 60 },
          { name: 'Nórdico (flexão nórdica)', muscle: 'Posterior de coxa', sets: 3, reps: '6', load: 'corporal', rest_s: 90, notes: 'Excêntrico controlado — chave p/ prevenir estiramento' },
          { name: 'Elevação de panturrilha', muscle: 'Panturrilha / tendão de aquiles', sets: 3, reps: '15', load: 'corporal', rest_s: 45 },
          { name: 'Prancha com toque de ombro', muscle: 'Core anti-rotação', sets: 3, reps: '40s', load: 'corporal', rest_s: 45 },
          { name: 'Caminhada lateral com miniband', muscle: 'Glúteo médio', sets: 3, reps: '15 / lado', load: 'miniband', rest_s: 45 },
        ],
      },
    ],
  },
  {
    key: 'power_plyo',
    name: 'Potência e pliometria',
    goal: 'potencia',
    frequency: '2x/semana',
    level: 'avancado',
    focus: 'Fase específica/competitiva: desenvolve taxa de produção de força e economia de corrida. Baixas reps, execução explosiva, descanso completo.',
    structure: [
      {
        day: 1, label: 'Potência A',
        exercises: [
          { name: 'Agachamento com salto', muscle: 'Pernas (explosivo)', sets: 4, reps: '5', load: 'corporal / leve', rest_s: 120, notes: 'Máxima velocidade concêntrica' },
          { name: 'Levantamento terra com puxada (clean pull)', muscle: 'Cadeia posterior', sets: 4, reps: '3', load: '70% 1RM', rest_s: 180, rpe: 8 },
          { name: 'Saltos em caixa (box jump)', muscle: 'Pliometria', sets: 4, reps: '4', load: 'corporal', rest_s: 120 },
          { name: 'Agachamento livre', muscle: 'Força base', sets: 3, reps: '3', load: '85% 1RM', rest_s: 180, rpe: 8 },
        ],
      },
      {
        day: 2, label: 'Potência B',
        exercises: [
          { name: 'Afundo com salto', muscle: 'Unipodal explosivo', sets: 3, reps: '6 / perna', load: 'corporal', rest_s: 90 },
          { name: 'Saltos horizontais (bounding)', muscle: 'Pliometria / corrida', sets: 4, reps: '20m', load: 'corporal', rest_s: 120 },
          { name: 'Levantamento terra', muscle: 'Força máxima', sets: 3, reps: '3', load: '85% 1RM', rest_s: 180, rpe: 8 },
          { name: 'Prancha dinâmica', muscle: 'Core', sets: 3, reps: '40s', load: 'corporal', rest_s: 45 },
        ],
      },
    ],
  },
]

/** 1RM estimado — fórmula de Epley (padrão de mercado) */
export function estimateOneRM(load: number, reps: number): number {
  if (reps <= 1) return load
  return Math.round(load * (1 + reps / 30) * 10) / 10
}

/** % de 1RM sugerido por faixa de repetições (tabela de Brzycki simplificada) */
export function loadForReps(oneRM: number, reps: number): number {
  const pct = [1, 0.955, 0.917, 0.885, 0.857, 0.832, 0.809, 0.788, 0.768, 0.749][Math.min(reps - 1, 9)] ?? 0.7
  return Math.round(oneRM * pct * 10) / 10
}
