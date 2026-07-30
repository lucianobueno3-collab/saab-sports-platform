import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

if (!globalThis.WebSocket) globalThis.WebSocket = ws

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const GEMINI_API_KEY = process.env.GEMINI_API_KEY
// Modelo configurável — troque por outro do Gemini sem mexer no código.
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash'

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const num = (v) => (typeof v === 'number' && !Number.isNaN(v) ? v : null)
const line = (label, v, unit = '') => (v == null ? null : `${label}: ${v}${unit}`)

// Monta o "briefing" com os números do atleta. Sem sobrenome, e-mail ou id —
// só primeiro nome e métricas (dado de saúde não precisa sair identificado).
function buildBriefing(d) {
  const parts = [
    `Atleta: ${d.firstName || 'atleta'} · modalidade: ${d.sport || 'corrida'}`,
    line('CTL (condicionamento)', num(d.ctl)),
    line('ATL (fadiga)', num(d.atl)),
    line('TSB (saldo de forma)', num(d.tsb)),
    d.tsbTrend ? `Tendência do TSB nos últimos 14 dias: ${d.tsbTrend}` : null,
    line('HRV mais recente', num(d.hrv), ' ms'),
    line('HRV média 14 dias', num(d.hrvAvg), ' ms'),
    line('Sono mais recente', num(d.sleep), ' h'),
    line('Sono médio 7 dias', num(d.sleepAvg), ' h'),
    line('Body Battery', num(d.bodyBattery)),
    line('Estresse médio', num(d.stress)),
    line('FC repouso', num(d.restingHr), ' bpm'),
    d.readiness ? `Prontidão calculada: ${d.readiness}` : null,
    line('Treinos concluídos na semana', num(d.workoutsDone)),
    line('Treinos planejados na semana', num(d.workoutsPlanned)),
    line('Volume da semana', num(d.weekHours), ' h'),
  ].filter(Boolean)
  return parts.join('\n')
}

const SYSTEM = `Você é um treinador de endurance experiente escrevendo o comentário semanal de um relatório para o próprio atleta, em português do Brasil.

Regras:
- Fale direto com o atleta, em segundo pessoa ("você"), tom profissional e encorajador, sem ser bajulador.
- Baseie-se SOMENTE nos números fornecidos. Nunca invente dados que não estão no briefing.
- Se um dado estiver ausente, simplesmente não comente sobre ele.
- Não dê diagnóstico médico nem prescreva medicamento. Se algo parecer preocupante, oriente procurar a equipe.
- Seja concreto: cite os números que embasam o que você diz.

Responda APENAS com um JSON válido, sem markdown e sem cercas de código, neste formato exato:
{
  "titulo": "3 a 5 palavras que resumem a semana",
  "resumo": "2 a 3 frases lendo a semana do atleta",
  "destaques": ["3 itens curtos, no máximo 8 palavras cada, cada um citando um número"],
  "recomendacao": "1 a 2 frases dizendo o que fazer na próxima semana"
}`

// Gera a análise textual do relatório semanal com o Gemini.
export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!URL_ || !ANON) return json({ error: 'Servidor sem URL/ANON do Supabase' }, 500)
  if (!GEMINI_API_KEY) return json({ error: 'IA não configurada: falta GEMINI_API_KEY no Netlify.' }, 503)

  try {
    const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '')
    if (!token) return json({ error: 'Não autenticado' }, 401)
    const caller = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } })
    const { data: { user } } = await caller.auth.getUser()
    if (!user) return json({ error: 'Sessão inválida. Entre novamente.' }, 401)

    let body
    try { body = await req.json() } catch { return json({ error: 'Requisição inválida' }, 400) }

    const briefing = buildBriefing(body ?? {})
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM }] },
          contents: [{ role: 'user', parts: [{ text: `Dados da semana:\n${briefing}` }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 700, responseMimeType: 'application/json' },
        }),
      },
    )

    if (!resp.ok) {
      const t = await resp.text().catch(() => '')
      return json({ error: `Gemini respondeu ${resp.status}: ${t.slice(0, 200)}` }, 502)
    }

    const data = await resp.json()
    const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('') ?? ''
    if (!text.trim()) return json({ error: 'A IA não retornou conteúdo.' }, 502)

    let parsed
    try {
      parsed = JSON.parse(text)
    } catch {
      // fallback: extrai o primeiro bloco {...} caso venha com texto em volta
      const m = text.match(/\{[\s\S]*\}/)
      if (!m) return json({ error: 'Resposta da IA em formato inesperado.' }, 502)
      try { parsed = JSON.parse(m[0]) } catch { return json({ error: 'Resposta da IA em formato inesperado.' }, 502) }
    }

    return json({
      titulo: String(parsed.titulo ?? '').slice(0, 60),
      resumo: String(parsed.resumo ?? '').slice(0, 600),
      destaques: Array.isArray(parsed.destaques) ? parsed.destaques.slice(0, 4).map(s => String(s).slice(0, 80)) : [],
      recomendacao: String(parsed.recomendacao ?? '').slice(0, 400),
    })
  } catch (e) {
    return json({ error: 'Erro ao gerar a análise: ' + (e?.message ?? String(e)) }, 500)
  }
}

export const config = { path: '/api/ai-report' }
