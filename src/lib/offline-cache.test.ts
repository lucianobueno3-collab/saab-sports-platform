import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { saveSnapshot, readSnapshot, clearSnapshots, snapshotAge, offlineKey } from './offline-cache'

// localStorage de mentira, para rodar fora do navegador
function fakeStorage() {
  const mapa = new Map<string, string>()
  return {
    get length() { return mapa.size },
    key: (i: number) => Array.from(mapa.keys())[i] ?? null,
    getItem: (k: string) => mapa.get(k) ?? null,
    setItem: (k: string, v: string) => { mapa.set(k, v) },
    removeItem: (k: string) => { mapa.delete(k) },
    clear: () => mapa.clear(),
  } as unknown as Storage
}

beforeEach(() => {
  vi.stubGlobal('window', {})
  vi.stubGlobal('localStorage', fakeStorage())
})
afterEach(() => vi.unstubAllGlobals())

describe('cópia local dos treinos', () => {
  it('guarda e devolve os dados com a data da cópia', () => {
    const treinos = [{ id: 'a', date: '2026-08-01' }]
    saveSnapshot(offlineKey.planned('atleta-1'), treinos)

    const lido = readSnapshot<typeof treinos>(offlineKey.planned('atleta-1'))
    expect(lido?.data).toEqual(treinos)
    expect(Date.parse(lido!.at)).not.toBeNaN()
  })

  it('devolve null quando não existe cópia', () => {
    expect(readSnapshot(offlineKey.planned('ninguem'))).toBeNull()
  })

  it('devolve null em vez de quebrar quando o conteúdo está corrompido', () => {
    localStorage.setItem(offlineKey.self('atleta-1'), '{isso não é json')
    expect(readSnapshot(offlineKey.self('atleta-1'))).toBeNull()
  })

  it('separa a cópia de cada atleta', () => {
    saveSnapshot(offlineKey.planned('a'), ['treino de A'])
    saveSnapshot(offlineKey.planned('b'), ['treino de B'])
    expect(readSnapshot<string[]>(offlineKey.planned('a'))?.data).toEqual(['treino de A'])
    expect(readSnapshot<string[]>(offlineKey.planned('b'))?.data).toEqual(['treino de B'])
  })

  it('ao sair da conta apaga tudo do app e não toca no resto', () => {
    saveSnapshot(offlineKey.planned('a'), [1])
    saveSnapshot(offlineKey.self('a'), { x: 1 })
    saveSnapshot(offlineKey.thresholds('a'), { lthr: 170 })
    localStorage.setItem('theme', 'light')

    clearSnapshots()

    expect(readSnapshot(offlineKey.planned('a'))).toBeNull()
    expect(readSnapshot(offlineKey.self('a'))).toBeNull()
    expect(readSnapshot(offlineKey.thresholds('a'))).toBeNull()
    expect(localStorage.getItem('theme')).toBe('light')
  })

  it('não quebra quando o armazenamento está bloqueado', () => {
    vi.stubGlobal('localStorage', {
      ...fakeStorage(),
      setItem: () => { throw new Error('QuotaExceededError') },
    } as unknown as Storage)
    expect(() => saveSnapshot('saab:off:x', { a: 1 })).not.toThrow()
  })
})

describe('idade da cópia em texto', () => {
  const menos = (min: number) => new Date(Date.now() - min * 60000).toISOString()

  it('descreve o tempo decorrido em linguagem simples', () => {
    expect(snapshotAge(menos(0))).toBe('agora há pouco')
    expect(snapshotAge(menos(25))).toBe('há 25 min')
    expect(snapshotAge(menos(3 * 60))).toBe('há 3h')
    expect(snapshotAge(menos(24 * 60))).toBe('ontem')
    expect(snapshotAge(menos(5 * 24 * 60))).toBe('há 5 dias')
  })
})
