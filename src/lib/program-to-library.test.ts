import { describe, it, expect } from 'vitest'
import { programWorkoutsToLibrary, apenasNovos } from './program-to-library'
import { progressao5kIniciantes } from './program-templates'
import type { ProgramWeek } from './program-templates'

describe('levar os treinos do plano para a biblioteca', () => {
  it('não repete o mesmo treino que aparece em várias semanas', () => {
    const semanas: ProgramWeek[] = [
      { label: 'S1', workouts: [{ day: 0, sport: 'running', title: 'Rodagem leve', duration_min: 40 }] },
      { label: 'S2', workouts: [{ day: 0, sport: 'running', title: 'Rodagem leve', duration_min: 40 }] },
    ]
    expect(programWorkoutsToLibrary(semanas)).toHaveLength(1)
  })

  it('quando o mesmo nome tem passos diferentes, guarda os dois com a semana', () => {
    // É o caso do "Corrida/caminhada" que cresce a cada semana: guardar só o
    // primeiro jogaria fora a progressão inteira.
    const semanas: ProgramWeek[] = [
      { label: 'S1', workouts: [{ day: 0, sport: 'running', title: 'Corrida/caminhada', structure: [{ type: 'step', step: { kind: 'work', min: 10, zone: 2 } }] }] },
      { label: 'S2', workouts: [{ day: 0, sport: 'running', title: 'Corrida/caminhada', structure: [{ type: 'step', step: { kind: 'work', min: 20, zone: 2 } }] }] },
    ]
    const saida = programWorkoutsToLibrary(semanas)
    expect(saida.map(x => x.title)).toEqual(['Corrida/caminhada (Semana 1)', 'Corrida/caminhada (Semana 2)'])
  })

  it('não põe número na semana quando o nome é único', () => {
    const saida = programWorkoutsToLibrary(progressao5kIniciantes().weeks)
    expect(saida.every(x => !x.title.includes('(Semana'))).toBe(true)
  })

  it('leva as corridas do plano do treinador, mais as 2 forças', () => {
    // 23 e não 24: "6x 3min forte / 2min leve" é o MESMO treino nas semanas 3
    // e 8 do plano, então vira uma entrada só na biblioteca.
    const saida = programWorkoutsToLibrary(progressao5kIniciantes().weeks)
    expect(saida.filter(x => x.sport === 'running')).toHaveLength(23)
    expect(saida.filter(x => x.sport === 'strength')).toHaveLength(2)
  })

  it('cada corrida chega com estrutura, duração e carga', () => {
    for (const w of programWorkoutsToLibrary(progressao5kIniciantes().weeks).filter(x => x.sport === 'running')) {
      expect(w.structure, w.title).toBeTruthy()
      expect(w.duration_min, w.title).toBeGreaterThan(0)
      expect(w.tss, w.title).toBeGreaterThan(0)
    }
  })

  it('sempre devolve títulos únicos, senão a biblioteca fica ambígua', () => {
    const saida = programWorkoutsToLibrary(progressao5kIniciantes().weeks)
    expect(new Set(saida.map(x => x.title)).size).toBe(saida.length)
  })

  it('distingue por semana um plano cujo treino cresce mantendo o nome', () => {
    const semanas: ProgramWeek[] = [1, 2, 3].map(n => ({
      label: `S${n}`,
      workouts: [{ day: 0, sport: 'running', title: 'Longo', structure: [{ type: 'step', step: { kind: 'steady', min: n * 10, zone: 2 } }] }],
    }))
    const saida = programWorkoutsToLibrary(semanas)
    expect(saida.map(x => x.title)).toEqual(['Longo (Semana 1)', 'Longo (Semana 2)', 'Longo (Semana 3)'])
    expect(new Set(saida.map(x => x.title)).size).toBe(3)
  })
})

describe('não regravar o que já está na biblioteca', () => {
  const candidatos = programWorkoutsToLibrary(progressao5kIniciantes().weeks)

  it('filtra os que já existem, comparando esporte e título', () => {
    const jaTem = [{ sport: 'running', title: candidatos[0].title }]
    expect(apenasNovos(candidatos, jaTem)).toHaveLength(candidatos.length - 1)
  })

  it('ignora caixa e espaços na comparação', () => {
    const jaTem = [{ sport: 'running', title: `  ${candidatos[0].title.toUpperCase()} ` }]
    expect(apenasNovos(candidatos, jaTem)).toHaveLength(candidatos.length - 1)
  })

  it('mesmo título em esporte diferente não conta como repetido', () => {
    const jaTem = [{ sport: 'cycling', title: candidatos[0].title }]
    expect(apenasNovos(candidatos, jaTem)).toHaveLength(candidatos.length)
  })

  it('biblioteca vazia deixa tudo passar', () => {
    expect(apenasNovos(candidatos, [])).toHaveLength(candidatos.length)
  })

  it('rodar duas vezes não duplica nada', () => {
    const primeira = apenasNovos(candidatos, [])
    const segunda = apenasNovos(candidatos, primeira.map(x => ({ sport: x.sport, title: x.title })))
    expect(segunda).toHaveLength(0)
  })
})
