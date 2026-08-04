/**
 * FASE 1 FORÇA — o programa de sala do treinador, transcrito exercício a
 * exercício.
 *
 * Três sessões que giram na semana: A (costas e bíceps), B (peito e ombros) e
 * C (pernas e glúteos). Quase tudo em 4 séries de 12/12/10/8 — pirâmide
 * crescente de carga — com 45s de intervalo; o que é acessório de abdômen e
 * panturrilha fica em 4×15.
 *
 * Aqui a força ganha o mesmo tratamento que a corrida: em vez de uma frase
 * solta na descrição, cada sessão chega com os exercícios estruturados, e o
 * aluno vê série por série quantas repetições fazer e quanto descansar.
 */

import type { LibExercise } from '@/lib/supabase/queries'

/** 4 séries em pirâmide: a carga sobe enquanto as repetições caem. */
const PIRAMIDE = '12/12/10/8'
/** Acessório: 4 séries mantendo as repetições. */
const QUINZE = '15/15/15/15'
const DESCANSO = 45

function ex(name: string, muscle: string, reps = PIRAMIDE, sets = '4', rest_s = DESCANSO): LibExercise {
  return { name, muscle, sets, reps, load: '', rest_s }
}

export type SessaoDeForca = {
  /** Letra da sessão no rodízio (A, B, C). */
  letra: string
  titulo: string
  foco: string
  exercicios: LibExercise[]
}

export const FASE_1_FORCA: SessaoDeForca[] = [
  {
    letra: 'A',
    titulo: 'Força A — costas e bíceps',
    foco: 'Puxadas e remadas para as costas, fechando com bíceps e panturrilha.',
    exercicios: [
      ex('Puxada frente', 'Dorsais'),
      ex('Puxada fechado', 'Dorsais'),
      ex('Remada curvada com barra', 'Dorsais / lombar'),
      ex('Remada máquina (pegada neutra)', 'Dorsais'),
      ex('Pull down (corda)', 'Dorsais / serrátil'),
      ex('Rosca scott', 'Bíceps'),
      ex('Rosca com halteres no banco', 'Bíceps'),
      ex('Panturrilha máquina (em pé)', 'Panturrilha', QUINZE),
    ],
  },
  {
    letra: 'B',
    titulo: 'Força B — peito e ombros',
    foco: 'Peito na máquina e halteres, ombros nas três porções, tríceps e abdômen.',
    exercicios: [
      ex('Voador', 'Peitoral'),
      ex('Supino máquina inclinado', 'Peitoral superior'),
      ex('Supino máquina reto', 'Peitoral'),
      ex('Desenvolvimento com halter', 'Ombros'),
      ex('Elevação lateral com halter', 'Ombro medial'),
      // Série única de propósito: é finalizador, entra só para pré-exaustão.
      { ...ex('Elevação frontal com corda na cross (tronco inclinado)', 'Ombro anterior', '12', '1'), note: 'Tronco inclinado à frente, série única' },
      ex('Tríceps polia (corda)', 'Tríceps'),
      ex('Abdominal máquina', 'Abdômen', QUINZE),
    ],
  },
  {
    letra: 'C',
    titulo: 'Força C — pernas e glúteos',
    foco: 'Cadeia posterior e glúteo, com abdutor/adutor, panturrilha e abdômen.',
    exercicios: [
      ex('Stiff com barra', 'Posterior de coxa / glúteo'),
      ex('Elevação pélvica na máquina', 'Glúteo'),
      ex('Abdutor', 'Glúteo médio'),
      ex('Abdominal curto', 'Abdômen', QUINZE),
      ex('Panturrilha máquina (sentado)', 'Panturrilha / sóleo', QUINZE),
      ex('Abdominal infra', 'Abdômen inferior', QUINZE),
      ex('Adutor', 'Adutores'),
      ex('Banco extensor bilateral', 'Quadríceps'),
    ],
  },
]

// ─── Contas em cima dos exercícios ───────────────────────────────────────────

/**
 * Repetições de cada série.
 *
 * "12/12/10/8" vira [12,12,10,8]; "15" com 4 séries vira [15,15,15,15]. Aceita
 * vírgula também, que é como o treinador escreve na planilha.
 */
export function repsPorSerie(reps: string, sets: number): number[] {
  const partes = reps.split(/[/,]/).map(p => parseInt(p.trim(), 10)).filter(n => Number.isFinite(n))
  if (partes.length === 0) return []
  if (partes.length >= sets) return partes.slice(0, sets)
  // Uma repetição só descrita: vale para todas as séries.
  return Array.from({ length: sets }, (_, i) => partes[i] ?? partes[partes.length - 1])
}

/**
 * Série medida em tempo, não em repetição — "45s" de prancha, por exemplo.
 *
 * Sem essa distinção uma prancha de 45s entraria na conta como 45 repetições,
 * e a sessão apareceria com o triplo da duração real.
 */
export function ehPorTempo(reps: string): boolean {
  return /\d\s*s\b/i.test(reps.trim())
}

/** Número de séries do exercício (o campo é texto livre no formulário). */
export function seriesDe(e: LibExercise): number {
  const n = parseInt(String(e.sets).trim(), 10)
  return Number.isFinite(n) && n > 0 ? n : 1
}

/** Total de repetições planejadas do exercício, somando as séries. */
export function repsTotais(e: LibExercise): number {
  return repsPorSerie(e.reps, seriesDe(e)).reduce((s, r) => s + r, 0)
}

/**
 * Duração e carga estimadas de uma sessão de força.
 *
 * Cada repetição leva ~3s (subida e descida controladas) e entre séries entra
 * o intervalo prescrito. O TSS sai do tempo: musculação de hipertrofia fica
 * perto de 0,6 TSS por minuto — bem abaixo de uma corrida forte, porque o
 * custo cardiovascular é menor.
 */
export function estimarForca(exercicios: LibExercise[]): { min: number; tss: number } {
  let seg = 0
  for (const e of exercicios) {
    const series = seriesDe(e)
    // Série por tempo já vem em segundos; por repetição, ~3s cada.
    seg += ehPorTempo(e.reps) ? repsTotais(e) : repsTotais(e) * 3
    seg += series * (e.rest_s ?? DESCANSO)
  }
  const min = Math.round(seg / 60)
  return { min, tss: Math.round(min * 0.6) }
}

/** Resumo de uma linha, para a descrição do treino e a busca da biblioteca. */
export function resumoDeForca(exercicios: LibExercise[]): string {
  return exercicios.map(e => `${e.name} ${e.sets}×${e.reps.replace(/\//g, '-')}`).join(' · ')
}
