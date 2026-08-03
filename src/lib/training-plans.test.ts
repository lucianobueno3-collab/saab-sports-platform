import { describe, it, expect } from 'vitest'
import { generatePlan, structureForTitle, PLAN_LIBRARY } from './training-plans'
import { estimateStructure, flattenSteps, zoneTotals } from './workout-structure'

describe('todo treino de plano sai estruturado', () => {
  it('nenhuma sessão do catálogo fica sem passos', () => {
    for (const plano of PLAN_LIBRARY) {
      for (const semana of generatePlan(plano)) {
        for (const s of semana.workouts) {
          expect(s.structure.length, `${plano.key} · ${s.title}`).toBeGreaterThan(0)
        }
      }
    }
  })

  it('a duração anunciada é a soma dos passos', () => {
    // O aluno não pode ver "50 min" e somar 62 min de passos.
    for (const plano of PLAN_LIBRARY) {
      for (const semana of generatePlan(plano)) {
        for (const s of semana.workouts) {
          expect(estimateStructure(s.structure).min, `${plano.key} · ${s.title}`).toBe(s.duration_min)
        }
      }
    }
  })

  it('nenhum passo tem duração zero ou negativa', () => {
    for (const plano of PLAN_LIBRARY) {
      for (const semana of generatePlan(plano)) {
        for (const s of semana.workouts) {
          for (const passo of flattenSteps(s.structure)) {
            expect(passo.min, `${plano.key} · ${s.title}`).toBeGreaterThan(0)
          }
        }
      }
    }
  })

  it('a carga estimada é sempre positiva', () => {
    for (const plano of PLAN_LIBRARY) {
      for (const semana of generatePlan(plano)) {
        for (const s of semana.workouts) expect(s.tss).toBeGreaterThan(0)
      }
    }
  })
})

describe('intensidade compatível com o tipo de sessão', () => {
  const acharTreino = (planoKey: string, titulo: string) => {
    const plano = PLAN_LIBRARY.find(p => p.key === planoKey)!
    for (const semana of generatePlan(plano)) {
      const s = semana.workouts.find(w => w.title === titulo)
      if (s) return s
    }
    throw new Error(`não achei ${titulo} em ${planoKey}`)
  }

  it('o intervalado tem trecho forte de verdade', () => {
    const zonas = zoneTotals(acharTreino('run_10k_8', 'Intervalado (VO2)').structure)
    expect(zonas.some(z => z.zone === 5)).toBe(true)
  })

  it('a rodagem leve fica toda em zona baixa', () => {
    const zonas = zoneTotals(acharTreino('run_10k_8', 'Rodagem leve').structure)
    expect(zonas.every(z => z.zone <= 2)).toBe(true)
  })

  it('o regenerativo não passa da Z1', () => {
    const zonas = zoneTotals(acharTreino('run_42k_16', 'Regenerativo').structure)
    expect(zonas.every(z => z.zone === 1)).toBe(true)
  })

  it('a corrida/caminhada do iniciante alterna trote e caminhada', () => {
    const passos = flattenSteps(acharTreino('run_first5k_12', 'Corrida/caminhada').structure)
    expect(passos.some(p => p.note?.includes('trote'))).toBe(true)
    expect(passos.some(p => p.note?.includes('caminhada'))).toBe(true)
  })

  it('sessões de série nunca saem com menos de 2 repetições', () => {
    for (const plano of PLAN_LIBRARY) {
      for (const semana of generatePlan(plano)) {
        for (const s of semana.workouts) {
          for (const seg of s.structure) {
            if (seg.type === 'repeat') expect(seg.times, `${plano.key} · ${s.title}`).toBeGreaterThanOrEqual(2)
          }
        }
      }
    }
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
    // O card mostra a duração salva; se os passos somassem outro número, o
    // aluno veria dois valores diferentes para o mesmo treino.
    for (const titulo of ['Intervalado (VO2)', 'Tempo / limiar', 'Rodagem leve', 'Longo', 'Corrida/caminhada', 'Bike intervalado', 'Brick (bike+run)']) {
      for (const min of [20, 25, 30, 45, 50, 55, 80, 120, 165]) {
        const st = structureForTitle(titulo, min)!
        expect(estimateStructure(st).min, `${titulo} · ${min}min`).toBe(min)
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
