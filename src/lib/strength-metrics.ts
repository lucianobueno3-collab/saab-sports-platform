/**
 * Contas do treino de força: volume, recorde e tempo de descanso.
 *
 * Os campos de reps e carga são texto livre — o treinador escreve "8-10",
 * "45s", "cada perna", "corporal". Então tudo aqui tolera lixo e devolve null
 * em vez de fingir um número.
 */

import type { StrengthSetLog, StrengthLogRow } from '@/lib/supabase/queries'

/** Primeiro número de um texto. "8-10" → 8; "45s" → 45; "corporal" → null. */
export function parseNumero(txt: string | null | undefined): number | null {
  if (!txt) return null
  const m = String(txt).replace(',', '.').match(/-?\d+(?:\.\d+)?/)
  if (!m) return null
  const n = parseFloat(m[0])
  return Number.isFinite(n) && n >= 0 ? n : null
}

/** Volume de uma série: reps × carga, em kg. Null quando falta um dos dois. */
export function volumeSerie(s: { reps: string; load: string }): number | null {
  const reps = parseNumero(s.reps)
  const carga = parseNumero(s.load)
  if (reps == null || carga == null || carga === 0) return null
  return reps * carga
}

/** Volume somado das séries concluídas. Zero quando nenhuma tem carga. */
export function volumeTotal(sets: { reps: string; load: string; done: boolean }[]): number {
  return sets.reduce((soma, s) => s.done ? soma + (volumeSerie(s) ?? 0) : soma, 0)
}

/** Volume em texto curto: "2,4 t" acima de mil quilos, senão "840 kg". */
export function fmtVolume(kg: number): string {
  if (kg <= 0) return '—'
  if (kg >= 1000) return `${(kg / 1000).toFixed(1).replace('.', ',')} t`
  return `${Math.round(kg)} kg`
}

/** Maior carga já registrada num exercício, em treinos anteriores. */
export function recordeAnterior(logs: StrengthLogRow[], exercicio: string): number | null {
  let maior: number | null = null
  for (const log of logs) {
    for (const e of log.completed) {
      if (e.name !== exercicio) continue
      for (const s of e.sets ?? []) {
        if (!s.done) continue
        const carga = parseNumero(s.load)
        if (carga != null && carga > 0 && (maior == null || carga > maior)) maior = carga
      }
    }
  }
  return maior
}

/**
 * A série bateu o recorde do exercício?
 * Empatar não conta — recorde é superar, e avisar a cada repetição cansa.
 */
export function ehRecorde(serie: { load: string; done: boolean }, recorde: number | null): boolean {
  if (!serie.done) return false
  const carga = parseNumero(serie.load)
  if (carga == null || carga <= 0) return false
  return recorde == null ? false : carga > recorde
}

/** Últimas séries registradas de cada exercício, do treino mais recente que o tem. */
export function ultimasSeries(logs: StrengthLogRow[]): Record<string, StrengthSetLog[]> {
  const m: Record<string, StrengthSetLog[]> = {}
  for (const log of logs) {          // logs já vêm do mais recente para o mais antigo
    for (const e of log.completed) {
      if (e.sets && e.sets.length && !(e.name in m)) m[e.name] = e.sets
    }
  }
  return m
}

/** Cronômetro em texto: 90 → "1:30". */
export function fmtSegundos(total: number): string {
  const seg = Math.max(0, Math.round(total))
  const m = Math.floor(seg / 60), s = seg % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** Passo do ajuste rápido de carga: barra olímpica sobe de 2,5 em 2,5. */
export const PASSO_CARGA = 2.5

/** Soma no campo de carga respeitando o texto vazio e sem descer abaixo de zero. */
export function ajustarCarga(atual: string, delta: number): string {
  const base = parseNumero(atual) ?? 0
  const novo = Math.max(0, base + delta)
  // Sem casa decimal quando é inteiro: "40" fica melhor do que "40.0".
  return Number.isInteger(novo) ? String(novo) : novo.toFixed(1)
}
