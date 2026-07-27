// Extração de texto de PDF (pdf.js) + detecção heurística de exames laboratoriais
// e composição corporal em laudos brasileiros. O resultado sempre passa por revisão
// do usuário antes de salvar — a extração é sugestão, não verdade.

// O pdfjs-dist v6 usa Promise.withResolvers() — ausente em iOS/Safari < 17.4 —
// tanto no thread principal quanto DENTRO do worker. Sem isso: "undefined is
// not a function". Instalamos o polyfill nos dois lugares.
const WITH_RESOLVERS_POLYFILL =
  "if(typeof Promise.withResolvers!=='function'){Promise.withResolvers=function(){var a,b;var p=new Promise(function(x,y){a=x;b=y});return{promise:p,resolve:a,reject:b}}}"

function installPolyfills() {
  const P = Promise as unknown as { withResolvers?: () => unknown }
  if (typeof P.withResolvers !== 'function') {
    P.withResolvers = function <T>() {
      let resolve!: (v: T | PromiseLike<T>) => void
      let reject!: (r?: unknown) => void
      const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
      return { promise, resolve, reject }
    }
  }
}

async function loadPdfjs() {
  installPolyfills() // thread principal (e caso o pdfjs use fake worker no main)
  const pdfjs = await import('pdfjs-dist')
  const workerUrl = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
  try {
    // Worker "shim": instala o polyfill e então importa o worker real do pdfjs.
    // Se o navegador bloquear o worker-blob, o pdfjs cai no fake worker (main).
    const shim = `${WITH_RESOLVERS_POLYFILL};import(${JSON.stringify(workerUrl)});`
    pdfjs.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([shim], { type: 'text/javascript' }))
  } catch {
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
  }
  return pdfjs
}

/** Extrai o texto de todas as páginas do PDF, no navegador (só PDFs com camada de texto) */
export async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await loadPdfjs()
  const buf = await file.arrayBuffer()
  const doc = await pdfjs.getDocument({ data: buf }).promise
  const pages: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const text = content.items
      .map(item => ('str' in item ? item.str : ''))
      .join(' ')
    pages.push(text)
  }
  return pages.join('\n')
}

// Rejeita se a promessa não resolver no tempo dado — evita "spinner eterno".
export function withTimeout<T>(p: PromiseLike<T>, ms: number, msg: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(msg)), ms)),
  ])
}

function ocrStatusPt(status: string, progress?: number): string {
  const pct = progress != null && progress > 0 ? ` ${Math.round(progress * 100)}%` : ''
  if (/load|initial|download|fetch/i.test(status)) return `carregando modelo de OCR${pct}`
  if (/recogn/i.test(status)) return `lendo (OCR)${pct}`
  return status + pct
}

/** Renderiza cada página do PDF em imagem e roda OCR (para PDFs digitalizados sem texto).
 *  Os assets do tesseract (worker, core wasm e modelo 'por') são servidos do próprio
 *  site em /tesseract — sem depender de CDN, que era o motivo do "carregando" infinito. */
export async function ocrPdf(
  file: File,
  onProgress?: (info: { page: number; totalPages: number; status: string }) => void,
): Promise<string> {
  const pdfjs = await loadPdfjs()
  const { createWorker } = await import('tesseract.js')

  const buf = await file.arrayBuffer()
  const doc = await pdfjs.getDocument({ data: buf }).promise
  const totalPages = doc.numPages

  onProgress?.({ page: 0, totalPages, status: 'carregando modelo de OCR' })
  const logger = (m: { status?: string; progress?: number }) => {
    if (m.status) onProgress?.({ page: 0, totalPages, status: ocrStatusPt(m.status, m.progress) })
  }
  // Português + motor LSTM (OEM=1). Tenta primeiro os assets locais (/tesseract,
  // rápido e sem CDN); se algo não carregar, cai no CDN padrão do tesseract.
  // Assim o OCR funciona de um jeito ou de outro, e nunca fica preso em silêncio.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let worker: any
  try {
    worker = await withTimeout(
      createWorker('por', 1, {
        workerPath: '/tesseract/worker.min.js',
        corePath: '/tesseract/tesseract-core-simd-lstm.wasm.js',
        langPath: '/tesseract',
        logger,
      }),
      45_000,
      'assets locais não carregaram',
    )
  } catch {
    onProgress?.({ page: 0, totalPages, status: 'baixando modelo de OCR…' })
    worker = await withTimeout(
      createWorker('por', 1, { logger }),
      90_000,
      'O leitor de OCR não carregou. Verifique a conexão e tente novamente, ou preencha manualmente.',
    )
  }
  const pages: string[] = []

  try {
    for (let i = 1; i <= totalPages; i++) {
      onProgress?.({ page: i, totalPages, status: 'renderizando' })
      const page = await doc.getPage(i)
      // Escala 2x melhora a acurácia do OCR em laudos com fonte pequena
      const viewport = page.getViewport({ scale: 2 })
      const canvas = document.createElement('canvas')
      canvas.width = viewport.width
      canvas.height = viewport.height
      const ctx = canvas.getContext('2d')
      if (!ctx) continue
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await page.render({ canvasContext: ctx, viewport, canvas } as any).promise

      onProgress?.({ page: i, totalPages, status: 'lendo (OCR)' })
      const { data } = await withTimeout<{ data: { text: string } }>(
        worker.recognize(canvas), 120_000, `O OCR demorou demais na página ${i}.`,
      )
      pages.push(data.text)
      canvas.width = 0; canvas.height = 0 // libera memória
    }
  } finally {
    await worker.terminate()
  }
  return pages.join('\n')
}

