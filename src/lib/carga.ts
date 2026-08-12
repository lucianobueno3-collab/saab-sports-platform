/**
 * TSS traduzido para o aluno.
 *
 * "47 TSS" não diz nada para quem está começando a correr — e é o número que
 * mais aparece nas telas dele. O treinador precisa da escala; o aluno precisa
 * saber se o treino de hoje é leve ou puxado.
 *
 * As faixas são fixas de propósito, e isso é justo com qualquer atleta: TSS já
 * nasce relativo ao limiar de cada um. 100 TSS é uma hora no limiar — para o
 * iniciante e para o competitivo. Então "forte" quer dizer a mesma coisa para
 * os dois, cada um no seu ritmo.
 */

export type ChaveDeCarga = 'leve' | 'moderada' | 'forte' | 'muito-forte'

export type NivelDeCarga = {
  chave: ChaveDeCarga
  /** Como aparece na tela: "Carga leve". */
  rotulo: string
  /** Uma linha de contexto, para quando há espaço. */
  descricao: string
  cor: string
}

const NIVEIS: Record<ChaveDeCarga, NivelDeCarga> = {
  'leve': {
    chave: 'leve', rotulo: 'Leve', cor: '#22c55e',
    descricao: 'Dá para conversar o treino inteiro. Serve para soltar as pernas.',
  },
  'moderada': {
    chave: 'moderada', rotulo: 'Moderada', cor: '#0088ff',
    descricao: 'O treino do dia a dia. Cansa, mas você termina inteiro.',
  },
  'forte': {
    chave: 'forte', rotulo: 'Forte', cor: '#ffa800',
    descricao: 'Treino puxado. No dia seguinte, vá leve.',
  },
  'muito-forte': {
    chave: 'muito-forte', rotulo: 'Muito forte', cor: '#e8001c',
    descricao: 'Dos mais duros do plano. Durma bem e coma direito depois.',
  },
}

/**
 * A faixa de carga de um treino, pelo TSS.
 *
 * Os cortes saem do próprio significado do TSS: 100 = uma hora no limiar.
 * Metade disso (50) já é um treino de verdade; 90 para cima é dia difícil.
 */
export function cargaDe(tss: number | null | undefined): NivelDeCarga | null {
  if (tss == null || !Number.isFinite(tss) || tss <= 0) return null
  if (tss < 30) return NIVEIS.leve
  if (tss < 60) return NIVEIS.moderada
  if (tss < 90) return NIVEIS.forte
  return NIVEIS['muito-forte']
}

/** "Carga moderada" — o texto que o aluno lê no lugar de "47 TSS". */
export function textoDeCarga(tss: number | null | undefined): string | null {
  const n = cargaDe(tss)
  return n ? `Carga ${n.rotulo.toLowerCase()}` : null
}

/**
 * Carga de uma semana inteira, que é outra escala: aqui somam-se vários
 * treinos, então 300 TSS numa semana é rotina, não um dia difícil.
 */
export function cargaDaSemana(tss: number | null | undefined): NivelDeCarga | null {
  if (tss == null || !Number.isFinite(tss) || tss <= 0) return null
  if (tss < 150) return NIVEIS.leve
  if (tss < 300) return NIVEIS.moderada
  if (tss < 450) return NIVEIS.forte
  return NIVEIS['muito-forte']
}
