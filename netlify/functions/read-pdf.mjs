import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { extractText, getDocumentProxy } from 'unpdf'

if (!globalThis.WebSocket) globalThis.WebSocket = ws

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
    // unpdf: pdfjs pronto para serverless (não precisa de DOMMatrix/canvas).
    const pdf = await getDocumentProxy(buf)
    const { text, totalPages } = await extractText(pdf, { mergePages: true })
    return json({ text, pages: totalPages })
  } catch (e) {
    return json({ error: 'Erro ao ler o PDF: ' + (e?.message ?? String(e)) }, 500)
  }
}

export const config = { path: '/api/read-pdf' }