/** Conta caracteres "úteis" (letras/números) — decide se o PDF tem texto ou precisa de OCR */
export function hasExtractableText(text: string): boolean {
  const useful = text.replace(/[^a-zA-Z0-9À-ÿ]/g, '')
  return useful.length >= 20
}

// ─── Exames laboratoriais ────────────────────────────────────────────────────

export interface ExtractedExam {
  exam_name: string
  value: number
  unit: string | null
  reference_min: number | null
  reference_max: number | null
}

// Exames conhecidos: nome canônico + variações que aparecem em laudos
const KNOWN_EXAMS: { name: string; patterns: RegExp[] }[] = [
  { name: 'Ferritina', patterns: [/ferritina/i] },
  { name: 'Hemoglobina', patterns: [/hemoglobina(?!\s*glicada)/i] },
  { name: 'Hemoglobina Glicada', patterns: [/hemoglobina\s*glicada|hba1c/i] },
  { name: 'Hematócrito', patterns: [/hemat[óo]crito/i] },
  { name: 'Vitamina D', patterns: [/vitamina\s*d\b|25[\s-]*hidroxi|25[\s-]*oh/i] },
  { name: 'Vitamina B12', patterns: [/vitamina\s*b\s*12|cianocobalamina/i] },
  { name: 'TSH', patterns: [/\btsh\b|tireoestimulante/i] },
  { name: 'T4 Livre', patterns: [/t4\s*livre|tiroxina\s*livre/i] },
  { name: 'Testosterona', patterns: [/testosterona\s*total|testosterona(?!\s*livre)/i] },
  { name: 'Cortisol', patterns: [/cortisol/i] },
  { name: 'Creatinina', patterns: [/creatinina/i] },
  { name: 'PCR', patterns: [/\bpcr\b|prote[íi]na\s*c\s*reativa/i] },
  { name: 'TGO', patterns: [/\btgo\b|\bast\b|aspartato/i] },
  { name: 'TGP', patterns: [/\btgp\b|\balt\b|alanina/i] },
  { name: 'Glicose', patterns: [/glicose|glicemia/i] },
  { name: 'Ureia', patterns: [/ur[ée]ia/i] },
  { name: 'Colesterol Total', patterns: [/colesterol\s*total/i] },
  { name: 'HDL', patterns: [/\bhdl\b/i] },
  { name: 'LDL', patterns: [/\bldl\b/i] },
  { name: 'Triglicerídeos', patterns: [/triglicer[íi]d/i] },
  { name: 'Ferro', patterns: [/ferro\s*s[ée]rico|\bferro\b(?!\w)/i] },
  { name: 'Leucócitos', patterns: [/leuc[óo]citos/i] },
  { name: 'CPK', patterns: [/\bcpk\b|creatinoquinase|creatina\s*quinase/i] },
  { name: 'Magnésio', patterns: [/magn[ée]sio/i] },
  { name: 'Zinco', patterns: [/\bzinco\b/i] },
  { name: 'Saturação de Transferrina', patterns: [/satura[çc][ãa]o\s*(?:de\s*)?transferrina|[íi]ndice\s*de\s*satura[çc][ãa]o/i] },
  { name: 'Transferrina', patterns: [/transferrina(?!\s)/i] },
  { name: 'LDH', patterns: [/\bldh\b|desidrogenase\s*l[áa]ctica/i] },
  { name: 'GGT', patterns: [/\bggt\b|gama\s*gt|gama\s*glutamil/i] },
  { name: 'Ácido Úrico', patterns: [/[áa]cido\s*[úu]rico/i] },
  { name: 'Ácido Fólico', patterns: [/[áa]cido\s*f[óo]lico|folato/i] },
  { name: 'Plaquetas', patterns: [/plaquetas/i] },
  { name: 'VCM', patterns: [/\bvcm\b|volume\s*corpuscular/i] },
  { name: 'Insulina', patterns: [/insulina(?!\s*p[óo]s)/i] },
  { name: 'IGF-1', patterns: [/\bigf[\s-]*1\b|somatomedina/i] },
]

