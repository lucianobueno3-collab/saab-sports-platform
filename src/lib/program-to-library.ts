/**
 * Leva os treinos de um plano para a biblioteca, para o treinador reaproveitar
 * um treino solto — arrastar no calendário de um aluno, montar outro plano,
 * baixar para o relógio — sem precisar aplicar o plano inteiro.
 */

import type { ProgramWeek } from '@/lib/program-templates'
import type { WorkoutLibraryRow } from '@/lib/supabase/queries'
import { structureSummary } from '@/lib/workout-structure'

export type LibraryDraft = Omit<WorkoutLibraryRow, 'id'>

/**
 * Identidade de um treino: mesmo esporte, mesmo título e mesmo conteúdo.
 *
 * O conteúdo é `structure` na corrida e `exercises` na força — duas sessões de
 * sala com o mesmo nome e exercícios diferentes são treinos diferentes.
 */
function chave(sport: string, title: string, structure: unknown, exercises?: unknown) {
  return `${sport}::${title.trim().toLowerCase()}::${JSON.stringify(structure ?? null)}::${JSON.stringify(exercises ?? null)}`
}

/**
 * Converte as semanas de um plano em treinos de biblioteca, sem repetir.
 *
 * Recebe o nome do plano como `grupo`: é assim que os treinos chegam à
 * biblioteca já dentro da pasta certa, em vez de todos soltos na raiz.
 *
 * Um plano repete o mesmo treino em várias semanas — só faz sentido guardar
 * uma cópia. Mas quando o título se repete com passos DIFERENTES (o
 * "Corrida/caminhada" que cresce a cada semana), guardar só o primeiro perderia
 * a progressão inteira: nesses casos o nome ganha a semana de origem.
 */
export function programWorkoutsToLibrary(weeks: ProgramWeek[], grupo?: string): LibraryDraft[] {
  // 1ª passada: quantas versões distintas cada título tem.
  const versoesPorTitulo = new Map<string, Set<string>>()
  weeks.forEach(wk => wk.workouts.forEach(w => {
    const t = w.title.trim().toLowerCase()
    if (!versoesPorTitulo.has(t)) versoesPorTitulo.set(t, new Set())
    versoesPorTitulo.get(t)!.add(chave(w.sport, w.title, w.structure, w.exercises))
  }))

  const vistos = new Set<string>()
  const saida: LibraryDraft[] = []

  weeks.forEach((wk, i) => {
    for (const w of wk.workouts) {
      const k = chave(w.sport, w.title, w.structure, w.exercises)
      if (vistos.has(k)) continue
      vistos.add(k)

      const precisaDistinguir = (versoesPorTitulo.get(w.title.trim().toLowerCase())?.size ?? 1) > 1
      saida.push({
        sport: w.sport,
        group_name: grupo?.trim() || null,
        title: precisaDistinguir ? `${w.title} (Semana ${i + 1})` : w.title,
        description: w.description ?? (w.structure ? structureSummary(w.structure) : null) ?? null,
        duration_min: w.duration_min ?? null,
        tss: w.tss ?? null,
        structure: w.structure ?? null,
        exercises: w.exercises ?? null,
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

/**
 * Treinos que já estão na biblioteca mas fora da pasta do plano.
 *
 * Só inserir os novos não bastava: um treino gravado antes de o plano ter
 * pasta ficava para sempre sem grupo, porque a checagem de duplicado o pulava
 * e nada nunca o atualizava. Era o caso de quem recarregava o plano e via
 * tudo igual.
 */
export function paraMoverDeGrupo(
  candidatos: LibraryDraft[],
  jaNaBiblioteca: { id: string; sport: string; title: string; group_name?: string | null }[],
  grupo: string,
): string[] {
  const alvos = new Set(candidatos.map(c => `${c.sport}::${c.title.trim().toLowerCase()}`))
  return jaNaBiblioteca
    .filter(w => alvos.has(`${w.sport}::${w.title.trim().toLowerCase()}`) && (w.group_name ?? '') !== grupo)
    .map(w => w.id)
}
