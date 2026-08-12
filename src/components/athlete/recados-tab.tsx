'use client'

import { useEffect, useState } from 'react'
import {
  getAthleteInbox, getWorkoutComments, addWorkoutComment, markThreadRead,
  type InboxThread, type WorkoutComment,
} from '@/lib/supabase/queries'
import { MessageCircle, ChevronLeft, Loader2, Send } from 'lucide-react'

const RED = 'var(--marca)'

function quando(iso: string): string {
  const d = new Date(iso)
  const dias = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (dias === 0) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (dias === 1) return 'ontem'
  if (dias < 7) return `há ${dias} dias`
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

/**
 * Caixa de recados do aluno.
 *
 * Ele já podia perguntar dentro de cada treino, mas não tinha onde ver as
 * respostas: o aviso de "seu treinador respondeu" ficava numa aba que nem é a
 * que abre. O treinador tem uma tela de Recados com contador de não lidos há
 * tempos — esta é o espelho dela.
 *
 * A conversa continua presa ao treino, que é o que faz a dúvida ter contexto.
 * O que muda é só a porta de entrada.
 */
export function RecadosTab({ athleteId, onLido }: { athleteId: string; onLido?: () => void }) {
  const [threads, setThreads] = useState<InboxThread[]>([])
  const [loading, setLoading] = useState(true)
  const [aberta, setAberta] = useState<InboxThread | null>(null)

  async function carregar() {
    setThreads(await getAthleteInbox(athleteId))
    setLoading(false)
  }
  useEffect(() => { carregar() /* eslint-disable-next-line */ }, [athleteId])

  if (aberta) {
    return (
      <Conversa
        thread={aberta} athleteId={athleteId}
        onVoltar={() => { setAberta(null); carregar(); onLido?.() }}
      />
    )
  }

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div>
        <h1 className="text-xl font-black text-foreground">Recados</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Suas conversas com o treinador, por treino.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : threads.length === 0 ? (
        <div className="rounded-2xl p-10 text-center" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <MessageCircle className="w-9 h-9 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-semibold text-foreground">Nenhum recado ainda</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto leading-relaxed">
            Para perguntar algo, abra um treino no calendário e toque em <b className="text-foreground">Falar com o treinador</b>. A conversa aparece aqui.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          {threads.map((t, i) => (
            <button key={t.workout_id} onClick={() => setAberta(t)}
              className="w-full flex items-start gap-3 px-4 py-3.5 text-left hover:bg-secondary/40 transition-colors"
              style={i ? { borderTop: '1px solid var(--border)' } : undefined}>
              <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: t.unread ? RED : 'var(--secondary)' }}>
                <MessageCircle className="w-4 h-4" style={{ color: t.unread ? '#fff' : 'var(--muted-foreground)' }} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className={`text-[13px] truncate flex-1 ${t.unread ? 'font-black text-foreground' : 'font-bold text-foreground'}`}>
                    {t.workout_title}
                  </span>
                  <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">{quando(t.last_at)}</span>
                </span>
                <span className={`block text-xs mt-0.5 line-clamp-2 ${t.unread ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {t.last_from_athlete ? 'Você: ' : ''}{t.last_body}
                </span>
              </span>
              {t.unread > 0 && (
                <span className="shrink-0 mt-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-black text-white flex items-center justify-center tabular-nums"
                  style={{ background: RED }}>{t.unread}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Conversa({ thread, athleteId, onVoltar }: {
  thread: InboxThread; athleteId: string; onVoltar: () => void
}) {
  const [itens, setItens] = useState<WorkoutComment[]>([])
  const [texto, setTexto] = useState('')
  const [loading, setLoading] = useState(true)
  const [enviando, setEnviando] = useState(false)

  async function carregar() { setItens(await getWorkoutComments(thread.workout_id)); setLoading(false) }
  useEffect(() => {
    carregar()
    // Abrir a conversa é ler: marca antes de o aluno sair da tela.
    markThreadRead(thread.workout_id, 'athlete').catch(() => {})
    /* eslint-disable-next-line */
  }, [thread.workout_id])

  async function enviar() {
    if (!texto.trim()) return
    setEnviando(true)
    await addWorkoutComment(thread.workout_id, athleteId, texto)
    setTexto(''); await carregar(); setEnviando(false)
  }

  const data = thread.workout_date
    ? new Date(thread.workout_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })
    : ''

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center gap-2">
        <button onClick={onVoltar} aria-label="Voltar aos recados"
          className="p-2 -ml-2 rounded-lg hover:bg-secondary text-muted-foreground"><ChevronLeft className="w-5 h-5" /></button>
        <div className="min-w-0">
          <h1 className="text-base font-black text-foreground truncate">{thread.workout_title}</h1>
          {data && <p className="text-[11px] text-muted-foreground capitalize">{data}</p>}
        </div>
      </div>

      <div className="rounded-2xl p-4 space-y-2.5 min-h-[160px]" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : itens.map(c => {
          const meu = c.author_role === 'athlete' || c.author_role == null
          return (
            <div key={c.id} className={`flex ${meu ? 'justify-end' : 'justify-start'}`}>
              <div className="max-w-[85%] rounded-2xl px-3.5 py-2"
                style={meu
                  ? { background: RED, color: '#fff' }
                  : { background: 'var(--secondary)', color: 'var(--foreground)' }}>
                {!meu && <p className="text-[10px] font-black uppercase tracking-wide opacity-60 mb-0.5">Treinador</p>}
                <p className="text-sm whitespace-pre-line leading-relaxed">{c.body}</p>
                <p className="text-[10px] opacity-60 mt-1 tabular-nums">{quando(c.created_at)}</p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex gap-2">
        <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={2}
          placeholder="Escreva para o seu treinador…"
          className="flex-1 px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none" />
        <button onClick={enviar} disabled={enviando || !texto.trim()} aria-label="Enviar recado"
          className="px-4 rounded-xl text-white font-bold disabled:opacity-50 flex items-center justify-center shrink-0"
          style={{ background: RED }}>
          {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}