const UNIT_RE = 'ng/mL|pg/mL|mg/dL|g/dL|µg/dL|ug/dL|mcg/dL|U/L|UI/L|µUI/mL|uUI/mL|mUI/L|nmol/L|ng/dL|mil/mm3|/mm3|%'
// número BR: 1.234,5 ou 1234.5 ou 12,3 ou 12
const NUM_RE = '\\d{1,3}(?:\\.\\d{3})*(?:,\\d+)?|\\d+(?:\\.\\d+)?'

export function parseBrNumber(s: string): number {
  // "1.234,5" → 1234.5 · "12,3" → 12.3 · "12.3" → 12.3
  if (s.includes(',')) return parseFloat(s.replace(/\./g, '').replace(',', '.'))
  return parseFloat(s)
}

/** Detecta exames conhecidos no texto do laudo. Cada exame reporta a 1ª ocorrência. */
export function extractExamsFromText(text: string): ExtractedExam[] {
  const results: ExtractedExam[] = []

  for (const exam of KNOWN_EXAMS) {
    for (const pattern of exam.patterns) {
      const m = pattern.exec(text)
      if (!m) continue

      // Janela de até 120 caracteres após o nome do exame: valor + unidade + referência
      const window = text.slice(m.index, m.index + 160)
      const valueMatch = new RegExp(`(?::|\\s)\\s*(${NUM_RE})\\s*(${UNIT_RE})?`).exec(window.slice(m[0].length))
      if (!valueMatch) continue

      const value = parseBrNumber(valueMatch[1])
      if (isNaN(value)) continue

      // Faixa de referência: "Referência: 20 a 300" | "VR: 20 - 300" | "(20-300)"
      const refMatch = new RegExp(
        `(?:refer[êe]ncia|valores?\\s*de\\s*refer[êe]ncia|vr|normal)[:\\s]*(?:de\\s*)?(${NUM_RE})\\s*(?:a|-|–|at[ée])\\s*(${NUM_RE})`, 'i'
      ).exec(window) ?? new RegExp(`\\((${NUM_RE})\\s*(?:a|-|–)\\s*(${NUM_RE})\\)`).exec(window)

      results.push({
        exam_name: exam.name,
        value,
        unit: valueMatch[2] ?? null,
        reference_min: refMatch ? parseBrNumber(refMatch[1]) : null,
        reference_max: refMatch ? parseBrNumber(refMatch[2]) : null,
      })
      break // achou por um dos padrões, não repete o mesmo exame
    }
  }
  return results
}

/** Data mais recente (dd/mm/aaaa ou dd.mm.aaaa) encontrada no texto do laudo. */
export function extractDateFromText(text: string): string | null {
  const re = /(\d{2})[./](\d{2})[./](\d{4})/g
  let best: string | null = null
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const [, d, mo, y] = m
    const day = parseInt(d), month = parseInt(mo)
    if (day < 1 || day > 31 || month < 1 || month > 12) continue
    const iso = `${y}-${mo}-${d}`
    if (!best || iso > best) best = iso   // mantém a data mais recente
  }
  return best
}

// ─── Composição corporal ─────────────────────────────────────────────────────

export interface ExtractedBodyComp {
  weight_kg: number | null
  body_fat_pct: number | null
  muscle_mass_kg: number | null
  bone_mass_kg: number | null
  visceral_fat: number | null
}

/**
 * Laudos InBody (InBody120/270/570/770 · LookinBody) não trazem os rótulos
 * junto dos números no texto — usam o layout gráfico. Extraímos pela sequência
 * fixa da "Composição Corporal": Água, Proteína, Minerais, Massa de Gordura, Peso.
 */
