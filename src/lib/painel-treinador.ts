/**
 * A leitura da equipe no dia, para o painel do treinador.
 *
 * A Visão Geral respondia "qual o CTL médio do grupo" — número de relatório
 * mensal. A pergunta de quem abre o painel de manhã é outra: quem treinou,
 * quem faltou, e quem precisa de mim hoje. Para responder isso era preciso
 * abrir aluno por aluno.
 */

import type { AlunoNaSemana, DiaDoAluno } from '@/lib/supabase/queries'

export type ChaveDeMotivo = 'recado' | 'dor' | 'faltas' | 'plano-acabando' | 'fadiga'

export type Motivo = {
  chave: ChaveDeMotivo
  texto: string
  /** Quanto mais alto, mais para cima o aluno aparece na lista. */
  peso: number
}

/** Dor a partir daqui deixa de ser incômodo normal de treino. */
const DOR_ALTA = 6
/** Faltas na semana que já mudam a conversa com o aluno. */
const FALTAS_PREOCUPANTES = 2
/** Menos que isso de plano pela frente e é hora de montar a continuação. */
const DIAS_DE_PLANO_MINIMO = 7
/** Abaixo deste TSB o aluno está acumulando fadiga mais rápido do que recupera. */
const TSB_CRITICO = -25

export function diasDeDiferenca(de: string, ate: string): number {
  const a = new Date(de + 'T12:00:00').getTime()
  const b = new Date(ate + 'T12:00:00').getTime()
  return Math.round((b - a) / 86400000)
}

/** Treinos planejados num dia que já passou e não foram feitos. */
export function faltasAte(dias: DiaDoAluno[], hoje: string): number {
  return dias
    .filter(d => d.date < hoje)
    .reduce((s, d) => s + Math.max(0, d.planejados - d.feitos), 0)
}

/** O que o aluno tem para hoje: planejado, feito, ou nada. */
export type SituacaoDeHoje = 'fez' | 'pendente' | 'sem-treino'

export function situacaoDeHoje(aluno: AlunoNaSemana, hoje: string): SituacaoDeHoje {
  const d = aluno.dias.find(x => x.date === hoje)
  if (!d || d.planejados === 0) return d && d.feitos > 0 ? 'fez' : 'sem-treino'
  return d.feitos >= d.planejados ? 'fez' : 'pendente'
}

/**
 * Por que este aluno precisa de atenção hoje — em ordem de urgência.
 *
 * Devolve lista vazia quando está tudo bem, que é o caso da maioria: a tela só
 * vale se o que aparece nela for mesmo acionável.
 */
export function motivosDeAtencao(aluno: AlunoNaSemana, hoje: string): Motivo[] {
  const motivos: Motivo[] = []

  if (aluno.recadosNaoLidos > 0) {
    motivos.push({
      chave: 'recado',
      texto: aluno.recadosNaoLidos === 1 ? 'Recado sem resposta' : `${aluno.recadosNaoLidos} recados sem resposta`,
      peso: 100,
    })
  }

  if (aluno.dor != null && aluno.dor >= DOR_ALTA) {
    motivos.push({ chave: 'dor', texto: `Relatou dor ${aluno.dor}/10`, peso: 90 })
  }

  const faltas = faltasAte(aluno.dias, hoje)
  if (faltas >= FALTAS_PREOCUPANTES) {
    motivos.push({ chave: 'faltas', texto: `${faltas} treinos não feitos esta semana`, peso: 70 })
  }

  if (aluno.tsb != null && aluno.tsb < TSB_CRITICO) {
    motivos.push({ chave: 'fadiga', texto: 'Fadiga acumulada', peso: 60 })
  }

  // Plano acabando: sem isso o aluno descobre sozinho, num dia sem treino.
  if (aluno.ultimoPlanejado == null) {
    motivos.push({ chave: 'plano-acabando', texto: 'Sem plano', peso: 80 })
  } else {
    const restam = diasDeDiferenca(hoje, aluno.ultimoPlanejado)
    if (restam < 0) motivos.push({ chave: 'plano-acabando', texto: 'Plano terminou', peso: 80 })
    else if (restam < DIAS_DE_PLANO_MINIMO) {
      motivos.push({
        chave: 'plano-acabando',
        texto: restam === 0 ? 'Último dia de plano' : `Plano acaba em ${restam} dia${restam > 1 ? 's' : ''}`,
        peso: 50,
      })
    }
  }

  return motivos.sort((a, b) => b.peso - a.peso)
}

export type PainelDeHoje = {
  fizeram: AlunoNaSemana[]
  pendentes: AlunoNaSemana[]
  semTreino: AlunoNaSemana[]
  /** Quem precisa de você, do mais urgente para o menos. */
  atencao: { aluno: AlunoNaSemana; motivos: Motivo[] }[]
}

/** Divide a equipe nas listas do dia. */
export function painelDeHoje(alunos: AlunoNaSemana[], hoje: string): PainelDeHoje {
  const fizeram: AlunoNaSemana[] = []
  const pendentes: AlunoNaSemana[] = []
  const semTreino: AlunoNaSemana[] = []

  for (const a of alunos) {
    const s = situacaoDeHoje(a, hoje)
    if (s === 'fez') fizeram.push(a)
    else if (s === 'pendente') pendentes.push(a)
    else semTreino.push(a)
  }

  const atencao = alunos
    .map(aluno => ({ aluno, motivos: motivosDeAtencao(aluno, hoje) }))
    .filter(x => x.motivos.length > 0)
    .sort((a, b) => b.motivos[0].peso - a.motivos[0].peso || a.aluno.nome.localeCompare(b.aluno.nome, 'pt-BR'))

  return { fizeram, pendentes, semTreino, atencao }
}

/** Como pintar o quadradinho de um dia na grade da semana. */
export type EstadoDoDia = 'feito' | 'parcial' | 'furado' | 'pendente' | 'vazio'

export function estadoDoDia(dia: DiaDoAluno, hoje: string): EstadoDoDia {
  if (dia.planejados === 0) return dia.feitos > 0 ? 'feito' : 'vazio'
  if (dia.feitos >= dia.planejados) return 'feito'
  if (dia.feitos > 0) return 'parcial'
  return dia.date < hoje ? 'furado' : 'pendente'
}

export const COR_DO_DIA: Record<EstadoDoDia, string> = {
  feito: '#00d084',
  parcial: '#ffa800',
  furado: '#e8001c',
  pendente: '#64748b',
  vazio: 'transparent',
}

export const NOME_DO_ESTADO: Record<EstadoDoDia, string> = {
  feito: 'Feito',
  parcial: 'Parcial',
  furado: 'Não fez',
  pendente: 'A fazer',
  vazio: 'Sem treino',
}

/** Quantos treinos a equipe fez e deixou de fazer na semana. */
export function totaisDaSemana(alunos: AlunoNaSemana[], hoje: string) {
  let planejados = 0, feitos = 0, furados = 0
  for (const a of alunos) for (const d of a.dias) {
    planejados += d.planejados
    feitos += Math.min(d.feitos, d.planejados || d.feitos)
    if (d.date < hoje) furados += Math.max(0, d.planejados - d.feitos)
  }
  return { planejados, feitos, furados }
}
