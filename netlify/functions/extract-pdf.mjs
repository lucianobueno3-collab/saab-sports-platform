import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { extractText, getDocumentProxy } from 'unpdf'

if (!globalThis.WebSocket) globalThis.WebSocket = ws

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

    let body
    try { body = await req.json() } catch { return json({ error: 'Requisição inválida' }, 400) }
    const storagePath = String(body.storage_path ?? '')
    if (!storagePath) return json({ error: 'storage_path obrigatório' }, 400)

    // Treinador/admin leem qualquer documento; o atleta lê os próprios
    // (arquivos na pasta {athlete_id}/...). Assim a leitura no servidor —
    // robusta em qualquer navegador — vale também para o atleta.
    const { data: prof } = await caller.from('profiles').select('role').eq('id', user.id).single()
    let allowed = !!prof && (prof.role === 'admin' || prof.role === 'coach')
    if (!allowed) {
      const { data: myAthleteId } = await caller.rpc('my_athlete_id')
      if (myAthleteId && storagePath.split('/')[0] === myAthleteId) allowed = true
    }
    if (!allowed) return json({ error: 'Sem permissão' }, 403)

    const admin = createClient(URL_, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: file, error: dlErr } = await admin.storage.from('athlete-docs').download(storagePath)
    if (dlErr || !file) return json({ error: 'Não foi possível baixar o PDF' }, 404)
    const buf = new Uint8Array(await file.arrayBuffer())
    // unpdf: pdfjs pronto para serverless (não precisa de DOMMatrix/canvas).
    const pdf = await getDocumentProxy(buf)
    const { text } = await extractText(pdf, { mergePages: true })
    return json({ text })
  } catch (e) {
    return json({ error: 'Erro ao ler o PDF: ' + (e?.message ?? String(e)) }, 500)
  }
}

export const config = { path: '/api/extract-pdf' }
