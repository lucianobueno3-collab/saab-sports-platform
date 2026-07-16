'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { portalGetAthlete, portalGetCheckins, portalSubmitCheckin, type PortalAthlete, type CheckinRow } from '@/lib/supabase/queries'
import { Activity, Heart, Moon, Battery, TrendingUp, Loader2, CheckCircle2, Dumbbell } from 'lucide-react'

function sportLabel(s: string) {
  const map: Record<string, string> = { running: 'Corrida', cycling: 'Ciclismo', triathlon: 'Triathlon', swimming: 'Natação', duathlon: 'Duathlon', other: 'Outro' }
  return map[s] ?? s
}

function fmtDate(d: string) {
  return new Date(d + (d.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('pt-BR')
}

function fmtDuration(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m}min`
}

/** Slider 0–10 com rótulo e cor conforme o valor */
function ScaleInput({ label, value, onChange, hint, invert }: {
  label: string; value: number; onChange: (v: number) => void; hint?: string; invert?: boolean
}) {
  // invert: valores altos são ruins (dor, esforço). senão altos são bons (sono, humor)
  const good = invert ? value <= 3 : value >= 7
  const bad = invert ? value >= 7 : value <= 3
  const color = good ? '#4ade80' : bad ? '#ef4444' : '#fbbf24'
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-sm font-medium text-foreground">{label}</label>
        <span className="text-lg font-black tabular-nums" style={{ color }}>{value}</span>
      </div>
      <input type="range" min={0} max={10} value={value} onChange={e => onChange(parseInt(e.target.value))}
        className="w-full accent-primary" style={{ accentColor: color }} />
      {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  )
}

function PortalContent() {
  const params = useSearchParams()
  const token = params.get('token')

  const [athlete, setAthlete] = useState<PortalAthlete | null>(null)
  const [checkins, setCheckins] = useState<CheckinRow[]>([])
  const [loading, setLoading] = useState(true)
  const [invalid, setInvalid] = useState(false)

  const [rpe, setRpe] = useState(5)
  const [soreness, setSoreness] = useState(3)
  const [sleepQ, setSleepQ] = useState(7)
  const [mood, setMood] = useState(7)
  const [painLoc, setPainLoc] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!token) { setInvalid(true); setLoading(false); return }
    Promise.all([portalGetAthlete(token), portalGetCheckins(token)]).then(([a, c]) => {
      if (!a) setInvalid(true)
      else { setAthlete(a); setCheckins(c) }
      setLoading(false)
    })
  }, [token])

  async function submit() {
    if (!token) return
    setSubmitting(true)
    const ok = await portalSubmitCheckin(token, {
      rpe, soreness, sleep_quality: sleepQ, mood,
      pain_location: painLoc.trim() || null, notes: notes.trim() || null,
    })
    setSubmitting(false)
    if (ok) {
      setSubmitted(true)
      setPainLoc(''); setNotes('')
      const c = await portalGetCheckins(token)
      setCheckins(c)
      setTimeout(() => setSubmitted(false), 3000)
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center gap-2 text-muted-foreground">
      <Loader2 className="w-5 h-5 animate-spin" /> <span className="text-sm">Carregando...</span>
    </div>
  )

  if (invalid || !athlete) return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <Dumbbell className="w-10 h-10 text-muted-foreground/40 mb-3" />
      <p className="text-sm font-semibold text-foreground">Link inválido ou expirado</p>
      <p className="text-xs text-muted-foreground mt-1">Peça um novo link de acesso ao seu treinador.</p>
    </div>
  )

  const m = athlete.metrics
  const tsb = m?.tsb ?? null
  const formColor = tsb == null ? '#888' : tsb >= 5 ? '#4ade80' : tsb >= -10 ? '#fbbf24' : '#ef4444'
  const formLabel = tsb == null ? '—' : tsb >= 5 ? 'Descansado' : tsb >= -10 ? 'Equilibrado' : 'Fadigado'

  return (
    <div className="min-h-screen max-w-lg mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <header className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-sm font-bold text-primary">
          {athlete.full_name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()}
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground leading-tight">{athlete.full_name}</h1>
          <p className="text-xs text-muted-foreground">{sportLabel(athlete.primary_sport)} · Portal do Atleta</p>
        </div>
      </header>

      {/* Forma / prontidão */}
      <div className="rounded-2xl p-4" style={{ background: formColor + '14', border: `1px solid ${formColor}33` }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: formColor }}>Forma atual</p>
            <p className="text-2xl font-black text-foreground mt-0.5">{formLabel}</p>
          </div>
          <TrendingUp className="w-8 h-8" style={{ color: formColor }} />
        </div>
      </div>

      {/* Métricas */}
      {m && (
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: TrendingUp, label: 'Fitness (CTL)', value: m.ctl?.toFixed(0) ?? '—', color: '#0088ff' },
            { icon: Activity, label: 'Fadiga (ATL)', value: m.atl?.toFixed(0) ?? '—', color: '#e8001c' },
            { icon: Heart, label: 'HRV', value: m.hrv_ms != null ? `${m.hrv_ms.toFixed(0)}ms` : '—', color: '#00d084' },
            { icon: Battery, label: 'Body Battery', value: m.body_battery?.toFixed(0) ?? '—', color: '#8b5cf6' },
            { icon: Moon, label: 'Sono', value: m.sleep_hours != null ? `${m.sleep_hours.toFixed(1)}h` : '—', color: '#60a5fa' },
            { icon: Heart, label: 'FC Repouso', value: m.resting_hr != null ? `${m.resting_hr.toFixed(0)}` : '—', color: '#f97316' },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-3">
              <Icon className="w-4 h-4 mb-1.5" style={{ color }} />
              <p className="text-lg font-black text-foreground">{value}</p>
              <p className="text-[10px] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Check-in do dia */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h2 className="text-sm font-bold text-foreground mb-1">Como você está hoje?</h2>
        <p className="text-xs text-muted-foreground mb-4">Seu check-in ajuda o treinador a ajustar seus treinos.</p>
        <div className="space-y-4">
          <ScaleInput label="Esforço do último treino (RPE)" value={rpe} onChange={setRpe} invert
            hint="0 = muito leve · 10 = máximo" />
          <ScaleInput label="Dor muscular" value={soreness} onChange={setSoreness} invert
            hint="0 = nenhuma · 10 = muito dolorido" />
          <ScaleInput label="Qualidade do sono" value={sleepQ} onChange={setSleepQ}
            hint="0 = péssimo · 10 = excelente" />
          <ScaleInput label="Humor / energia" value={mood} onChange={setMood}
            hint="0 = exausto · 10 = ótimo" />
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Local de dor (opcional)</label>
            <input value={painLoc} onChange={e => setPainLoc(e.target.value)}
              placeholder="ex: joelho direito, lombar"
              className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Observações (opcional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Como se sentiu, algo diferente..."
              className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none" />
          </div>
          <button onClick={submit} disabled={submitting || submitted}
            className="w-full py-3 rounded-xl text-sm font-bold text-white transition-colors flex items-center justify-center gap-2"
            style={{ background: submitted ? '#4ade80' : 'var(--primary)' }}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" />
              : submitted ? <><CheckCircle2 className="w-4 h-4" /> Enviado! Obrigado</>
              : 'Enviar check-in de hoje'}
          </button>
        </div>
      </div>

      {/* Treinos recentes */}
      {athlete.activities.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <h2 className="text-sm font-bold text-foreground mb-3">Treinos recentes</h2>
          <div className="space-y-2">
            {athlete.activities.map((a, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <Dumbbell className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{a.name ?? sportLabel(a.sport)}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {fmtDate(a.started_at.slice(0, 10))} · {fmtDuration(a.duration_seconds)}
                    {a.distance_meters ? ` · ${(a.distance_meters / 1000).toFixed(1)}km` : ''}
                  </p>
                </div>
                {a.tss != null && <span className="text-xs font-bold text-[#ffa800]">{a.tss.toFixed(0)} TSS</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Histórico de check-ins */}
      {checkins.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <h2 className="text-sm font-bold text-foreground mb-3">Seus check-ins</h2>
          <div className="space-y-2">
            {checkins.slice(0, 7).map((c, i) => (
              <div key={i} className="flex items-center gap-2 text-xs py-1.5 border-b border-border/30 last:border-0">
                <span className="text-muted-foreground w-16 flex-shrink-0">{fmtDate(c.checkin_date)}</span>
                <span className="flex gap-2 flex-wrap flex-1">
                  {c.rpe != null && <span className="text-muted-foreground">RPE {c.rpe}</span>}
                  {c.soreness != null && <span className="text-muted-foreground">Dor {c.soreness}</span>}
                  {c.sleep_quality != null && <span className="text-muted-foreground">Sono {c.sleep_quality}</span>}
                  {c.mood != null && <span className="text-muted-foreground">Humor {c.mood}</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-center text-[10px] text-muted-foreground/60 pt-2">Saab Sports Performance Platform</p>
    </div>
  )
}

export default function PortalPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" /> <span className="text-sm">Carregando...</span>
      </div>
    }>
      <PortalContent />
    </Suspense>
  )
}
