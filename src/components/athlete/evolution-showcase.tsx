'use client'

import { useEffect, useMemo, useState } from 'react'
import { getActivitiesRange, type ActivityRow } from '@/lib/supabase/queries'
import {
  Loader2, TrendingUp, TrendingDown, Minus, Share2, Download,
  Route, Timer, Trophy, Zap, Flame, CheckCircle2,
} from 'lucide-react'

const SPORT: Record<string, { label: string; color: string }> = {
  running: { label: 'Corrida', color: '#ff6b00' }, cycling: { label: 'Ciclismo', color: '#0088ff' },
  swimming: { label: 'Natação', color: '#00b4d8' }, triathlon: { label: 'Triathlon', color: '#8b5cf6' },
  duathlon: { label: 'Duathlon', color: '#ffa800' }, strength: { label: 'Força', color: '#e8001c' },
  other: { label: 'Outro', color: '#64748b' },
}
const sInfo = (s: string) => SPORT[s] ?? SPORT.other

function startOfWeek(d: Date) { const x = new Date(d); const wd = (x.getDay() + 6) % 7; x.setDate(x.getDate() - wd); x.setHours(0, 0, 0, 0); return x }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x }
function fmtKm(m: number) { return (m / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) }
function fmtH(s: number) { const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60); return h > 0 ? `${h}h${m ? ` ${m}min` : ''}` : `${m}min` }
function fmtPace(secPerKm: number) { const m = Math.floor(secPerKm / 60), s = Math.round(secPerKm % 60); return `${m}:${String(s).padStart(2, '0')}/km` }

type Agg = { count: number; dist: number; time: number; tss: number }
function agg(list: ActivityRow[]): Agg {
  return list.reduce((a, x) => ({
    count: a.count + 1, dist: a.dist + (x.distance_meters ?? 0),
    time: a.time + (x.duration_seconds || 0), tss: a.tss + (x.tss ?? 0),
  }), { count: 0, dist: 0, time: 0, tss: 0 })
}
function delta(cur: number, prev: number) { return prev > 0 ? Math.round(((cur - prev) / prev) * 100) : (cur > 0 ? 100 : 0) }

const PERIODS: { key: 30 | 90 | 365; label: string; short: string }[] = [
  { key: 30, label: '30 dias', short: '30d' },
  { key: 90, label: '90 dias', short: '90d' },
  { key: 365, label: '12 meses', short: '12m' },
]

