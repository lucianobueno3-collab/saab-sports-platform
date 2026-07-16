'use client'

import { useEffect, useState } from 'react'
import { Topbar } from '@/components/layout/topbar'
import { MessageCircle, RefreshCw, AlertTriangle, CheckCircle, Clock, Zap, Moon, Heart, Activity, ChevronRight, Info, Database, Cpu, CalendarClock, Settings, Dumbbell } from 'lucide-react'
import Link from 'next/link'
import { getAthletesForAlerts, getCoachProfile, type AthleteAlertRow } from '@/lib/supabase/queries'
import { trainingGap, trainingGapLabel, type TrainingGap } from '@/lib/training-gap'
import { useAutoRefresh } from '@/lib/use-auto-refresh'
import { trainingReadiness, stopProtocol, type DailyMetrics } from '@/lib/readiness'
import { THRESHOLDS } from '@/lib/thresholds'

const T = THRESHOLDS

function sportLabel(s: string) {
  const m: Record<string, string> = { running: 'Corrida', cycling: 'Ciclismo', triathlon: 'Triathlon', swimming: 'Natação', duathlon: 'Duathlon', other: 'Outro' }
  return m[s] ?? s
}

type AlertSeverity = 'critical' | 'warning' | 'ok' | 'nodata'

type AthleteAlert = {
  athlete: AthleteAlertRow
  severity: AlertSeverity
  readinessLevel: string
  triggers: string[]
  stopSignals: string[]
  clinicalFlag: boolean
  whatsappMessage: string
  syncDaysAgo: number | null
  gap: TrainingGap
}

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null
  const diff = Date.now() - new Date(dateStr).getTime()
  return Math.floor(diff / 86400000)
}

function toMetrics(r: AthleteAlertRow): DailyMetrics {
  return {
    date: r.latest_date ?? '',
    hrv_ms: r.hrv_ms,
    resting_hr_bpm: r.resting_hr,
    body_battery: r.body_battery,
    stress_avg: r.stress_avg,
    sleep_hours: r.sleep_hours,
    rem_pct: r.rem_pct,
    rem_sleep_hours: null, deep_sleep_hours: null, light_sleep_hours: null, weight_kg: null,
  }
}

