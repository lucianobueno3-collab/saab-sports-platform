/**
 * Leva os treinos de um plano para a biblioteca, para o treinador reaproveitar
 * um treino solto — arrastar no calendário de um aluno, montar outro plano,
 * baixar para o relógio — sem precisar aplicar o plano inteiro.
 */

import type { ProgramWeek } from '@/lib/program-templates'
import type { WorkoutLibraryRow } from '@/lib/supabase/queries'
import { structureSummary } from '@/lib/workout-structure'

export type LibraryDraft = Omit<WorkoutLibraryRow, 'id'>

/** Identidade de um treino: mesmo esporte, mesmo título e mesmos passos. */
function chave(sport: string, title: string, structure: unknown) {
  return `${sport}::${title.trim().toLowerCase()}::${JSON.stringify(structure ?? null)}`
}

/**
 * Converte as semanas de um plano em treinos de biblioteca, sem repetir.
 *
 * Um plano repete o mesmo treino em várias semanas — só faz sentido guardar
 * uma cópia. Mas quando o título se repete com passos DIFERENTES (o
 * "Corrida/caminhada" que cresce a cada semana), guardar só o primeiro perderia
 * a progressão inteira: nesses casos o nome ganha a semana de origem.
 */
export function programWorkoutsToLibrary(weeks: ProgramWeek[]): LibraryDraft[] {
  // 1ª passada: quantas versões distintas cada título tem.
  const versoesPorTitulo = new Map<string, Set<string>>()
  weeks.forEach(wk => wk.workouts.forEach(w => {
    const t = w.title.trim().toLowerCase()
    if (!versoesPorTitulo.has(t)) versoesPorTitulo.set(t, new Set())
    versoesPorTitulo.get(t)!.add(chave(w.sport, w.title, w.structure))
  }))

  const vistos = new Set<string>()
  const saida: LibraryDraft[] = []

  weeks.forEach((wk, i) => {
    for (const w of wk.workouts) {
      const k = chave(w.sport, w.title, w.structure)
      if (vistos.has(k)) continue
      vistos.add(k)

      const precisaDistinguir = (versoesPorTitulo.get(w.title.trim().toLowerCase())?.size ?? 1) > 1
      saida.push({
        sport: w.sport,
        title: precisaDistinguir ? `${w.title} (Semana ${i + 1})` : w.title,
        description: w.description ?? (w.structure ? structureSummary(w.structure) : null) ?? null,
        duration_min: w.duration_min ?? null,
        tss: w.tss ?? null,
        structure: w.structure ?? null,
        exercises: null,
      })
    }
  })

  return saida
}

/** Os que ainda não existem na biblioteca (mesmo esporte e mesmo título). */
export function apenasNovos(candidatos: LibraryDraft[], jaNaBiblioteca: { sport: string; title: string }[]): LibraryDraft[] {
  const existentes = new Set(jaNaBiblioteca.map(w => `${w.sport}::${w.title.trim().toLowerCase()}`))
  return candidatos.filter(c => !existentes.has(`${c.sport}::${c.title.trim().toLowerCase()}`))
}
