/**
 * Primeiros passos do treinador.
 *
 * Ninguém é apresentado ao app: quem entra pela primeira vez encontra um menu
 * cheio e nenhuma indicação de por onde começar. Pior, dá para chegar longe com
 * a montagem pela metade — o caso mais comum é o aluno cadastrado e com plano,
 * mas sem ritmo de limiar, o que faz o treino chegar nele como "88–98%" em vez
 * de minutos por quilômetro.
 *
 * Os passos são deduzidos dos dados, nunca de um "já vi isso" guardado no
 * navegador: um aluno novo sem ritmo faz o aviso voltar, que é o certo.
 */

export type ChaveDoPasso = 'aluno' | 'ritmo' | 'plano'

export type Passo = {
  chave: ChaveDoPasso
  titulo: string
  /** O que acontece se ficar por fazer. */
  porque: string
  href: string
  feito: boolean
}

export type EstadoDaMontagem = {
  /** Quantos alunos ativos o treinador tem. */
  alunos: number
  /** Quantos deles têm ritmo de limiar cadastrado. */
  comRitmo: number
  /** Quantos têm ao menos um treino programado de hoje em diante. */
  comPlano: number
}

export function passosDoTreinador(e: EstadoDaMontagem): Passo[] {
  const semRitmo = Math.max(0, e.alunos - e.comRitmo)
  const semPlano = Math.max(0, e.alunos - e.comPlano)

  return [
    {
      chave: 'aluno',
      titulo: 'Cadastre seu primeiro aluno',
      porque: 'É por ele que tudo começa.',
      href: '/athletes',
      feito: e.alunos > 0,
    },
    {
      chave: 'ritmo',
      titulo: semRitmo === 1 && e.alunos > 1
        ? 'Falta o ritmo de limiar de 1 aluno'
        : semRitmo > 1
          ? `Falta o ritmo de limiar de ${semRitmo} alunos`
          : 'Defina o ritmo de limiar do aluno',
      porque: 'Sem ele, o treino chega como "88–98%" em vez de minutos por quilômetro.',
      href: '/athletes',
      feito: e.alunos > 0 && semRitmo === 0,
    },
    {
      chave: 'plano',
      titulo: semPlano > 0 && e.comPlano > 0
        ? `${semPlano} aluno${semPlano > 1 ? 's' : ''} sem treino programado`
        : 'Aplique um plano de treinamento',
      porque: 'O aluno abre o app e vê o treino do dia.',
      href: '/treinos',
      feito: e.alunos > 0 && semPlano === 0,
    },
  ]
}

/**
 * O aviso só aparece enquanto há passo pendente — e some sozinho quando a
 * montagem fica completa, sem ninguém precisar fechar nada.
 */
export function montagemCompleta(passos: Passo[]): boolean {
  return passos.every(p => p.feito)
}

export function passosPendentes(passos: Passo[]): Passo[] {
  return passos.filter(p => !p.feito)
}
