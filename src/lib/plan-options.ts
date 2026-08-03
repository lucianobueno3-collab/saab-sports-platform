/**
 * Os planos aplicáveis a um aluno: só os que o treinador cadastrou.
 *
 * O modal do calendário oferecia modelos embutidos no código, que o treinador
 * nunca escreveu e não conseguia editar. Agora a lista vem do banco — o que
 * está aqui é o que ele montou.
 */

import { PLAN_SPORT_LABEL } from '@/lib/training-plans'
import { expandProgram, type ProgramWeek } from '@/lib/program-templates'
import type { PlannedWorkoutInput, TrainingProgramRow } from '@/lib/supabase/queries'

export type PlanoOpcao = {
  chave: string
  nome: string
  resumo: string
  sport: string
  nivel: string | null
  semanas: number
  treinos: number
  horas: number
  tss: number
  /** Os treinos datados que serão criados no calendário do aluno. */
  linhas: (athleteId: string, inicio: Date) => PlannedWorkoutInput[]
}

function somar(weeks: ProgramWeek[]) {
  let treinos = 0, minutos = 0, tss = 0
  for (const w of weeks) for (const x of w.workouts) {
    treinos++; minutos += x.duration_min ?? 0; tss += x.tss ?? 0
  }
  return { treinos, horas: Math.round(minutos / 60), tss }
}

/** Um plano cadastrado pelo treinador vira opção aplicável. */
export function opcaoDePlanoSalvo(p: TrainingProgramRow): PlanoOpcao {
  const { treinos, horas, tss } = somar(p.weeks)
  return {
    chave: `salvo:${p.id}`,
    nome: p.name,
    resumo: p.description ?? '',
    sport: p.sport,
    nivel: p.level,
    semanas: p.weeks.length,
    treinos, horas, tss,
    linhas: (athleteId, inicio) =>
      // Sem dias preferidos, mantém os dias do próprio plano — o treinador
      // ajusta depois no calendário se quiser.
      expandProgram(p.weeks, inicio, []).map(x => ({
        athlete_id: athleteId, date: x.date, sport: x.sport, title: x.title,
        description: x.description, planned_duration_min: x.planned_duration_min,
        planned_tss: x.planned_tss, structure: x.structure,
      })),
  }
}

/** Os planos ativos do treinador, prontos para aplicar. */
export function opcoesDePlano(salvos: TrainingProgramRow[]): PlanoOpcao[] {
  return salvos.filter(p => p.active !== false).map(opcaoDePlanoSalvo)
}

export { PLAN_SPORT_LABEL }
