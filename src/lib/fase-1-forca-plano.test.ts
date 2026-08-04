import { describe, it, expect } from 'vitest'
import { fase1Forca, expandProgram, progressao5kIniciantes } from './program-templates'
import { programWorkoutsToLibrary } from './program-to-library'
import { opcaoDePlanoSalvo } from './plan-options'
import type { TrainingProgramRow } from './supabase/queries'

const plano = fase1Forca()

describe('FASE 1 FORÇA como plano de treinamento', () => {
  it('tem 4 semanas de 3 sessões', () => {
    expect(plano.weeks).toHaveLength(4)
    for (const w of plano.weeks) expect(w.workouts).toHaveLength(3)
  })

  it('é um plano de força, não de corrida', () => {
    expect(plano.sport).toBe('strength')
    expect(plano.weeks.flatMap(w => w.workouts).every(x => x.sport === 'strength')).toBe(true)
  })

  it('cada sessão leva os exercícios junto — é o "estruturado" da força', () => {
    for (const w of plano.weeks) for (const x of w.workouts) {
      expect(x.exercises, x.title).toBeTruthy()
      expect(x.exercises!.length, x.title).toBe(8)
      expect(x.duration_min, x.title).toBeGreaterThan(0)
      expect(x.tss, x.title).toBeGreaterThan(0)
    }
  })

  it('as três sessões giram na semana, sem repetir a mesma', () => {
    const titulos = plano.weeks[0].workouts.map(x => x.title)
    expect(new Set(titulos).size).toBe(3)
  })
})

describe('aplicar no calendário do aluno', () => {
  const seg = new Date('2026-08-03T12:00:00') // uma segunda-feira

  it('respeita os dias escolhidos pelo aluno', () => {
    // Terça, quinta e sábado: sem isso a sala caía nos "dias que sobram" e
    // ignorava a escolha, porque a força era tratada como complemento.
    const linhas = expandProgram(plano.weeks, seg, [1, 3, 5])
    const primeiraSemana = linhas.filter(x => x.date < '2026-08-10')
    expect(primeiraSemana.map(x => x.date)).toEqual(['2026-08-04', '2026-08-06', '2026-08-08'])
  })

  it('mantém a ordem A → B → C nos dias escolhidos', () => {
    // Trocar a ordem juntaria dois dias de perna ou repetiria costas seguidas.
    const linhas = expandProgram(plano.weeks, seg, [1, 3, 5])
    const letras = linhas.slice(0, 3).map(x => x.title.match(/Força ([ABC])/)?.[1])
    expect(letras).toEqual(['A', 'B', 'C'])
  })

  it('sem dias escolhidos, usa os do próprio plano (seg/qua/sex)', () => {
    const linhas = expandProgram(plano.weeks, seg, [])
    expect(linhas.slice(0, 3).map(x => x.date)).toEqual(['2026-08-03', '2026-08-05', '2026-08-07'])
  })

  it('os exercícios chegam ao dia do aluno', () => {
    for (const l of expandProgram(plano.weeks, seg, [1, 3, 5])) {
      expect(l.exercises, l.title).toBeTruthy()
      expect(l.exercises!.length, l.title).toBe(8)
    }
  })

  it('menos dias que sessões não perde sessão — dobra no mesmo dia', () => {
    const linhas = expandProgram(plano.weeks, seg, [1, 3])
    expect(linhas.filter(x => x.date < '2026-08-10')).toHaveLength(3)
  })

  it('gera as 12 sessões das 4 semanas', () => {
    expect(expandProgram(plano.weeks, seg, [1, 3, 5])).toHaveLength(12)
  })
})

describe('o plano salvo vira opção aplicável', () => {
  const salvo: TrainingProgramRow = {
    id: 'p1', name: plano.name, description: plano.description, sport: plano.sport,
    goal: plano.goal, level: plano.level, weeks: plano.weeks, routing: plano.routing,
    package_key: null, active: true,
  }

  it('oferece 3 dias para escolher, e não zero', () => {
    // Antes a contagem ignorava a força: um plano só de sala aparecia com
    // "0 dias", e o modal não deixava escolher nada.
    const op = opcaoDePlanoSalvo(salvo)
    expect(op.corridasPorSemana).toBe(3)
    expect(op.diasPadrao).toEqual([0, 2, 4])
  })

  it('as linhas geradas levam os exercícios', () => {
    const op = opcaoDePlanoSalvo(salvo)
    const linhas = op.linhas('a1', new Date('2026-08-03T12:00:00'), [1, 3, 5])
    expect(linhas).toHaveLength(12)
    expect(linhas[0].exercises).toHaveLength(8)
    expect(linhas[0].sport).toBe('strength')
  })
})

describe('a FASE 1 FORÇA na biblioteca', () => {
  it('vira 3 treinos, um por sessão, sem repetir as 4 semanas', () => {
    const saida = programWorkoutsToLibrary(plano.weeks, plano.name)
    expect(saida).toHaveLength(3)
    expect(saida.every(x => x.group_name === 'FASE 1 FORÇA')).toBe(true)
  })

  it('cada treino chega com exercícios, duração e carga', () => {
    for (const w of programWorkoutsToLibrary(plano.weeks, plano.name)) {
      expect(w.exercises, w.title).toHaveLength(8)
      expect(w.duration_min, w.title).toBeGreaterThan(0)
      expect(w.tss, w.title).toBeGreaterThan(0)
    }
  })
})

describe('as forças da PROGRESSÃO 5K também ficam estruturadas', () => {
  const p5k = progressao5kIniciantes()

  it('as duas sessões de prevenção levam exercícios', () => {
    const forcas = p5k.weeks[0].workouts.filter(x => x.sport === 'strength')
    expect(forcas).toHaveLength(2)
    for (const f of forcas) expect(f.exercises!.length, f.title).toBeGreaterThan(0)
  })

  it('a corrida continua estruturada por passos, não por exercícios', () => {
    const corridas = p5k.weeks[0].workouts.filter(x => x.sport === 'running')
    for (const c of corridas) {
      expect(c.structure, c.title).toBeTruthy()
      expect(c.exercises ?? null, c.title).toBeNull()
    }
  })

  it('a força continua caindo nos dias livres, sem roubar dia de corrida', () => {
    const linhas = expandProgram(p5k.weeks, new Date('2026-08-03T12:00:00'), [1, 3, 5])
    const semana1 = linhas.filter(x => x.date < '2026-08-10')
    const diasDeCorrida = semana1.filter(x => x.sport === 'running').map(x => x.date)
    const diasDeForca = semana1.filter(x => x.sport === 'strength').map(x => x.date)
    expect(diasDeCorrida).toHaveLength(3)
    expect(diasDeForca).toHaveLength(2)
    expect(diasDeForca.some(d => diasDeCorrida.includes(d))).toBe(false)
  })
})
