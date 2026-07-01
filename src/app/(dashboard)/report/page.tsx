'use client'

import { useEffect, useState, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Printer, MessageCircle, ArrowLeft, ImageDown, Loader2 } from 'lucide-react'
import Link from 'next/link'
import {
  getAthlete, getAthletePMC, getAthleteHRV,
  type AthleteRow, type PMCRow, type DailyMetricRow,
} from '@/lib/supabase/queries'
import { trainingReadiness, weeklyScorecard, type DailyMetrics } from '@/lib/readiness'
import { PHASE_PROTOCOL } from '@/lib/thresholds'

function sportLabel(s: string) {
  const m: Record<string, string> = { running: 'Corrida', cycling: 'Ciclismo', triathlon: 'Triathlon', swimming: 'Natação', duathlon: 'Duathlon', other: 'Outro' }
  return m[s] ?? s
}

function n(v: number | null | undefined, dec = 1): string | null {
  return v == null ? null : v.toFixed(dec)
}

function readinessConfig(level: string) {
  if (level === 'VERDE') return { color: '#00d084', bg: '#071410', border: '#00d084', label: 'Treino liberado', badge: 'VERDE' }
  if (level === 'AMARELO') return { color: '#ffa800', bg: '#12100a', border: '#ffa800', label: 'Treino adaptado', badge: 'AMARELO' }
  if (level === 'VALVULA') return { color: '#e8001c', bg: '#120505', border: '#e8001c', label: 'Válvula de segurança ativada', badge: 'CANCELADO' }
  return { color: '#e8001c', bg: '#120505', border: '#e8001c', label: 'Descanso total', badge: 'VERMELHO' }
}

