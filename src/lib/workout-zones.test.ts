import { describe, it, expect } from 'vitest'
import { zoneTotals, dominantZone, estimateStructure, type WorkoutStructure } from './workout-structure'
import { estimateKm, estimateTotalKm, fmtKm, paceRange, hrRange } from './workout-export'

// 15min Z1 + 5x(3min Z4 + 2min Z1) + 10min Z1  → clássico treino de tiros
const tiros: WorkoutStructure = [
  { type: 'step', step: { kind: 'warmup', min: 15, zone: 1 } },
  { type: 'repeat', times: 5, steps: [
    { kind: 'work', min: 3, zone: 4 },
    { kind: 'recovery', min: 2, zone: 1 },
  ] },
  { type: 'step', step: { kind: 'cooldown', min: 10, zone: 1 } },
]

const rodagem: WorkoutStructure = [
  { type: 'step', step: { kind: 'steady', min: 50, zone: 2 } },
]

describe('tempo em cada zona', () => {
  it('soma as repetições, não conta a série só uma vez', () => {
    // Z1: 15 aquec. + 5×2 recup. + 10 desaquec. = 35 ; Z4: 5×3 = 15 ; total 50
    expect(zoneTotals(tiros)).toEqual([
      { zone: 1, min: 35, pct: 70 },
      { zone: 4, min: 15, pct: 30 },
    ])
  })

  it('bate com a duração total estimada', () => {
    const soma = zoneTotals(tiros).reduce((a, t) => a + t.min, 0)
    expect(soma).toBe(estimateStructure(tiros).min)
  })

  it('devolve lista vazia quando não há estrutura', () => {
    expect(zoneTotals([])).toEqual([])
  })

  it('ignora passos com duração zero', () => {
    expect(zoneTotals([{ type: 'step', step: { kind: 'work', min: 0, zone: 5 } }])).toEqual([])
  })
})

describe('zona que define o treino', () => {
  it('escolhe a parte forte, mesmo sendo minoria do tempo', () => {
    // Sem isso, 35 min de Z1 fariam um treino de tiros parecer leve.
    expect(dominantZone(tiros)).toBe(4)
  })

  it('numa rodagem contínua é a própria zona', () => {
    expect(dominantZone(rodagem)).toBe(2)
  })

  it('descarta um toque irrelevante de zona alta', () => {
    // 1 min de Z5 em 99 min = 1% do tempo: não define o treino.
    const quase: WorkoutStructure = [
      { type: 'step', step: { kind: 'steady', min: 99, zone: 2 } },
      { type: 'step', step: { kind: 'work', min: 1, zone: 5 } },
    ]
    expect(dominantZone(quase)).toBe(2)
  })

  it('devolve null sem estrutura', () => {
    expect(dominantZone([])).toBeNull()
  })
})

describe('distância estimada', () => {
  const th = { thresholdPaceSecKm: 300 }   // 5:00/km de limiar

  it('estima mais distância na zona mais rápida, no mesmo tempo', () => {
    const emZ2 = estimateKm(10, 2, 'running', th)!
    const emZ4 = estimateKm(10, 4, 'running', th)!
    expect(emZ4).toBeGreaterThan(emZ2)
  })

  it('em Z4 (perto do limiar) 10 min dão cerca de 2 km', () => {
    expect(estimateKm(10, 4, 'running', th)!).toBeCloseTo(2.03, 1)
  })

  it('não estima sem ritmo de limiar cadastrado', () => {
    expect(estimateKm(10, 2, 'running', {})).toBeNull()
  })

  it('não estima para outras modalidades', () => {
    expect(estimateKm(10, 2, 'cycling', th)).toBeNull()
  })

  it('soma o treino inteiro', () => {
    const total = estimateTotalKm([{ min: 10, zone: 2 }, { min: 10, zone: 4 }], 'running', th)!
    expect(total).toBeCloseTo(estimateKm(10, 2, 'running', th)! + estimateKm(10, 4, 'running', th)!, 5)
  })
})

describe('distância em texto', () => {
  it('usa metros abaixo de 1 km e vírgula como separador', () => {
    expect(fmtKm(0.6)).toBe('600 m')
    expect(fmtKm(8.42)).toBe('8,4 km')
    expect(fmtKm(1)).toBe('1,0 km')
  })
})

describe('faixas de alvo', () => {
  it('mostra ritmo mais lento nas zonas leves', () => {
    expect(paceRange(2, 'running', { thresholdPaceSecKm: 300 })).toBe('5:45–5:18 /km')
    expect(paceRange(4, 'running', { thresholdPaceSecKm: 300 })).toBe('5:00–4:51 /km')
  })

  it('não inventa ritmo fora da corrida nem sem limiar', () => {
    expect(paceRange(2, 'cycling', { thresholdPaceSecKm: 300 })).toBeNull()
    expect(paceRange(2, 'running', {})).toBeNull()
  })

  it('mostra a faixa de batimentos a partir da FC de limiar', () => {
    expect(hrRange(4, { lthr: 170 })).toBe('162–170 bpm')
    expect(hrRange(4, {})).toBeNull()
  })
})
