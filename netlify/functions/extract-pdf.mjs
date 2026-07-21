import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

// Polyfills defensivos no ambiente Node da Function (contexto único, sem worker):
if (!globalThis.WebSocket) globalThis.WebSocket = ws
if (typeof Promise.withResolvers !== 'function') {
  Promise.withResolvers = function () { let a, b; const p = new Promise((x, y) => { a = x; b = y }); return { promise: p, resolve: a, reject: b } }
}

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

// Extrai o texto de um PDF do storage no SERVIDOR (Node) — evita a
// incompatibilidade do pdfjs com navegadores/Safari antigos. Funciona em
// qualquer navegador porque o cliente só recebe o texto já extraído.
export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!URL_ || !ANON) return json({ error: 'Servidor sem URL/ANON do Supabase' }, 500)
  if (!SERVICE) return json({ error: 'Servidor sem SUPABASE_SERVICE_ROLE_KEY' }, 500)

  try {
    const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '')
    if (!token) return json({ error: 'Não autenticado' }, 401)
    const caller = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } })
    const { data: { user } } = await caller.auth.getUser()
    if (!user) return json({ error: 'Sessão inválida' }, 401)
    const { data: prof } = await caller.from('profiles').select('role').eq('id', user.id).single()
    if (!prof || (prof.role !== 'admin' && prof.role !== 'coach')) return json({ error: 'Sem permissão' }, 403)

    let body
    try { body = await req.json() } catch { return json({ error: 'Requisição inválida' }, 400) }
    const storagePath = String(body.storage_path ?? '')
    if (!storagePath) return json({ error: 'storage_path obrigatório' }, 400)

    const admin = createClient(URL_, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: file, error: dlErr } = await admin.storage.from('athlete-docs').download(storagePath)
    if (dlErr || !file) return json({ error: 'Não foi possível baixar o PDF' }, 404)
    const buf = new Uint8Array(await file.arrayBuffer())

    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const doc = await pdfjs.getDocument({ data: buf, isEvalSupported: false, disableFontFace: true, useSystemFonts: false }).promise
    const pages = []
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      pages.push(content.items.map(it => ('str' in it ? it.str : '')).join(' '))
    }
    return json({ text: pages.join('\n') })
  } catch (e) {
    return json({ error: 'Erro ao ler o PDF: ' + (e?.message ?? String(e)) }, 500)
  }
}

export const config = { path: '/api/extract-pdf' }