// Mini sparkline SVG string (for inline HTML)
function sparkSVG(data: number[], color: string): string {
  if (data.length < 2) return ''
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const w = 72; const h = 28
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ')
  const lx = (data.length - 1) / (data.length - 1) * w
  const ly = h - ((data[data.length - 1] - min) / range) * h
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="overflow:visible"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/><circle cx="${lx}" cy="${ly}" r="2.5" fill="${color}"/></svg>`
}

// ─── PRINT HTML GENERATOR ───────────────────────────────────────────────────
function buildPrintHTML(opts: {
  athlete: AthleteRow & { phone?: string }
  pmc: PMCRow[]
  latestM: DailyMetricRow | null
  scorecard: ReturnType<typeof weeklyScorecard>
  readiness: ReturnType<typeof trainingReadiness> | null
  wKg: string | null
  today: string
}) {
  const { athlete, pmc, latestM, scorecard, readiness, wKg, today } = opts
  const rc = readiness ? readinessConfig(readiness.level) : null
  const lastPmc = pmc[pmc.length - 1]
  const tsb = lastPmc?.tsb ?? 0
  const tsbColor = tsb >= 5 ? '#00d084' : tsb >= -10 ? '#ffa800' : '#e8001c'
  const tsbLabel = tsb >= 5 ? 'Em forma' : tsb >= -10 ? 'Neutro' : 'Cansado'
  const ctlSpark = sparkSVG(pmc.slice(-14).map(p => p.ctl ?? 0), '#4a9eff')
  const atlSpark = sparkSVG(pmc.slice(-14).map(p => p.atl ?? 0), '#cc6666')
  const tsbSpark = sparkSVG(pmc.slice(-14).map(p => p.tsb ?? 0), tsbColor)

  const paradox = latestM?.body_battery != null && latestM.body_battery < 40
  const paradoxColor = paradox ? '#e8001c' : '#00d084'
  const paradoxLabel = !latestM ? 'Sem dados de recuperação' : paradox ? 'PARADOXO IDENTIFICADO' : 'ALINHADO'
  const paradoxSub = !latestM ? 'Sincronize o Garmin Connect' : paradox ? 'O coração é eficiente, mas a energia está crítica' : 'Capacidade e energia em equilíbrio'

  const emptyVal = (v: string | null, unit = '') => v != null
    ? `<span style="font-size:28px;font-weight:900;color:#00d084;line-height:1">${v}<span style="font-size:13px;font-weight:700;margin-left:3px;opacity:.8">${unit}</span></span>`
    : `<span style="font-size:11px;color:#445566;font-style:italic">Aguardando sincronização</span>`

  const metricBlock = (label: string, value: string | null, unit = '', note = '', color = '#00d084') => `
    <div style="margin-bottom:16px">
      <div style="font-size:9px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:#667788;margin-bottom:5px">${label}</div>
      ${value != null
        ? `<div style="font-size:26px;font-weight:900;color:${color};line-height:1">${value}<span style="font-size:12px;font-weight:700;margin-left:3px;opacity:.8">${unit}</span></div>${note ? `<div style="font-size:9px;margin-top:3px;color:${color}99">${note}</div>` : ''}`
        : `<div style="font-size:10px;color:#445566;font-style:italic">Aguardando sincronização</div>`
      }
    </div>`

  const phaseColors = ['#e8001c', '#ffa800', '#00d084']
  const phasesHTML = PHASE_PROTOCOL.map((phase, i) => {
    const c = phaseColors[i]
    const isCurrent = i === 0
    const text: string = 'foco' in phase ? phase.foco : 'projecao' in phase ? phase.projecao : (phase as { resultado: string }).resultado
    return `
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:8px">
        <div style="position:relative;display:flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:50%;background:${isCurrent ? c : '#0d0d18'};border:2px solid ${c};color:${isCurrent ? '#fff' : c};font-weight:900;font-size:14px;z-index:2">
          ${phase.fase}
          ${isCurrent ? `<div style="position:absolute;top:-20px;left:50%;transform:translateX(-50%);background:#e8001c;color:#fff;font-size:7px;font-weight:900;padding:2px 5px;border-radius:3px;white-space:nowrap;letter-spacing:.08em">VOCÊ ESTÁ AQUI</div>` : ''}
        </div>
        <div style="background:${isCurrent ? '#12080a' : '#0d0d18'};border:1px solid ${isCurrent ? c + '55' : '#1a1a28'};border-radius:10px;padding:14px;width:100%;box-sizing:border-box">
          <div style="font-size:8px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${c}aa;margin-bottom:4px">Sem ${phase.semanas} · Fase ${phase.fase}</div>
          <div style="font-size:13px;font-weight:900;color:#fff;margin-bottom:6px">${phase.nome}</div>
          <div style="font-size:10px;color:#667788;line-height:1.5;margin-bottom:8px">${text}</div>
          <div style="display:flex;align-items:center;gap:5px">
            <div style="width:3px;height:12px;border-radius:2px;background:${c}"></div>
            <div style="font-size:10px;font-weight:700;color:${c}">Meta: ${phase.meta_sono_h}h de sono</div>
          </div>
        </div>
      </div>`
  }).join(`<div style="width:1px;background:#1a1a28;margin-top:20px;margin-bottom:0;align-self:stretch"></div>`)

  const scorecardHTML = scorecard.length > 0 ? `
    <div style="margin-bottom:24px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
        <div style="width:3px;height:18px;background:#e8001c;border-radius:2px"></div>
        <div style="font-size:10px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:#aabbcc">Scorecard — últimos 14 dias</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
        ${scorecard.map(kpi => {
          const c = kpi.state === 'ok' ? '#00d084' : kpi.state === 'amber' ? '#ffa800' : '#e8001c'
          return `<div style="background:#0d0d18;border:1px solid #1a1a28;border-left:3px solid ${c};border-radius:8px;padding:12px">
            <div style="font-size:8px;text-transform:uppercase;letter-spacing:.1em;color:#667788;margin-bottom:4px">${kpi.label}</div>
            <div style="font-size:20px;font-weight:900;color:${c}">${kpi.value != null ? kpi.value.toFixed(kpi.unit === 'h' ? 1 : 0) + kpi.unit : '—'}</div>
            <div style="font-size:8px;margin-top:3px;color:${c}88">Meta: ${kpi.targetLabel}</div>
          </div>`
        }).join('')}
      </div>
    </div>` : ''

  const readinessHTML = rc && readiness ? `
    <div style="margin-bottom:24px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
        <div style="width:3px;height:18px;background:#e8001c;border-radius:2px"></div>
        <div style="font-size:10px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:#aabbcc">Prontidão de hoje</div>
      </div>
      <div style="background:${rc.bg};border:1.5px solid ${rc.border};border-radius:10px;padding:16px 20px;display:flex;align-items:center;gap:14px">
        <div style="width:12px;height:12px;border-radius:50%;background:${rc.color};flex-shrink:0;box-shadow:0 0 8px ${rc.color}66"></div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:900;color:${rc.color}">${rc.label.toUpperCase()}</div>
          <div style="font-size:10px;margin-top:4px;color:${rc.color}bb">${readiness.recommendation}</div>
          ${readiness.safetyReason ? `<div style="font-size:9px;margin-top:5px;color:${rc.color}77">↳ ${readiness.safetyReason}</div>` : ''}
        </div>
        <div style="background:${rc.color}18;border:1px solid ${rc.color}33;color:${rc.color};font-size:10px;font-weight:900;letter-spacing:.1em;padding:5px 10px;border-radius:6px">${rc.badge}</div>
      </div>
    </div>` : ''

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Relatório — ${athlete.full_name}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
  @page { size: A4 portrait; margin: 0; }
  @media print {
    html, body { width: 210mm; height: 297mm; }
    .page { page-break-after: avoid; }
    .no-print { display: none !important; }
  }
  body { background: #0a0a0f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #e0e8f0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { width: 210mm; min-height: 297mm; background: #0a0a0f; padding: 0; display: flex; flex-direction: column; }
</style>
</head>
<body>
<div class="page">

  <!-- HEADER -->
  <div style="background:linear-gradient(135deg,#0d0d18,#120c14);border-bottom:1px solid #1a1a28;padding:20px 32px;display:flex;align-items:center;justify-content:space-between">
    <div style="display:flex;align-items:center;gap:12px">
      <div style="width:40px;height:40px;background:#e8001c;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:13px;letter-spacing:-.5px">SS</div>
      <div>
        <div style="font-size:14px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:#fff">Saab Sports</div>
        <div style="font-size:10px;color:#6677aa;margin-top:1px">Performance Platform</div>
      </div>
    </div>
    <div style="text-align:right">
      <div style="font-size:18px;font-weight:900;color:#fff">${athlete.full_name}</div>
      <div style="font-size:10px;color:#6677aa;margin-top:2px">${sportLabel(athlete.primary_sport)}</div>
      <div style="margin-top:5px;display:inline-block;background:#131320;border:1px solid #222233;border-radius:5px;padding:2px 8px">
        <span style="font-size:9px;font-weight:700;letter-spacing:.08em;color:#8899bb">${today}</span>
      </div>
    </div>
  </div>

  <div style="padding:24px 32px;flex:1;display:flex;flex-direction:column;gap:22px">

    <!-- PERFIL FISIOLÓGICO -->
    <div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
        <div style="width:3px;height:18px;background:#e8001c;border-radius:2px"></div>
        <div style="font-size:10px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:#aabbcc">Perfil fisiológico — o paradoxo da performance</div>
      </div>
      <div style="display:flex;gap:10px;align-items:stretch">

        <!-- CAPACIDADE -->
        <div style="flex:1;background:#071410;border:1px solid #0f3024;border-radius:12px;padding:18px">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:14px">
            <div style="width:6px;height:6px;border-radius:50%;background:#00d084"></div>
            <div style="font-size:8px;font-weight:900;letter-spacing:.18em;text-transform:uppercase;color:#00d084">Capacidade (o motor)</div>
          </div>
          ${metricBlock('HRV — RMSSD', n(latestM?.hrv_ms), 'ms',
            latestM?.hrv_ms != null ? (latestM.hrv_ms >= 37 ? 'Zona verde — treino seguro' : latestM.hrv_ms >= 34 ? 'Zona amarela — atenção' : 'Zona vermelha') : '', '#00d084')}
          ${metricBlock('FC Repouso', n(latestM?.resting_hr, 0), 'bpm',
            latestM?.resting_hr != null ? (latestM.resting_hr <= 55 ? 'Condicionamento de elite' : 'Bom condicionamento aeróbico') : '', '#00d084')}
          ${athlete.weight_kg ? metricBlock('Peso corporal', athlete.weight_kg.toString(), 'kg', wKg ? `${wKg} W/kg` : '', '#4a9eff') : ''}
        </div>

        <!-- PARADOX CONNECTOR -->
        <div style="width:130px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:12px 8px">
          <div style="width:1px;height:24px;background:${paradoxColor}33"></div>
          <div style="background:${paradox ? '#180808' : '#071410'};border:1px solid ${paradoxColor}44;border-radius:10px;padding:10px 10px;text-align:center;width:100%">
            <div style="font-size:8px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:${paradoxColor};margin-bottom:5px">${paradoxLabel}</div>
            <div style="font-size:8px;color:#667788;line-height:1.5">${paradoxSub}</div>
          </div>
          <div style="width:1px;height:24px;background:${paradoxColor}33"></div>
        </div>

        <!-- ENERGIA -->
        <div style="flex:1;background:${paradox ? '#120808' : '#071410'};border:1px solid ${paradox ? '#3a1010' : '#0f3024'};border-radius:12px;padding:18px">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:14px">
            <div style="width:6px;height:6px;border-radius:50%;background:${paradox ? '#e8001c' : '#ffa800'}"></div>
            <div style="font-size:8px;font-weight:900;letter-spacing:.18em;text-transform:uppercase;color:${paradox ? '#e8001c' : '#ffa800'}">Energia (a bateria)</div>
          </div>
          ${metricBlock('Body Battery',
            n(latestM?.body_battery, 0), '',
            latestM?.body_battery != null ? (latestM.body_battery < 25 ? 'Exaustão — válvula de segurança' : latestM.body_battery < 40 ? 'Zona crítica — meta >50' : 'Dentro do alvo') : '',
            latestM?.body_battery != null ? (latestM.body_battery < 40 ? '#e8001c' : '#00d084') : '#6677aa')}
          ${metricBlock('Stress médio',
            n(latestM?.stress_avg), '',
            latestM?.stress_avg != null ? (latestM.stress_avg > 35 ? 'Elevado — o corpo não desliga (meta <30)' : 'Dentro do alvo') : '',
            latestM?.stress_avg != null && latestM.stress_avg > 35 ? '#ffa800' : '#00d084')}
          ${metricBlock('Sono',
            n(latestM?.sleep_hours), 'h',
            latestM?.sleep_hours != null ? (latestM.sleep_hours >= 8 ? 'Excelente (meta ≥8h)' : latestM.sleep_hours >= 7 ? 'Adequado' : 'Abaixo do ideal') : '',
            latestM?.sleep_hours != null ? (latestM.sleep_hours >= 7 ? '#00d084' : '#ffa800') : '#6677aa')}
        </div>

      </div>
    </div>

    <!-- PRONTIDÃO -->
    ${readinessHTML}

    <!-- PMC -->
    <div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
        <div style="width:3px;height:18px;background:#e8001c;border-radius:2px"></div>
        <div style="font-size:10px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:#aabbcc">Performance — PMC · Modelo de Banister</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
        ${[
          { label: 'CTL / Fitness', sub: 'Carga crônica · 42 dias', val: lastPmc?.ctl?.toFixed(0) ?? '0', color: '#4a9eff', spark: ctlSpark },
          { label: 'ATL / Fadiga', sub: 'Carga aguda · 7 dias', val: lastPmc?.atl?.toFixed(0) ?? '0', color: '#cc6666', spark: atlSpark },
          { label: 'TSB / Forma', sub: tsbLabel, val: (tsb >= 0 ? '+' : '') + tsb.toFixed(0), color: tsbColor, spark: tsbSpark },
        ].map(k => `
          <div style="background:#0d0d18;border:1px solid #1a1a28;border-radius:12px;padding:16px">
            <div style="font-size:8px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#667788;margin-bottom:3px">${k.label}</div>
            <div style="font-size:9px;color:#445566;margin-bottom:10px">${k.sub}</div>
            <div style="display:flex;align-items:flex-end;justify-content:space-between">
              <div style="font-size:30px;font-weight:900;color:${k.color};line-height:1">${k.val}</div>
              ${k.spark}
            </div>
            <div style="font-size:8px;color:#334455;margin-top:5px">Tendência 14 dias</div>
          </div>`).join('')}
      </div>
    </div>

    <!-- SCORECARD -->
    ${scorecardHTML}

    <!-- PLANO DE AÇÃO -->
    <div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
        <div style="width:3px;height:18px;background:#e8001c;border-radius:2px"></div>
        <div style="font-size:10px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:#aabbcc">Plano de ação — fases de recuperação progressiva</div>
      </div>
      <div style="position:relative">
        <div style="position:absolute;top:20px;left:60px;right:60px;height:1px;background:#1a1a28;z-index:0"></div>
        <div style="display:flex;gap:12px;align-items:flex-start;position:relative;z-index:1">
          ${phasesHTML}
        </div>
      </div>
    </div>

    <!-- FOOTER -->
    <div style="border-top:1px solid #1a1a28;padding-top:14px;display:flex;align-items:center;justify-content:space-between;margin-top:auto">
      <div>
        <div style="font-size:9px;font-weight:600;color:#445566">SAAB Sports Performance Platform</div>
        <div style="font-size:8px;color:#334455;margin-top:1px">saab-sports-platform.netlify.app</div>
      </div>
      <div style="font-size:8px;color:#334455">Gerado em ${today}</div>
    </div>

  </div>
</div>
<script>window.onload = () => { window.print() }</script>
</body>
</html>`
}

