/**
 * PROGRESSÃO 5K INICIANTES — 8 semanas, 3 corridas por semana.
 *
 * Transcrição fiel do programa do treinador, que prescreve cada trecho em
 * % DO RITMO LIMITE (100% = ritmo de limiar) em vez de zona. As porcentagens
 * são guardadas como estão: são elas que definem a carga do treino e o ritmo
 * mostrado ao aluno. A zona serve só para a cor e o rótulo na tela.
 */

import type { Step, WorkoutStructure, Zone } from '@/lib/workout-structure'

/** Faixas usadas pelo programa, com o nome que o treinador dá a cada uma. */
const ALVO = {
  solto:   { pct: [70, 80] as [number, number],   zone: 1 as Zone, nota: 'bem leve, soltando as pernas' },
  easy:    { pct: [75, 85] as [number, number],   zone: 2 as Zone, nota: 'trote de recuperação — dá pra conversar' },
  hard:    { pct: [88, 98] as [number, number],   zone: 4 as Zone, nota: 'forte, respiração pesada' },
  active:  { pct: [90, 95] as [number, number],   zone: 3 as Zone, nota: 'ritmo firme e constante' },
  harder:  { pct: [100, 103] as [number, number], zone: 5 as Zone, nota: 'acima do limiar — bem forte' },
  sprint:  { pct: [103, 110] as [number, number], zone: 5 as Zone, nota: 'quase máximo' },
  parado:  { pct: [0, 0] as [number, number],     zone: 1 as Zone, nota: 'parado ou caminhando' },
} as const

type AlvoKey = keyof typeof ALVO

function passo(kind: Step['kind'], min: number, alvo: AlvoKey): Step {
  const a = ALVO[alvo]
  return { kind, min, zone: a.zone, pacePct: a.pct, note: a.nota }
}

const wu = (min: number): WorkoutStructure[number] => ({ type: 'step', step: passo('warmup', min, 'solto') })
const cd = (min: number): WorkoutStructure[number] => ({ type: 'step', step: passo('cooldown', min, 'solto') })
const active = (min: number): WorkoutStructure[number] => ({ type: 'step', step: passo('steady', min, 'active') })

/** Série simples: forte + recuperação, repetida N vezes. */
function serie(times: number, forte: number, alvoForte: AlvoKey, facil: number, alvoFacil: AlvoKey): WorkoutStructure[number] {
  return { type: 'repeat', times, steps: [passo('work', forte, alvoForte), passo('recovery', facil, alvoFacil)] }
}

/** Série de três tempos: forte + mais forte + recuperação. */
function serieTripla(times: number, a: number, b: number, facil: number): WorkoutStructure[number] {
  return {
    type: 'repeat', times,
    steps: [passo('work', a, 'active'), passo('work', b, 'harder'), passo('recovery', facil, 'easy')],
  }
}

export type Corrida = { semana: number; dia: number; titulo: string; structure: WorkoutStructure }

/**
 * Os 24 treinos, na ordem do programa. `dia` é 0=segunda, 2=quarta, 4=sexta —
 * mas quem manda no dia real é a preferência do aluno na anamnese.
 */
