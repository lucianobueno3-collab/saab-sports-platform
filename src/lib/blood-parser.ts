// OCR/leitura de exame de sangue (Fase 3) — casa os valores do PDF com o
// catálogo de marcadores. Trabalha sobre a CAMADA DE TEXTO do PDF (laudos
// digitais), bem mais confiável que OCR de imagem.
//
// O pdfjs entrega cada página como um texto corrido (sem quebras por linha),
// e os laudos misturam cabeçalhos (Material/Coleta/Método), datas e notas.
// Por isso a leitura é por JANELA após o rótulo, em duas passadas:
//   Passada A (sinal forte): "Resultado <n>" ou "<n> <unidade>" logo após o rótulo.
//   Passada B (fallback): primeiro número imediatamente após o rótulo (tabelas).
// A faixa de referência valida o número; datas/horas são removidas antes.

import { BLOOD_MARKERS, refFor, type MarkerRef } from './blood-markers'

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9.,/% ]+/g, ' ').replace(/\s+/g, ' ')
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const stripDates = (s: string) => s.replace(/\b\d{2}\/\d{2}\/\d{4}\b/g, ' ').replace(/\b\d{1,2}:\d{2}(:\d{2})?\b/g, ' ')

// unidades comuns em laudos (já normalizadas: minúsculas, sem acento)
const UNIT = '(?:mg/dl|g/dl|ng/ml|pg/ml|u/l|ui/ml|uui/ml|uiu/ml|mui/ml|miu/ml|%|mil/mm3|/mm3|mmol/l|meq/l|ug/dl|nmol/l|mm/h|fl|pg)'

function toNumber(tok: string): number {
  let t = tok
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')          // vírgula = decimal, ponto = milhar
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '')         // só pontos em grupos de 3 = milhar
  return parseFloat(t)
}

function inBand(v: number, ref: MarkerRef | undefined, count: boolean): boolean {
  let lo = ref?.min != null ? ref.min * 0.3 : 0
  const hi = ref?.max != null ? ref.max * 4 : Number.POSITIVE_INFINITY
  if (count) lo = lo / 1000 // contagens podem vir em "mil/mm³"
  return v >= lo && v <= hi
}
// contagens reportadas em milhares (leucócitos 6,75 = 6750): corrige a escala
function scaleCount(v: number, ref: MarkerRef | undefined, count: boolean): number {
  return count && ref?.min != null && v < ref.min * 0.3 ? v * 1000 : v
}

// Janelas de texto após cada ocorrência do apelido (com fronteira de palavra).
function windowsFor(N: string, alias: string, len: number): string[] {
  const na = norm(alias)
  const re = new RegExp(`(^|[^a-z0-9])${escapeRe(na)}([^a-z0-9]|$)`, 'g')
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(N)) !== null) {
    if (m.index === re.lastIndex) re.lastIndex++
    out.push(stripDates(N.slice(m.index + m[0].length, m.index + m[0].length + len)))
  }
  return out
}

export type ParsedMarker = { key: string; value: number }

/** Extrai os marcadores encontrados no texto do laudo de sangue. */
export function parseBloodPdfText(text: string): ParsedMarker[] {
  const N = norm(text)
  const results: ParsedMarker[] = []
  const reResultado = /resultado\s+(\d[\d.,]*)/
  const reNumUnit = new RegExp(`^\\s*(\\d[\\d.,]*)\\s*(${UNIT})`)
  const reFirst = /\d[\d.,]*\d|\d/

  for (const [key, marker] of Object.entries(BLOOD_MARKERS)) {
    const ref = refFor(marker, null)
    const count = marker.unit === '/mm³'
    const aliases = marker.aliases && marker.aliases.length ? marker.aliases : [marker.label]
    let val: number | null = null

    // Passada A — sinal forte (Resultado <n> | <n> <unidade>)
    for (const al of aliases) {
      for (const win of windowsFor(N, al, 260)) {
        const mt = reResultado.exec(win) ?? reNumUnit.exec(win)
        if (!mt) continue
        const v = scaleCount(toNumber(mt[1]), ref, count)
        if (!Number.isNaN(v) && inBand(v, ref, count)) { val = v; break }
      }
      if (val != null) break
    }
    // Passada B — primeiro número logo após o rótulo (tabelas)
    if (val == null) {
      for (const al of aliases) {
        for (const win of windowsFor(N, al, 44)) {
          const mt = win.match(reFirst)
          if (!mt) continue
          const v = scaleCount(toNumber(mt[0]), ref, count)
          if (!Number.isNaN(v) && inBand(v, ref, count)) { val = v; break }
        }
        if (val != null) break
      }
    }

    if (val != null) results.push({ key, value: val })
  }
  return results
}
