import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

// Polyfills para o pdfjs rodar no Node da Function (sem worker/DOM):
if (!globalThis.WebSocket) globalThis.WebSocket = ws
if (typeof Promise.withResolvers !== 'function') {
  Promise.withResolvers = function () { let a, b; const p = new Promise((x, y) => { a = x; b = y }); return { promise: p, resolve: a, reject: b } }
}

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

// Extrai o texto de um PDF enviado direto pelo cliente (base64), no SERVIDOR.
// Robusto em qualquer navegador (inclusive iOS/Safari), pois o pdfjs roda no
// Node — o cliente só manda os bytes e recebe o texto pronto. Não precisa de
// storage: ideal para o OCR de exame de sangue.
export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!URL_ || !ANON) return json({ error: 'Servidor sem URL/ANON do Supabase' }, 500)

  try {
    const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '')
    if (!token) return json({ error: 'Não autenticado' }, 401)
    const caller = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } })
    const { data: { user } } = await caller.auth.getUser()
    if (!user) return json({ error: 'Sessão inválida. Entre novamente.' }, 401)

    let body
    try { body = await req.json() } catch { return json({ error: 'Requisição inválida' }, 400) }
    const b64 = String(body.pdf_base64 ?? '')
    if (!b64) return json({ error: 'PDF ausente' }, 400)
    if (b64.length > 12_000_000) return json({ error: 'PDF muito grande (máx. ~8 MB).' }, 413)

    const buf = new Uint8Array(Buffer.from(b64, 'base64'))
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const doc = await pdfjs.getDocument({ data: buf, isEvalSupported: false, disableFontFace: true, useSystemFonts: false }).promise
    const pages = []
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      pages.push(content.items.map(it => ('str' in it ? it.str : '')).join(' '))
    }
    return json({ text: pages.join('\n'), pages: doc.numPages })
  } catch (e) {
    return json({ error: 'Erro ao ler o PDF: ' + (e?.message ?? String(e)) }, 500)
  }
}

export const config = { path: '/api/read-pdf' }
