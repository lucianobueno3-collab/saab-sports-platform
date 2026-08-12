/**
 * O que cada notificação diz.
 *
 * Fica separado do envio para poder ser testado: o texto de uma notificação é
 * a única coisa que o aluno vê do aviso, e errar o plural ou mandar um título
 * genérico ("Nova atualização") é o caminho mais curto para ele desligar tudo.
 */

export type TipoDeAviso = 'recado' | 'treino-do-dia' | 'plano-novo'

export type Aviso = {
  titulo: string
  corpo: string
  /** Para onde o toque leva. */
  url: string
  /**
   * Notificações com a mesma tag se substituem em vez de empilhar. Três
   * recados no mesmo treino viram um aviso, não três.
   */
  tag: string
}

/** Corta um texto longo sem cortar palavra no meio. */
export function resumir(texto: string, limite = 120): string {
  const t = texto.trim().replace(/\s+/g, ' ')
  if (t.length <= limite) return t
  const corte = t.slice(0, limite)
  const ultimoEspaco = corte.lastIndexOf(' ')
  return (ultimoEspaco > limite * 0.6 ? corte.slice(0, ultimoEspaco) : corte).trimEnd() + '…'
}

/** O treinador respondeu num treino. */
export function avisoDeRecado(input: {
  treino: string
  corpo: string
  workoutId: string
  nomeDoTreinador?: string | null
}): Aviso {
  const quem = input.nomeDoTreinador?.trim()
  return {
    titulo: quem ? `${quem} respondeu` : 'Seu treinador respondeu',
    corpo: `${input.treino}: ${resumir(input.corpo, 100)}`,
    url: '/atleta?aba=recados',
    // Por treino: várias respostas na mesma conversa viram um aviso só.
    tag: `recado-${input.workoutId}`,
  }
}

/** Lembrete do treino do dia. */
export function avisoDoTreinoDoDia(input: {
  titulo: string
  duracaoMin?: number | null
  data: string
}): Aviso {
  const dur = input.duracaoMin ? ` · ${input.duracaoMin} min` : ''
  return {
    titulo: 'Seu treino de hoje',
    corpo: `${input.titulo}${dur}`,
    url: '/atleta',
    // Por dia: reenviar não empilha, e o aviso de ontem some.
    tag: `treino-${input.data}`,
  }
}

/** O treinador publicou treinos novos. */
export function avisoDePlanoNovo(input: { quantos: number }): Aviso {
  const n = input.quantos
  return {
    titulo: 'Treinos novos no seu calendário',
    corpo: n === 1
      ? 'Seu treinador programou 1 treino novo.'
      : `Seu treinador programou ${n} treinos novos.`,
    url: '/atleta?aba=calendario',
    tag: 'plano-novo',
  }
}

/**
 * Só notifica o que vale acordar alguém.
 *
 * Aviso sem conteúdo, ou de treino que já passou, é o tipo de coisa que faz o
 * aluno desligar as notificações — e aí ele perde também as que importavam.
 */
export function valeNotificar(a: Aviso | null | undefined): a is Aviso {
  return Boolean(a && a.titulo.trim() && a.corpo.trim())
}
