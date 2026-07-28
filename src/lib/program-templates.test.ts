import { describe, it, expect } from 'vitest'
import { couchTo5k8Weeks, expandProgram, recommendProgram } from './program-templates'

describe('couchTo5k8Weeks', () => {
  it('tem 8 semanas com 3 corridas + 2 forças cada', () => {
    const p = couchTo5k8Weeks()
    expect(p.weeks).toHaveLength(8)
    const w0 = p.weeks[0].workouts
    expect(w0.filter(x => x.sport === 'running')).toHaveLength(3)
    expect(w0.filter(x => x.sport === 'strength')).toHaveLength(2)
  })
})

describe('expandProgram (dias flutuantes)', () => {
  it('coloca corrida nos dias preferidos e força nos dias que sobram', () => {
    const p = couchTo5k8Weeks()
    const monday = new Date('2026-08-03T12:00:00') // uma segunda-feira
    const rows = expandProgram(p.weeks, monday, [0, 2, 6]) // seg, qua, dom

    // Semana 1 = primeiros 5 treinos (datas 03..09/08)
    const wk1 = rows.filter(r => r.date >= '2026-08-03' && r.date <= '2026-08-09')
    const byDate = Object.fromEntries(wk1.map(r => [r.date, r.sport]))
    expect(byDate['2026-08-03']).toBe('running') // segunda (preferido)
    expect(byDate['2026-08-05']).toBe('running') // quarta (preferido)
    expect(byDate['2026-08-09']).toBe('running') // domingo (preferido)
    // força cai em 2 dias livres (ter/qui = 04 e 06)
    expect(byDate['2026-08-04']).toBe('strength')
    expect(byDate['2026-08-06']).toBe('strength')
    expect(wk1).toHaveLength(5)
  })

  it('outro atleta, outros dias (ter/qui/sáb) → corrida segue os preferidos', () => {
    const p = couchTo5k8Weeks()
    const monday = new Date('2026-08-03T12:00:00')
    const rows = expandProgram(p.weeks, monday, [1, 3, 5]) // ter, qui, sáb
    const wk1 = Object.fromEntries(rows.filter(r => r.date <= '2026-08-09').map(r => [r.date, r.sport]))
    expect(wk1['2026-08-04']).toBe('running') // terça
    expect(wk1['2026-08-06']).toBe('running') // quinta
    expect(wk1['2026-08-08']).toBe('running') // sábado
  })
})

describe('recommendProgram', () => {
  it('escolhe o programa que casa objetivo + nível + corre/não', () => {
    const programs = [
      { id: 'a', active: true, routing: { currently_running: false, levels: ['iniciante'], goals: ['concluir_5_10k'] } },
      { id: 'b', active: true, routing: { currently_running: true, levels: ['avancado'], goals: ['maratona_42k'] } },
    ]
    const rec = recommendProgram({ currently_running: false, activity_level: 'iniciante', goal: 'concluir_5_10k' }, programs)
    expect(rec?.id).toBe('a')
  })
  it('sem casar objetivo, não recomenda', () => {
    const programs = [{ id: 'a', active: true, routing: { goals: ['maratona_42k'] } }]
    expect(recommendProgram({ goal: 'concluir_5_10k' }, programs)).toBeNull()
  })
})
