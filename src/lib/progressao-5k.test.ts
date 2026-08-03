import { describe, it, expect } from 'vitest'
import { PROGRESSAO_5K } from './progressao-5k'
import { progressao5kIniciantes } from './program-templates'
import { estimateStructure, flattenSteps, structureSummary, stepIntensity } from './workout-structure'
import { pacePctRange, estimateTotalKm } from './workout-export'

const treino = (semana: number, dia: number) => {
  const c = PROGRESSAO_5K.find(x => x.semana === semana && x.dia === dia)
  if (!c) throw new Error(`sem treino na semana ${semana} dia ${dia}`)
  return c
}

describe('o programa cobre 8 semanas com 3 corridas cada', () => {
  it('tem 24 corridas', () => {
    expect(PROGRESSAO_5K).toHaveLength(24)
  })

  it('cada semana tem exatamente 3 corridas', () => {
    for (let s = 1; s <= 8; s++) {
      expect(PROGRESSAO_5K.filter(c => c.semana === s), `semana ${s}`).toHaveLength(3)
    }
  })

  it('todo trecho traz a % do ritmo limite prescrita', () => {
    for (const c of PROGRESSAO_5K) {
      for (const p of flattenSteps(c.structure)) {
        expect(p.pacePct, `${c.semana}/${c.dia} · ${c.titulo}`).toBeDefined()
      }
    }
  })

  it('nenhum trecho tem duração zero', () => {
    for (const c of PROGRESSAO_5K) {
      for (const p of flattenSteps(c.structure)) expect(p.min).toBeGreaterThan(0)
    }
  })
})

describe('transcrição fiel dos treinos do script', () => {
  // Semana 1, dia 1: WU 5min 70-80% · 10x (1min 88-98% / 1min 75-85%) · CD 5min
  it('semana 1 segunda: 10 tiros de 1 min', () => {
    const st = treino(1, 0).structure
    expect(st).toHaveLength(3)
    expect(st[0]).toMatchObject({ type: 'step', step: { kind: 'warmup', min: 5, pacePct: [70, 80] } })
    expect(st[1]).toMatchObject({ type: 'repeat', times: 10 })
    expect((st[1] as { steps: unknown[] }).steps[0]).toMatchObject({ min: 1, pacePct: [88, 98] })
    expect((st[1] as { steps: unknown[] }).steps[1]).toMatchObject({ min: 1, pacePct: [75, 85] })
    expect(st[2]).toMatchObject({ type: 'step', step: { kind: 'cooldown', min: 5, pacePct: [70, 80] } })
    expect(estimateStructure(st).min).toBe(30)   // 5 + 10x2 + 5
  })

  // Semana 2, dia 12: WU 10 · 6x (1min 90-95 / 1min 100-103 / 2min 75-85) · CD 5
  it('semana 2 sexta: série de três tempos', () => {
    const st = treino(2, 4).structure
    const serie = st[1] as { type: 'repeat'; times: number; steps: { min: number; pacePct: number[] }[] }
    expect(serie.times).toBe(6)
    expect(serie.steps.map(p => [p.min, p.pacePct])).toEqual([
      [1, [90, 95]], [1, [100, 103]], [2, [75, 85]],
    ])
    expect(estimateStructure(st).min).toBe(39)   // 10 + 6x4 + 5
  })

  // Semana 4, dia 24: 10x (1min 103-110% / 1min PARADO)
  it('semana 4 quarta: tiros intensos com parada total', () => {
    const st = treino(4, 2).structure
    const serie = st[1] as { steps: { pacePct: number[] }[] }
    expect(serie.steps[0].pacePct).toEqual([103, 110])
    expect(serie.steps[1].pacePct).toEqual([0, 0])
  })

  it('trecho parado não gera carga nenhuma', () => {
    const parado = flattenSteps(treino(4, 2).structure).find(p => p.pacePct?.[1] === 0)!
    expect(stepIntensity(parado)).toBe(0)
  })

  // Semana 5, dia 33: WU 10 · 4x(2/1) · 1x(15min 90-95 + 5min 100-103) · CD 5
  it('semana 5 sexta: dois blocos diferentes no mesmo treino', () => {
    const st = treino(5, 4).structure
    expect(st).toHaveLength(4)
    const bloco = st[2] as { type: 'repeat'; times: number; steps: { min: number; pacePct: number[] }[] }
    expect(bloco.times).toBe(1)
    expect(bloco.steps.map(p => [p.min, p.pacePct])).toEqual([[15, [90, 95]], [5, [100, 103]]])
    expect(estimateStructure(st).min).toBe(47)   // 10 + 4x3 + 20 + 5
  })

  // Semana 7, dia 47: WU 10 · 2x(2/2) · Active 30min 90-95% · CD 5
  it('semana 7 sexta: bloco contínuo de 30 min', () => {
    const st = treino(7, 4).structure
    expect(st[2]).toMatchObject({ type: 'step', step: { kind: 'steady', min: 30, pacePct: [90, 95] } })
    expect(estimateStructure(st).min).toBe(53)   // 10 + 2x4 + 30 + 5
  })

  it('a prova final é prescrita em distância', () => {
    const st = treino(8, 4).structure
    const passos = flattenSteps(st)
    expect(passos.map(p => p.km)).toEqual([1, 5])
    expect(passos[1].pacePct).toEqual([90, 95])
    expect(estimateTotalKm(passos, 'running', { thresholdPaceSecKm: 330 })).toBe(6)
  })
})