// ─── SCREEN COMPONENT ────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-0.5 h-5 bg-[#e8001c] rounded-full flex-shrink-0" />
      <p className="text-[10px] font-black tracking-[.14em] uppercase text-[#aabbcc]">{children}</p>
    </div>
  )
}

function MetricRow({ label, value, unit, note, color }: { label: string; value: string | null; unit?: string; note?: string; color: string }) {
  return (
    <div className="mb-4 last:mb-0">
      <p className="text-[9px] font-bold uppercase tracking-wider text-[#667788] mb-1">{label}</p>
      {value != null ? (
        <>
          <p className="text-2xl font-black leading-none" style={{ color }}>
            {value}{unit && <span className="text-xs font-bold ml-1 opacity-80">{unit}</span>}
          </p>
          {note && <p className="text-[9px] mt-0.5" style={{ color: color + '99' }}>{note}</p>}
        </>
      ) : (
        <p className="text-[10px] text-[#445566] italic">Aguardando sincronização</p>
      )}
    </div>
  )
}

function SparklineSVG({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null
  const min = Math.min(...data); const max = Math.max(...data); const range = max - min || 1
  const w = 72; const h = 28
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ')
  const lx = w; const ly = h - ((data[data.length - 1] - min) / range) * h
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
      <circle cx={lx} cy={ly} r="2.5" fill={color} />
    </svg>
  )
}

