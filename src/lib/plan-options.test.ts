import { describe, it, expect } from 'vitest'
import { opcoesDePlano, opcaoDePlanoSalvo } from './plan-options'
import { progressao5kIniciantes } from './program-templates'
import type { TrainingProgramRow } from './supabase/queries'

const salvo = (over: Partial<TrainingProgramRow> = {}): TrainingProgramRow => {
  const modelo = progressao5kIniciantes()
  return {
    id: 'p1', name: modelo.name, description: modelo.description, sport: 'running',
    goal: '5km', level: 'iniciante', weeks: modelo.weeks, routing: null,
    package_key: null, active: true, ...over,
  }
}

describe('planos oferecidos na hora de aplicar', () => {
  it('inclui o plano cadastrado pelo treinador — que era o que faltava', () => {
    const nomes = opcoesDePlano([salvo()]).map(o => o.nome)
    expect(nomes).toContain('PROGRESSÃO 5K INICIANTES')
  })

  it('sem plano cadastrado, a lista fica vazia — nada de modelo embutido', () => {
    // Antes caía nos modelos do código, que o treinador nunca escreveu.
    expect(opcoesDePlano([])).toEqual([])
  })

  it('não mostra plano desativado', () => {
    expect(opcoesDePlano([salvo({ active: false })])).toEqual([])
  })

  it('cada opção tem chave única, senão a seleção pega o plano errado', () => {
    const lista = opcoesDePlano([salvo(), salvo({ id: 'p2', name: 'Outro plano' })])
    expect(new Set(lista.map(o => o.chave)).size).toBe(lista.length)
  })
})

describe('aplicar um plano cadastrado ao aluno', () => {
  const opcao = opcaoDePlanoSalvo(salvo())
  const inicio = new Date('2026-08-03T12:00:00')   // uma segunda-feira

  it('anuncia o mesmo número de treinos que vai criar', () => {
    expect(opcao.linhas('atleta-1', inicio)).toHaveLength(opcao.treinos)
  })

  it('cria as 8 semanas com 3 corridas e 2 forças cada', () => {
    const linhas = opcao.linhas('atleta-1', inicio)
    expect(linhas.filter(l => l.sport === 'running')).toHaveLength(24)
    expect(linhas.filter(l => l.sport === 'strength')).toHaveLength(16)
  })

  it('as corridas chegam ao calendário com os passos, não só com o texto', () => {
    for (const l of opcao.linhas('atleta-1', inicio).filter(x => x.sport === 'running')) {
      expect(l.structure, l.title).toBeTruthy()
      expect(l.structure![0]).toHaveProperty('step')
    }
  })

  it('a % do ritmo limite sobrevive até o treino do aluno', () => {
    const primeiro = opcao.linhas('atleta-1', inicio).find(l => l.sport === 'running')!
    const passo = (primeiro.structure![0] as { step: { pacePct?: number[] } }).step
    expect(passo.pacePct).toEqual([70, 80])
  })

  it('começa na data escolhida e ocupa 8 semanas', () => {
    const datas = opcao.linhas('atleta-1', inicio).map(l => l.date).sort()
    expect(datas[0]).toBe('2026-08-03')
    const dias = (new Date(datas[datas.length - 1]).getTime() - new Date(datas[0]).getTime()) / 86400000
    expect(dias).toBeLessThanOrEqual(8 * 7)
  })

  it('todo treino vai para o atleta pedido', () => {
    expect(opcao.linhas('atleta-42', inicio).every(l => l.athlete_id === 'atleta-42')).toBe(true)
  })
})

describe('escolher os dias da semana ao aplicar', () => {
  const opcao = opcaoDePlanoSalvo(salvo())
  const inicio = new Date('2026-08-03T12:00:00')   // segunda-feira
  // Dia da semana de uma data, 0=segunda … 6=domingo.
  const diaSemana = (iso: string) => (new Date(iso + 'T12:00:00').getDay() + 6) % 7

  it('anuncia quantas corridas por semana o plano tem', () => {
    expect(opcao.corridasPorSemana).toBe(3)
    expect(opcao.diasPadrao).toEqual([0, 2, 4])   // seg, qua, sex
  })

  it('as corridas caem exatamente nos dias escolhidos', () => {
    const linhas = opcao.linhas('a1', inicio, [1, 3, 5])   // ter, qui, sáb
    const dias = new Set(linhas.filter(l => l.sport === 'running').map(l => diaSemana(l.date)))
    expect([...dias].sort()).toEqual([1, 3, 5])
  })

  it('a força vai para os dias que sobram, sem cair em cima da corrida', () => {
    const linhas = opcao.linhas('a1', inicio, [1, 3, 5])
    const corrida = new Set(linhas.filter(l => l.sport === 'running').map(l => diaSemana(l.date)))
    const forca = new Set(linhas.filter(l => l.sport === 'strength').map(l => diaSemana(l.date)))
    for (const d of forca) expect(corrida.has(d), `força no dia ${d}`).toBe(false)
  })

  it('o longão vai para o dia escolhido', () => {
    const linhas = opcao.linhas('a1', inicio, [0, 2, 6], 6)   // longão no domingo
    const semana1 = linhas.filter(l => l.date <= '2026-08-09' && l.sport === 'running')
    const maior = Math.max(...semana1.map(l => l.planned_duration_min ?? 0))
    const noDomingo = semana1.find(l => diaSemana(l.date) === 6)
    expect(noDomingo?.planned_duration_min).toBe(maior)
  })

  it('trocar os dias não muda a quantidade de treinos', () => {
    for (const dias of [[0, 2, 4], [1, 3, 5], [0, 3, 6], [2, 4, 6]]) {
      expect(opcao.linhas('a1', inicio, dias), dias.join(',')).toHaveLength(opcao.treinos)
    }
  })

  it('sem dias escolhidos, usa os do próprio plano', () => {
    const linhas = opcao.linhas('a1', inicio)
    const dias = new Set(linhas.filter(l => l.sport === 'running').map(l => diaSemana(l.date)))
    expect([...dias].sort()).toEqual(opcao.diasPadrao)
  })

  it('menos dias que corridas ainda gera todos os treinos', () => {
    // O treinador pode escolher 2 dias para um plano de 3 corridas; o app
    // encaixa duas no mesmo dia em vez de perder um treino.
    expect(opcao.linhas('a1', inicio, [0, 3])).toHaveLength(opcao.treinos)
  })
})
