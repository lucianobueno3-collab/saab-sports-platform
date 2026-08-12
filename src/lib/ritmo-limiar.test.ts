import { describe, it, expect } from 'vitest'
import { limiarDeEsforco, fmtRitmo, lerTempo, lerDistancia, resumoDoEsforco } from './ritmo-limiar'

const limiar = (km: number, segundos: number) => limiarDeEsforco({ km, segundos })

describe('ritmo de limiar a partir de um esforço', () => {
  it('5 km em 25 min dá ~5:15/km', () => {
    // O ritmo de 5 km é 5:00/km; o limiar fica ~15s/km mais lento, que é o que
    // a literatura de treinamento espera.
    const r = limiar(5, 25 * 60)!
    expect(fmtRitmo(r)).toBe('5:15')
  })

  it('10 km em 50 min dá ~5:07/km', () => {
    // Prova mais longa fica mais perto do limiar: a diferença encolhe.
    const r = limiar(10, 50 * 60)!
    expect(r).toBeGreaterThan(300)
    expect(r).toBeLessThan(315)
  })

  it('iniciante: 3 km em 21 min', () => {
    const r = limiar(3, 21 * 60)!
    expect(fmtRitmo(r)).toBe('7:26')
  })

  it('quanto mais rápido o esforço, mais rápido o limiar', () => {
    expect(limiar(5, 22 * 60)!).toBeLessThan(limiar(5, 28 * 60)!)
  })

  it('o limiar é sempre mais lento que o ritmo de uma prova curta', () => {
    for (const [km, min] of [[3, 15], [5, 25], [5, 30], [10, 55]] as [number, number][]) {
      const ritmoDaProva = (min * 60) / km
      expect(limiar(km, min * 60)!, `${km}km em ${min}min`).toBeGreaterThan(ritmoDaProva)
    }
  })

  it('prova longa: o limiar fica mais rápido que o ritmo da prova', () => {
    // Uma meia em 2h é mais lenta que o limiar — projetar para 1h acelera.
    const r = limiar(21.1, 120 * 60)!
    expect(r).toBeLessThan((120 * 60) / 21.1)
  })
})

describe('recusa o que não faz sentido', () => {
  it('distância curta demais', () => {
    expect(limiar(0.4, 120)).toBeNull()
  })

  it('distância maior que uma maratona', () => {
    expect(limiar(50, 4 * 3600)).toBeNull()
  })

  it('tempo zero ou negativo', () => {
    expect(limiar(5, 0)).toBeNull()
    expect(limiar(5, -60)).toBeNull()
  })

  it('ritmo mais rápido que o recorde mundial', () => {
    // 5 km em 8 min = 1:36/km. É erro de digitação, não atleta.
    expect(limiar(5, 8 * 60)).toBeNull()
  })

  it('ritmo de caminhada muito lenta', () => {
    expect(limiar(5, 90 * 60)).toBeNull()
  })

  it('valores não numéricos', () => {
    expect(limiar(NaN, 1500)).toBeNull()
    expect(limiar(5, NaN)).toBeNull()
  })
})

describe('ler o que o aluno digita', () => {
  it('mm:ss', () => {
    expect(lerTempo('25:30')).toBe(25 * 60 + 30)
  })

  it('h:mm:ss', () => {
    expect(lerTempo('1:05:00')).toBe(3900)
  })

  it('só o número vale como minutos', () => {
    expect(lerTempo('25')).toBe(1500)
  })

  it('aceita o sufixo min', () => {
    expect(lerTempo('25min')).toBe(1500)
    expect(lerTempo('25 min')).toBe(1500)
  })

  it('vazio e lixo devolvem nulo', () => {
    expect(lerTempo('')).toBeNull()
    expect(lerTempo('   ')).toBeNull()
    expect(lerTempo('rápido')).toBeNull()
    expect(lerTempo('0:00')).toBeNull()
  })

  it('distância com vírgula ou ponto', () => {
    expect(lerDistancia('5,2')).toBe(5.2)
    expect(lerDistancia('5.2')).toBe(5.2)
    expect(lerDistancia('5 km')).toBe(5)
  })

  it('distância inválida devolve nulo', () => {
    expect(lerDistancia('')).toBeNull()
    expect(lerDistancia('uns 5')).toBeNull()
    expect(lerDistancia('0')).toBeNull()
  })
})

describe('a frase de conferência', () => {
  it('mostra o ritmo que o aluno vai ver nos treinos', () => {
    expect(resumoDoEsforco(5, 1500)).toContain('5:15/km')
  })

  it('esforço implausível não gera frase', () => {
    expect(resumoDoEsforco(5, 60)).toBeNull()
  })
})

describe('formatar o ritmo', () => {
  it('põe zero à esquerda nos segundos', () => {
    expect(fmtRitmo(305)).toBe('5:05')
  })

  it('arredonda os segundos', () => {
    expect(fmtRitmo(305.6)).toBe('5:06')
  })
})
