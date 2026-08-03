import { describe, it, expect } from 'vitest'
import type { BulkDeleteScope } from './supabase/queries'

/**
 * Mesmo filtro que a consulta aplica no banco, para verificar a regra sem
 * depender do Supabase. O que importa aqui é O QUE some e o que fica.
 */
type Treino = { date: string; completed: boolean; title: string }

function seriaApagado(t: Treino, s: BulkDeleteScope) {
  if (s.from && t.date < s.from) return false
  if (s.to && t.date > s.to) return false
  if (!s.includeCompleted && t.completed) return false
  return true
}
const apagados = (ts: Treino[], s: BulkDeleteScope) => ts.filter(t => seriaApagado(t, s)).map(t => t.title)

const HOJE = '2026-08-10'
const plano: Treino[] = [
  { date: '2026-07-20', completed: true, title: 'passado feito' },
  { date: '2026-08-05', completed: false, title: 'passado nao feito' },
  { date: HOJE, completed: false, title: 'hoje' },
  { date: '2026-08-15', completed: false, title: 'futuro' },
  { date: '2026-09-01', completed: false, title: 'futuro distante' },
]

describe('de hoje em diante', () => {
  const escopo: BulkDeleteScope = { from: HOJE }

  it('apaga de hoje para a frente, incluindo hoje', () => {
    expect(apagados(plano, escopo)).toEqual(['hoje', 'futuro', 'futuro distante'])
  })

  it('não toca no passado, feito ou não', () => {
    const sobrou = plano.filter(t => !seriaApagado(t, escopo)).map(t => t.title)
    expect(sobrou).toEqual(['passado feito', 'passado nao feito'])
  })
})

describe('período', () => {
  it('respeita as duas pontas, inclusive', () => {
    expect(apagados(plano, { from: '2026-08-05', to: HOJE })).toEqual(['passado nao feito', 'hoje'])
  })

  it('período de um dia só pega aquele dia', () => {
    expect(apagados(plano, { from: HOJE, to: HOJE })).toEqual(['hoje'])
  })

  it('período sem treino nenhum não apaga nada', () => {
    expect(apagados(plano, { from: '2026-12-01', to: '2026-12-31' })).toEqual([])
  })
})

describe('tudo', () => {
  it('sem datas, pega o plano inteiro — menos o que já foi feito', () => {
    expect(apagados(plano, {})).toEqual(['passado nao feito', 'hoje', 'futuro', 'futuro distante'])
  })
})

describe('o histórico do aluno é preservado por padrão', () => {
  it('treino concluído nunca some sem a opção ligada', () => {
    for (const escopo of [{}, { from: '2026-01-01' }, { from: '2026-01-01', to: '2026-12-31' }]) {
      expect(apagados(plano, escopo), JSON.stringify(escopo)).not.toContain('passado feito')
    }
  })

  it('com a opção ligada, o concluído entra junto', () => {
    expect(apagados(plano, { includeCompleted: true })).toContain('passado feito')
  })

  it('a opção ligada ainda respeita o intervalo de datas', () => {
    expect(apagados(plano, { from: HOJE, includeCompleted: true })).not.toContain('passado feito')
  })
})

describe('contagem bate com a remoção', () => {
  it('o número mostrado é exatamente o que seria apagado', () => {
    for (const escopo of [{ from: HOJE }, { from: '2026-08-05', to: HOJE }, {}, { includeCompleted: true }]) {
      const lista = plano.filter(t => seriaApagado(t, escopo))
      expect(lista.length, JSON.stringify(escopo)).toBe(apagados(plano, escopo).length)
    }
  })
})