function extractInBody(text: string): ExtractedBodyComp | null {
  if (!/inbody|lookinbody/i.test(text)) return null

  // 5 valores no formato "X ( ) low~high (kg)" na ordem padrão do InBody
  const compRe = /([\d.,]+)\s*\(\s*\)\s*[\d.,]+\s*~\s*[\d.,]+\s*\(kg\)/gi
  const vals: number[] = []
  let m: RegExpExecArray | null
  while ((m = compRe.exec(text)) !== null) { const v = parseBrNumber(m[1]); if (!isNaN(v)) vals.push(v) }
  if (vals.length < 5) return null

  const fatMass = vals[3]
  const weight = vals[4]
  const bodyFat = weight > 0 && !isNaN(fatMass) ? Math.round((fatMass / weight) * 1000) / 10 : null

  // Massa Muscular Esquelética: 1º "X low~high kg" (sem "( )"), faixa plausível
  let smm: number | null = null
  const smmRe = /([\d.,]+)\s+[\d.,]+\s*~\s*[\d.,]+\s*kg/gi
  let ms: RegExpExecArray | null
  while ((ms = smmRe.exec(text)) !== null) { const v = parseBrNumber(ms[1]); if (v >= 20 && v <= 90) { smm = v; break } }

  return { weight_kg: weight, body_fat_pct: bodyFat, muscle_mass_kg: smm, bone_mass_kg: null, visceral_fat: null }
}

/**
 * Relatórios "Comparativo Antropométrico" (ex.: FlexNutri / Dr. César Torres)
 * trazem várias datas em colunas — o valor ATUAL é o da última coluna — e os
 * rótulos vêm separados dos números no texto. Extraímos por âncora + faixa
 * plausível, pegando sempre o ÚLTIMO valor de cada métrica (medição mais recente).
 */
function extractComparativeAnthro(text: string): ExtractedBodyComp | null {
  if (!/massa\s+magra/i.test(text) || !/massa\s+gorda/i.test(text)) return null
  const cut = text.search(/massa\s+gorda/i)
  const before = cut > 0 ? text.slice(0, cut) : text // bloco Peso/Altura/IMC
  const after = cut > 0 ? text.slice(cut) : ''        // bloco de composição

  const lastKg = (s: string, min: number, max: number): number | null => {
    const re = /(\d{1,3}(?:\.\d{3})*,\d+)\s*kg/gi
    let m: RegExpExecArray | null, last: number | null = null
    while ((m = re.exec(s)) !== null) { const v = parseBrNumber(m[1]); if (v >= min && v <= max) last = v }
    return last
  }
  // Peso: último kg antes do bloco de composição (exclui massa gorda/magra).
  const weight = lastKg(before, 30, 300)
  // Massa Magra: kg no bloco de composição, faixa alta (exclui massa gorda < 40).
  const muscle = lastKg(after, 40, 250)
  // % de gordura: último percentual plausível (<=55 exclui a % de massa magra).
  let bodyFat: number | null = null
  const pr = /(\d{1,3},\d+)\s*%/g
  let pm: RegExpExecArray | null
  while ((pm = pr.exec(text)) !== null) { const v = parseBrNumber(pm[1]); if (v >= 3 && v <= 55) bodyFat = v }

  if (weight == null && bodyFat == null && muscle == null) return null
  return { weight_kg: weight, body_fat_pct: bodyFat, muscle_mass_kg: muscle, bone_mass_kg: null, visceral_fat: null }
}

// ─── Métricas antropométricas completas (layouts homologados) ────────────────

export interface AnthroMetric {
  category: 'composicao' | 'circunferencia' | 'dobra'
  key: string
  label: string
  value: number
  unit: string
}
export interface AnthroExtract { measured_at: string | null; metrics: AnthroMetric[] }

// Circunferências na ordem em que aparecem no laudo comparativo (FlexNutri).
const CIRC_LABELS = [
  'Ombro', 'Peitoral', 'Cintura', 'Abdômen', 'Quadril',
  'Panturrilha direita', 'Panturrilha esquerda', 'Punho direito', 'Punho esquerdo',
  'Coxa proximal direita', 'Coxa proximal esquerda',
  'Braço relaxado direito', 'Braço relaxado esquerdo',
  'Braço contraído direito', 'Braço contraído esquerdo',
  'Antebraço direito', 'Antebraço esquerdo',
]

const slug = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')

/**
 * Layout HOMOLOGADO: "Relatório Comparativo Antropométrico" (FlexNutri /
 * Dr. César Torres). Extrai TODAS as métricas da medição mais recente (última
 * coluna): composição + circunferências. Valores verificados contra o laudo
 * real. As dobras cutâneas ainda não são homologadas (o PDF embaralha a ordem).
 */