export function EvolutionShowcase({ athleteId, athleteName }: { athleteId: string; athleteName: string }) {
  const [acts, setActs] = useState<ActivityRow[] | null>(null)
  const [period, setPeriod] = useState<30 | 90 | 365>(90)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    (async () => {
      const to = new Date(); const from = addDays(to, -371)
      const rows = await getActivitiesRange(athleteId, from.toISOString(), to.toISOString())
      setActs(rows)
    })()
  }, [athleteId])

  const stats = useMemo(() => {
    if (!acts) return null
    const now = new Date()
    const sinceP = addDays(now, -period)
    const inPeriod = acts.filter(a => new Date(a.started_at) >= sinceP)
    const totals = agg(inPeriod)

    // Comparativo: esta semana (calendário, seg→hoje) x semana passada
    const tw = startOfWeek(now), lw = addDays(tw, -7)
    const thisWeek = agg(acts.filter(a => new Date(a.started_at) >= tw))
    const lastWeek = agg(acts.filter(a => { const d = new Date(a.started_at); return d >= lw && d < tw }))

    // Por modalidade (no período)
    const bySportMap: Record<string, Agg> = {}
    for (const a of inPeriod) { (bySportMap[a.sport] ??= { count: 0, dist: 0, time: 0, tss: 0 }); const s = bySportMap[a.sport]; s.count++; s.dist += a.distance_meters ?? 0; s.time += a.duration_seconds || 0; s.tss += a.tss ?? 0 }
    const bySport = Object.entries(bySportMap).map(([sport, v]) => ({ sport, ...v })).sort((x, y) => y.time - x.time)

    // Recordes (últimos 12 meses)
    const runs = acts.filter(a => a.sport === 'running' && (a.distance_meters ?? 0) >= 1000)
    let bestPace: { pace: number; act: ActivityRow } | null = null
    for (const r of runs) { const pace = (r.duration_seconds || 0) / ((r.distance_meters ?? 0) / 1000); if (pace > 0 && (!bestPace || pace < bestPace.pace)) bestPace = { pace, act: r } }
    const longest = acts.reduce<ActivityRow | null>((b, a) => ((a.distance_meters ?? 0) > (b?.distance_meters ?? 0) ? a : b), null)
    const longestTime = acts.reduce<ActivityRow | null>((b, a) => ((a.duration_seconds || 0) > (b?.duration_seconds ?? 0) ? a : b), null)
    const bigTss = acts.reduce<ActivityRow | null>((b, a) => ((a.tss ?? 0) > (b?.tss ?? 0) ? a : b), null)

    // Tendência: TSS por semana (últimas 12 semanas) + semana mais forte
    const weeks = Array.from({ length: 12 }, (_, i) => startOfWeek(addDays(tw, -7 * (11 - i))))
    const weekTss = weeks.map(ws => { const we = addDays(ws, 7); return acts.filter(a => { const d = new Date(a.started_at); return d >= ws && d < we }).reduce((s, a) => s + (a.tss ?? 0), 0) })
    const bestWeek = Math.max(0, ...weekTss)

    // Sequência: semanas seguidas com ≥1 treino (terminando nesta ou na semana passada)
    let streak = 0
    for (let i = 0; i < 52; i++) {
      const ws = startOfWeek(addDays(tw, -7 * i)), we = addDays(ws, 7)
      const has = acts.some(a => { const d = new Date(a.started_at); return d >= ws && d < we })
      if (has) streak++
      else if (i === 0) continue // semana atual ainda pode estar vazia
      else break
    }

    return { totals, thisWeek, lastWeek, bySport, bestPace, longest, longestTime, bigTss, weekTss, bestWeek, streak }
  }, [acts, period])

  const periodLabel = PERIODS.find(p => p.key === period)!.label

  function shareText() {
    if (!stats) return ''
    const t = stats.totals
    return `Minha evolução (${periodLabel}): ${t.count} treinos · ${fmtKm(t.dist)} km · ${fmtH(t.time)} · ${Math.round(t.tss)} TSS — via SAAB Sports 🚀`
  }
  async function share() {
    const text = shareText()
    try {
      if (typeof navigator !== 'undefined' && navigator.share) await navigator.share({ title: 'Minha evolução', text })
      else { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }
    } catch { /* cancelado */ }
  }
  function downloadImage() {
    if (!stats) return
    const t = stats.totals
    const c = document.createElement('canvas'); c.width = 1080; c.height = 1350
    const ctx = c.getContext('2d'); if (!ctx) return
    const g = ctx.createLinearGradient(0, 0, 0, 1350); g.addColorStop(0, '#0b0b14'); g.addColorStop(1, '#1c0410')
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1350)
    ctx.fillStyle = '#e8001c'; ctx.fillRect(0, 0, 1080, 14)
    ctx.textAlign = 'center'
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 58px sans-serif'; ctx.fillText(athleteName, 540, 180)
    ctx.fillStyle = '#e8001c'; ctx.font = 'bold 30px sans-serif'; ctx.fillText('MINHA EVOLUÇÃO · ' + periodLabel.toUpperCase(), 540, 232)
    const rows: [string, string][] = [
      ['TREINOS', String(t.count)], ['DISTÂNCIA', fmtKm(t.dist) + ' km'],
      ['TEMPO', fmtH(t.time)], ['CARGA (TSS)', String(Math.round(t.tss))],
    ]
    let y = 420
    for (const [label, val] of rows) {
      ctx.fillStyle = '#7a8aa0'; ctx.font = '600 32px sans-serif'; ctx.fillText(label, 540, y)
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 96px sans-serif'; ctx.fillText(val, 540, y + 98); y += 218
    }
    ctx.fillStyle = '#8a9ab0'; ctx.font = 'bold 30px sans-serif'; ctx.fillText('SAAB SPORTS · PERFORMANCE PLATFORM', 540, 1300)
    c.toBlob(b => { if (!b) return; const url = URL.createObjectURL(b); const a = document.createElement('a'); a.href = url; a.download = 'minha-evolucao.png'; a.click(); URL.revokeObjectURL(url) })
  }

  if (!acts) return <div className="flex items-center justify-center py-14 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /></div>
  if (!stats || acts.length === 0) {
    return <div className="bg-card border border-border rounded-2xl p-8 text-center">
      <Trophy className="w-9 h-9 text-muted-foreground/40 mx-auto mb-3" />
      <p className="text-sm font-semibold text-foreground">Sua evolução aparece aqui</p>
      <p className="text-xs text-muted-foreground mt-1">Assim que houver treinos importados, você vê seus números, recordes e um card pra postar.</p>
    </div>
  }

  const maxWeek = Math.max(1, ...stats.weekTss)

  return (
    <div className="space-y-4">
      {/* Cabeçalho + período */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-base font-black text-foreground flex items-center gap-2"><TrendingUp className="w-5 h-5 text-primary" /> Sua evolução</h2>
        <div className="flex gap-0.5 p-0.5 rounded-lg bg-background border border-border">
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)} className="px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors"
              style={period === p.key ? { background: '#e8001c', color: '#fff' } : { color: 'var(--muted-foreground)' }}>{p.short}</button>
          ))}
        </div>
      </div>

      {/* Card compartilhável */}
      <div className="rounded-2xl p-5 relative overflow-hidden" style={{ background: 'linear-gradient(135deg,#12121c 0%,#26060f 100%)', border: '1px solid #e8001c33' }}>
        <div className="absolute top-0 left-0 right-0 h-1" style={{ background: '#e8001c' }} />
        <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#e8001c' }}>Minha evolução · {periodLabel}</p>
        <p className="text-lg font-black text-white mt-0.5">{athleteName}</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          {[
            { label: 'Treinos', value: String(stats.totals.count), icon: CheckCircle2 },
            { label: 'Distância', value: `${fmtKm(stats.totals.dist)} km`, icon: Route },
            { label: 'Tempo', value: fmtH(stats.totals.time), icon: Timer },
            { label: 'Carga (TSS)', value: String(Math.round(stats.totals.tss)), icon: Zap },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label}>
              <Icon className="w-4 h-4 mb-1" style={{ color: '#e8001c' }} />
              <p className="text-2xl font-black text-white leading-none">{value}</p>
              <p className="text-[10px] uppercase tracking-wider mt-1" style={{ color: '#8a9ab0' }}>{label}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={share} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-white" style={{ background: '#e8001c' }}>
            <Share2 className="w-3.5 h-3.5" /> {copied ? 'Copiado!' : 'Compartilhar'}
          </button>
          <button onClick={downloadImage} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-white" style={{ background: '#ffffff1a', border: '1px solid #ffffff33' }}>
            <Download className="w-3.5 h-3.5" /> Baixar imagem
          </button>
        </div>
      </div>

      {/* Comparativo semana x semana */}
      <div>
        <p className="text-[11px] font-black text-muted-foreground uppercase tracking-wider mb-2">Esta semana vs. semana passada</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Treinos', cur: stats.thisWeek.count, prev: stats.lastWeek.count, fmt: (n: number) => String(n) },
            { label: 'Distância', cur: stats.thisWeek.dist, prev: stats.lastWeek.dist, fmt: (n: number) => `${fmtKm(n)} km` },
            { label: 'Tempo', cur: stats.thisWeek.time, prev: stats.lastWeek.time, fmt: (n: number) => fmtH(n) },
            { label: 'TSS', cur: stats.thisWeek.tss, prev: stats.lastWeek.tss, fmt: (n: number) => String(Math.round(n)) },
          ].map(({ label, cur, prev, fmt }) => {
            const d = delta(cur, prev)
            const up = d > 0, down = d < 0
            const DIcon = up ? TrendingUp : down ? TrendingDown : Minus
            const color = up ? '#00d084' : down ? '#ef4444' : '#8a9ab0'
            return (
              <div key={label} className="rounded-xl p-3" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
                <p className="text-base font-black text-foreground mt-0.5">{fmt(cur)}</p>
                <p className="text-[10px] font-bold flex items-center gap-0.5 mt-0.5" style={{ color }}>
                  <DIcon className="w-3 h-3" />{d > 0 ? '+' : ''}{d}%
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Recordes */}
      <div>
        <p className="text-[11px] font-black text-muted-foreground uppercase tracking-wider mb-2">Recordes (12 meses)</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            stats.longest && (stats.longest.distance_meters ?? 0) > 0 ? { icon: Route, label: 'Maior distância', value: `${fmtKm(stats.longest.distance_meters ?? 0)} km`, sub: sInfo(stats.longest.sport).label, color: '#0088ff' } : null,
            stats.longestTime ? { icon: Timer, label: 'Maior duração', value: fmtH(stats.longestTime.duration_seconds || 0), sub: sInfo(stats.longestTime.sport).label, color: '#8b5cf6' } : null,
            stats.bestPace ? { icon: Flame, label: 'Melhor pace', value: fmtPace(stats.bestPace.pace), sub: 'Corrida', color: '#ff6b00' } : null,
            stats.bestWeek > 0 ? { icon: Trophy, label: 'Semana mais forte', value: `${Math.round(stats.bestWeek)} TSS`, sub: 'em 12 semanas', color: '#ffa800' } : null,
            stats.bigTss && (stats.bigTss.tss ?? 0) > 0 ? { icon: Zap, label: 'Treino mais duro', value: `${Math.round(stats.bigTss.tss ?? 0)} TSS`, sub: sInfo(stats.bigTss.sport).label, color: '#e8001c' } : null,
            { icon: CheckCircle2, label: 'Sequência', value: `${stats.streak} sem`, sub: 'semanas seguidas', color: '#00d084' },
          ].filter(Boolean).map((r, i) => {
            const rec = r as { icon: typeof Route; label: string; value: string; sub: string; color: string }
            return (
              <div key={i} className="rounded-xl p-3 flex items-center gap-3" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: rec.color + '18' }}>
                  <rec.icon className="w-4 h-4" style={{ color: rec.color }} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-black text-foreground leading-tight">{rec.value}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{rec.label} · {rec.sub}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Por modalidade */}
      {stats.bySport.length > 0 && (
        <div>
          <p className="text-[11px] font-black text-muted-foreground uppercase tracking-wider mb-2">Por modalidade · {periodLabel}</p>
          <div className="rounded-2xl p-4 space-y-3" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            {stats.bySport.map(s => {
              const info = sInfo(s.sport)
              const maxTime = Math.max(1, ...stats.bySport.map(x => x.time))
              return (
                <div key={s.sport}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-bold text-foreground flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: info.color }} />{info.label}</span>
                    <span className="text-muted-foreground">{s.count} treino{s.count !== 1 ? 's' : ''} · {fmtH(s.time)}{s.dist > 0 ? ` · ${fmtKm(s.dist)} km` : ''}</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--panel-border)' }}>
                    <div className="h-full rounded-full" style={{ width: `${(s.time / maxTime) * 100}%`, background: info.color }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Tendência de carga (12 semanas) */}
      <div>
        <p className="text-[11px] font-black text-muted-foreground uppercase tracking-wider mb-2">Carga por semana (12 semanas)</p>
        <div className="rounded-2xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="flex items-end gap-1 h-28">
            {stats.weekTss.map((t, i) => (
              <div key={i} className="flex-1 flex flex-col justify-end" title={`${Math.round(t)} TSS`}>
                <div className="rounded-t" style={{ height: `${(t / maxWeek) * 100}%`, minHeight: t > 0 ? 4 : 0, background: i === stats.weekTss.length - 1 ? '#e8001c' : '#0088ff' }} />
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-[9px] text-muted-foreground"><span>12 sem atrás</span><span>esta semana</span></div>
        </div>
      </div>
    </div>
  )
}
