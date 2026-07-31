'use client'

import { useEffect, useState } from 'react'
import { getStravaStatus, startStravaConnect, syncStrava, type StravaStatus } from '@/lib/supabase/queries'
import { RefreshCw, Loader2, Link2, CheckCircle2 } from 'lucide-react'

const STRAVA = '#fc4c02'

function fmtWhen(iso: string | null) {
  if (!iso) return 'nunca'
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000)
  if (h < 1) return 'agora há pouco'
  if (h < 24) return `${h}h atrás`
  const d = Math.floor(h / 24)
  return d === 1 ? 'ontem' : `${d} dias atrás`
}

/** Conexão com o Strava: o aluno autoriza uma vez e as atividades entram sozinhas. */
export function StravaCard({ athleteId, onSynced }: { athleteId: string; onSynced?: () => void }) {
  const [status, setStatus] = useState<StravaStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null)

  async function load() { setStatus(await getStravaStatus(athleteId)) }
  useEffect(() => {
    load()
    // Retorno do fluxo de autorização (?strava=ok | cancelado | erro)
    const p = new URLSearchParams(window.location.search)
    const r = p.get('strava')
    if (r === 'ok') setMsg({ t: 'Strava conectado! Toque em Sincronizar para trazer suas atividades.', ok: true })
    else if (r === 'cancelado') setMsg({ t: 'Conexão cancelada.', ok: false })
    else if (r === 'erro') setMsg({ t: p.get('msg') ?? 'Não foi possível conectar ao Strava.', ok: false })
    if (r) window.history.replaceState({}, '', window.location.pathname)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [athleteId])

  async function connect() {
    setBusy(true); setMsg(null)
    const res = await startStravaConnect()
    setBusy(false)
    if (!res.ok || !res.url) { setMsg({ t: res.error ?? 'Não foi possível iniciar a conexão.', ok: false }); return }
    window.location.href = res.url
  }

  async function sync() {
    setBusy(true); setMsg(null)
    const res = await syncStrava()
    setBusy(false)
    if (!res.ok) { setMsg({ t: res.error ?? 'Falha ao sincronizar.', ok: false }); return }
    setMsg({
      t: res.imported ? `${res.imported} atividade${res.imported > 1 ? 's' : ''} importada${res.imported > 1 ? 's' : ''}.` : 'Tudo em dia — nenhuma atividade nova.',
      ok: true,
    })
    load(); onSynced?.()
  }

  if (!status) return null

  return (
    <div className="rounded-2xl p-4" style={{ background: 'var(--card)', border: `1px solid ${status.connected ? STRAVA + '55' : 'var(--border)'}` }}>
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white font-black text-xs" style={{ background: STRAVA }}>
          ST
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-foreground flex items-center gap-1.5">
            Strava
            {status.connected && <CheckCircle2 className="w-3.5 h-3.5" style={{ color: '#00d084' }} />}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {status.connected
              ? `Conectado · última sincronização ${fmtWhen(status.lastSyncAt)}`
              : 'Conecte e seus treinos entram no app automaticamente'}
          </p>
        </div>
        <button onClick={status.connected ? sync : connect} disabled={busy}
          className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-black text-white disabled:opacity-60"
          style={{ background: STRAVA }}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" />
            : status.connected ? <RefreshCw className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
          {busy ? '...' : status.connected ? 'Sincronizar' : 'Conectar'}
        </button>
      </div>
      {msg && (
        <p className="text-[11px] font-semibold mt-2.5 rounded-lg px-2.5 py-1.5"
          style={{ background: msg.ok ? '#00d08418' : '#ef444418', color: msg.ok ? '#00d084' : '#ef4444' }}>{msg.t}</p>
      )}
    </div>
  )
}