describe('a carga sai da % prescrita, não da zona', () => {
  it('o mesmo tempo em % mais alta pesa mais', () => {
    const leve = estimateStructure([{ type: 'step', step: { kind: 'work', min: 20, zone: 3, pacePct: [75, 85] } }])
    const forte = estimateStructure([{ type: 'step', step: { kind: 'work', min: 20, zone: 3, pacePct: [100, 103] } }])
    expect(forte.tss).toBeGreaterThan(leve.tss)
  })

  it('sem % informada, continua usando a zona', () => {
    const a = estimateStructure([{ type: 'step', step: { kind: 'work', min: 60, zone: 4 } }])
    expect(a.tss).toBe(96)   // 1h × 0.98² × 100
  })
})

describe('ritmo mostrado ao aluno', () => {
  const th = { thresholdPaceSecKm: 300 }   // 5:00/km de limiar

  it('% acima de 100 fica mais rápido que o limiar', () => {
    expect(pacePctRange([100, 103], 'running', th)).toBe('5:00–4:51 /km')
  })

  it('% abaixo de 100 fica mais lento', () => {
    expect(pacePctRange([70, 80], 'running', th)).toBe('7:09–6:15 /km')
  })

  it('trecho parado não mostra ritmo', () => {
    expect(pacePctRange([0, 0], 'running', th)).toBeNull()
  })
})

describe('programa montado para o compositor', () => {
  const prog = progressao5kIniciantes()

  it('leva o nome que o treinador usa', () => {
    expect(prog.name).toBe('PROGRESSÃO 5K INICIANTES')
  })

  it('tem 8 semanas, cada uma com 3 corridas e 2 forças', () => {
    expect(prog.weeks).toHaveLength(8)
    for (const w of prog.weeks) {
      expect(w.workouts.filter(x => x.sport === 'running')).toHaveLength(3)
      expect(w.workouts.filter(x => x.sport === 'strength')).toHaveLength(2)
    }
  })

  it('toda corrida vai com estrutura, duração e carga', () => {
    for (const w of prog.weeks) {
      for (const x of w.workouts.filter(c => c.sport === 'running')) {
        expect(x.structure, x.title).toBeTruthy()
        expect(x.duration_min, x.title).toBeGreaterThan(0)
        expect(x.tss, x.title).toBeGreaterThan(0)
        expect(estimateStructure(x.structure!).min).toBe(x.duration_min)
      }
    }
  })

  it('a descrição mostra a % e não só a zona', () => {
    const primeiro = prog.weeks[0].workouts.find(x => x.sport === 'running')!
    expect(primeiro.description).toContain('%')
    expect(structureSummary(primeiro.structure!)).toContain('88-98%')
  })

  it('o volume cresce da primeira para a última semana de treino', () => {
    const minutos = (i: number) => prog.weeks[i].workouts
      .filter(x => x.sport === 'running').reduce((s, x) => s + (x.duration_min ?? 0), 0)
    expect(minutos(6)).toBeGreaterThan(minutos(0))
  })
})
