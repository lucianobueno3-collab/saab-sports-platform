import { describe, it, expect } from 'vitest'
import {
  FASE_1_FORCA, repsPorSerie, seriesDe, repsTotais, ehPorTempo, estimarForca, resumoDeForca,
} from './fase-1-forca'
import type { LibExercise } from './supabase/queries'

const ex = (over: Partial<LibExercise> = {}): LibExercise =>
  ({ name: 'Exercício', sets: '4', reps: '12/12/10/8', load: '', rest_s: 45, ...over })

describe('repetições de cada série', () => {
  it('abre a pirâmide do treinador', () => {
    expect(repsPorSerie('12/12/10/8', 4)).toEqual([12, 12, 10, 8])
  })

  it('um número só vale para todas as séries', () => {
    expect(repsPorSerie('15', 4)).toEqual([15, 15, 15, 15])
  })

  it('aceita vírgula, que é como vem da planilha', () => {
    expect(repsPorSerie('12, 12, 10, 8', 4)).toEqual([12, 12, 10, 8])
  })

  it('ignora espaços em volta', () => {
    expect(repsPorSerie(' 12 / 10 ', 2)).toEqual([12, 10])
  })

  it('sobra de séries repete a última', () => {
    expect(repsPorSerie('12/10', 4)).toEqual([12, 10, 10, 10])
  })

  it('mais valores que séries corta no número de séries', () => {
    expect(repsPorSerie('12/12/10/8', 2)).toEqual([12, 12])
  })

  it('texto sem número não inventa série', () => {
    expect(repsPorSerie('até a falha', 3)).toEqual([])
  })
})

describe('séries medidas em tempo', () => {
  it('reconhece a prancha', () => {
    expect(ehPorTempo('45s')).toBe(true)
    expect(ehPorTempo('30 s')).toBe(true)
  })

  it('repetição comum não é tempo', () => {
    expect(ehPorTempo('12')).toBe(false)
    expect(ehPorTempo('12/12/10/8')).toBe(false)
  })

  it('conta os segundos como tempo, não como repetição', () => {
    // 3×45s = 135s de trabalho + 3×45s de intervalo = 270s ≈ 5min.
    // Como repetição daria 3×45×3s = 405s só de trabalho: o triplo.
    const um = estimarForca([ex({ sets: '3', reps: '45s', rest_s: 45 })])
    expect(um.min).toBe(5)
  })
})

describe('contas de uma sessão', () => {
  it('soma as repetições de todas as séries', () => {
    expect(repsTotais(ex())).toBe(42) // 12+12+10+8
  })

  it('série única conta uma vez só', () => {
    expect(repsTotais(ex({ sets: '1', reps: '12' }))).toBe(12)
  })

  it('campo de séries vazio não zera o exercício', () => {
    expect(seriesDe(ex({ sets: '' }))).toBe(1)
  })

  it('estimativa cresce com o número de exercícios', () => {
    const um = estimarForca([ex()])
    const dois = estimarForca([ex(), ex()])
    expect(dois.min).toBeGreaterThan(um.min)
  })

  it('sessão vazia não tem duração', () => {
    expect(estimarForca([])).toEqual({ min: 0, tss: 0 })
  })

  it('o resumo cabe numa linha e cita os exercícios', () => {
    const r = resumoDeForca([ex({ name: 'Puxada frente' }), ex({ name: 'Rosca scott' })])
    expect(r).toContain('Puxada frente 4×12-12-10-8')
    expect(r).toContain('Rosca scott')
  })
})

describe('o programa do treinador', () => {
  it('tem as três sessões do rodízio', () => {
    expect(FASE_1_FORCA.map(s => s.letra)).toEqual(['A', 'B', 'C'])
  })

  it('cada sessão tem os 8 exercícios da planilha', () => {
    for (const s of FASE_1_FORCA) expect(s.exercicios, s.titulo).toHaveLength(8)
  })

  it('todo exercício tem nome, séries, repetições e intervalo', () => {
    for (const s of FASE_1_FORCA) for (const e of s.exercicios) {
      expect(e.name.trim(), s.titulo).not.toBe('')
      expect(seriesDe(e), e.name).toBeGreaterThan(0)
      expect(repsPorSerie(e.reps, seriesDe(e)).length, e.name).toBeGreaterThan(0)
      expect(e.rest_s, e.name).toBe(45)
    }
  })

  it('a pirâmide 12/12/10/8 é a regra da fase', () => {
    const piramides = FASE_1_FORCA.flatMap(s => s.exercicios).filter(e => e.reps === '12/12/10/8')
    expect(piramides.length).toBeGreaterThan(15)
  })

  it('abdômen e panturrilha ficam em 4×15', () => {
    const quinze = FASE_1_FORCA.flatMap(s => s.exercicios).filter(e => e.reps.startsWith('15'))
    expect(quinze.map(e => e.name)).toEqual([
      'Panturrilha máquina (em pé)', 'Abdominal máquina',
      'Abdominal curto', 'Panturrilha máquina (sentado)', 'Abdominal infra',
    ])
  })

  it('a elevação frontal é a única série única', () => {
    const unicas = FASE_1_FORCA.flatMap(s => s.exercicios).filter(e => seriesDe(e) === 1)
    expect(unicas).toHaveLength(1)
    expect(unicas[0].name).toContain('Elevação frontal')
  })

  it('cada sessão dura entre 35 e 60 minutos', () => {
    // Fora dessa faixa a estimativa estaria errada: 8 exercícios × 4 séries com
    // 45s de intervalo não cabem em meia hora nem passam de uma hora. O B fica
    // uns 5 min mais curto porque a elevação frontal é série única.
    for (const s of FASE_1_FORCA) {
      const { min, tss } = estimarForca(s.exercicios)
      expect(min, s.titulo).toBeGreaterThanOrEqual(35)
      expect(min, s.titulo).toBeLessThanOrEqual(60)
      expect(tss, s.titulo).toBeGreaterThan(0)
    }
  })

  it('nenhum exercício se repete dentro da mesma sessão', () => {
    for (const s of FASE_1_FORCA) {
      expect(new Set(s.exercicios.map(e => e.name)).size, s.titulo).toBe(s.exercicios.length)
    }
  })
})
