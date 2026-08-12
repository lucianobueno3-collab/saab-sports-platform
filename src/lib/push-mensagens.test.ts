import { describe, it, expect } from 'vitest'
import {
  resumir, avisoDeRecado, avisoDoTreinoDoDia, avisoDePlanoNovo, valeNotificar,
} from './push-mensagens'

describe('resumir texto longo', () => {
  it('texto curto passa inteiro', () => {
    expect(resumir('Tudo certo?')).toBe('Tudo certo?')
  })

  it('corta no espaço, não no meio da palavra', () => {
    const r = resumir('a'.repeat(10) + ' ' + 'b'.repeat(200), 30)
    expect(r.endsWith('…')).toBe(true)
    expect(r).not.toMatch(/b{25,}…$/)
  })

  it('palavra única gigante ainda é cortada', () => {
    const r = resumir('x'.repeat(300), 50)
    expect(r.length).toBeLessThanOrEqual(51)
    expect(r.endsWith('…')).toBe(true)
  })

  it('junta quebras de linha numa linha só', () => {
    // A notificação mostra uma ou duas linhas: quebra do texto original vira
    // espaço em branco desperdiçado.
    expect(resumir('linha um\n\n   linha dois')).toBe('linha um linha dois')
  })
})

describe('aviso de recado', () => {
  const base = { treino: '10× 1min forte', corpo: 'Pode ir mais devagar hoje.', workoutId: 'w1' }

  it('usa o nome do treinador quando existe', () => {
    expect(avisoDeRecado({ ...base, nomeDoTreinador: 'Luciano' }).titulo).toBe('Luciano respondeu')
  })

  it('sem nome, cai num título genérico mas ainda pessoal', () => {
    expect(avisoDeRecado(base).titulo).toBe('Seu treinador respondeu')
  })

  it('nome só com espaços conta como ausente', () => {
    expect(avisoDeRecado({ ...base, nomeDoTreinador: '   ' }).titulo).toBe('Seu treinador respondeu')
  })

  it('o corpo diz de qual treino é', () => {
    expect(avisoDeRecado(base).corpo).toBe('10× 1min forte: Pode ir mais devagar hoje.')
  })

  it('recado longo é resumido', () => {
    const a = avisoDeRecado({ ...base, corpo: 'palavra '.repeat(60) })
    expect(a.corpo.endsWith('…')).toBe(true)
    expect(a.corpo.length).toBeLessThan(140)
  })

  it('a tag agrupa por treino — três respostas viram um aviso', () => {
    const a = avisoDeRecado(base)
    const b = avisoDeRecado({ ...base, corpo: 'outra coisa' })
    expect(a.tag).toBe(b.tag)
  })

  it('treinos diferentes não se sobrescrevem', () => {
    expect(avisoDeRecado(base).tag).not.toBe(avisoDeRecado({ ...base, workoutId: 'w2' }).tag)
  })

  it('leva para a caixa de recados', () => {
    expect(avisoDeRecado(base).url).toContain('recados')
  })
})

describe('aviso do treino do dia', () => {
  it('mostra o treino e a duração', () => {
    const a = avisoDoTreinoDoDia({ titulo: 'Longo de domingo', duracaoMin: 60, data: '2026-08-09' })
    expect(a.corpo).toBe('Longo de domingo · 60 min')
  })

  it('sem duração, não sobra separador solto', () => {
    const a = avisoDoTreinoDoDia({ titulo: 'Força A', duracaoMin: null, data: '2026-08-09' })
    expect(a.corpo).toBe('Força A')
  })

  it('a tag é do dia — reenviar não empilha', () => {
    const a = avisoDoTreinoDoDia({ titulo: 'A', data: '2026-08-09' })
    const b = avisoDoTreinoDoDia({ titulo: 'A', data: '2026-08-09' })
    expect(a.tag).toBe(b.tag)
    expect(a.tag).not.toBe(avisoDoTreinoDoDia({ titulo: 'A', data: '2026-08-10' }).tag)
  })
})

describe('aviso de plano novo', () => {
  it('singular e plural', () => {
    expect(avisoDePlanoNovo({ quantos: 1 }).corpo).toContain('1 treino novo.')
    expect(avisoDePlanoNovo({ quantos: 24 }).corpo).toContain('24 treinos novos.')
  })

  it('leva para o calendário', () => {
    expect(avisoDePlanoNovo({ quantos: 3 }).url).toContain('calendario')
  })
})

describe('o que não vale notificar', () => {
  it('aviso sem corpo não sai', () => {
    expect(valeNotificar({ titulo: 'Oi', corpo: '   ', url: '/', tag: 'x' })).toBe(false)
  })

  it('aviso sem título não sai', () => {
    expect(valeNotificar({ titulo: '', corpo: 'algo', url: '/', tag: 'x' })).toBe(false)
  })

  it('nulo não sai', () => {
    expect(valeNotificar(null)).toBe(false)
    expect(valeNotificar(undefined)).toBe(false)
  })

  it('aviso completo passa', () => {
    expect(valeNotificar(avisoDePlanoNovo({ quantos: 2 }))).toBe(true)
  })
})