function buildAlert(a: AthleteAlertRow): AthleteAlert {
  const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const syncDaysAgo = daysSince(a.latest_date)
  const hasData = a.latest_date !== null && (syncDaysAgo ?? 99) <= 2
  const gap = trainingGap(a.last_activity_at)

  if (!hasData) {
    return {
      athlete: a, severity: 'nodata', readinessLevel: 'NODATA',
      triggers: ['Sem dados de recuperação nos últimos 2 dias', ...(gap.flagged ? [trainingGapLabel(gap)] : [])],
      stopSignals: [], clinicalFlag: false, syncDaysAgo, gap,
      whatsappMessage: `Oi ${a.full_name.split(' ')[0]}! 👋\n\nNão estou conseguindo ver seus dados de recuperação.\n\n_Poderia sincronizar o Garmin Connect hoje?_\n\n_SAAB Sports_`,
    }
  }

  const m = toMetrics(a)
  const readiness = trainingReadiness(m)

  // Build specific trigger list
  const triggers: string[] = []
  if (a.body_battery != null && a.body_battery < T.bodyBattery.safety_floor)
    triggers.push(`Body Battery ${a.body_battery.toFixed(0)} — abaixo do piso crítico (${T.bodyBattery.safety_floor})`)
  else if (a.body_battery != null && a.body_battery < T.bodyBattery.exhaustion_max)
    triggers.push(`Body Battery ${a.body_battery.toFixed(0)} — zona de exaustão (meta >${T.bodyBattery.target_min})`)
  if (a.sleep_hours != null && a.sleep_hours < T.sleep.min_safe_hours)
    triggers.push(`Sono ${a.sleep_hours.toFixed(1)}h — abaixo do mínimo de segurança (${T.sleep.min_safe_hours}h)`)
  else if (a.sleep_hours != null && a.sleep_hours < T.sleep.injury_risk_below)
    triggers.push(`Sono ${a.sleep_hours.toFixed(1)}h — risco de lesão (meta ≥${T.sleep.injury_risk_below}h)`)
  if (a.hrv_ms != null && a.hrv_ms < T.hrv.yellow_min)
    triggers.push(`HRV ${a.hrv_ms.toFixed(0)}ms — zona vermelha (meta ≥${T.hrv.green_min}ms)`)
  else if (a.hrv_ms != null && a.hrv_ms < T.hrv.green_min)
    triggers.push(`HRV ${a.hrv_ms.toFixed(0)}ms — zona amarela (meta ≥${T.hrv.green_min}ms)`)
  if (a.stress_avg != null && a.stress_avg > T.stress.blocks_deep_sleep_above)
    triggers.push(`Stress ${a.stress_avg.toFixed(0)} — bloqueia sono profundo (meta <${T.stress.target_max})`)
  if (a.resting_hr != null && a.resting_hr >= T.rhr.clinical_bpm)
    triggers.push(`FC repouso ${a.resting_hr.toFixed(0)}bpm — sinal clínico (≥${T.rhr.clinical_bpm})`)
  else if (a.resting_hr != null && a.resting_hr >= T.rhr.warning_bpm)
    triggers.push(`FC repouso ${a.resting_hr.toFixed(0)}bpm — atenção (≥${T.rhr.warning_bpm})`)

  // Stop protocol on week history
  const weekDM: DailyMetrics[] = a.week_metrics.map(r => ({
    date: r.date, hrv_ms: r.hrv_ms, resting_hr_bpm: r.resting_hr,
    body_battery: r.body_battery, sleep_hours: r.sleep_hours,
    stress_avg: null, rem_pct: null, rem_sleep_hours: null, deep_sleep_hours: null, light_sleep_hours: null, weight_kg: null,
  }))
  const stop = stopProtocol(weekDM)

  // Sem treino nas últimas 48h: sinaliza para o treinador e nunca deixa o card como "OK"
  if (gap.flagged) triggers.push(trainingGapLabel(gap))

  const severity: AlertSeverity =
    readiness.level === 'VALVULA' || readiness.level === 'VERMELHO' || stop.abort ? 'critical'
    : readiness.level === 'AMARELO' || gap.flagged ? 'warning'
    : 'ok'

  // Build personalized WhatsApp message
  const name = a.full_name.split(' ')[0]
  let msg = ''
  if (readiness.level === 'VALVULA') {
    msg = `Oi ${name}! 🔴\n\n*Relatório de Recuperação — ${today}*\n\nO sistema identificou que hoje você *não deve treinar*.\n\n`
    msg += `*Indicadores críticos:*\n${triggers.map(t => `• ${t}`).join('\n')}\n\n`
    msg += `*Plano para hoje:*\n• Apenas recuperação ativa (caminhada leve, alongamento)\n• Prioridade máxima: sono ≥ 7h esta noite\n• Hidratação e alimentação anti-inflamatória\n\n`
    msg += `_Você é um atleta de elite. Descanso estratégico é parte do treino._\n\n_SAAB Sports_`
  } else if (readiness.level === 'VERMELHO') {
    msg = `Oi ${name}! 🔴\n\n*Relatório de Recuperação — ${today}*\n\nSeu sistema nervoso autônomo está em zona vermelha.\n\n`
    msg += `*HRV:* ${a.hrv_ms?.toFixed(0) ?? '—'}ms (zona vermelha)\n`
    if (triggers.length > 1) msg += `*Outros sinais:*\n${triggers.slice(1).map(t => `• ${t}`).join('\n')}\n\n`
    msg += `*Recomendação:* Cancelar o treino de hoje. Sono e recuperação são a prioridade.\n\n_SAAB Sports_`
  } else if (readiness.level === 'AMARELO') {
    msg = `Oi ${name}! 🟡\n\n*Relatório de Recuperação — ${today}*\n\nSeu corpo está pedindo um treino adaptado.\n\n`
    msg += `*Indicadores:*\n${triggers.map(t => `• ${t}`).join('\n')}\n\n`
    msg += `*Plano adaptado:*\n• Reduzir volume 30–40%\n• Foco aeróbico leve — sem intensidade\n• Cuidado redobrado com o sono esta noite\n\n_SAAB Sports_`
  } else {
    msg = `Oi ${name}! 🟢\n\n*Relatório de Recuperação — ${today}*\n\nTudo certo! Você está em ótima forma para treinar hoje.\n\n`
    if (a.hrv_ms) msg += `• HRV: ${a.hrv_ms.toFixed(0)}ms ✅\n`
    if (a.body_battery) msg += `• Body Battery: ${a.body_battery.toFixed(0)} ✅\n`
    if (a.sleep_hours) msg += `• Sono: ${a.sleep_hours.toFixed(1)}h ✅\n`
    msg += `\n_Bora treinar! 💪_\n\n_SAAB Sports_`
  }

  if (stop.abort) {
    msg += `\n\n⚠️ *PROTOCOLO DE PARADA ATIVADO*\n${stop.signals.map(s => `• ${s}`).join('\n')}`
  }

  return {
    athlete: a, severity, readinessLevel: readiness.level,
    triggers: triggers.length ? triggers : ['Dados dentro dos parâmetros'],
    stopSignals: stop.signals, clinicalFlag: stop.clinicalFlag,
    syncDaysAgo, gap, whatsappMessage: msg,
  }
}

