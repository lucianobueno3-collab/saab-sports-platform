import { describe, it, expect } from 'vitest'
import {
  parseNumero, volumeSerie, volumeTotal, fmtVolume,
  recordeAnterior, ehRecorde, ultimasSeries, fmtSegundos, ajustarCarga,
} from './strength-metrics'
import type { StrengthLogRow } from '@/lib/supabase/queries'

const log = (id: string, at: string, ex: string, sets: { reps: string; load: string; done: boolean }[]): StrengthLogRow => ({
  id, day_label: 'A', performed_at: at, rpe: 7, completed: [{ name: ex, done: true, sets }], notes: null,
} as unknown as StrengthLogRow)

describe('leitura dos campos de texto livre', () => {
  it('pega o primeiro número de prescrições escritas à mão', () => {
    expect(parseNumero('8-10')).toBe(8)
    expect(parseNumero('45s')).toBe(45)
    expect(parseNumero('12 / perna')).toBe(12)
    expect(parseNumero('42,5')).toBe(42.5)
  })

  it('devolve null em vez de inventar número', () => {
    expect(parseNumero('corporal')).toBeNull()
    expect(parseNumero('')).toBeNull()
    expect(parseNumero(null)).toBeNull()
    expect(parseNumero(undefined)).toBeNull()
  })
})

describe('volume levantado', () => {
  it('multiplica reps por carga', () => {
    expect(volumeSerie({ reps: '10', load: '40' })).toBe(400)
  })

  it('não conta série sem carga — peso corporal não vira zero enganoso', () => {
    expect(volumeSerie({ reps: '10', load: 'corporal' })).toBeNull()
    expect(volumeSerie({ reps: '10', load: '0' })).toBeNull()
  })

  it('soma só as séries concluídas', () => {
    const sets = [
      { reps: '10', load: '40', done: true },
      { reps: '10', load: '40', done: true },
      { reps: '10', load: '40', done: false },   // ainda não fez
    ]
    expect(volumeTotal(sets)).toBe(800)
  })

  it('ignora séries sem carga sem quebrar a soma', () => {
    const sets = [
      { reps: '10', load: '40', done: true },
      { reps: '10', load: 'corporal', done: true },
    ]
    expect(volumeTotal(sets)).toBe(400)
  })

  it('escreve toneladas acima de mil quilos', () => {
    expect(fmtVolume(840)).toBe('840 kg')
    expect(fmtVolume(2430)).toBe('2,4 t')
    expect(fmtVolume(0)).toBe('—')
  })
})

describe('recorde do exercício', () => {
  const historico = [
    log('2', '2026-07-20', 'Agachamento livre', [{ reps: '5', load: '80', done: true }]),
    log('1', '2026-07-10', 'Agachamento livre', [{ reps: '5', load: '75', done: true }, { reps: '5', load: '85', done: true }]),
  ]

  it('acha a maior carga em todo o histórico, não só no último treino', () => {
    expect(recordeAnterior(historico, 'Agachamento livre')).toBe(85)
  })

  it('ignora séries não concluídas', () => {
    const comFalha = [log('3', '2026-07-25', 'Supino', [{ reps: '5', load: '200', done: false }])]
    expect(recordeAnterior(comFalha, 'Supino')).toBeNull()
  })

  it('devolve null para exercício nunca feito', () => {
    expect(recordeAnterior(historico, 'Remada')).toBeNull()
  })

  it('só aponta recorde quando supera — empatar não conta', () => {
    expect(ehRecorde({ load: '90', done: true }, 85)).toBe(true)
    expect(ehRecorde({ load: '85', done: true }, 85)).toBe(false)
    expect(ehRecorde({ load: '80', done: true }, 85)).toBe(false)
  })

  it('não aponta recorde em série ainda não marcada', () => {
    expect(ehRecorde({ load: '90', done: false }, 85)).toBe(false)
  })

  it('sem histórico não anuncia recorde no primeiro treino', () => {
    expect(ehRecorde({ load: '90', done: true }, null)).toBe(false)
  })
})

describe('últimas séries por exercício', () => {
  it('usa o treino mais recente que tem o exercício', () => {
    const logs = [
      log('2', '2026-07-20', 'Supino', [{ reps: '8', load: '60', done: true }]),
      log('1', '2026-07-10', 'Supino', [{ reps: '8', load: '55', done: true }]),
    ]
    expect(ultimasSeries(logs)['Supino'][0].load).toBe('60')
  })
})

describe('cronômetro e ajuste de carga', () => {
  it('mostra o descanso em minutos e segundos', () => {
    expect(fmtSegundos(90)).toBe('1:30')
    expect(fmtSegundos(5)).toBe('0:05')
    expect(fmtSegundos(-3)).toBe('0:00')
  })

  it('soma e subtrai a carga sem passar de zero', () => {
    expect(ajustarCarga('40', 2.5)).toBe('42.5')
    expect(ajustarCarga('42.5', -2.5)).toBe('40')
    expect(ajustarCarga('', 2.5)).toBe('2.5')
    expect(ajustarCarga('1', -2.5)).toBe('0')
  })
})
