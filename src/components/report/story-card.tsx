'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { generateAiReport, type AiReportInput, type AiReport } from '@/lib/supabase/queries'
import { Sparkles, Loader2, Share2, Download, X, RefreshCw } from 'lucide-react'

const RED = '#e8001c'

export type StoryData = {
  athleteName: string
  sport: string
  dateLabel: string
  ctl: number | null
  atl: number | null
  tsb: number | null
  tsbLabel: string
  hrv: number | null
  sleep: number | null
  readiness: string | null
  readinessLabel: string | null
  tsbSpark: number[]
  ai: AiReportInput
}

const fmt = (v: number | null, dec = 0) => (v == null ? '—' : v.toFixed(dec))

/** Card de story (1080×1350) com os números reais + leitura da IA, para o WhatsApp. */
export function StoryCardModal({ data, onClose }: { data: StoryData; onClose: () => void }) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [ai, setAi] = useState<AiReport | null>(null)
  const [loadingAi, setLoadingAi] = useState(true)
  const [aiError, setAiError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  async function runAi() {
    setLoadingAi(true); setAiError(null)
    const res = await generateAiReport(data.ai)
    setLoadingAi(false)
    if (!res.ok || !res.report) { setAiError(res.error ?? 'Não foi possível gerar a análise.'); return }
    setAi(res.report)
  }
  useEffect(() => { runAi() /* eslint-disable-next-line */ }, [])

  async function toBlob(): Promise<Blob | null> {
    const el = cardRef.current
    if (!el) return null
    const html2canvas = (await import('html2canvas')).default
    const canvas = await html2canvas(el, { backgroundColor: '#0a0a0f', scale: 2, useCORS: true, logging: false, width: 540, height: 675 })
    return new Promise(resolve => canvas.toBlob(b => resolve(b), 'image/png'))
  }

  async function share() {
    setBusy(true)
    const blob = await toBlob()
    setBusy(false)
    if (!blob) return
    const file = new File([blob], `saab-${data.athleteName.split(' ')[0].toLowerCase()}.png`, { type: 'image/png' })
    const text = ai ? `${ai.titulo}\n\n${ai.resumo}\n\n${ai.recomendacao}` : `Relatório — ${data.athleteName}`
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Relatório SAAB', text }) } catch { /* cancelado */ }
      return
    }
    download(blob)
  }

  function download(blob?: Blob) {
    const go = (b: Blob) => {
      const url = URL.createObjectURL(b)
      const a = document.createElement('a')
      a.href = url; a.download = `saab-${data.athleteName.split(' ')[0].toLowerCase()}.png`; a.click()
      URL.revokeObjectURL(url)
    }
    if (blob) return go(blob)
    setBusy(true)
    toBlob().then(b => { setBusy(false); if (b) go(b) })
  }

  const firstName = data.athleteName.split(' ')[0]
  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-[85] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <div className="bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full max-w-[600px] shadow-2xl max-h-[95vh] flex flex-col safe-bottom">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-black text-foreground flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" /> Card para o WhatsApp
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div className="overflow-y-auto p-4">
          {/* Card renderizado em 540×675 (metade de 1080×1350) e exportado em 2× */}
          <div className="mx-auto" style={{ width: 540, maxWidth: '100%' }}>
            <div ref={cardRef} style={{
              width: 540, height: 675, position: 'relative', overflow: 'hidden',
              background: 'linear-gradient(160deg, #14141c 0%, #0a0a0f 55%, #1a0206 100%)',
              fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', color: '#fff',
            }}>
              {/* brilho de marca */}
              <div style={{ position: 'absolute', top: -170, right: -130, width: 420, height: 420, borderRadius: '50%', background: `radial-gradient(circle, ${RED}44 0%, transparent 68%)` }} />

              <div style={{ position: 'relative', padding: 34, height: '100%', display: 'flex', flexDirection: 'column' }}>
                {/* topo */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 11, letterSpacing: 2.5, fontWeight: 900, color: RED }}>SAAB SPORTS</p>
                    <p style={{ margin: '10px 0 0', fontSize: 31, fontWeight: 900, lineHeight: 1.05 }}>{firstName}</p>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: '#9aa0ae' }}>{data.sport} · {data.dateLabel}</p>
                  </div>
                  {data.readinessLabel && (
                    <span style={{
                      fontSize: 10, fontWeight: 900, letterSpacing: 1, padding: '7px 12px', borderRadius: 999,
                      background: (data.readiness === 'VERDE' ? '#00d084' : data.readiness === 'AMARELO' ? '#ffa800' : '#ef4444') + '26',
                      color: data.readiness === 'VERDE' ? '#00d084' : data.readiness === 'AMARELO' ? '#ffa800' : '#ef4444',
                    }}>{data.readinessLabel.toUpperCase()}</span>
                  )}
                </div>

                {/* título da IA */}
                <p style={{ margin: '26px 0 0', fontSize: 25, fontWeight: 900, lineHeight: 1.15, minHeight: 58 }}>
                  {ai?.titulo ?? (loadingAi ? 'Analisando a semana…' : 'Resumo da semana')}
                </p>

                {/* números */}
                <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                  {[
                    { k: 'CTL', v: fmt(data.ctl), c: '#0088ff', s: 'condicionamento' },
                    { k: 'ATL', v: fmt(data.atl), c: RED, s: 'fadiga' },
                    { k: 'TSB', v: (data.tsb ?? 0) > 0 ? `+${fmt(data.tsb)}` : fmt(data.tsb), c: (data.tsb ?? 0) >= 5 ? '#00d084' : (data.tsb ?? 0) >= -10 ? '#ffa800' : '#ef4444', s: data.tsbLabel },
                  ].map(m => (
                    <div key={m.k} style={{ flex: 1, background: '#ffffff0d', border: '1px solid #ffffff17', borderRadius: 15, padding: '13px 12px' }}>
                      <p style={{ margin: 0, fontSize: 9.5, fontWeight: 900, letterSpacing: 1.4, color: '#8b93a7' }}>{m.k}</p>
                      <p style={{ margin: '5px 0 0', fontSize: 29, fontWeight: 900, color: m.c, lineHeight: 1 }}>{m.v}</p>
                      <p style={{ margin: '4px 0 0', fontSize: 9.5, color: '#8b93a7' }}>{m.s}</p>
                    </div>
                  ))}
                </div>

                {/* tendência do TSB */}
                {data.tsbSpark.length > 1 && (
                  <div style={{ marginTop: 14, background: '#ffffff0a', border: '1px solid #ffffff14', borderRadius: 15, padding: '12px 14px' }}>
                    <p style={{ margin: '0 0 6px', fontSize: 9.5, fontWeight: 900, letterSpacing: 1.4, color: '#8b93a7' }}>TSB · 14 DIAS</p>
                    <Spark values={data.tsbSpark} />
                  </div>
                )}

                {/* destaques da IA */}
                <div style={{ marginTop: 16, flex: 1 }}>
                  {(ai?.destaques ?? []).slice(0, 3).map((d, i) => (
                    <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', marginBottom: 9 }}>
                      <span style={{ width: 6, height: 6, borderRadius: 999, background: RED, marginTop: 6, flexShrink: 0 }} />
                      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.4, color: '#e6e8ee' }}>{d}</p>
                    </div>
                  ))}
                  {!ai && !loadingAi && (
                    <div style={{ display: 'flex', gap: 18, marginTop: 4 }}>
                      {data.hrv != null && <Mini k="HRV" v={`${fmt(data.hrv)} ms`} />}
                      {data.sleep != null && <Mini k="Sono" v={`${fmt(data.sleep, 1)} h`} />}
                    </div>
                  )}
                </div>

                {/* recomendação */}
                {ai?.recomendacao && (
                  <div style={{ background: `${RED}1c`, border: `1px solid ${RED}44`, borderRadius: 15, padding: '13px 15px' }}>
                    <p style={{ margin: 0, fontSize: 9.5, fontWeight: 900, letterSpacing: 1.4, color: RED }}>PRÓXIMOS PASSOS</p>
                    <p style={{ margin: '5px 0 0', fontSize: 13, lineHeight: 1.42, color: '#f0f1f5' }}>{ai.recomendacao}</p>
                  </div>
                )}
                <p style={{ margin: '13px 0 0', fontSize: 9.5, color: '#6b7280', textAlign: 'center' }}>
                  SAAB Sports Performance · saabsports.com.br
                </p>
              </div>
            </div>
          </div>

          {/* estado da IA */}
          <div className="mt-3 max-w-[540px] mx-auto">
            {loadingAi && (
              <p className="text-xs text-muted-foreground flex items-center gap-2 justify-center">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> A IA está lendo os números da semana…
              </p>
            )}
            {aiError && (
              <div className="rounded-xl px-3.5 py-2.5" style={{ background: '#f59e0b18', border: '1px solid #f59e0b40' }}>
                <p className="text-xs font-semibold" style={{ color: '#b45309' }}>{aiError}</p>
                <p className="text-[11px] text-muted-foreground mt-1">O card continua válido com os números reais — só ficou sem o comentário da IA.</p>
                <button onClick={runAi} className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-bold text-primary hover:underline">
                  <RefreshCw className="w-3 h-3" /> Tentar de novo
                </button>
              </div>
            )}
            {ai && (
              <div className="rounded-xl px-3.5 py-2.5" style={{ background: 'var(--panel)', border: '1px solid var(--panel-border)' }}>
                <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Leitura da semana</p>
                <p className="text-xs text-foreground mt-1">{ai.resumo}</p>
                <button onClick={runAi} className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-bold text-primary hover:underline">
                  <RefreshCw className="w-3 h-3" /> Gerar outra versão
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 px-5 py-4 border-t border-border">
          <button onClick={() => download()} disabled={busy}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold text-muted-foreground border border-border hover:bg-secondary disabled:opacity-50">
            <Download className="w-4 h-4" /> Baixar
          </button>
          <button onClick={share} disabled={busy}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-black text-white disabled:opacity-60" style={{ background: RED }}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
            {busy ? 'Gerando imagem…' : 'Compartilhar'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function Mini({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <p style={{ margin: 0, fontSize: 9.5, fontWeight: 900, letterSpacing: 1.4, color: '#8b93a7' }}>{k}</p>
      <p style={{ margin: '3px 0 0', fontSize: 17, fontWeight: 900 }}>{v}</p>
    </div>
  )
}

function Spark({ values }: { values: number[] }) {
  const W = 462, H = 42
  const min = Math.min(...values), max = Math.max(...values)
  const span = max - min || 1
  const x = (i: number) => (i / Math.max(1, values.length - 1)) * W
  const y = (v: number) => H - 3 - ((v - min) / span) * (H - 6)
  const d = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const zeroY = min <= 0 && max >= 0 ? y(0) : null
  return (
    <svg width={W} height={H} style={{ display: 'block', maxWidth: '100%' }}>
      {zeroY != null && <line x1={0} y1={zeroY} x2={W} y2={zeroY} stroke="#ffffff22" strokeWidth="1" strokeDasharray="3 3" />}
      <path d={d} fill="none" stroke={RED} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r="3.5" fill={RED} />
    </svg>
  )
}