function severityOrder(s: AlertSeverity) {
  return s === 'critical' ? 0 : s === 'warning' ? 1 : s === 'nodata' ? 2 : 3
}

const SEVERITY_CONFIG = {
  critical: { color: '#e8001c', bg: '#e8001c0f', border: '#e8001c38', badge: 'CRÍTICO', label: 'Crítico' },
  warning:  { color: '#ffa800', bg: '#ffa8000f', border: '#ffa80038', badge: 'ATENÇÃO', label: 'Atenção' },
  ok:       { color: '#00d084', bg: '#00d0840f', border: '#00d08438', badge: 'OK',      label: 'OK' },
  nodata:   { color: 'var(--muted-foreground)', bg: 'var(--secondary)', border: 'var(--border)', badge: 'SEM DADOS', label: 'Sem dados' },
}

type Filter = 'all' | 'critical' | 'warning' | 'ok' | 'nodata' | 'notraining'

function AlertCard({ alert, onWhatsApp }: { alert: AthleteAlert; onWhatsApp: () => void }) {
  const cfg = SEVERITY_CONFIG[alert.severity]
  const a = alert.athlete
  const tsb = a.tsb ?? 0
  const tsbColor = tsb >= 5 ? '#00d084' : tsb >= -10 ? '#ffa800' : '#e8001c'

  return (
    <div className="rounded-xl overflow-hidden transition-all hover:shadow-lg hover:shadow-black/40"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
      {/* Top bar */}
      <div className="h-0.5 w-full" style={{ background: cfg.color }} />

      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0"
              style={{ background: cfg.color + '22', border: `1.5px solid ${cfg.color}55`, color: cfg.color }}>
              {a.full_name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()}
            </div>
            <div>
              <Link href={`/athletes/detail?id=${a.id}`} className="text-sm font-bold text-foreground hover:underline">{a.full_name}</Link>
              <p className="text-[10px] text-muted-foreground">{sportLabel(a.primary_sport)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {alert.gap.flagged && (
              <span className="flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider"
                style={{ background: '#8b5cf622', border: '1px solid #8b5cf655', color: '#8b5cf6' }}
                title={trainingGapLabel(alert.gap)}>
                <Dumbbell className="w-2.5 h-2.5" /> Sem treino 48h
              </span>
            )}
            {alert.clinicalFlag && (
              <span className="flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider"
                style={{ background: '#e8001c22', border: '1px solid #e8001c55', color: '#e8001c' }}>
                <AlertTriangle className="w-2.5 h-2.5" /> Clínico
              </span>
            )}
            <span className="text-[9px] font-black px-2.5 py-1 rounded-md uppercase tracking-wider"
              style={{ background: cfg.color + '20', border: `1px solid ${cfg.color}40`, color: cfg.color }}>
              {cfg.badge}
            </span>
          </div>
        </div>

        {/* Metrics strip */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { icon: Heart, label: 'HRV', value: a.hrv_ms != null ? a.hrv_ms.toFixed(0) + 'ms' : '—', ok: a.hrv_ms != null && a.hrv_ms >= T.hrv.green_min },
            { icon: Zap, label: 'Battery', value: a.body_battery != null ? a.body_battery.toFixed(0) : '—', ok: a.body_battery != null && a.body_battery >= T.bodyBattery.target_min },
            { icon: Moon, label: 'Sono', value: a.sleep_hours != null ? a.sleep_hours.toFixed(1) + 'h' : '—', ok: a.sleep_hours != null && a.sleep_hours >= T.sleep.injury_risk_below },
            { icon: Activity, label: 'TSB', value: (tsb >= 0 ? '+' : '') + tsb.toFixed(0), ok: tsb >= -10 },
          ].map(({ icon: Icon, label, value, ok }) => (
            <div key={label} className="rounded-lg px-3 py-2 text-center" style={{ background: 'var(--background)', border: '1px solid var(--border)' }}>
              <Icon className="w-3 h-3 mx-auto mb-1" style={{ color: value === '—' ? 'var(--muted-foreground)' : ok ? '#00d084' : '#e8001c' }} />
              <p className="text-[10px] font-black" style={{ color: value === '—' ? 'var(--muted-foreground)' : ok ? '#00d084' : '#e8001c' }}>{value}</p>
              <p className="text-[8px] text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Triggers */}
        <div className="space-y-1 mb-4">
          {alert.triggers.slice(0, 3).map((t, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="w-1 h-1 rounded-full mt-1.5 flex-shrink-0" style={{ background: cfg.color }} />
              <p className="text-[10px] leading-relaxed" style={{ color: cfg.color + 'cc' }}>{t}</p>
            </div>
          ))}
          {alert.stopSignals.length > 0 && (
            <div className="mt-2 px-3 py-2 rounded-lg" style={{ background: '#e8001c11', border: '1px solid #e8001c33' }}>
              <p className="text-[9px] font-black text-[#e8001c] mb-1 uppercase tracking-wider">⚠ Protocolo de parada</p>
              {alert.stopSignals.map((s, i) => <p key={i} className="text-[9px] text-[#e8001caa]">• {s}</p>)}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-muted-foreground" />
              <p className="text-[9px] text-muted-foreground">
                {alert.syncDaysAgo === null ? 'Nunca sincronizado'
                  : alert.syncDaysAgo === 0 ? 'Sincronizado hoje'
                  : alert.syncDaysAgo === 1 ? 'Sincronizado ontem'
                  : `Sincronizado há ${alert.syncDaysAgo} dias`}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <Dumbbell className="w-3 h-3" style={{ color: alert.gap.flagged ? '#8b5cf6' : 'var(--muted-foreground)' }} />
              <p className="text-[9px]" style={{ color: alert.gap.flagged ? '#8b5cf6' : 'var(--muted-foreground)' }}>
                {alert.gap.daysSince == null ? 'Sem treino em 30 dias'
                  : alert.gap.daysSince === 0 ? 'Treinou hoje'
                  : alert.gap.daysSince === 1 ? 'Treinou ontem'
                  : `Último treino há ${alert.gap.daysSince} dias`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/athletes/detail?id=${a.id}`}
              className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-colors">
              Ver perfil <ChevronRight className="w-3 h-3" />
            </Link>
            <button onClick={onWhatsApp}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold rounded-lg transition-colors"
              style={{ background: '#25d36615', border: '1px solid #25d36645', color: '#25d366' }}>
              <MessageCircle className="w-3 h-3" /> Enviar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AthleteAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')
  const [sending, setSending] = useState<string | null>(null)
  const [coachPhone, setCoachPhone] = useState<string | null>(null)
  const [coachName, setCoachName] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  const load = async (silent = false) => {
    if (!silent) setLoading(true)
    const [rows, profile] = await Promise.all([getAthletesForAlerts(), getCoachProfile()])
    const built = rows.map(buildAlert).sort((a, b) => severityOrder(a.severity) - severityOrder(b.severity))
    setAlerts(built)
    setCoachPhone(profile?.phone ?? null)
    setCoachName(profile?.full_name ?? null)
    setUpdatedAt(new Date())
    setLoading(false)
  }

  useEffect(() => { load() }, [])
  // recalcula ao voltar do segundo plano e a cada 1h com a página aberta
  useAutoRefresh(() => load(true))

  const counts = {
    critical: alerts.filter(a => a.severity === 'critical').length,
    warning:  alerts.filter(a => a.severity === 'warning').length,
    ok:       alerts.filter(a => a.severity === 'ok').length,
    nodata:   alerts.filter(a => a.severity === 'nodata').length,
    notraining: alerts.filter(a => a.gap.flagged).length,
  }

  const filtered = filter === 'all' ? alerts
    : filter === 'notraining' ? alerts.filter(a => a.gap.flagged)
    : alerts.filter(a => a.severity === filter)

  function sendWhatsApp(alert: AthleteAlert) {
    const phone = alert.athlete.phone?.replace(/\D/g, '') ?? ''
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(alert.whatsappMessage)}`
      : `https://wa.me/?text=${encodeURIComponent(alert.whatsappMessage)}`
    window.open(url, '_blank')
  }

  function sendCoachBriefing() {
    const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
    const criticals = alerts.filter(a => a.severity === 'critical')
    const warnings  = alerts.filter(a => a.severity === 'warning')
    const oks       = alerts.filter(a => a.severity === 'ok')
    const nodata    = alerts.filter(a => a.severity === 'nodata')

    let msg = `*SAAB Sports — Briefing Diário*\n`
    msg += `_${today}_\n\n`

    if (coachName) msg += `Olá, ${coachName.split(' ')[0]}! Aqui está o resumo do dia:\n\n`

    msg += `🔴 *${criticals.length} crítico${criticals.length !== 1 ? 's'  : ''}*`
    if (criticals.length) msg += `\n${criticals.map(a => `• ${a.athlete.full_name} — ${a.triggers[0]}`).join('\n')}`
    msg += `\n\n🟡 *${warnings.length} atenção*`
    if (warnings.length) msg += `\n${warnings.map(a => `• ${a.athlete.full_name} — ${a.triggers[0]}`).join('\n')}`
    msg += `\n\n🟢 *${oks.length} no alvo*`
    if (nodata.length) msg += `\n\n⚫ *${nodata.length} sem dados* (sem sincronização nas últimas 48h)`
    if (nodata.length) msg += `\n${nodata.map(a => `• ${a.athlete.full_name}`).join('\n')}`

    const noTraining = alerts.filter(a => a.gap.flagged)
    if (noTraining.length) {
      msg += `\n\n🏋️ *${noTraining.length} sem treino nas últimas 48h*`
      msg += `\n${noTraining.map(a => `• ${a.athlete.full_name}${a.gap.daysSince != null && a.gap.daysSince > 2 ? ` — há ${a.gap.daysSince} dias` : ''}`).join('\n')}`
    }

    if (criticals.some(a => a.clinicalFlag)) {
      msg += `\n\n⚠️ *Atenção clínica:* ${criticals.filter(a => a.clinicalFlag).map(a => a.athlete.full_name).join(', ')} — FC repouso elevada`
    }

    msg += `\n\n_Central de Alertas · SAAB Sports_`

    const phone = coachPhone?.replace(/\D/g, '') ?? ''
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank')
  }

  async function sendAllCritical() {
    const criticals = alerts.filter(a => a.severity === 'critical' && a.athlete.phone)
    for (const alert of criticals) {
      setSending(alert.athlete.id)
      sendWhatsApp(alert)
      await new Promise(r => setTimeout(r, 800))
    }
    setSending(null)
  }

  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })

  return (
    <div className="flex flex-col h-screen">
      <Topbar title="Central de Alertas" subtitle={`Briefing diário — ${today}`} />

      <div className="flex-1 overflow-auto p-4 md:p-6 space-y-5">

        {/* Coach phone missing banner */}
        {!loading && !coachPhone && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'var(--secondary)', border: '1px solid var(--border)' }}>
            <Settings className="w-4 h-4 flex-shrink-0" style={{ color: '#a3c040' }} />
            <p className="text-[11px] flex-1" style={{ color: '#a3c040' }}>
              Configure seu WhatsApp em{' '}
              <Link href="/settings" className="font-bold underline">Configurações</Link>
              {' '}para receber o briefing diário direto no seu número.
            </p>
          </div>
        )}

        {/* Summary banner */}
        {!loading && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { key: 'critical',   label: 'Críticos', count: counts.critical, color: '#e8001c', bg: '#e8001c0f', border: '#e8001c38', icon: AlertTriangle },
              { key: 'warning',    label: 'Atenção',  count: counts.warning,  color: '#ffa800', bg: '#ffa8000f', border: '#ffa80038', icon: AlertTriangle },
              { key: 'ok',         label: 'OK',        count: counts.ok,       color: '#00d084', bg: '#00d0840f', border: '#00d08438', icon: CheckCircle },
              { key: 'notraining', label: 'Sem treino 48h', count: counts.notraining, color: '#8b5cf6', bg: '#8b5cf60f', border: '#8b5cf638', icon: Dumbbell },
              { key: 'nodata',     label: 'Sem dados', count: counts.nodata,   color: 'var(--muted-foreground)', bg: 'var(--secondary)', border: 'var(--border)', icon: Clock },
            ].map(({ key, label, count, color, bg, border, icon: Icon }) => (
              <button key={key}
                onClick={() => setFilter(filter === key as Filter ? 'all' : key as Filter)}
                className="rounded-xl p-4 text-left transition-all hover:scale-[1.02]"
                style={{ background: bg, border: `1px solid ${filter === key ? color : border}` }}>
                <div className="flex items-center justify-between mb-2">
                  <Icon className="w-4 h-4" style={{ color }} />
                  {filter === key && <div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />}
                </div>
                <p className="text-2xl font-black" style={{ color }}>{count}</p>
                <p className="text-[10px] font-semibold text-muted-foreground mt-0.5">{label}</p>
              </button>
            ))}
          </div>
        )}

        {/* Actions bar */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            {(['all', 'critical', 'warning', 'ok', 'notraining', 'nodata'] as Filter[]).map(f => (
              <button key={f}
                onClick={() => setFilter(f)}
                className="px-3 py-1.5 text-[11px] font-semibold rounded-lg transition-colors"
                style={filter === f
                  ? { background: '#e8001c', color: '#fff', border: '1px solid #e8001c' }
                  : { background: 'var(--secondary)', color: 'var(--muted-foreground)', border: '1px solid var(--border)' }}>
                {f === 'all' ? 'Todos' : f === 'critical' ? 'Críticos' : f === 'warning' ? 'Atenção' : f === 'ok' ? 'OK' : f === 'notraining' ? 'Sem treino' : 'Sem dados'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {counts.critical > 0 && (
              <button onClick={sendAllCritical} disabled={sending !== null}
                className="flex items-center gap-2 px-4 py-2 text-[11px] font-bold rounded-lg transition-colors disabled:opacity-60"
                style={{ background: '#e8001c22', border: '1px solid #e8001c55', color: '#e8001c' }}>
                <MessageCircle className="w-3.5 h-3.5" />
                Avisar todos os críticos ({counts.critical})
              </button>
            )}
            <button
              onClick={sendCoachBriefing}
              title={!coachPhone ? 'Configure seu WhatsApp em Configurações para receber direto no seu número' : undefined}
              className="flex items-center gap-2 px-4 py-2 text-[11px] font-bold rounded-lg transition-colors"
              style={{ background: '#25d36615', border: '1px solid #25d36645', color: '#25d366' }}>
              <MessageCircle className="w-3.5 h-3.5" />
              {coachPhone ? 'Receber meu briefing' : 'Briefing p/ WhatsApp'}
            </button>
            <button onClick={() => load()} disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold rounded-lg transition-colors"
              style={{ background: 'var(--secondary)', border: '1px solid var(--border)', color: 'var(--muted-foreground)' }}
              title="Também atualiza sozinho: ao abrir, ao voltar para o app e a cada 1h">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              {updatedAt
                ? `Atualizado às ${updatedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                : 'Atualizar'}
            </button>
          </div>
        </div>

        {/* Legend */}
        <details className="group rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer select-none list-none">
            <Info className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[11px] font-semibold text-muted-foreground">Como os alertas são calculados</span>
            <ChevronRight className="w-3 h-3 text-muted-foreground ml-auto group-open:rotate-90 transition-transform" />
          </summary>
          <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">

            {/* Origem dos dados */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Database className="w-3 h-3 text-muted-foreground" />
                <p className="text-[10px] font-black text-foreground/70 uppercase tracking-wider">Origem dos dados</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {[
                  { label: 'HRV (ms)', src: 'Garmin Connect → tabela daily_metrics · campo hrv_ms', detail: 'Variabilidade da frequência cardíaca medida durante o sono (rMSSD)' },
                  { label: 'Body Battery', src: 'Garmin Connect → tabela daily_metrics · campo body_battery', detail: 'Nível de energia acumulada ao acordar (0–100)' },
                  { label: 'Sono (h)', src: 'Garmin Connect → tabela daily_metrics · campo sleep_hours', detail: 'Horas totais de sono registradas pelo dispositivo' },
                  { label: 'TSB (Form)', src: 'Supabase view v_athlete_summary · campo tsb', detail: 'CTL – ATL: forma atual pelo modelo PMC. Calculado diariamente pelo pipeline de importação' },
                  { label: 'FC Repouso', src: 'Garmin Connect → tabela daily_metrics · campo resting_hr', detail: 'Frequência cardíaca de repouso ao acordar (bpm)' },
                  { label: 'Stress médio', src: 'Garmin Connect → tabela daily_metrics · campo stress_avg', detail: 'Nível médio de estresse ao longo do dia (0–100)' },
                  { label: 'Último treino', src: 'Importação FIT/CSV → tabela activities · campo started_at', detail: 'Data do treino mais recente registrado — usado no selo "Sem treino 48h"' },
                ].map(({ label, src, detail }) => (
                  <div key={label} className="rounded-lg px-3 py-2.5" style={{ background: 'var(--background)', border: '1px solid var(--border)' }}>
                    <p className="text-[10px] font-black text-foreground/70 mb-0.5">{label}</p>
                    <p className="text-[9px] text-muted-foreground font-mono leading-relaxed">{src}</p>
                    <p className="text-[9px] text-muted-foreground mt-1 leading-relaxed">{detail}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Quando é calculado */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <CalendarClock className="w-3 h-3 text-muted-foreground" />
                <p className="text-[10px] font-black text-foreground/70 uppercase tracking-wider">Quando é calculado</p>
              </div>
              <div className="rounded-lg px-3 py-3 space-y-2" style={{ background: 'var(--background)', border: '1px solid var(--border)' }}>
                {[
                  { step: '1', text: 'Atleta sincroniza o Garmin Connect (automático ou manual)', when: 'A qualquer hora do dia' },
                  { step: '2', text: 'Importação manual via tela "Importar Dados" processa o arquivo .fit e grava daily_metrics', when: 'Sob demanda — você clica em importar' },
                  { step: '3', text: 'Central de Alertas recalcula tudo em tempo real: ao abrir a página, ao voltar do segundo plano, a cada 1 hora com a página aberta, ou ao tocar em "Atualizar"', when: 'Automático — o horário da última atualização aparece no botão' },
                  { step: '4', text: 'Alertas consideram apenas dados com ≤ 2 dias de defasagem — dados mais antigos geram "Sem dados"', when: 'Janela: últimas 48h' },
                ].map(({ step, text, when }) => (
                  <div key={step} className="flex gap-3">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black flex-shrink-0 mt-0.5"
                      style={{ background: '#e8001c22', border: '1px solid #e8001c44', color: '#e8001c' }}>{step}</div>
                    <div>
                      <p className="text-[10px] text-foreground/70 leading-relaxed">{text}</p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">{when}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Lógica de classificação */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Cpu className="w-3 h-3 text-muted-foreground" />
                <p className="text-[10px] font-black text-foreground/70 uppercase tracking-wider">Lógica de classificação</p>
              </div>
              <div className="space-y-1.5">
                {[
                  { badge: 'CRÍTICO', color: '#e8001c', bg: '#e8001c0f', border: '#e8001c38', rule: 'HRV < 34ms (zona vermelha) OU Body Battery < 25 (piso de segurança) OU Sono < 5.5h OU Protocolo de parada ativado (2+ sinais críticos por 3+ dias consecutivos)' },
                  { badge: 'ATENÇÃO', color: '#ffa800', bg: '#ffa8000f', border: '#ffa80038', rule: 'HRV entre 34–44ms (zona amarela) OU Body Battery < 40 OU Sono < 6.5h — treino deve ser reduzido 30–40%. Também entra aqui quem está sem treino registrado há mais de 48h' },
                  { badge: 'OK', color: '#00d084', bg: '#00d0840f', border: '#00d08438', rule: 'HRV ≥ 44ms + Body Battery ≥ 40 + Sono ≥ 6.5h — todos os indicadores dentro do alvo' },
                  { badge: 'SEM TREINO 48H', color: '#8b5cf6', bg: '#8b5cf60f', border: '#8b5cf638', rule: 'Nenhum treino registrado na tabela activities nas últimas 48h — selo roxo no cartão do atleta e destaque no briefing do treinador. Verifique se o atleta pulou as sessões ou se os arquivos não foram importados' },
                  { badge: 'SEM DADOS', color: 'var(--muted-foreground)', bg: 'var(--secondary)', border: 'var(--border)', rule: 'Nenhuma métrica registrada nas últimas 48h — o atleta não sincronizou o dispositivo' },
                ].map(({ badge, color, bg, border, rule }) => (
                  <div key={badge} className="flex items-start gap-3 rounded-lg px-3 py-2.5" style={{ background: bg, border: `1px solid ${border}` }}>
                    <span className="text-[9px] font-black px-2 py-0.5 rounded flex-shrink-0 mt-0.5"
                      style={{ background: color + '20', border: `1px solid ${color}40`, color }}>{badge}</span>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">{rule}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </details>

        {/* Alert cards */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-48 rounded-xl animate-pulse" style={{ background: 'var(--card)', border: '1px solid var(--border)' }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <CheckCircle className="w-12 h-12 text-[#00d084] mb-3 opacity-50" />
            <p className="text-sm font-semibold text-foreground">Nenhum alerta nessa categoria</p>
            <p className="text-xs text-muted-foreground mt-1">Todos os atletas estão dentro dos parâmetros</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map(alert => (
              <AlertCard
                key={alert.athlete.id}
                alert={alert}
                onWhatsApp={() => sendWhatsApp(alert)}
              />
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
