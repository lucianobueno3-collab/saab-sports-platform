import { describe, it, expect } from 'vitest'
import { extractExamsFromText, extractBodyCompFromText, extractDateFromText, parseBrNumber } from './pdf-parser'

describe('parseBrNumber', () => {
  it('converte formatos brasileiros e internacionais', () => {
    expect(parseBrNumber('12,3')).toBe(12.3)
    expect(parseBrNumber('1.234,5')).toBe(1234.5)
    expect(parseBrNumber('12.3')).toBe(12.3)
    expect(parseBrNumber('45')).toBe(45)
  })
})

describe('extractExamsFromText', () => {
  it('detecta exames de um laudo típico', () => {
    const text = `
      LABORATÓRIO EXEMPLO — Coleta: 10/07/2026
      FERRITINA: 45,2 ng/mL Valores de referência: 20 a 300
      HEMOGLOBINA: 13,8 g/dL Referência: 12,0 a 16,0
      VITAMINA D (25-HIDROXI): 28 ng/mL VR: 30 a 100
      TSH: 2,1 µUI/mL (0,4 - 4,5)
    `
    const exams = extractExamsFromText(text)
    const byName = Object.fromEntries(exams.map(e => [e.exam_name, e]))

    expect(byName['Ferritina'].value).toBe(45.2)
    expect(byName['Ferritina'].unit).toBe('ng/mL')
    expect(byName['Ferritina'].reference_min).toBe(20)
    expect(byName['Ferritina'].reference_max).toBe(300)

    expect(byName['Hemoglobina'].value).toBe(13.8)
    expect(byName['Vitamina D'].value).toBe(28)
    expect(byName['TSH'].value).toBe(2.1)
  })

  it('retorna vazio para texto sem exames', () => {
    expect(extractExamsFromText('Relatório de treino da semana, tudo certo.')).toEqual([])
  })

  it('não confunde Hemoglobina com Hemoglobina Glicada', () => {
    const text = 'HEMOGLOBINA GLICADA (HbA1c): 5,4 %'
    const exams = extractExamsFromText(text)
    const names = exams.map(e => e.exam_name)
    expect(names).toContain('Hemoglobina Glicada')
    expect(names).not.toContain('Hemoglobina')
  })
})

describe('extractBodyCompFromText', () => {
  it('detecta dados de bioimpedância', () => {
    const text = `
      AVALIAÇÃO FÍSICA — 05/07/2026
      Peso: 62,4 kg
      % Gordura: 21,8 %
      Massa muscular: 26,1 kg
      Massa óssea: 2,4 kg
      Gordura visceral: nível 4
    `
    const comp = extractBodyCompFromText(text)
    expect(comp.weight_kg).toBe(62.4)
    expect(comp.body_fat_pct).toBe(21.8)
    expect(comp.muscle_mass_kg).toBe(26.1)
    expect(comp.bone_mass_kg).toBe(2.4)
    expect(comp.visceral_fat).toBe(4)
  })

  it('retorna nulls quando não há dados', () => {
    const comp = extractBodyCompFromText('Plano alimentar da semana')
    expect(comp.weight_kg).toBeNull()
    expect(comp.body_fat_pct).toBeNull()
  })

  it('extrai laudo Comparativo Antropométrico (pega a última coluna = mais recente)', () => {
    // trecho real (FlexNutri / Dr. César Torres): rótulos separados dos números,
    // 4 datas em colunas — o valor atual é o da última.
    const text = `
      Relatório Comparativo Antropométrico
      Data Altura Peso IMC
      29/01/2026 05/03/2026 13/05/2026 03/07/2026
      1,91 m 1,91 m 1,91 m 1,91 m
      119,40 kg 114,50 kg (-4,90) 109,40 kg (-5,10) 108,10 kg (-1,30)
      32,73 31,39 29,99 (-1,40) 29,63 (-0,36)
      Massa Gorda % Massa Gorda Massa Magra % Massa Magra
      39,49 kg 26,78 kg (-7,39) 24,45 kg (-2,33)
      33,07% 24,48% (-5,36) 22,61% (-1,87)
      79,91 kg 82,62 kg (+2,29) 83,65 kg (+1,03)
      66,93% 75,52% (+5,36) 77,39% (+1,87)
    `
    const comp = extractBodyCompFromText(text)
    expect(comp.weight_kg).toBe(108.1)
    expect(comp.muscle_mass_kg).toBe(83.65)
    expect(comp.body_fat_pct).toBe(22.61)
    expect(extractDateFromText(text)).toBe('2026-07-03')
  })

  it('extrai laudo InBody (peso, %gordura calculado, massa muscular)', () => {
    // trecho real de um laudo InBody120 (sem rótulos junto dos números)
    const text = '[InBody120] 65,7 ( ) 45,1~55,2 (kg) 17,8 ( ) 12,1~14,8 (kg) 6,73 ( ) 4,18~5,10 (kg) 19,1 ( ) 9,6~19,3 (kg) 109,4 ( ) 68,2~92,3 (kg) 51,8 34,7~42,4 kg 90,3 61,4~75,0 kcal Ver.LookinBody120'
    const comp = extractBodyCompFromText(text)
    expect(comp.weight_kg).toBe(109.4)
    expect(comp.muscle_mass_kg).toBe(51.8)
    expect(comp.body_fat_pct).toBe(17.5)
  })
})

describe('extractDateFromText', () => {
  it('extrai a primeira data dd/mm/aaaa', () => {
    expect(extractDateFromText('Coleta: 10/07/2026 às 08:15')).toBe('2026-07-10')
  })

  it('ignora datas inválidas', () => {
    expect(extractDateFromText('código 99/99/2026')).toBeNull()
    expect(extractDateFromText('sem data aqui')).toBeNull()
  })
})
