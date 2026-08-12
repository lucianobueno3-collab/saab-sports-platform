import { describe, it, expect } from 'vitest'
import {
  motivosDeAtencao, painelDeHoje, situacaoDeHoje, faltasAte,
  estadoDoDia, totaisDaSemana, diasDeDiferenca,
} from './painel-treinador'
import type { AlunoNaSemana, DiaDoAluno } from './supabase/queries'

const SEMANA = ['2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07', '2026-08-08', '2026-08-09']
const HOJE = '2026-08-06' // quinta

/** Dias da semana; `plano` e `feito` são mapas por índice do dia. */
function dias(plano: Record<number, number> = {}, feito: Record<number, number> = {}): DiaDoAluno[] {
  return SEMANA.map((date, i) => ({ date, planejados: plano[i] ?? 0, feitos: feito[i] ?? 0 }))
}

const aluno = (over: Partial<AlunoNaSemana> = {}): AlunoNaSemana => ({
  id: 'a1', nome: 'Ana', sport: 'running', tsb: 0, status: 'fit',
  dias: dias(), recadosNaoLidos: 0, dor: null, dorEm: null,
  ultimoPlanejado: '2026-09-30',
  ...over,
})

describe('situação do aluno hoje', () => {
  it('fez o treino de hoje', () => {
    expect(situacaoDeHoje(aluno({ dias: dias({ 3: 1 }, { 3: 1 }) }), HOJE)).toBe('fez')
  })

  it('tem treino e ainda não fez', () => {
    expect(situacaoDeHoje(aluno({ dias: dias({ 3: 1 }) }), HOJE)).toBe('pendente')
  })

  it('não tem treino hoje', () => {
    expect(situacaoDeHoje(aluno(), HOJE)).toBe('sem-treino')
  })

  it('treinou por conta, sem estar planejado, conta como feito', () => {
    // Veio do relógio: o aluno correu, só não estava no plano.
    expect(situacaoDeHoje(aluno({ dias: dias({}, { 3: 1 }) }), HOJE)).toBe('fez')
  })

  it('dois treinos no dia, um feito, ainda é pendente', () => {
    expect(situacaoDeHoje(aluno({ dias: dias({ 3: 2 }, { 3: 1 }) }), HOJE)).toBe('pendente')
  })
})

describe('faltas', () => {
  it('conta só os dias que já passaram', () => {
    // Planejado seg, qua e sáb; fez só a segunda. Sábado ainda não conta.
    const d = dias({ 0: 1, 2: 1, 5: 1 }, { 0: 1 })
    expect(faltasAte(d, HOJE)).toBe(1)
  })

  it('o dia de hoje não conta como falta', () => {
    expect(faltasAte(dias({ 3: 1 }), HOJE)).toBe(0)
  })

  it('semana em dia não tem falta', () => {
    expect(faltasAte(dias({ 0: 1, 2: 1 }, { 0: 1, 2: 1 }), HOJE)).toBe(0)
  })
})

describe('quem precisa de você', () => {
  it('aluno em dia não aparece', () => {
    expect(motivosDeAtencao(aluno({ dias: dias({ 0: 1 }, { 0: 1 }) }), HOJE)).toEqual([])
  })

  it('recado sem resposta é o mais urgente', () => {
    const m = motivosDeAtencao(aluno({ recadosNaoLidos: 1, dor: 8 }), HOJE)
    expect(m[0].chave).toBe('recado')
    expect(m[0].texto).toBe('Recado sem resposta')
  })

  it('pluraliza os recados', () => {
    const m = motivosDeAtencao(aluno({ recadosNaoLidos: 3 }), HOJE)
    expect(m[0].texto).toBe('3 recados sem resposta')
  })

  it('dor alta aparece; incômodo normal de treino não', () => {
    expect(motivosDeAtencao(aluno({ dor: 7 }), HOJE).some(m => m.chave === 'dor')).toBe(true)
    expect(motivosDeAtencao(aluno({ dor: 3 }), HOJE).some(m => m.chave === 'dor')).toBe(false)
  })

  it('duas faltas na semana já chamam atenção', () => {
    const m = motivosDeAtencao(aluno({ dias: dias({ 0: 1, 1: 1, 2: 1 }) }), HOJE)
    expect(m.find(x => x.chave === 'faltas')?.texto).toBe('3 treinos não feitos esta semana')
  })

  it('uma falta só não vira alerta', () => {
    expect(motivosDeAtencao(aluno({ dias: dias({ 0: 1 }) }), HOJE).some(m => m.chave === 'faltas')).toBe(false)
  })

  it('avisa quando o plano está acabando', () => {
    const m = motivosDeAtencao(aluno({ ultimoPlanejado: '2026-08-09' }), HOJE)
    expect(m.find(x => x.chave === 'plano-acabando')?.texto).toBe('Plano acaba em 3 dias')
  })

  it('avisa no último dia de plano', () => {
    const m = motivosDeAtencao(aluno({ ultimoPlanejado: HOJE }), HOJE)
    expect(m.find(x => x.chave === 'plano-acabando')?.texto).toBe('Último dia de plano')
  })

  it('plano que já terminou pesa mais que plano acabando', () => {
    const acabou = motivosDeAtencao(aluno({ ultimoPlanejado: '2026-08-01' }), HOJE)
    const acabando = motivosDeAtencao(aluno({ ultimoPlanejado: '2026-08-10' }), HOJE)
    expect(acabou[0].texto).toBe('Plano terminou')
    expect(acabou[0].peso).toBeGreaterThan(acabando[0].peso)
  })

  it('aluno sem plano nenhum aparece', () => {
    const m = motivosDeAtencao(aluno({ ultimoPlanejado: null }), HOJE)
    expect(m[0].texto).toBe('Sem plano')
  })

  it('plano com muito tempo pela frente não vira alerta', () => {
    expect(motivosDeAtencao(aluno({ ultimoPlanejado: '2026-12-01' }), HOJE)).toEqual([])
  })

  it('fadiga acumulada entra pelo TSB', () => {
    expect(motivosDeAtencao(aluno({ tsb: -30 }), HOJE).some(m => m.chave === 'fadiga')).toBe(true)
    expect(motivosDeAtencao(aluno({ tsb: -10 }), HOJE).some(m => m.chave === 'fadiga')).toBe(false)
  })

  it('os motivos saem do mais urgente para o menos', () => {
    const m = motivosDeAtencao(aluno({ recadosNaoLidos: 1, dor: 8, tsb: -30, ultimoPlanejado: '2026-08-08' }), HOJE)
    expect(m.map(x => x.chave)).toEqual(['recado', 'dor', 'fadiga', 'plano-acabando'])
  })
})