function ReportContent() {
  const params = useSearchParams()
  const id = params.get('id')
  const [athlete, setAthlete] = useState<AthleteRow | null>(null)
  const [pmc, setPmc] = useState<PMCRow[]>([])
  const [metrics, setMetrics] = useState<DailyMetricRow[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const reportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!id) return
    Promise.all([getAthlete(id), getAthletePMC(id, 90), getAthleteHRV(id, 30)]).then(([a, p, m]) => {
      setAthlete(a); setPmc(p); setMetrics(m); setLoading(false)
    })
  }, [id])

  if (!id || !athlete) return (
    <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
      {loading ? 'Carregando...' : 'Atleta não encontrado'}
    </div>
  )

  const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const lastPmc = pmc[pmc.length - 1]
  const latestM = metrics[metrics.length - 1] ?? null
  const tsb = lastPmc?.tsb ?? 0
  const tsbColor = tsb >= 5 ? '#00d084' : tsb >= -10 ? '#ffa800' : '#e8001c'
  const tsbLabel = tsb >= 5 ? 'Em forma' : tsb >= -10 ? 'Neutro' : 'Cansado'

  const asDM = (m: DailyMetricRow): DailyMetrics => ({
    date: m.date, hrv_ms: m.hrv_ms, resting_hr_bpm: m.resting_hr, body_battery: m.body_battery,
    stress_avg: m.stress_avg, sleep_hours: m.sleep_hours, rem_pct: m.rem_pct,
    rem_sleep_hours: null, deep_sleep_hours: null, light_sleep_hours: null, weight_kg: null,
  })

  const readiness = latestM ? trainingReadiness(asDM(latestM)) : null
  const rc = readiness ? readinessConfig(readiness.level) : null
  const last14 = metrics.slice(-14).map(asDM)
  const scorecard = weeklyScorecard(last14)
  const phone = (athlete as AthleteRow & { phone?: string }).phone
  const wKg = athlete.ftp_watts && athlete.weight_kg ? (athlete.ftp_watts / athlete.weight_kg).toFixed(2) : null
  const paradox = latestM?.body_battery != null && latestM.body_battery < 40
  const paradoxColor = paradox ? '#e8001c' : '#00d084'
  const paradoxLabel = !latestM ? 'Sem dados' : paradox ? 'PARADOXO' : 'ALINHADO'
  const paradoxSub = !latestM ? 'Sincronize o Garmin' : paradox ? 'Capacidade preservada, energia crítica' : 'Capacidade e energia em equilíbrio'

  const ctlSpark = pmc.slice(-14).map(p => p.ctl ?? 0)
  const atlSpark = pmc.slice(-14).map(p => p.atl ?? 0)
  const tsbSpark = pmc.slice(-14).map(p => p.tsb ?? 0)

  const fname = () => `relatorio-${athlete.full_name.replace(/\s+/g, '-').toLowerCase()}`

  // Renders the print HTML in a hidden iframe, captures with html2canvas → returns PDF blob
  async function generatePDFBlob(): Promise<Blob | null> {
    const html = buildPrintHTML({ athlete: athlete as AthleteRow & { phone?: string }, pmc, latestM, scorecard, readiness, wKg, today })
    return new Promise((resolve) => {
      const iframe = document.createElement('iframe')
      iframe.style.cssText = 'position:fixed;top:0;left:0;width:794px;height:1123px;z-index:-999;opacity:0;pointer-events:none'
      document.body.appendChild(iframe)
      const doc = iframe.contentDocument!
      doc.open(); doc.write(html); doc.close()
      setTimeout(async () => {
        try {
          const html2canvas = (await import('html2canvas')).default
          const canvas = await html2canvas(doc.body, {
            backgroundColor: '#0a0a0f', scale: 2, useCORS: true, logging: false,
            width: 794, height: doc.body.scrollHeight,
            windowWidth: 794, windowHeight: doc.body.scrollHeight,
          })
          document.body.removeChild(iframe)
          const { jsPDF } = await import('jspdf')
          const imgData = canvas.toDataURL('image/png')
          const pageW = 210; const pageH = 297; const margin = 0
          const aspect = canvas.height / canvas.width
          const drawW = pageW - margin * 2
          const drawH = Math.min(pageH - margin * 2, drawW * aspect)
          const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
          pdf.addImage(imgData, 'PNG', margin, margin, drawW, drawH)
          resolve(pdf.output('blob'))
        } catch { document.body.removeChild(iframe); resolve(null) }
      }, 900)
    })
  }

  async function handleDownloadPDF() {
    setExporting(true)
    const blob = await generatePDFBlob()
    if (blob) {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = fname() + '.pdf'; a.click()
      URL.revokeObjectURL(url)
    }
    setExporting(false)
  }

  async function handleWhatsApp() {
    if (!athlete) return
    setExporting(true)
    const blob = await generatePDFBlob()
    setExporting(false)
    if (blob) {
      const file = new File([blob], fname() + '.pdf', { type: 'application/pdf' })
      // Mobile: native share sheet (includes WhatsApp)
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: `Relatório ${athlete.full_name}`, text: `Relatório de performance — ${today}` }) } catch { /* cancelled */ }
        return
      }
      // Desktop fallback: download PDF + open WA with text
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = fname() + '.pdf'; a.click()
      URL.revokeObjectURL(url)
    }
    // Open WhatsApp with text (desktop fallback)
    const tsbStr = (tsb >= 0 ? '+' : '') + tsb.toFixed(0)
    const rec = latestM ? `\n\n━━━ ❤️ RECUPERAÇÃO ━━━\n• HRV: ${n(latestM.hrv_ms) ?? '—'}ms\n• Body Battery: ${n(latestM.body_battery, 0) ?? '—'}\n• Sono: ${n(latestM.sleep_hours) ?? '—'}h\n• Stress: ${n(latestM.stress_avg) ?? '—'}` : ''
    const ready = rc && readiness ? `\n\n━━━ 🎯 PRONTIDÃO ━━━\n${readiness.level === 'VERDE' ? '🟢' : readiness.level === 'AMARELO' ? '🟡' : '🔴'} ${rc.label.toUpperCase()}\n↳ ${readiness.recommendation}` : ''
    const text = `🏋️ *SAAB Sports — Relatório de Performance*\n📅 ${today}\n\n*${athlete.full_name}* • ${sportLabel(athlete.primary_sport)}\n\n━━━ 📊 PMC ━━━\n• CTL: ${lastPmc?.ctl?.toFixed(0) ?? '—'} · ATL: ${lastPmc?.atl?.toFixed(0) ?? '—'} · TSB: ${tsbStr} ${tsbLabel}${rec}${ready}\n\n_SAAB Sports Performance Platform_`
    const clean = phone?.replace(/\D/g, '') ?? ''
    window.open(clean ? `https://wa.me/${clean}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  const stateColor = (s: string) => s === 'ok' ? '#00d084' : s === 'amber' ? '#ffa800' : '#e8001c'

  return (
    <div className="min-h-screen bg-[#060609] p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className={`mb-5 transition-opacity ${capturing ? 'opacity-0 pointer-events-none' : ''}`}>
          <Link href={`/athletes/detail?id=${id}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar para o perfil
          </Link>
        </div>

        <div ref={reportRef} className="rounded-2xl overflow-hidden" style={{ background: '#0a0a0f', border: '1px solid #1a1a28' }}>

          {/* Header */}
          <div className="flex items-center justify-between px-8 py-6" style={{ background: 'linear-gradient(135deg,#0d0d18,#120c14)', borderBottom: '1px solid #1a1a28' }}>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-[#e8001c] flex items-center justify-center text-white font-black text-sm">SS</div>
              <div>
                <p className="text-sm font-black text-white tracking-widest uppercase">Saab Sports</p>
                <p className="text-[10px] text-[#6677aa] mt-0.5">Performance Platform</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-black text-white">{athlete.full_name}</p>
              <p className="text-[10px] text-[#6677aa] mt-0.5">{sportLabel(athlete.primary_sport)}</p>
              <div className="mt-1.5 inline-block px-2 py-0.5 rounded" style={{ background: '#131320', border: '1px solid #222233' }}>
                <p className="text-[9px] font-bold text-[#8899bb] tracking-wider">{today}</p>
              </div>
            </div>
          </div>

          <div className="p-8 space-y-7">

            {/* Perfil Fisiológico */}
            <section>
              <SectionLabel>Perfil fisiológico — o paradoxo da performance</SectionLabel>
              <div className="flex gap-3 items-stretch">
                {/* Capacidade */}
                <div className="flex-1 rounded-xl p-5" style={{ background: '#071410', border: '1px solid #0f3024' }}>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#00d084]" />
                    <p className="text-[8px] font-black tracking-[.18em] uppercase text-[#00d084]">Capacidade (o motor)</p>
                  </div>
                  <MetricRow label="HRV — RMSSD" value={n(latestM?.hrv_ms)} unit="ms" color="#00d084"
                    note={latestM?.hrv_ms != null ? (latestM.hrv_ms >= 37 ? 'Zona verde — treino seguro' : latestM.hrv_ms >= 34 ? 'Zona amarela — atenção' : 'Zona vermelha') : undefined} />
                  <MetricRow label="FC Repouso" value={n(latestM?.resting_hr, 0)} unit="bpm" color="#00d084"
                    note={latestM?.resting_hr != null ? (latestM.resting_hr <= 55 ? 'Condicionamento de elite' : 'Bom condicionamento') : undefined} />
                  {athlete.weight_kg && <MetricRow label="Peso corporal" value={athlete.weight_kg.toString()} unit="kg" color="#4a9eff" note={wKg ? `${wKg} W/kg` : undefined} />}
                </div>

                {/* Connector */}
                <div className="w-32 flex flex-col items-center justify-center gap-2 py-4">
                  <div className="w-px h-6 rounded-full" style={{ background: paradoxColor + '44' }} />
                  <div className="w-full rounded-xl px-3 py-2 text-center" style={{ background: paradox ? '#180808' : '#071410', border: `1px solid ${paradoxColor}44` }}>
                    <p className="text-[8px] font-black tracking-[.12em] uppercase mb-1" style={{ color: paradoxColor }}>{paradoxLabel}</p>
                    <p className="text-[8px] text-[#667788] leading-relaxed">{paradoxSub}</p>
                  </div>
                  <div className="w-px h-6 rounded-full" style={{ background: paradoxColor + '44' }} />
                </div>

                {/* Energia */}
                <div className="flex-1 rounded-xl p-5" style={{ background: paradox ? '#120808' : '#071410', border: `1px solid ${paradox ? '#3a1010' : '#0f3024'}` }}>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: paradox ? '#e8001c' : '#ffa800' }} />
                    <p className="text-[8px] font-black tracking-[.18em] uppercase" style={{ color: paradox ? '#e8001c' : '#ffa800' }}>Energia (a bateria)</p>
                  </div>
                  <MetricRow label="Body Battery" value={n(latestM?.body_battery, 0)}
                    color={latestM?.body_battery != null ? (latestM.body_battery < 40 ? '#e8001c' : '#00d084') : '#6677aa'}
                    note={latestM?.body_battery != null ? (latestM.body_battery < 25 ? 'Exaustão — válvula ativada' : latestM.body_battery < 40 ? 'Zona crítica (meta >50)' : 'OK') : undefined} />
                  <MetricRow label="Stress médio" value={n(latestM?.stress_avg)}
                    color={latestM?.stress_avg != null && latestM.stress_avg > 35 ? '#ffa800' : '#00d084'}
                    note={latestM?.stress_avg != null ? (latestM.stress_avg > 35 ? 'Elevado — meta <30' : 'Dentro do alvo') : undefined} />
                  <MetricRow label="Sono" value={n(latestM?.sleep_hours)} unit="h"
                    color={latestM?.sleep_hours != null ? (latestM.sleep_hours >= 7 ? '#00d084' : '#ffa800') : '#6677aa'}
                    note={latestM?.sleep_hours != null ? (latestM.sleep_hours >= 8 ? 'Excelente (meta ≥8h)' : latestM.sleep_hours >= 7 ? 'Adequado' : 'Abaixo do ideal') : undefined} />
                </div>
              </div>
            </section>

            {/* Prontidão */}
            {rc && readiness && (
              <section>
                <SectionLabel>Prontidão de hoje</SectionLabel>
                <div className="rounded-xl px-5 py-4 flex items-center gap-4" style={{ background: rc.bg, border: `1.5px solid ${rc.border}` }}>
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: rc.color }} />
                  <div className="flex-1">
                    <p className="text-sm font-black" style={{ color: rc.color }}>{rc.label.toUpperCase()}</p>
                    <p className="text-[10px] mt-1" style={{ color: rc.color + 'bb' }}>{readiness.recommendation}</p>
                    {readiness.safetyReason && <p className="text-[9px] mt-1" style={{ color: rc.color + '77' }}>↳ {readiness.safetyReason}</p>}
                  </div>
                  <div className="px-2.5 py-1 rounded-md text-[10px] font-black tracking-wider" style={{ background: rc.color + '18', border: `1px solid ${rc.color}33`, color: rc.color }}>{rc.badge}</div>
                </div>
              </section>
            )}

            {/* PMC */}
            <section>
              <SectionLabel>Performance — PMC · Modelo de Banister</SectionLabel>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'CTL / Fitness', sub: 'Carga crônica · 42 dias', value: lastPmc?.ctl?.toFixed(0) ?? '0', color: '#4a9eff', spark: ctlSpark },
                  { label: 'ATL / Fadiga', sub: 'Carga aguda · 7 dias', value: lastPmc?.atl?.toFixed(0) ?? '0', color: '#cc6666', spark: atlSpark },
                  { label: 'TSB / Forma', sub: tsbLabel, value: (tsb >= 0 ? '+' : '') + tsb.toFixed(0), color: tsbColor, spark: tsbSpark },
                ].map(k => (
                  <div key={k.label} className="rounded-xl p-4" style={{ background: '#0d0d18', border: '1px solid #1a1a28' }}>
                    <p className="text-[8px] font-bold uppercase tracking-[.12em] text-[#667788] mb-0.5">{k.label}</p>
                    <p className="text-[9px] text-[#445566] mb-3">{k.sub}</p>
                    <div className="flex items-end justify-between">
                      <p className="text-3xl font-black leading-none" style={{ color: k.color }}>{k.value}</p>
                      <SparklineSVG data={k.spark} color={k.color} />
                    </div>
                    <p className="text-[8px] text-[#334455] mt-1.5">Tendência 14 dias</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Scorecard */}
            {scorecard.length > 0 && (
              <section>
                <SectionLabel>Scorecard semanal — últimos 14 dias</SectionLabel>
                <div className="grid grid-cols-3 gap-3">
                  {scorecard.map(kpi => {
                    const c = stateColor(kpi.state)
                    return (
                      <div key={kpi.label} className="rounded-lg p-4" style={{ background: '#0d0d18', border: '1px solid #1a1a28', borderLeftColor: c, borderLeftWidth: 3 }}>
                        <p className="text-[8px] uppercase tracking-[.1em] text-[#667788] mb-1">{kpi.label}</p>
                        <p className="text-xl font-black" style={{ color: c }}>{kpi.value != null ? kpi.value.toFixed(kpi.unit === 'h' ? 1 : 0) + kpi.unit : '—'}</p>
                        <p className="text-[8px] mt-1" style={{ color: c + '99' }}>Meta: {kpi.targetLabel}</p>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* Plano de Ação */}
            <section>
              <SectionLabel>Plano de ação — fases de recuperação progressiva</SectionLabel>
              <div className="relative">
                <div className="absolute top-5 left-14 right-14 h-px bg-[#1a1a28]" />
                <div className="flex gap-3 relative">
                  {PHASE_PROTOCOL.map((phase, i) => {
                    const c = ['#e8001c', '#ffa800', '#00d084'][i]
                    const isCurrent = i === 0
                    const text: string = 'foco' in phase ? phase.foco : 'projecao' in phase ? phase.projecao : (phase as { resultado: string }).resultado
                    return (
                      <div key={phase.fase} className="flex-1 flex flex-col items-center gap-3">
                        <div className="relative flex items-center justify-center w-10 h-10 rounded-full font-black text-sm z-10"
                          style={{ background: isCurrent ? c : '#0d0d18', border: `2px solid ${c}`, color: isCurrent ? '#fff' : c }}>
                          {phase.fase}
                          {isCurrent && <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-[#e8001c] text-white text-[7px] font-black px-1.5 py-0.5 rounded whitespace-nowrap tracking-wider">VOCÊ ESTÁ AQUI</div>}
                        </div>
                        <div className="w-full rounded-xl p-4" style={{ background: isCurrent ? '#12080a' : '#0d0d18', border: `1px solid ${isCurrent ? c + '55' : '#1a1a28'}` }}>
                          <p className="text-[8px] font-bold uppercase tracking-[.1em] mb-1" style={{ color: c + 'aa' }}>Sem {phase.semanas} · Fase {phase.fase}</p>
                          <p className="text-sm font-black text-white mb-2">{phase.nome}</p>
                          <p className="text-[9px] text-[#667788] leading-relaxed mb-3">{text}</p>
                          <div className="flex items-center gap-1.5">
                            <div className="w-0.5 h-3 rounded-full" style={{ background: c }} />
                            <p className="text-[9px] font-bold" style={{ color: c }}>Meta: {phase.meta_sono_h}h de sono</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </section>

            {/* Footer */}
            <div className={`flex items-center justify-between pt-4 transition-opacity ${capturing ? 'opacity-0 pointer-events-none' : ''}`} style={{ borderTop: '1px solid #1a1a28' }}>
              <div>
                <p className="text-[9px] font-semibold text-[#445566]">SAAB Sports Performance Platform</p>
                <p className="text-[8px] text-[#334455]">saab-sports-platform.netlify.app</p>
              </div>
              <div className="flex gap-2">
                <button onClick={handleDownloadPDF} disabled={exporting}
                  className="flex items-center gap-2 px-4 py-2 text-[12px] font-bold rounded-lg disabled:opacity-40 transition-colors"
                  style={{ background: '#131320', border: '1px solid #2a2a3a', color: '#aabbcc' }}>
                  {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
                  {exporting ? 'Gerando...' : 'Baixar PDF'}
                </button>
                <button onClick={handleWhatsApp} disabled={exporting}
                  className="flex items-center gap-2 px-5 py-2 text-[12px] font-bold rounded-lg disabled:opacity-40 transition-colors"
                  style={{ background: '#071a0e', border: '1px solid #1a4a25', color: '#25d366' }}>
                  {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5" />}
                  {exporting ? 'Gerando PDF...' : 'Enviar no WhatsApp'}
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}

export default function ReportPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64 text-muted-foreground text-sm">Carregando...</div>}>
      <ReportContent />
    </Suspense>
  )
}
