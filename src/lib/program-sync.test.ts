import { describe, it, expect } from 'vitest'
import { progressao5kIniciantes } from './program-templates'

/** Mesma busca que o compositor faz antes de gravar. */
function acharExistente(programas: { id: string; name: string }[], nome: string) {
  return programas.find(p => p.name.trim().toLowerCase() === nome.trim().toLowerCase())
}

describe('carregar o programa no banco não duplica', () => {
  const modelo = progressao5kIniciantes()

  it('reconhece o programa que já está gravado, para atualizar em vez de criar', () => {
    const banco = [{ id: 'abc', name: 'PROGRESSÃO 5K INICIANTES' }]
    expect(acharExistente(banco, modelo.name)?.id).toBe('abc')
  })

  it('ignora diferença de caixa e espaços sobrando', () => {
    const banco = [{ id: 'abc', name: '  progressão 5k iniciantes ' }]
    expect(acharExistente(banco, modelo.name)?.id).toBe('abc')
  })

  it('não confunde com um plano de nome diferente', () => {
    const banco = [{ id: 'abc', name: 'Meia maratona — 12 semanas' }]
    expect(acharExistente(banco, modelo.name)).toBeUndefined()
  })

  it('banco vazio cria um novo', () => {
    expect(acharExistente([], modelo.name)).toBeUndefined()
  })
})

describe('o que vai para o banco', () => {
  const modelo = progressao5kIniciantes()

  it('leva as 8 semanas com todos os treinos', () => {
    expect(modelo.weeks).toHaveLength(8)
    expect(modelo.weeks.flatMap(w => w.workouts)).toHaveLength(8 * 5)   // 3 corridas + 2 forças
  })

  it('toda corrida vai com a estrutura de passos, que é o que o aluno lê', () => {
    const corridas = modelo.weeks.flatMap(w => w.workouts).filter(x => x.sport === 'running')
    expect(corridas).toHaveLength(24)
    for (const c of corridas) expect(c.structure, c.title).toBeTruthy()
  })

  it('sobrevive a ida e volta em JSON, que é como a coluna guarda', () => {
    const voltou = JSON.parse(JSON.stringify(modelo)) as typeof modelo
    expect(voltou).toEqual(modelo)
    const primeiro = voltou.weeks[0].workouts.find(x => x.sport === 'running')!
    expect(primeiro.structure![0]).toMatchObject({ step: { pacePct: [70, 80] } })
  })
})