describe('as listas do dia', () => {
  const equipe = [
    aluno({ id: '1', nome: 'Ana', dias: dias({ 3: 1 }, { 3: 1 }) }),
    aluno({ id: '2', nome: 'Bruno', dias: dias({ 3: 1 }) }),
    aluno({ id: '3', nome: 'Carla' }),
    aluno({ id: '4', nome: 'Davi', dias: dias({ 3: 1 }), recadosNaoLidos: 2 }),
  ]

  it('separa fez, pendente e sem treino', () => {
    const p = painelDeHoje(equipe, HOJE)
    expect(p.fizeram.map(a => a.nome)).toEqual(['Ana'])
    expect(p.pendentes.map(a => a.nome)).toEqual(['Bruno', 'Davi'])
    expect(p.semTreino.map(a => a.nome)).toEqual(['Carla'])
  })

  it('só entra em "precisa de você" quem tem motivo', () => {
    const p = painelDeHoje(equipe, HOJE)
    expect(p.atencao.map(x => x.aluno.nome)).toEqual(['Davi'])
  })

  it('a lista de atenção vem ordenada pela urgência', () => {
    const p = painelDeHoje([
      aluno({ id: '1', nome: 'Plano curto', ultimoPlanejado: '2026-08-09' }),
      aluno({ id: '2', nome: 'Com recado', recadosNaoLidos: 1 }),
      aluno({ id: '3', nome: 'Com dor', dor: 9 }),
    ], HOJE)
    expect(p.atencao.map(x => x.aluno.nome)).toEqual(['Com recado', 'Com dor', 'Plano curto'])
  })

  it('equipe vazia devolve listas vazias', () => {
    const p = painelDeHoje([], HOJE)
    expect(p.fizeram).toEqual([])
    expect(p.atencao).toEqual([])
  })

  it('todo aluno cai em exatamente uma das três listas', () => {
    const p = painelDeHoje(equipe, HOJE)
    expect(p.fizeram.length + p.pendentes.length + p.semTreino.length).toBe(equipe.length)
  })
})

describe('o quadradinho de cada dia na grade', () => {
  const d = (date: string, planejados: number, feitos: number): DiaDoAluno => ({ date, planejados, feitos })

  it('feito, parcial e furado', () => {
    expect(estadoDoDia(d('2026-08-03', 1, 1), HOJE)).toBe('feito')
    expect(estadoDoDia(d('2026-08-03', 2, 1), HOJE)).toBe('parcial')
    expect(estadoDoDia(d('2026-08-03', 1, 0), HOJE)).toBe('furado')
  })

  it('dia futuro por fazer é pendente, não furado', () => {
    expect(estadoDoDia(d('2026-08-08', 1, 0), HOJE)).toBe('pendente')
  })

  it('o próprio dia de hoje ainda é pendente', () => {
    expect(estadoDoDia(d(HOJE, 1, 0), HOJE)).toBe('pendente')
  })

  it('dia sem treino fica vazio', () => {
    expect(estadoDoDia(d('2026-08-05', 0, 0), HOJE)).toBe('vazio')
  })

  it('treinou sem ter planejado conta como feito', () => {
    expect(estadoDoDia(d('2026-08-05', 0, 1), HOJE)).toBe('feito')
  })
})

describe('totais da semana', () => {
  it('soma planejados, feitos e furados da equipe', () => {
    const t = totaisDaSemana([
      aluno({ dias: dias({ 0: 1, 2: 1, 5: 1 }, { 0: 1 }) }),
      aluno({ dias: dias({ 0: 1, 2: 1 }, { 0: 1, 2: 1 }) }),
    ], HOJE)
    expect(t.planejados).toBe(5)
    expect(t.feitos).toBe(3)
    expect(t.furados).toBe(1)  // só a quarta do primeiro; o sábado ainda vem
  })

  it('equipe sem treino não quebra', () => {
    expect(totaisDaSemana([], HOJE)).toEqual({ planejados: 0, feitos: 0, furados: 0 })
  })
})

describe('diferença de dias', () => {
  it('conta para frente e para trás', () => {
    expect(diasDeDiferenca('2026-08-06', '2026-08-09')).toBe(3)
    expect(diasDeDiferenca('2026-08-06', '2026-08-01')).toBe(-5)
    expect(diasDeDiferenca('2026-08-06', '2026-08-06')).toBe(0)
  })

  it('atravessa a virada do mês', () => {
    expect(diasDeDiferenca('2026-08-30', '2026-09-02')).toBe(3)
  })
})
