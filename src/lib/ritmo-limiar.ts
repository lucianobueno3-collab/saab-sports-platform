/**
 * Ritmo de limiar a partir de um esforço cronometrado do aluno.
 *
 * O app prescreve tudo em % do ritmo limite, e converte isso em min/km para o
 * aluno — mas só se o limiar dele estiver cadastrado. Até aqui esse número só
 * podia ser digitado pelo treinador, num campo escondido na ficha, e nada
 * lembrava ninguém disso. O aluno abria o treino da semana 1 e lia
 * "10× 1min a 88–98%", que não dá para executar.
 *
 * Aqui o número sai de algo que o aluno sabe responder na matrícula: quanto
 * tempo ele levou em uma distância. O treinador corrige depois, mas o aluno
 * nunca fica sem ritmo.
 */

/**
 * Expoente de fadiga da fórmula de Riegel (1977), que projeta o tempo de uma
 * distância para outra. 1,06 é o valor clássico e funciona bem de 1 km a 42 km.
 */
const RIEGEL = 1.06

/** Duração do esforço que define o limiar: o ritmo que se sustenta por ~1 hora. */
const LIMIAR_SEG = 3600

/** Limites de plausibilidade — fora disso é erro de digitação, não atleta. */
const KM_MIN = 0.8
const KM_MAX = 42.5
/** 2:00/km é acima do recorde mundial; 15:00/km é caminhada lenta. */
const RITMO_MIN_SEG_KM = 120
const RITMO_MAX_SEG_KM = 900

export type EsforcoCronometrado = { km: number; segundos: number }

/**
 * Ritmo de limiar em segundos por quilômetro, ou `null` se o esforço informado
 * não fizer sentido.
 *
 * Projeta o esforço para o que o aluno sustentaria em 1 hora e usa esse ritmo.
 * Para quem corre 5 km em 25 min, dá ~5:15/km — cerca de 15s/km mais lento que
 * o ritmo de 5 km, que é o que a literatura de treinamento espera.
 */
export function limiarDeEsforco({ km, segundos }: EsforcoCronometrado): number | null {
  if (!Number.isFinite(km) || !Number.isFinite(segundos)) return null
  if (km < KM_MIN || km > KM_MAX || segundos <= 0) return null

  const ritmoDoEsforco = segundos / km
  if (ritmoDoEsforco < RITMO_MIN_SEG_KM || ritmoDoEsforco > RITMO_MAX_SEG_KM) return null

  // Riegel: t2 = t1 × (d2/d1)^1.06. Fixando t2 = 1h, sai a distância de 1 hora.
  const kmEmUmaHora = km * Math.pow(LIMIAR_SEG / segundos, 1 / RIEGEL)
  const limiar = Math.round(LIMIAR_SEG / kmEmUmaHora)

  // O esforço já pode ter durado mais de 1 hora: aí o próprio ritmo dele já é
  // igual ou mais lento que o de limiar, e projetar para cima seria inventar.
  if (limiar < RITMO_MIN_SEG_KM || limiar > RITMO_MAX_SEG_KM) return null
  return limiar
}

/** "5:15" a partir de 315 segundos. */
export function fmtRitmo(segPorKm: number): string {
  const m = Math.floor(segPorKm / 60)
  const s = Math.round(segPorKm % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * Lê "25:30", "25min", "1:05:00" ou "25" (minutos) em segundos.
 *
 * O campo é livre de propósito: obrigar o aluno a acertar um formato na
 * matrícula é onde ele desiste.
 */
export function lerTempo(texto: string): number | null {
  const t = texto.trim().toLowerCase().replace(/\s/g, '')
  if (!t) return null

  const comDoisPontos = t.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/)
  if (comDoisPontos) {
    const [, a, b, c] = comDoisPontos
    // Com três partes é h:m:s; com duas, min:seg — ninguém informa "1 hora e 5"
    // como "1:05" numa prova de corrida.
    const seg = c != null
      ? Number(a) * 3600 + Number(b) * 60 + Number(c)
      : Number(a) * 60 + Number(b)
    return seg > 0 ? seg : null
  }

  const soNumero = t.match(/^(\d{1,3})(?:min|m)?$/)
  if (soNumero) {
    const min = Number(soNumero[1])
    return min > 0 ? min * 60 : null
  }

  return null
}

/** Lê "5", "5,2", "5.2" ou "5km" em quilômetros. */
export function lerDistancia(texto: string): number | null {
  const t = texto.trim().toLowerCase().replace(/\s|km/g, '').replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * Frase que o aluno lê logo abaixo do campo, para ele conferir se o que
 * digitou faz sentido antes de seguir.
 */
export function resumoDoEsforco(km: number, segundos: number): string | null {
  const limiar = limiarDeEsforco({ km, segundos })
  if (limiar == null) return null
  return `Seus treinos vão sair com ritmo por volta de ${fmtRitmo(limiar)}/km. Seu treinador ajusta depois.`
}
