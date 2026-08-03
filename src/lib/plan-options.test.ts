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

  it('mostra os planos do treinador antes dos modelos prontos', () => {
    const lista = opcoesDePlano([salvo()])
    expect(lista[0].salvo).toBe(true)
    expect(lista.filter(o => !o.salvo).length).toBeGreaterThan(0)
  })

  it('sem nenhum plano cadastrado, ainda oferece os modelos', () => {
    const lista = opcoesDePlano([])
    expect(lista.length).toBeGreaterThan(0)
    expect(lista.every(o => !o.salvo)).toBe(true)
  })

  it('não mostra plano desativado', () => {
    expect(opcoesDePlano([salvo({ active: false })]).some(o => o.salvo)).toBe(false)
  })

  it('modelo com o mesmo nome de um plano cadastrado não aparece duas vezes', () => {
    const lista = opcoesDePlano([salvo({ name: 'Meus primeiros 5 km — 12 semanas' })])
    expect(lista.filter(o => o.nome === 'Meus primeiros 5 km — 12 semanas')).toHaveLength(1)
    expect(lista.find(o => o.nome === 'Meus primeiros 5 km — 12 semanas')!.salvo).toBe(true)
  })

  it('cada opção tem chave única, senão a seleção pega o plano errado', () => {
    const lista = opcoesDePlano([salvo()])
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
