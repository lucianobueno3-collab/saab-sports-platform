/**
 * Cópia local dos dados do treino, para o aluno ver o que fazer sem internet.
 *
 * É só leitura: guardamos o que veio do servidor na última vez que houve
 * conexão e mostramos isso quando a rede falha, sempre avisando a data da
 * cópia. Nada é enviado a partir daqui — marcar treino como feito continua
 * exigindo internet, de propósito, para não criar conflito com o que o
 * treinador editar no painel.
 */

export type Snapshot<T> = { at: string; data: T }

const PREFIXO = 'saab:off:'

export const offlineKey = {
  planned: (athleteId: string) => `${PREFIXO}planned:${athleteId}`,
  thresholds: (athleteId: string) => `${PREFIXO}th:${athleteId}`,
  self: (athleteId: string) => `${PREFIXO}self:${athleteId}`,
}

export function saveSnapshot<T>(key: string, data: T) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify({ at: new Date().toISOString(), data }))
  } catch {
    // Armazenamento cheio ou navegação privada: seguimos sem cópia local.
  }
}

export function readSnapshot<T>(key: string): Snapshot<T> | null {
  if (typeof window === 'undefined') return null
  try {
    const cru = localStorage.getItem(key)
    if (!cru) return null
    const s = JSON.parse(cru) as Snapshot<T>
    return s && s.at ? s : null
  } catch {
    return null
  }
}

/**
 * Apaga todas as cópias locais. Obrigatório ao sair da conta: o celular pode
 * ser emprestado, e os treinos de um aluno não podem aparecer para outro.
 */
export function clearSnapshots() {
  if (typeof window === 'undefined') return
  try {
    const alvos: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k?.startsWith(PREFIXO)) alvos.push(k)
    }
    for (const k of alvos) localStorage.removeItem(k)
  } catch {
    // Sem acesso ao armazenamento: nada a limpar.
  }
}

/** Texto amigável para "quando foi tirada esta cópia". */
export function snapshotAge(iso: string) {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'agora há pouco'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h}h`
  const d = Math.floor(h / 24)
  return d === 1 ? 'ontem' : `há ${d} dias`
}
