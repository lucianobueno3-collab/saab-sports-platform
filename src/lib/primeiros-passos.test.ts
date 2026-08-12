import { describe, it, expect } from 'vitest'
import { passosDoTreinador, montagemCompleta, passosPendentes } from './primeiros-passos'

const passos = (alunos: number, comRitmo: number, comPlano: number) =>
  passosDoTreinador({ alunos, comRitmo, comPlano })

describe('primeiros passos do treinador', () => {
  it('conta vazia: nada feito', () => {
    const p = passos(0, 0, 0)
    expect(p.every(x => !x.feito)).toBe(true)
    expect(montagemCompleta(p)).toBe(false)
  })

  it('montagem completa quando todo aluno tem ritmo e plano', () => {
    expect(montagemCompleta(passos(3, 3, 3))).toBe(true)
  })

  it('aluno cadastrado marca só o primeiro passo', () => {
    const p = passos(1, 0, 0)
    expect(p.find(x => x.chave === 'aluno')!.feito).toBe(true)
    expect(p.find(x => x.chave === 'ritmo')!.feito).toBe(false)
    expect(p.find(x => x.chave === 'plano')!.feito).toBe(false)
  })

  it('o passo do ritmo diz quantos faltam', () => {
    // É o buraco mais comum: aluno com plano montado, mas sem ritmo, recebe
    // "88-98%" em vez de min/km.
    expect(passos(5, 2, 5).find(x => x.chave === 'ritmo')!.titulo)
      .toBe('Falta o ritmo de limiar de 3 alunos')
  })

  it('singular quando falta um só', () => {
    expect(passos(3, 2, 3).find(x => x.chave === 'ritmo')!.titulo)
      .toBe('Falta o ritmo de limiar de 1 aluno')
  })

  it('com um aluno só, o texto é o convite original', () => {
    expect(passos(1, 0, 0).find(x => x.chave === 'ritmo')!.titulo)
      .toBe('Defina o ritmo de limiar do aluno')
  })

  it('o passo do plano avisa quem ficou de fora', () => {
    expect(passos(4, 4, 1).find(x => x.chave === 'plano')!.titulo)
      .toBe('3 alunos sem treino programado')
  })

  it('nenhum aluno com plano ainda: texto de convite', () => {
    expect(passos(2, 2, 0).find(x => x.chave === 'plano')!.titulo)
      .toBe('Aplique um plano de treinamento')
  })

  it('todo passo explica o que se perde sem ele', () => {
    for (const p of passos(0, 0, 0)) {
      expect(p.porque.length, p.chave).toBeGreaterThan(10)
      expect(p.href, p.chave).toMatch(/^\//)
    }
  })

  it('pendentes some conforme a montagem avança', () => {
    expect(passosPendentes(passos(0, 0, 0))).toHaveLength(3)
    expect(passosPendentes(passos(2, 0, 0))).toHaveLength(2)
    expect(passosPendentes(passos(2, 2, 0))).toHaveLength(1)
    expect(passosPendentes(passos(2, 2, 2))).toHaveLength(0)
  })

  it('mais ritmos que alunos não gera número negativo', () => {
    // Pode acontecer com aluno desativado no meio do caminho.
    expect(passos(2, 5, 5).find(x => x.chave === 'ritmo')!.feito).toBe(true)
  })
})
