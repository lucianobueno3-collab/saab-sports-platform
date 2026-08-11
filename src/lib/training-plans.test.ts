import { describe, it, expect } from 'vitest'
import { structureFor, structureForTitle, TIPOS_DE_SESSAO } from './training-plans'
import { estimateStructure, flattenSteps, zoneTotals } from './workout-structure'

// Durações plausíveis de qualquer sessão, das mais curtas às mais longas.
const DURACOES = [20, 25, 30, 45, 50, 55, 80, 120, 165]

describe('estrutura de cada tipo de sessão', () => {
  it('nenhum tipo fica sem passos, em nenhuma duração', () => {
    for (const tipo of TIPOS_DE_SESSAO) {
      for (const min of DURACOES) {
        expect(structureFor(tipo, min).length, `${tipo} · ${min}min`).toBeGreaterThan(0)
      }
    }
  })

  it('os passos somam exatamente a duração pedida', () => {
    // O card mostra a duração salva; se os passos somassem outro número, o
    // aluno veria dois valores diferentes para o mesmo treino.
    for (const tipo of TIPOS_DE_SESSAO) {
      for (const min of DURACOES) {
        expect(estimateStructure(structureFor(tipo, min)).min, `${tipo} · ${min}min`).toBe(min)
      }
    }
  })

  it('nenhum passo tem duração zero ou negativa', () => {
    for (const tipo of TIPOS_DE_SESSAO) {
      for (const min of DURACOES) {
        for (const p of flattenSteps(structureFor(tipo, min))) {
          expect(p.min, `${tipo} · ${min}min`).toBeGreaterThan(0)
        }
      }
    }
  })

  it('série nunca sai com menos de 2 repetições', () => {
    for (const tipo of TIPOS_DE_SESSAO) {
      for (const min of DURACOES) {
        for (const seg of structureFor(tipo, min)) {
          if (seg.type === 'repeat') expect(seg.times, `${tipo} · ${min}min`).toBeGreaterThanOrEqual(2)
        }
      }
    }
  })
})

describe('intensidade compatível com o tipo', () => {
  it('o intervalado tem trecho em zona alta', () => {
    expect(zoneTotals(structureFor('intervals', 55)).some(z => z.zone === 5)).toBe(true)
  })

  it('a rodagem leve fica em zona baixa', () => {
    expect(zoneTotals(structureFor('easy', 45)).every(z => z.zone <= 2)).toBe(true)
  })

  it('o regenerativo não passa da Z1', () => {
    expect(zoneTotals(structureFor('recovery', 30)).every(z => z.zone === 1)).toBe(true)
  })

  it('a corrida/caminhada alterna trote e caminhada', () => {
    const passos = flattenSteps(structureFor('walkrun', 30))
    expect(passos.some(p => p.note?.includes('trote'))).toBe(true)
    expect(passos.some(p => p.note?.includes('caminhada'))).toBe(true)
  })
})

describe('resgate de treinos antigos, salvos sem passos', () => {
  it('remonta pelo título do catálogo', () => {
    const st = structureForTitle('Intervalado (VO2)', 50)
    expect(st).not.toBeNull()
    expect(estimateStructure(st!).min).toBe(50)
    expect(zoneTotals(st!).some(z => z.zone === 5)).toBe(true)
  })

  it('não se importa com maiúsculas e espaços sobrando', () => {
    expect(structureForTitle('  rodagem leve  ', 45)).not.toBeNull()
  })

  it('os passos fecham a duração salva, em qualquer tamanho de treino', () => {
    for (const titulo of ['Intervalado (VO2)', 'Tempo / limiar', 'Rodagem leve', 'Longo', 'Corrida/caminhada', 'Bike intervalado', 'Brick (bike+run)']) {
      for (const min of DURACOES) {
        expect(estimateStructure(structureForTitle(titulo, min)!).min, `${titulo} · ${min}min`).toBe(min)
      }
    }
  })

  it('devolve null para treino escrito à mão — melhor nada do que inventar', () => {
    expect(structureForTitle('Fartlek do Luciano', 45)).toBeNull()
  })

  it('devolve null sem duração salva, que é a base do cálculo', () => {
    expect(structureForTitle('Rodagem leve', null)).toBeNull()
    expect(structureForTitle('Rodagem leve', 0)).toBeNull()
  })
})
