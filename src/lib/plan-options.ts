/**
 * As duas origens de plano numa lista só, para a tela de aplicar.
 *
 * O modal do calendário só oferecia os modelos embutidos no código, então os
 * planos que o treinador cadastra — o PROGRESSÃO 5K INICIANTES, por exemplo —
 * simplesmente não apareciam na hora de aplicar a um aluno. Aqui os dois viram
 * o mesmo tipo, e quem cadastrou vem primeiro.
 */

import { PLAN_LIBRARY, generatePlan, planTotals, PLAN_SPORT_LABEL, type PlanDef } from '@/lib/training-plans'
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
  /** true = cadastrado pelo treinador; false = modelo pronto do sistema. */
  salvo: boolean
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
    salvo: true,
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

/** Um modelo pronto do sistema vira opção aplicável. */
export function opcaoDeModelo(def: PlanDef): PlanoOpcao {
  const t = planTotals(def)
  return {
    chave: `modelo:${def.key}`,
    nome: def.name,
    resumo: def.focus,
    sport: def.sport,
    nivel: def.level,
    semanas: def.weeks,
    treinos: t.sessions,
    horas: t.hours,
    tss: t.tss,
    salvo: false,
    linhas: (athleteId, inicio) => {
      const rows: PlannedWorkoutInput[] = []
      for (const wk of generatePlan(def)) for (const s of wk.workouts) {
        const d = new Date(inicio)
        d.setDate(d.getDate() + (wk.week - 1) * 7 + s.day)
        rows.push({
          athlete_id: athleteId, date: d.toLocaleDateString('en-CA'), sport: s.sport, title: s.title,
          description: s.description, planned_duration_min: s.duration_min,
          planned_tss: s.tss, structure: s.structure,
        })
      }
      return rows
    },
  }
}

/**
 * Lista completa: primeiro os planos do treinador, depois os modelos.
 * Um modelo com o mesmo nome de um plano cadastrado é omitido — senão a
 * mesma coisa apareceria duas vezes, e não dá para saber qual está atualizada.
 */
export function opcoesDePlano(salvos: TrainingProgramRow[]): PlanoOpcao[] {
  const meus = salvos.filter(p => p.active !== false).map(opcaoDePlanoSalvo)
  const nomesUsados = new Set(meus.map(o => o.nome.trim().toLowerCase()))
  const modelos = PLAN_LIBRARY
    .filter(d => !nomesUsados.has(d.name.trim().toLowerCase()))
    .map(opcaoDeModelo)
  return [...meus, ...modelos]
}

export { PLAN_SPORT_LABEL }
