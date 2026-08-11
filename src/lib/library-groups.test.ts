import { describe, it, expect } from 'vitest'
import { agruparBiblioteca, grupoDe, casaBusca, gruposExistentes } from './library-groups'
import type { WorkoutLibraryRow } from './supabase/queries'

const t = (over: Partial<WorkoutLibraryRow>): WorkoutLibraryRow => ({
  id: Math.random().toString(36).slice(2), sport: 'running', title: 'Treino',
  description: null, duration_min: 40, tss: 40, ...over,
})

describe('pasta de um treino', () => {
  it('usa o grupo salvo', () => {
    expect(grupoDe(t({ group_name: '1 BIKE — ENDURANCE' }))).toBe('1 BIKE — ENDURANCE')
  })

  it('sem grupo, cai na modalidade em vez de virar "outros"', () => {
    expect(grupoDe(t({ sport: 'running' }))).toBe('Corrida')
    expect(grupoDe(t({ sport: 'strength' }))).toBe('Força')
    expect(grupoDe(t({ sport: 'cycling' }))).toBe('Ciclismo')
  })

  it('grupo só com espaços conta como vazio', () => {
    expect(grupoDe(t({ group_name: '   ', sport: 'swimming' }))).toBe('Natação')
  })

  it('modalidade desconhecida não quebra', () => {
    expect(grupoDe(t({ sport: 'parkour' }))).toBe('Outros')
  })
})

describe('agrupar a biblioteca', () => {
  const itens = [
    t({ title: 'Zeta', group_name: '2 BIKE — TEMPO' }),
    t({ title: 'Alfa', group_name: '2 BIKE — TEMPO' }),
    t({ title: 'Longo', group_name: '1 BIKE — ENDURANCE' }),
    t({ title: 'Força A', sport: 'strength' }),
  ]

  it('separa por pasta e conta certo', () => {
    const g = agruparBiblioteca(itens)
    expect(g.map(x => [x.nome, x.treinos.length])).toEqual([
      ['1 BIKE — ENDURANCE', 1],
      ['2 BIKE — TEMPO', 2],
      ['Força', 1],
    ])
  })

  it('ordena as pastas alfabeticamente, para o prefixo numérico funcionar', () => {
    // É como o treinador controla a ordem: "1 BIKE" antes de "2 BIKE".
    const g = agruparBiblioteca([
      t({ group_name: '3 BIKE LIMIAR' }), t({ group_name: '1 BIKE ENDURANCE' }), t({ group_name: '2 BIKE TEMPO' }),
    ])
    expect(g.map(x => x.nome)).toEqual(['1 BIKE ENDURANCE', '2 BIKE TEMPO', '3 BIKE LIMIAR'])
  })

  it('ordena os treinos por título dentro da pasta', () => {
    const g = agruparBiblioteca(itens)
    expect(g.find(x => x.nome === '2 BIKE — TEMPO')!.treinos.map(x => x.title)).toEqual(['Alfa', 'Zeta'])
  })

  it('biblioteca vazia devolve nenhuma pasta', () => {
    expect(agruparBiblioteca([])).toEqual([])
  })
})

describe('busca dentro da biblioteca', () => {
  const itens = [
    t({ title: '10x 1min forte', group_name: 'PROGRESSÃO 5K' }),
    t({ title: 'Longo de domingo', description: 'rodagem tranquila' }),
    t({ title: 'Força A', sport: 'strength' }),
  ]

  it('acha pelo título', () => {
    expect(agruparBiblioteca(itens, '1min').flatMap(g => g.treinos)).toHaveLength(1)
  })

  it('acha pela descrição', () => {
    expect(agruparBiblioteca(itens, 'rodagem').flatMap(g => g.treinos)).toHaveLength(1)
  })

  it('acha pelo nome da pasta', () => {
    expect(agruparBiblioteca(itens, 'progressão').flatMap(g => g.treinos)).toHaveLength(1)
  })

  it('ignora maiúsculas e espaços em volta', () => {
    expect(casaBusca(itens[0], '  FORTE ')).toBe(true)
  })

  it('busca vazia devolve tudo', () => {
    expect(agruparBiblioteca(itens, '  ').flatMap(g => g.treinos)).toHaveLength(3)
  })

  it('pasta que fica sem resultado some da lista', () => {
    const g = agruparBiblioteca(itens, 'domingo')
    expect(g).toHaveLength(1)
    expect(g[0].treinos).toHaveLength(1)
  })
})

describe('filtro por modalidade', () => {
  const itens = [t({ sport: 'running' }), t({ sport: 'strength' }), t({ sport: 'cycling' })]

  it('mostra só a modalidade pedida', () => {
    expect(agruparBiblioteca(itens, '', 'strength').flatMap(g => g.treinos)).toHaveLength(1)
  })

  it('"all" mostra todas', () => {
    expect(agruparBiblioteca(itens, '', 'all').flatMap(g => g.treinos)).toHaveLength(3)
  })

  it('combina com a busca', () => {
    const lista = [t({ sport: 'running', title: 'Tiro curto' }), t({ sport: 'cycling', title: 'Tiro curto' })]
    expect(agruparBiblioteca(lista, 'tiro', 'cycling').flatMap(g => g.treinos)).toHaveLength(1)
  })
})

describe('grupos já usados, para sugerir no formulário', () => {
  it('lista sem repetir e em ordem', () => {
    const itens = [t({ group_name: 'Provas' }), t({ group_name: 'Base' }), t({ group_name: 'Provas' }), t({})]
    expect(gruposExistentes(itens)).toEqual(['Base', 'Provas'])
  })

  it('não sugere pasta derivada da modalidade', () => {
    expect(gruposExistentes([t({ sport: 'running' })])).toEqual([])
  })
})
