/**
 * Agrupamento da biblioteca de treinos, no estilo das pastas do TrainingPeaks.
 *
 * Com dezenas de treinos vindos dos planos, uma lista corrida não serve. O
 * grupo é texto livre — o treinador nomeia como quiser — e quem não tem grupo
 * cai na própria modalidade, para nenhum treino ficar órfão numa pasta "outros"
 * que ninguém abre.
 */

import type { WorkoutLibraryRow } from '@/lib/supabase/queries'

export type GrupoDeTreinos = { nome: string; treinos: WorkoutLibraryRow[] }

const LABEL_MODALIDADE: Record<string, string> = {
  running: 'Corrida', cycling: 'Ciclismo', swimming: 'Natação',
  strength: 'Força', triathlon: 'Triathlon', other: 'Outros',
}

/** Pasta de um treino: o grupo salvo ou, na falta, a modalidade. */
export function grupoDe(w: WorkoutLibraryRow): string {
  const g = w.group_name?.trim()
  return g || LABEL_MODALIDADE[w.sport] || 'Outros'
}

/** Um treino casa com a busca pelo título, descrição ou nome do grupo. */
export function casaBusca(w: WorkoutLibraryRow, termo: string): boolean {
  const t = termo.trim().toLowerCase()
  if (!t) return true
  return w.title.toLowerCase().includes(t)
    || (w.description ?? '').toLowerCase().includes(t)
    || grupoDe(w).toLowerCase().includes(t)
}

/**
 * Monta os grupos em ordem alfabética, com os treinos ordenados por título.
 *
 * Ordem alfabética de propósito: o treinador nomeia as pastas com prefixo
 * numérico ("1 BIKE", "2 BIKE") justamente para controlar a ordem, como no
 * TrainingPeaks. Ordenar por data de criação atrapalharia isso.
 */
export function agruparBiblioteca(
  itens: WorkoutLibraryRow[], termo = '', modalidade = 'all',
): GrupoDeTreinos[] {
  const porGrupo = new Map<string, WorkoutLibraryRow[]>()
  for (const w of itens) {
    if (modalidade !== 'all' && w.sport !== modalidade) continue
    if (!casaBusca(w, termo)) continue
    const g = grupoDe(w)
    if (!porGrupo.has(g)) porGrupo.set(g, [])
    porGrupo.get(g)!.push(w)
  }
  return [...porGrupo.entries()]
    .map(([nome, treinos]) => ({
      nome,
      treinos: treinos.slice().sort((a, b) => a.title.localeCompare(b.title, 'pt-BR')),
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

/** Nomes de grupo já usados, para sugerir no formulário em vez de redigitar. */
export function gruposExistentes(itens: WorkoutLibraryRow[]): string[] {
  const nomes = new Set<string>()
  for (const w of itens) {
    const g = w.group_name?.trim()
    if (g) nomes.add(g)
  }
  return [...nomes].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}
