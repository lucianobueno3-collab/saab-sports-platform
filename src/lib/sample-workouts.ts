// Treinos de exemplo baseados na experiência de mercado — prontos para a
// biblioteca central. Endurance com estrutura por zona (exportável p/ relógio);
// força com lista de exercícios.

import { estimateStructure, type WorkoutStructure } from '@/lib/workout-structure'
import type { LibExercise, WorkoutLibraryRow } from '@/lib/supabase/queries'

type SampleEndurance = { sport: 'running' | 'cycling'; title: string; description: string; structure: WorkoutStructure }
type SampleStrength = { sport: 'strength'; title: string; description: string; duration_min: number; exercises: LibExercise[] }

const ENDURANCE: SampleEndurance[] = [
  {
    sport: 'running', title: 'Corrida · VO2 5x1km (Z5)',
    description: 'Clássico de VO2max. 5x ~1km fortes com trote de recuperação.',
    structure: [
      { type: 'step', step: { kind: 'warmup', min: 15, zone: 2 } },
      { type: 'repeat', times: 5, steps: [{ kind: 'work', min: 4, zone: 5 }, { kind: 'recovery', min: 2, zone: 1 }] },
      { type: 'step', step: { kind: 'cooldown', min: 10, zone: 1 } },
    ],
  },
  {
    sport: 'running', title: 'Corrida · Limiar 3x10min (Z4)',
    description: 'Desenvolvimento de limiar. 3 blocos de 10min no ritmo de limiar.',
    structure: [
      { type: 'step', step: { kind: 'warmup', min: 15, zone: 2 } },
      { type: 'repeat', times: 3, steps: [{ kind: 'work', min: 10, zone: 4 }, { kind: 'recovery', min: 3, zone: 1 }] },
      { type: 'step', step: { kind: 'cooldown', min: 10, zone: 1 } },
    ],
  },
  {
    sport: 'running', title: 'Corrida · Fartlek 10x1min',
    description: 'Velocidade e economia. 10x 1min forte / 1min trote.',
    structure: [
      { type: 'step', step: { kind: 'warmup', min: 15, zone: 2 } },
      { type: 'repeat', times: 10, steps: [{ kind: 'work', min: 1, zone: 5 }, { kind: 'recovery', min: 1, zone: 1 }] },
      { type: 'step', step: { kind: 'cooldown', min: 10, zone: 1 } },
    ],
  },
  {
    sport: 'running', title: 'Corrida · Longo progressivo',
    description: 'Longo com final no ritmo de prova (negative split).',
    structure: [
      { type: 'step', step: { kind: 'steady', min: 40, zone: 2 } },
      { type: 'step', step: { kind: 'work', min: 25, zone: 3 } },
      { type: 'step', step: { kind: 'cooldown', min: 10, zone: 1 } },
    ],
  },
  {
    sport: 'cycling', title: 'Bike · Sweet Spot 3x12 (Z3)',
    description: 'Base de potência sustentável. 3x12min em sweet spot.',
    structure: [
      { type: 'step', step: { kind: 'warmup', min: 15, zone: 2 } },
      { type: 'repeat', times: 3, steps: [{ kind: 'work', min: 12, zone: 3 }, { kind: 'recovery', min: 5, zone: 1 }] },
      { type: 'step', step: { kind: 'cooldown', min: 10, zone: 1 } },
    ],
  },
  {
    sport: 'cycling', title: 'Bike · Limiar 2x20min (Z4)',
    description: 'Padrão-ouro para elevar o FTP. 2x20min no limiar.',
    structure: [
      { type: 'step', step: { kind: 'warmup', min: 20, zone: 2 } },
      { type: 'repeat', times: 2, steps: [{ kind: 'work', min: 20, zone: 4 }, { kind: 'recovery', min: 8, zone: 1 }] },
      { type: 'step', step: { kind: 'cooldown', min: 10, zone: 1 } },
    ],
  },
  {
    sport: 'cycling', title: 'Bike · VO2 5x4min (Z5)',
    description: 'Potência aeróbica máxima. 5x4min fortes, recuperação igual.',
    structure: [
      { type: 'step', step: { kind: 'warmup', min: 15, zone: 2 } },
      { type: 'repeat', times: 5, steps: [{ kind: 'work', min: 4, zone: 5 }, { kind: 'recovery', min: 4, zone: 1 }] },
      { type: 'step', step: { kind: 'cooldown', min: 10, zone: 1 } },
    ],
  },
  {
    sport: 'cycling', title: 'Bike · Endurance Z2 90min',
    description: 'Base aeróbica constante em Z2.',
    structure: [{ type: 'step', step: { kind: 'steady', min: 90, zone: 2 } }],
  },
]

const STRENGTH: SampleStrength[] = [
  {
    sport: 'strength', title: 'Força · Base full body', duration_min: 50,
    description: 'Força geral com padrões compostos. 2–3x/semana.',
    exercises: [
      { name: 'Agachamento livre', sets: '4', reps: '5', load: '80% 1RM' },
      { name: 'Levantamento terra romeno', sets: '3', reps: '8', load: 'RPE 8' },
      { name: 'Supino reto', sets: '3', reps: '6', load: '80% 1RM' },
      { name: 'Remada curvada', sets: '3', reps: '8', load: 'RPE 7' },
      { name: 'Prancha isométrica', sets: '3', reps: '45s', load: 'corporal' },
    ],
  },
  {
    sport: 'strength', title: 'Força · Prevenção p/ corredor', duration_min: 35,
    description: 'Glúteo, posterior e core — reduz lesões típicas da corrida.',
    exercises: [
      { name: 'Elevação pélvica unipodal', sets: '3', reps: '12/perna', load: 'corporal' },
      { name: 'Nórdico (flexão nórdica)', sets: '3', reps: '6', load: 'corporal' },
      { name: 'Afundo búlgaro', sets: '3', reps: '10/perna', load: 'RPE 8' },
      { name: 'Panturrilha em pé', sets: '3', reps: '15', load: 'corporal' },
      { name: 'Prancha lateral', sets: '3', reps: '40s/lado', load: 'corporal' },
    ],
  },
  {
    sport: 'strength', title: 'Força · Potência / pliometria', duration_min: 40,
    description: 'Explosão e economia. Execução rápida, descanso completo.',
    exercises: [
      { name: 'Agachamento com salto', sets: '4', reps: '5', load: 'corporal' },
      { name: 'Saltos em caixa (box jump)', sets: '4', reps: '4', load: 'corporal' },
      { name: 'Levantamento terra', sets: '3', reps: '3', load: '85% 1RM' },
      { name: 'Afundo com salto', sets: '3', reps: '6/perna', load: 'corporal' },
    ],
  },
]

/** Monta as linhas prontas para inserir na biblioteca (com duração/TSS calculados). */
export function buildSampleLibraryRows(): Omit<WorkoutLibraryRow, 'id'>[] {
  const endurance = ENDURANCE.map(w => {
    const est = estimateStructure(w.structure)
    return { sport: w.sport, title: w.title, description: w.description, duration_min: est.min, tss: est.tss, structure: w.structure, exercises: null }
  })
  const strength = STRENGTH.map(w => ({ sport: w.sport, title: w.title, description: w.description, duration_min: w.duration_min, tss: null, structure: null, exercises: w.exercises }))
  return [...endurance, ...strength]
}

export const SAMPLE_COUNT = ENDURANCE.length + STRENGTH.length
