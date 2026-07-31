'use client'

import { useEffect, useState } from 'react'
import { Topbar } from '@/components/layout/topbar'
import {
  getCoachInbox, getWorkoutComments, addWorkoutComment, markThreadRead,
  type InboxThread, type WorkoutComment,
} from '@/lib/supabase/queries'
import { MessageCircle, Loader2, Send, ArrowLeft, CalendarDays } from 'lucide-react'

const RED = '#e8001c'
const fmtWhen = (iso: string) => {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const h = Math.floor(diff / 3600000)
  if (h < 1) return 'agora há pouco'
  if (h < 24) return `${h}h atrás`
  const dd = Math.floor(h / 24)
  return dd === 1 ? 'ontem' : `${dd} dias atrás`
}
const fmtDate = (d: string) => (d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '')

/** Caixa de entrada: todas as conversas dos alunos num lugar só. */
export default function RecadosPage() {
  const [threads, setThreads] = useState<InboxThread[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState<InboxThread | null>(null)

  async function load() { setThreads(await getCoachInbox()); setLoading(false) }
  useEffect(() => { load() }, [])

  const totalUnread = threads.reduce((s, t) => s + t.unread, 0)

  async function openThread(t: InboxThread) {
    setOpen(t)
    if (t.unread > 0) { await markThreadRead(t.workout_id, 'staff'); load() }
  }

  return (
    <div>
      <Topbar title="Recados"
        subtitle={loading ? 'Carregando...' : totalUnread > 0 ? `${totalUnread} mensagem${totalUnread > 1 ? 's' : ''} sem resposta` : 'Tudo respondido'} />

      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : threads.length === 0 ? (
          <div className="rounded-2xl p-10 text-center" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <MessageCircle className="w-8 h-8 mx-auto text-muted-foreground/40" />
            <p className="text-sm font-bold text-foreground mt-2">Nenhum recado ainda</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Quando um aluno mandar uma dúvida sobre um treino, ela aparece aqui — e você responde sem sair do app.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {threads.map(t => (
              <button key={t.workout_id} onClick={() => openThread(t)}
                className="w-full text-left rounded-xl p-4 transition-colors hover:bg-secondary/40"
                style={{ background: 'var(--card)', border: `1px solid ${t.unread > 0 ? RED + '55' : 'var(--border)'}` }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-black text-foreground">{t.athlete_name}</p>
                      {t.unread > 0 && (
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded" style={{ background: RED, color: '#fff' }}>
                          {t.unread} nova{t.unread > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                      <CalendarDays className="w-3 h-3" /> {t.workout_title}{t.workout_date ? ` · ${fmtDate(t.workout_date)}` : ''}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2">
                      {!t.last_from_athlete && <span className="font-bold text-foreground">Você: </span>}{t.last_body}
                    </p>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">{fmtWhen(t.last_at)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {open && <ThreadView thread={open} onClose={() => { setOpen(null); load() }} />}
    </div>
  )
}

function ThreadView({ thread, onClose }: { thread: InboxThread; onClose: () => void }) {
  const [items, setItems] = useState<WorkoutComment[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

  async function load() { setItems(await getWorkoutComments(thread.workout_id)); setLoading(false) }
  useEffect(() => { load() /* eslint-disable-next-line */ }, [thread.workout_id])

  async function send() {
    if (!text.trim()) return
    setSending(true)
    await addWorkoutComment(thread.workout_id, thread.athlete_id, text)
    setText(''); await load(); setSending(false)
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full max-w-lg shadow-2xl max-h-[88vh] flex flex-col safe-bottom">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground shrink-0"><ArrowLeft className="w-5 h-5" /></button>
          <div className="min-w-0">
            <h2 className="text-base font-black text-foreground truncate">{thread.athlete_name}</h2>
            <p className="text-[11px] text-muted-foreground truncate">{thread.workout_title}{thread.workout_date ? ` · ${fmtDate(thread.workout_date)}` : ''}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2.5 min-h-[180px]">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : items.map(c => {
            const staff = c.author_role === 'coach' || c.author_role === 'admin' || c.author_role === 'doctor'
            return (
              <div key={c.id} className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${staff ? 'ml-auto' : ''}`}
                style={staff ? { background: RED + '18', border: `1px solid ${RED}33` } : { background: 'var(--panel)', border: '1px solid var(--panel-border)' }}>
                <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: staff ? RED : 'var(--muted-foreground)' }}>
                  {staff ? 'Você' : (c.author_name ?? thread.athlete_name)}
                </p>
                <p className="text-sm text-foreground mt-0.5 whitespace-pre-line">{c.body}</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {new Date(c.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            )
          })}
        </div>

        <div className="flex items-center gap-2 px-5 py-4 border-t border-border">
          <input value={text} onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Responder…"
            className="flex-1 rounded-lg px-3 py-2.5 text-sm bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-[#e8001c]/40" />
          <button onClick={send} disabled={sending || !text.trim()}
            className="p-2.5 rounded-lg text-white disabled:opacity-50 shrink-0" style={{ background: RED }} aria-label="Enviar">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  )
}
