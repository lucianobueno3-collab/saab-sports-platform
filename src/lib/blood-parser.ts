// OCR/leitura de exame de sangue (Fase 3) — casa os valores do PDF com o
// catálogo de marcadores. Trabalha sobre a CAMADA DE TEXTO do PDF (laudos
// digitais), bem mais confiável que OCR de imagem.
//
// Estratégia por linha:
//  1. Descobre qual marcador a linha descreve (o apelido mais específico vence,
//     com fronteira de palavra — evita "ldl" casar dentro de "vldl").
//  2. Remove os apelidos da linha (tira números coláveis ao rótulo, ex. "25-OH").
//  3. Extrai o valor; quando há faixa de referência, usa-a para desambiguar
//     entre vários números na linha.

import { BLOOD_MARKERS, refFor, type MarkerRef } from './blood-markers'

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9.,]+/g, ' ').trim()
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function toNumber(tok: string): number {
  let t = tok
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')          // vírgula = decimal, ponto = milhar
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '')         // só pontos em grupos de 3 = milhar
  return parseFloat(t)
}

function pickValue(s: string, ref?: MarkerRef): number | null {
  const nums: number[] = []
  const re = /\d[\d.,]*\d|\d/g
  let m: RegExpExecArray | null
  while ((m = re.exec(s)) !== null) { const v = toNumber(m[0]); if (!Number.isNaN(v)) nums.push(v) }
  if (!nums.length) return null
  if (ref && (ref.min != null || ref.max != null)) {
    const lo = ref.min != null ? ref.min * 0.3 : 0
    const hi = ref.max != null ? ref.max * 4 : Number.POSITIVE_INFINITY
    const inBand = nums.filter(n => n >= lo && n <= hi)
    if (inBand.length) return inBand[0]
  }
  return nums[0]
}

export type ParsedMarker = { key: string; value: number }

/** Extrai os marcadores encontrados no texto do laudo de sangue. */
export function parseBloodPdfText(text: string): ParsedMarker[] {
  const lines = text.split(/[\n\r]+/).map(l => l.trim()).filter(Boolean)
  const markers = Object.entries(BLOOD_MARKERS).map(([key, m]) => ({
    key,
    ref: refFor(m, null),
    aliases: (m.aliases && m.aliases.length ? m.aliases : [m.label]).map(norm).sort((a, b) => b.length - a.length),
  }))
  const results: Record<string, number> = {}

  for (const line of lines) {
    const nl = norm(line)
    // Marcador dono da linha = maior apelido que casa (com fronteira de palavra).
    let claim: { key: string; aliasLen: number; aliases: string[]; ref?: MarkerRef } | null = null
    for (const mk of markers) {
      for (const a of mk.aliases) {
        const re = new RegExp(`(^|[^a-z0-9])${escapeRe(a)}([^a-z0-9]|$)`)
        if (re.test(nl)) { if (!claim || a.length > claim.aliasLen) claim = { key: mk.key, aliasLen: a.length, aliases: mk.aliases, ref: mk.ref }; break }
      }
    }
    if (!claim || claim.key in results) continue
    let stripped = nl
    for (const a of claim.aliases) stripped = stripped.split(a).join(' ')
    const val = pickValue(stripped, claim.ref)
    if (val != null) results[claim.key] = val
  }

  return Object.entries(results).map(([key, value]) => ({ key, value }))
}