export function extractAnthropometryMetrics(text: string): AnthroExtract | null {
  const isComparative = /comparativo\s+antropom[ée]trico/i.test(text) ||
    (/massa\s+magra/i.test(text) && /massa\s+gorda/i.test(text) && /circunfer[êe]ncias/i.test(text))
  if (!isComparative) return null

  const metrics: AnthroMetric[] = []
  const push = (category: AnthroMetric['category'], key: string, label: string, value: number | null, unit: string) => {
    if (value != null && !isNaN(value)) metrics.push({ category, key, label, value, unit })
  }
  const lastKg = (s: string, min: number, max: number): number | null => {
    const re = /(\d{1,3}(?:\.\d{3})*,\d+)\s*kg/gi
    let m: RegExpExecArray | null, last: number | null = null
    while ((m = re.exec(s)) !== null) { const v = parseBrNumber(m[1]); if (v >= min && v <= max) last = v }
    return last
  }

  // ── Composição (última coluna) ──
  const cut = text.search(/massa\s+gorda/i)
  const before = cut > 0 ? text.slice(0, cut) : text
  const after = cut > 0 ? text.slice(cut) : ''
  push('composicao', 'peso', 'Peso', lastKg(before, 30, 300), 'kg')
  // IMC: número simples (sem unidade) no bloco superior, faixa plausível.
  let imc: number | null = null
  for (const t of before.split(/\s+/)) { const mm = /^(\d{2},\d{1,2})$/.exec(t); if (mm) { const v = parseBrNumber(mm[1]); if (v >= 15 && v <= 45) imc = v } }
  push('composicao', 'imc', 'IMC', imc, '')
  push('composicao', 'massa_gorda', 'Massa Gorda', lastKg(after, 5, 40), 'kg')
  push('composicao', 'massa_magra', 'Massa Magra', lastKg(after, 40, 250), 'kg')
  let pctFat: number | null = null, pctLean: number | null = null
  { let m: RegExpExecArray | null; const re = /(\d{1,3},\d+)\s*%/g; while ((m = re.exec(text)) !== null) { const v = parseBrNumber(m[1]); if (v >= 3 && v <= 55) pctFat = v; else if (v > 55 && v <= 95) pctLean = v } }
  push('composicao', 'perc_gordura', '% Gordura', pctFat, '%')
  push('composicao', 'perc_massa_magra', '% Massa Magra', pctLean, '%')

  // ── Circunferências (última coluna) ──
  const ci = text.search(/circunfer[êe]ncias/i)
  if (ci >= 0) {
    const pi = text.search(/pregas\s+cut[âa]neas/i)
    const seg = text.slice(ci, pi > ci ? pi : undefined)
    const cm = [...seg.matchAll(/(\d{1,3},\d{2})\s*cm/g)].map(m => parseBrNumber(m[1]))
    const latest = cm.slice(-CIRC_LABELS.length)
    if (latest.length === CIRC_LABELS.length) {
      CIRC_LABELS.forEach((l, i) => push('circunferencia', slug(l), l, latest[i], 'cm'))
    }
  }

  return metrics.length > 0 ? { measured_at: extractDateFromText(text), metrics } : null
}

export function extractBodyCompFromText(text: string): ExtractedBodyComp {
  const inbody = extractInBody(text)
  if (inbody && inbody.weight_kg != null) return inbody

  const comparative = extractComparativeAnthro(text)
  if (comparative && comparative.weight_kg != null) return comparative

  const find = (patterns: RegExp[]): number | null => {
    for (const p of patterns) {
      const m = p.exec(text)
      if (m) {
        const v = parseBrNumber(m[1])
        if (!isNaN(v)) return v
      }
    }
    return null
  }

  return {
    weight_kg: find([
      new RegExp(`peso(?:\\s*corporal|\\s*atual)?\\s*[:\\s]\\s*(${NUM_RE})\\s*kg`, 'i'),
    ]),
    body_fat_pct: find([
      new RegExp(`(?:%\\s*(?:de\\s*)?gordura|gordura\\s*corporal|percentual\\s*de\\s*gordura)\\s*[:\\s]\\s*(${NUM_RE})\\s*%?`, 'i'),
    ]),
    muscle_mass_kg: find([
      new RegExp(`massa\\s*(?:muscular|magra)\\s*[:\\s]\\s*(${NUM_RE})\\s*kg`, 'i'),
    ]),
    bone_mass_kg: find([
      new RegExp(`massa\\s*[óo]ssea\\s*[:\\s]\\s*(${NUM_RE})\\s*kg`, 'i'),
    ]),
    visceral_fat: find([
      new RegExp(`gordura\\s*visceral\\s*[:\\s]*(?:n[íi]vel\\s*)?(${NUM_RE})`, 'i'),
    ]),
  }
}
