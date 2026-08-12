import { describe, it, expect } from 'vitest'
import { cargaDe, textoDeCarga, cargaDaSemana } from './carga'

describe('carga de um treino', () => {
  it('separa as quatro faixas', () => {
    expect(cargaDe(20)!.chave).toBe('leve')
    expect(cargaDe(45)!.chave).toBe('moderada')
    expect(cargaDe(75)!.chave).toBe('forte')
    expect(cargaDe(120)!.chave).toBe('muito-forte')
  })

  it('os cortes caem no lugar certo', () => {
    expect(cargaDe(29)!.chave).toBe('leve')
    expect(cargaDe(30)!.chave).toBe('moderada')
    expect(cargaDe(59)!.chave).toBe('moderada')
    expect(cargaDe(60)!.chave).toBe('forte')
    expect(cargaDe(89)!.chave).toBe('forte')
    expect(cargaDe(90)!.chave).toBe('muito-forte')
  })

  it('os treinos do plano de 5 km caem em leve, moderada e forte', () => {
    // O plano do treinador vai de 33 a 67 TSS. Se tudo virasse "leve", o rótulo
    // não estaria dizendo nada ao aluno.
    const chaves = [33, 42, 48, 52, 60, 67].map(t => cargaDe(t)!.chave)
    expect(new Set(chaves).size).toBeGreaterThan(1)
    expect(chaves).toContain('moderada')
    expect(chaves).toContain('forte')
  })

  it('sem número não inventa faixa', () => {
    expect(cargaDe(null)).toBeNull()
    expect(cargaDe(undefined)).toBeNull()
    expect(cargaDe(0)).toBeNull()
    expect(cargaDe(-5)).toBeNull()
    expect(cargaDe(NaN)).toBeNull()
  })

  it('toda faixa tem rótulo, cor e uma linha de explicação', () => {
    for (const tss of [10, 45, 75, 150]) {
      const n = cargaDe(tss)!
      expect(n.rotulo.length, String(tss)).toBeGreaterThan(0)
      expect(n.cor, String(tss)).toMatch(/^#[0-9a-f]{6}$/i)
      expect(n.descricao.length, String(tss)).toBeGreaterThan(10)
    }
  })

  it('a carga sempre cresce junto com o TSS', () => {
    const ordem = ['leve', 'moderada', 'forte', 'muito-forte']
    let anterior = -1
    for (const tss of [5, 29, 30, 59, 60, 89, 90, 200]) {
      const i = ordem.indexOf(cargaDe(tss)!.chave)
      expect(i, `${tss} TSS`).toBeGreaterThanOrEqual(anterior)
      anterior = i
    }
  })
})

describe('o texto que substitui o número', () => {
  it('sai em minúscula, para caber na frase', () => {
    expect(textoDeCarga(45)).toBe('Carga moderada')
    expect(textoDeCarga(120)).toBe('Carga muito forte')
  })

  it('sem TSS não há texto', () => {
    expect(textoDeCarga(null)).toBeNull()
  })
})

describe('carga da semana', () => {
  it('usa outra escala — a semana soma vários treinos', () => {
    // 200 TSS num treino é dia muito duro; numa semana é rotina.
    expect(cargaDe(200)!.chave).toBe('muito-forte')
    expect(cargaDaSemana(200)!.chave).toBe('moderada')
  })

  it('separa as quatro faixas semanais', () => {
    expect(cargaDaSemana(100)!.chave).toBe('leve')
    expect(cargaDaSemana(250)!.chave).toBe('moderada')
    expect(cargaDaSemana(400)!.chave).toBe('forte')
    expect(cargaDaSemana(600)!.chave).toBe('muito-forte')
  })

  it('semana vazia não tem carga', () => {
    expect(cargaDaSemana(0)).toBeNull()
  })
})