export const PROGRESSAO_5K: Corrida[] = [
  // ── Semana 1 — adaptação: tiros de 1 min ─────────────────────────────────
  { semana: 1, dia: 0, titulo: '10x 1min forte / 1min leve', structure: [wu(5), serie(10, 1, 'hard', 1, 'easy'), cd(5)] },
  { semana: 1, dia: 2, titulo: '12x 1min forte / 1min leve', structure: [wu(5), serie(12, 1, 'hard', 1, 'easy'), cd(5)] },
  { semana: 1, dia: 4, titulo: '10x 1min + 5min contínuos', structure: [wu(5), serie(10, 1, 'hard', 1, 'easy'), active(5), cd(5)] },

  // ── Semana 2 — alongando o esforço para 2 min ────────────────────────────
  { semana: 2, dia: 0, titulo: '6x 2min forte / 2min leve', structure: [wu(5), serie(6, 2, 'hard', 2, 'easy'), cd(5)] },
  { semana: 2, dia: 2, titulo: '7x 2min forte / 1min leve', structure: [wu(5), serie(7, 2, 'hard', 1, 'easy'), cd(5)] },
  { semana: 2, dia: 4, titulo: '6x (1min forte + 1min muito forte)', structure: [wu(10), serieTripla(6, 1, 1, 2), cd(5)] },

  // ── Semana 3 — blocos de 3 min e primeira dose de ritmo ──────────────────
  { semana: 3, dia: 0, titulo: '6x 3min forte / 2min leve', structure: [wu(5), serie(6, 3, 'hard', 2, 'easy'), cd(5)] },
  { semana: 3, dia: 2, titulo: '6x (2min forte + 1min muito forte)', structure: [wu(5), serieTripla(6, 2, 1, 2), cd(5)] },
  { semana: 3, dia: 4, titulo: '6x 2min + 10min contínuos', structure: [wu(5), serie(6, 2, 'hard', 1, 'easy'), active(10), cd(5)] },

  // ── Semana 4 — blocos longos e primeiro tiro curto de velocidade ─────────
  { semana: 4, dia: 0, titulo: '6x 5min forte / 1min leve', structure: [wu(5), serie(6, 5, 'hard', 1, 'easy'), cd(5)] },
  { semana: 4, dia: 2, titulo: '10x 1min intenso / 1min parado', structure: [wu(10), serie(10, 1, 'sprint', 1, 'parado'), cd(5)] },
  { semana: 4, dia: 4, titulo: '3x 2min + 15min contínuos', structure: [wu(10), serie(3, 2, 'hard', 1, 'easy'), active(15), cd(5)] },

  // ── Semana 5 — resistência: blocos de 10 min ─────────────────────────────
  { semana: 5, dia: 0, titulo: '2x 10min forte / 2min leve', structure: [wu(10), serie(2, 10, 'hard', 2, 'easy'), cd(5)] },
  { semana: 5, dia: 2, titulo: '2x (10min forte + 2min muito forte)', structure: [wu(10), serieTripla(2, 10, 2, 2), cd(5)] },
  { semana: 5, dia: 4, titulo: '4x 2min + bloco de 15min e 5min', structure: [
    wu(10), serie(4, 2, 'hard', 1, 'easy'),
    { type: 'repeat', times: 1, steps: [passo('work', 15, 'active'), passo('work', 5, 'harder')] },
    cd(5),
  ] },

  // ── Semana 6 — volume forte ──────────────────────────────────────────────
  { semana: 6, dia: 0, titulo: '3x 10min forte / 2min leve', structure: [wu(5), serie(3, 10, 'hard', 2, 'easy'), cd(5)] },
  { semana: 6, dia: 2, titulo: '2x 15min forte / 2min leve', structure: [wu(5), serie(2, 15, 'hard', 2, 'easy'), cd(5)] },
  { semana: 6, dia: 4, titulo: '2x 2min + 25min contínuos', structure: [wu(10), serie(2, 2, 'hard', 2, 'easy'), active(25), cd(5)] },

  // ── Semana 7 — pico ──────────────────────────────────────────────────────
  { semana: 7, dia: 0, titulo: '3x 12min forte / 1min leve', structure: [wu(5), serie(3, 12, 'hard', 1, 'easy'), cd(5)] },
  { semana: 7, dia: 2, titulo: '8x 2min intenso / 2min parado', structure: [wu(10), serie(8, 2, 'sprint', 2, 'parado'), cd(5)] },
  { semana: 7, dia: 4, titulo: '2x 2min + 30min contínuos', structure: [wu(10), serie(2, 2, 'hard', 2, 'easy'), active(30), cd(5)] },

  // ── Semana 8 — afinar e provar ───────────────────────────────────────────
  { semana: 8, dia: 0, titulo: '6x 3min forte / 2min leve', structure: [wu(5), serie(6, 3, 'hard', 2, 'easy'), cd(5)] },
  { semana: 8, dia: 2, titulo: '2x 14min forte / 1min leve', structure: [wu(5), serie(2, 14, 'hard', 1, 'easy'), cd(5)] },
  { semana: 8, dia: 4, titulo: 'Prova: 5 km direto 🎉', structure: [
    // Prescrito em distância, não em tempo. Os minutos servem só para estimar
    // a carga; o alvo que vale para o aluno é a distância.
    { type: 'step', step: { ...passo('warmup', 7, 'solto'), km: 1, note: '1 km bem leve para soltar' } },
    { type: 'step', step: { ...passo('steady', 32, 'active'), km: 5, note: '5 km no seu ritmo de prova — é o dia! 🎉' } },
  ] },
]

/** Rótulo da fase de cada semana, para o título do bloco no programa. */
export const FASE_DA_SEMANA: Record<number, string> = {
  1: 'Adaptação', 2: 'Adaptação', 3: 'Construção', 4: 'Construção',
  5: 'Resistência', 6: 'Volume', 7: 'Pico', 8: 'Afinamento e prova',
}
