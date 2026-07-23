'use client'

import { useState, useRef, useEffect } from 'react'
import { Topbar } from '@/components/layout/topbar'
import { GlossaryLegend } from '@/components/ui/glossary-legend'
import { Upload, FileText, CheckCircle, AlertCircle, X, Info, Loader2, ChevronDown, SkipForward, Archive, Heart, Dumbbell } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { parseFitFile } from '@/lib/parsers/fit-parser'
import { parseTPCSV } from '@/lib/parsers/csv-parser'
import { matchPlannedActivities } from '@/lib/supabase/queries'
import JSZip from 'jszip'

type FileStatus = 'idle' | 'parsing' | 'success' | 'error'

interface ParsedFile {
  id: string
  name: string
  size: string
  ext: 'fit' | 'csv'
  status: FileStatus
  metrics?: { tss?: number; duration?: string; sport?: string; np?: number; hr?: number; count?: number }
  error?: string
  buffer?: ArrayBuffer
  rawFile?: File
  isFromZip?: boolean
  zipSource?: string
}

interface MetricsFile {
  id: string
  name: string
  size: string
  status: 'ready' | 'importing' | 'done' | 'error'
  file: File
  log?: string
}

type AthleteSummary = { id: string; full_name: string; ftp_watts: number | null; ftp_run_watts: number | null; lthr_bpm: number | null; lthr_bike_bpm: number | null; lthr_run_bpm: number | null; lthr_swim_bpm: number | null }

async function decompressGz(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  const ds = new DecompressionStream('gzip')
  const writer = ds.writable.getWriter()
  writer.write(buffer)
  writer.close()
  return new Response(ds.readable).arrayBuffer()
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h}h ${m}min` : `${m}min`
}

function sportLabel(sport: string) {
  const map: Record<string, string> = {
    running: 'Corrida', cycling: 'Ciclismo', triathlon: 'Triathlon',
    swimming: 'Natação', bike: 'Ciclismo', ride: 'Ciclismo', run: 'Corrida',
    swim: 'Natação', generic: 'Outro', other: 'Outro',
  }
  return map[sport?.toLowerCase?.()] ?? sport
}

function sportToDb(sport: string): string {
  const map: Record<string, string> = {
    run: 'running', ride: 'cycling', bike: 'cycling', swim: 'swimming',
    cycling: 'cycling', running: 'running', swimming: 'swimming',
    triathlon: 'triathlon', generic: 'other',
  }
  return map[sport?.toLowerCase?.()] ?? 'other'
}

async function isMetricsCSV(text: string): Promise<boolean> {
  const first = text.split('\n')[0] ?? ''
  const lower = first.toLowerCase()
  return lower.includes('timestamp') && lower.includes('type') && lower.includes('value')
}

async function sniffZip(file: File): Promise<'workout' | 'metrics' | 'empty'> {
  const buf = await file.arrayBuffer()
  const zip = await JSZip.loadAsync(buf)
  const entries = Object.values(zip.files).filter(e => !e.dir)
  const hasFit = entries.some(e => e.name.toLowerCase().includes('.fit'))
  if (hasFit) return 'workout'
  const csvEntry = entries.find(e => e.name.toLowerCase().endsWith('.csv'))
  if (csvEntry) {
    const sample = await csvEntry.async('string').then(t => t.slice(0, 200))
    const isMetrics = await isMetricsCSV(sample)
    return isMetrics ? 'metrics' : 'workout'
  }
  return 'empty'
}

export default function ImportPage() {
  const [athletes, setAthletes] = useState<AthleteSummary[]>([])
  const [selectedAthlete, setSelectedAthlete] = useState<string>('')
  const [files, setFiles] = useState<ParsedFile[]>([])
  const [metricsFiles, setMetricsFiles] = useState<MetricsFile[]>([])
  const [dragging, setDragging] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveLog, setSaveLog] = useState<{ imported: number; skipped: number; failed: number; details: string[] } | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    createClient().from('athletes').select('id, full_name, ftp_watts, ftp_run_watts, lthr_bpm, lthr_bike_bpm, lthr_run_bpm, lthr_swim_bpm').eq('active', true).order('full_name')
      .then(({ data }) => setAthletes(data ?? []))
  }, [])

  const athlete = athletes.find(a => a.id === selectedAthlete) ?? null

  function athleteThresholds(a: AthleteSummary | null) {
    return {
      ftp: a?.ftp_watts, ftpRun: a?.ftp_run_watts,
      lthrBike: a?.lthr_bike_bpm, lthrRun: a?.lthr_run_bpm,
      lthrSwim: a?.lthr_swim_bpm, lthrGeneric: a?.lthr_bpm,
    }
  }

  async function parseSingleFit(buf: ArrayBuffer, name: string, a: AthleteSummary | null): Promise<ParsedFile['metrics']> {
    const act = await parseFitFile(buf, athleteThresholds(a))
    return {
      tss: act.tss ?? undefined,
      duration: formatDuration(act.duration_seconds),
      sport: sportLabel(act.sport),
      np: act.normalized_power ?? undefined,
      hr: act.avg_hr ?? undefined,
      count: 1,
    }
  }

  async function extractWorkoutZip(raw: File): Promise<{ name: string; buffer: ArrayBuffer; type: 'fit' | 'csv' }[]> {
    const buf = await raw.arrayBuffer()
    const zip = await JSZip.loadAsync(buf)
    const results: { name: string; buffer: ArrayBuffer; type: 'fit' | 'csv' }[] = []
    await Promise.all(
      Object.entries(zip.files).map(async ([path, entry]) => {
        if (entry.dir) return
        const lower = path.toLowerCase()
        const isFit = lower.includes('.fit')
        const isCsv = lower.endsWith('.csv')
        if (!isFit && !isCsv) return
        const content = await entry.async('arraybuffer')
        results.push({ name: path.split('/').pop() ?? path, buffer: content, type: isFit ? 'fit' : 'csv' })
      })
    )
    return results
  }

  function parseMetricsCSVText(text: string) {
    const lines = text.trim().split('\n').slice(1)
    const byDate: Record<string, Record<string, unknown>> = {}
    for (const line of lines) {
      const cols = line.match(/"([^"]*)"/g)?.map(s => s.replace(/"/g, '')) ?? []
      if (cols.length < 3) continue
      const [ts, type, value] = cols
      const date = ts.slice(0, 10)
      if (!byDate[date]) byDate[date] = { date }
      const num = parseFloat(value)
      if (type === 'Pulse') byDate[date].resting_hr_bpm = isNaN(num) ? null : num
      else if (type === 'Stress Level') {
        const avg = value.match(/Avg\s*:\s*([\d.]+)/); const max = value.match(/Max\s*:\s*([\d.]+)/)
        if (avg) byDate[date].stress_avg = parseFloat(avg[1])
        if (max) byDate[date].stress_max = parseFloat(max[1])
      }
      else if (type === 'Sleep Hours') {
        const sh = isNaN(num) ? null : Math.round(num * 100) / 100
        byDate[date].sleep_hours = sh
        // Recalcular rem_pct se rem_sleep_hours já estava disponível
        const remH = byDate[date].rem_sleep_hours as number | null
        if (sh && sh > 0 && remH) byDate[date].rem_pct = Math.round(remH / sh * 1000) / 10
      }
      else if (type === 'Time In Deep Sleep') byDate[date].deep_sleep_hours = isNaN(num) ? null : Math.round(num * 100) / 100
      else if (type === 'Time In Light Sleep') byDate[date].light_sleep_hours = isNaN(num) ? null : Math.round(num * 100) / 100
      else if (type === 'Time In REM Sleep') {
        const remH = isNaN(num) ? null : Math.round(num * 100) / 100
        byDate[date].rem_sleep_hours = remH
        // Calcular rem_pct se sleep_hours já disponível
        const sh = byDate[date].sleep_hours as number | null
        if (remH && sh && sh > 0) byDate[date].rem_pct = Math.round(remH / sh * 1000) / 10
      }
      else if (type === 'Weight Kilograms') byDate[date].weight_kg = isNaN(num) ? null : num
      else if (type === 'HRV' || type === 'HRV Status' || type === 'Heart Rate Variability') byDate[date].hrv_ms = isNaN(num) ? null : num
      else if (type === 'Body Battery') {
        // Garmin pode exportar min/max separados; usar o valor mínimo do dia como proxy
        const existing = byDate[date].body_battery as number | null
        if (!isNaN(num) && (existing === null || existing === undefined || num < existing)) {
          byDate[date].body_battery = num
        }
      }
    }
    return Object.values(byDate)
  }

  async function handleFiles(rawList: FileList | null) {
    if (!rawList) return
    for (const raw of Array.from(rawList)) {
      const lower = raw.name.toLowerCase()
      const isZip = lower.endsWith('.zip')
      const isGz = lower.endsWith('.gz')
      const isFit = lower.includes('.fit')
      const isCsv = lower.endsWith('.csv')

      if (isZip) {
        const zipType = await sniffZip(raw)

        if (zipType === 'metrics') {
          setMetricsFiles(prev => [...prev, {
            id: Math.random().toString(36).slice(2),
            name: raw.name,
            size: `${(raw.size / 1024 / 1024).toFixed(1)} MB`,
            status: 'ready',
            file: raw,
          }])
          continue
        }

        if (zipType === 'empty') {
          const errEntry: ParsedFile = {
            id: Math.random().toString(36).slice(2),
            name: raw.name,
            size: `${(raw.size / 1024 / 1024).toFixed(1)} MB`,
            ext: 'fit', status: 'error',
            error: 'Nenhum arquivo .FIT ou .CSV encontrado no ZIP',
          }
          setFiles(prev => [...prev, errEntry])
          continue
        }

        // workout ZIP
        const zipEntry: ParsedFile = {
          id: Math.random().toString(36).slice(2),
          name: raw.name,
          size: `${(raw.size / 1024 / 1024).toFixed(1)} MB`,
          ext: 'fit', status: 'parsing', isFromZip: true, zipSource: raw.name,
        }
        setFiles(prev => [...prev, zipEntry])
        try {
          const extracted = await extractWorkoutZip(raw)
          setFiles(prev => prev.filter(f => f.id !== zipEntry.id))
          const newFiles: ParsedFile[] = extracted.map(e => ({
            id: Math.random().toString(36).slice(2),
            name: e.name,
            size: `${(e.buffer.byteLength / 1024).toFixed(1)} KB`,
            ext: e.type,
            status: 'parsing' as FileStatus,
            buffer: e.buffer,
            isFromZip: true,
            zipSource: raw.name,
          }))
          setFiles(prev => [...prev, ...newFiles])
          for (const nf of newFiles) {
            try {
              if (nf.ext === 'fit') {
                let buf = nf.buffer!
                if (nf.name.toLowerCase().endsWith('.gz')) buf = await decompressGz(buf)
                const metrics = await parseSingleFit(buf, nf.name, athlete)
                setFiles(prev => prev.map(f => f.id === nf.id ? { ...f, status: 'success', metrics, buffer: buf } : f))
              } else {
                const blob = new Blob([nf.buffer!], { type: 'text/csv' })
                const csvFile = new File([blob], nf.name, { type: 'text/csv' })
                const acts = await parseTPCSV(csvFile)
                if (acts.length === 0) {
                  setFiles(prev => prev.map(f => f.id === nf.id ? { ...f, status: 'error', error: 'Nenhuma atividade reconhecida no CSV.' } : f))
                } else {
                  setFiles(prev => prev.map(f => f.id === nf.id ? {
                    ...f, status: 'success',
                    metrics: { count: acts.length, tss: Math.round(acts.reduce((s, a) => s + (a.tss ?? 0), 0)) },
                    rawFile: csvFile,
                  } : f))
                }
              }
            } catch (err) {
              setFiles(prev => prev.map(f => f.id === nf.id ? { ...f, status: 'error', error: String(err) } : f))
            }
          }
        } catch (err) {
          setFiles(prev => prev.map(f => f.id === zipEntry.id ? { ...f, status: 'error', error: String(err) } : f))
        }

      } else if (isFit || isGz) {
        const entry: ParsedFile = {
          id: Math.random().toString(36).slice(2),
          name: raw.name, size: `${(raw.size / 1024).toFixed(1)} KB`,
          ext: 'fit', status: 'parsing',
        }
        setFiles(prev => [...prev, entry])
        try {
          let buf = await raw.arrayBuffer()
          if (isGz) buf = await decompressGz(buf)
          const metrics = await parseSingleFit(buf, raw.name, athlete)
          setFiles(prev => prev.map(f => f.id === entry.id ? { ...f, status: 'success', metrics, buffer: buf } : f))
        } catch (err) {
          setFiles(prev => prev.map(f => f.id === entry.id ? { ...f, status: 'error', error: String(err) } : f))
        }

      } else if (isCsv) {
        const firstLine = await raw.slice(0, 200).text()
        if (await isMetricsCSV(firstLine)) {
          setMetricsFiles(prev => [...prev, {
            id: Math.random().toString(36).slice(2),
            name: raw.name, size: `${(raw.size / 1024).toFixed(1)} KB`,
            status: 'ready', file: raw,
          }])
        } else {
          const entry: ParsedFile = {
            id: Math.random().toString(36).slice(2),
            name: raw.name, size: `${(raw.size / 1024).toFixed(1)} KB`,
            ext: 'csv', status: 'parsing', rawFile: raw,
          }
          setFiles(prev => [...prev, entry])
          try {
            const acts = await parseTPCSV(raw)
            if (acts.length === 0) {
              setFiles(prev => prev.map(f => f.id === entry.id ? { ...f, status: 'error', error: 'Nenhuma atividade reconhecida no CSV.' } : f))
            } else {
              setFiles(prev => prev.map(f => f.id === entry.id ? {
                ...f, status: 'success',
                metrics: { count: acts.length, tss: Math.round(acts.reduce((s, a) => s + (a.tss ?? 0), 0)) },
                rawFile: raw,
              } : f))
            }
          } catch (err) {
            setFiles(prev => prev.map(f => f.id === entry.id ? { ...f, status: 'error', error: String(err) } : f))
          }
        }
      }
    }
  }

  async function handleSaveWorkouts() {
    if (!selectedAthlete || !athlete) return
    const readyFiles = files.filter(f => f.status === 'success')
    if (!readyFiles.length) return

    setSaving(true)
    setSaveLog(null)
    setSaveError(null)
    const sb = createClient()
    let totalImported = 0, totalSkipped = 0, totalFailed = 0
    const details: string[] = []

    // ── Reúne FIT + CSV numa lista única de candidatos ────────────────────
    type Candidate = {
      date: string; sport: string; duration: number; source: 'fit' | 'csv'
      label: string; payload: Record<string, unknown>; base?: Record<string, unknown>
    }
    const candidates: Candidate[] = []

    for (const uf of readyFiles) {
      if (uf.ext === 'fit') {
        try {
          const act = await parseFitFile(uf.buffer!, athleteThresholds(athlete))
          candidates.push({
            date: act.date, sport: sportToDb(act.sport), duration: act.duration_seconds,
            source: 'fit', label: uf.name,
            payload: {
              athlete_id: selectedAthlete, name: act.name, sport: sportToDb(act.sport),
              started_at: act.date, duration_seconds: act.duration_seconds,
              distance_meters: act.distance_meters ?? null,
              avg_power_watts: act.avg_power_watts ?? null, normalized_power: act.normalized_power ?? null,
              intensity_factor: act.intensity_factor ?? null, tss: act.tss ?? null, tss_method: act.tss_method,
              zone_data: act.zone_data, avg_hr_bpm: act.avg_hr ?? null, max_hr_bpm: act.max_hr ?? null,
              avg_cadence_rpm: act.avg_cadence ?? null, elevation_gain_m: act.elevation_gain_m ?? null,
              calories: act.calories ?? null, laps: act.laps ?? null,
              source: 'fit', external_id: uf.name, ftp_used: athlete.ftp_watts ?? null,
            },
          })
        } catch (err) { totalFailed++; details.push(`✗ ${uf.name} — ${String(err)}`) }

      } else if (uf.ext === 'csv' && uf.rawFile) {
        try {
          const acts = await parseTPCSV(uf.rawFile)
          for (const act of acts) {
            const base = {
              athlete_id: selectedAthlete, name: act.title || sportLabel(act.sport), sport: sportToDb(act.sport),
              started_at: act.date, duration_seconds: act.duration_seconds, distance_meters: act.distance_meters ?? null,
              tss: act.tss ?? null, normalized_power: act.np ?? null, intensity_factor: act.if_ ?? null,
              avg_hr_bpm: act.avg_hr ?? null, max_hr_bpm: act.hr_max ?? null,
              avg_power_watts: act.avg_power ?? null, max_power_watts: act.power_max ?? null,
              avg_cadence_rpm: act.cadence_avg ?? null, calories: act.calories ?? null,
              source: 'csv', external_id: `${act.date}-${act.title}`, ftp_used: athlete.ftp_watts ?? null,
            }
            const extra = {
              max_cadence_rpm: act.cadence_max ?? null, velocity_avg_mps: act.velocity_avg ?? null,
              velocity_max_mps: act.velocity_max ?? null, energy_kj: act.energy_kj ?? null,
              avg_torque_nm: act.torque_avg ?? null, max_torque_nm: act.torque_max ?? null,
              rpe: act.rpe ?? null, feeling: act.feeling ?? null,
              hr_zone_minutes: act.hr_zone_minutes ?? null, pwr_zone_minutes: act.pwr_zone_minutes ?? null,
              workout_description: act.workout_description ?? null, coach_comments: act.coach_comments ?? null,
              athlete_comments: act.athlete_comments ?? null, planned_duration_seconds: act.planned_duration_seconds ?? null,
              planned_distance_meters: act.planned_distance_meters ?? null,
            }
            candidates.push({
              date: act.date, sport: sportToDb(act.sport), duration: act.duration_seconds,
              source: 'csv', label: act.title || sportLabel(act.sport),
              payload: { ...base, ...extra }, base,
            })
          }
        } catch (err) { totalFailed++; details.push(`✗ CSV ${uf.name} — ${String(err)}`) }
      }
    }

    // Prefere o CSV (métricas ricas do TP) quando FIT e CSV coincidem
    candidates.sort((a, b) => (a.source === b.source ? 0 : a.source === 'csv' ? -1 : 1))

    // ── Dedup entre fontes: mesmo dia + modalidade + duração próxima ──────
    // Só desduplicamos entre fontes DIFERENTES (FIT vs CSV) — assim treinos
    // duplos no mesmo dia (mesma fonte) continuam sendo importados.
    const dayKey = (iso: string) => iso.slice(0, 10)
    const durTol = (d: number) => Math.max(300, d * 0.05) // 5 min ou 5%
    type Sig = { day: string; sport: string; dur: number; source: string; id?: string; hasLaps?: boolean; row?: Record<string, unknown> }
    // Campos "ricos" que um .FIT pode preencher num treino que já existe (ex.:
    // resumo importado antes por CSV). Só completamos o que estiver vazio.
    const ENRICH_FIELDS = ['laps', 'zone_data', 'avg_power_watts', 'normalized_power', 'intensity_factor', 'tss', 'avg_hr_bpm', 'max_hr_bpm', 'avg_cadence_rpm', 'elevation_gain_m', 'calories', 'distance_meters']
    const RICH_COLS = `id, started_at, duration_seconds, sport, source, ${ENRICH_FIELDS.join(', ')}`
    const seen: Sig[] = []
    if (candidates.length > 0) {
      const times = candidates.map(c => new Date(c.date).getTime()).filter(t => !isNaN(t))
      const minISO = new Date(Math.min(...times) - 86400000).toISOString()
      const maxISO = new Date(Math.max(...times) + 2 * 86400000).toISOString()
      // Tenta trazer as colunas ricas; se o banco for antigo, cai no mínimo.
      let existing = (await sb.from('activities').select(RICH_COLS)
        .eq('athlete_id', selectedAthlete).gte('started_at', minISO).lte('started_at', maxISO))
        .data as unknown as Record<string, unknown>[] | null
      if (!existing) {
        existing = (await sb.from('activities').select('id, started_at, duration_seconds, sport, source, laps')
          .eq('athlete_id', selectedAthlete).gte('started_at', minISO).lte('started_at', maxISO))
          .data as unknown as Record<string, unknown>[] | null
      }
      for (const e of existing ?? []) {
        const row = e as Record<string, unknown>
        seen.push({ id: row.id as string, day: dayKey(row.started_at as string), sport: sportToDb((row.sport as string) ?? ''), dur: (row.duration_seconds as number) ?? 0, source: (row.source as string) ?? '', hasLaps: Array.isArray(row.laps), row })
      }
    }
    const crossMatch = (c: Candidate): Sig | undefined => {
      const day = dayKey(c.date)
      return seen.find(s => s.source !== c.source && s.day === day && s.sport === c.sport && Math.abs(s.dur - c.duration) <= durTol(c.duration))
    }

    // ── Inserção com dedup ────────────────────────────────────────────────
    const isEmpty = (v: unknown) => v === null || v === undefined || (Array.isArray(v) && v.length === 0)
    let dedupSkipped = 0, enriched = 0, fitCoveredNoGain = 0
    // Completa, num treino que já existe, os campos ricos que estiverem vazios
    // usando os dados do .FIT (laps, zonas, potência, IF, TSS, elevação...).
    // Vale tanto para dedup entre fontes (FIT x CSV) quanto para re-import do
    // mesmo arquivo (FIT x FIT) — importante quando o import antigo foi feito
    // antes do recurso de laps. Devolve true se algo foi preenchido.
    const enrichExisting = async (c: Candidate, sig: Sig): Promise<boolean> => {
      if (c.source !== 'fit' || !sig.id) return false
      const upd: Record<string, unknown> = {}
      for (const f of ENRICH_FIELDS) {
        const val = (c.payload as Record<string, unknown>)[f]
        const cur = sig.row ? sig.row[f] : undefined
        // Sem a linha atual (banco antigo), só dá pra completar os laps.
        const curEmpty = sig.row ? isEmpty(cur) : (f === 'laps' ? !sig.hasLaps : false)
        if (curEmpty && !isEmpty(val)) upd[f] = val
      }
      if (!Object.keys(upd).length) return false
      const { error } = await sb.from('activities').update(upd).eq('id', sig.id)
      if (error) return false
      enriched++
      if ('laps' in upd) sig.hasLaps = true
      if (sig.row) Object.assign(sig.row, upd)
      return true
    }
    // Acha um treino já existente no mesmo dia+modalidade+duração (qualquer fonte).
    const sameSlot = (c: Candidate): Sig | undefined => seen.find(s =>
      s.id && s.day === dayKey(c.date) && s.sport === c.sport && Math.abs(s.dur - c.duration) <= durTol(c.duration))
    for (const c of candidates) {
      const match = crossMatch(c)
      if (match) {
        // FIT cobre um treino já existente (ex.: resumo do CSV): não duplica,
        // mas completa os campos ricos que ainda estiverem vazios.
        if (c.source === 'fit' && !(await enrichExisting(c, match))) fitCoveredNoGain++
        totalSkipped++; dedupSkipped++; continue
      }
      let { data: ins, error } = await sb.from('activities').insert(c.payload).select('id').single()
      if (error && (error.code === '42703' || /column .* does not exist/i.test(error.message ?? '') || error.message?.includes('zone_data'))) {
        // banco sem migração 011/025/028: tenta a versão reduzida
        if (c.base) { ({ data: ins, error } = await sb.from('activities').insert(c.base).select('id').single()) }
        else {
          const { zone_data: _z, laps: _l, ...withoutExtra } = c.payload
          void _z; void _l
          ;({ data: ins, error } = await sb.from('activities').insert(withoutExtra).select('id').single())
        }
      }
      if (error) {
        const isDuplicate = error.message?.includes('uq_activity') || error.code === '23505'
        if (isDuplicate) {
          // Mesmo arquivo/fonte já importado (ex.: re-import do mesmo .FIT):
          // não insere de novo, mas ainda completa o que faltar no treino atual.
          totalSkipped++
          const sig = sameSlot(c)
          if (sig) { if (!(await enrichExisting(c, sig)) && c.source === 'fit') fitCoveredNoGain++ }
        } else { totalFailed++; details.push(`✗ ${c.label} — ${error.message} (${error.code ?? ''})`) }
      } else {
        totalImported++
        seen.push({ id: ins?.id as string | undefined, day: dayKey(c.date), sport: c.sport, dur: c.duration, source: c.source, hasLaps: Array.isArray((c.payload as { laps?: unknown[] }).laps) })
      }
    }
    if (dedupSkipped > 0) details.push(`⏭ ${dedupSkipped} treino(s) já cobertos por outra fonte — não duplicados`)
    if (enriched > 0) details.push(`✓ detalhes (tiro a tiro / zonas / potência) adicionados a ${enriched} treino(s)`)
    if (fitCoveredNoGain > 0) details.push(`ℹ ${fitCoveredNoGain} arquivo(s) .FIT já cobertos e sem novos detalhes (ex.: corrida contínua, sem voltas registradas no arquivo)`)

    if (totalImported > 0 || enriched > 0) {
      const { error: rpcErr } = await sb.rpc('recalculate_pmc', { p_athlete_id: selectedAthlete })
      if (rpcErr) details.push(`⚠ PMC: ${rpcErr.message}`)
      else details.push(`✓ PMC recalculado`)
      // cruza os treinos importados com o que estava planejado no calendário
      try {
        const days = candidates.map(c => c.date.slice(0, 10)).sort()
        if (days.length) {
          const matched = await matchPlannedActivities(selectedAthlete, days[0], days[days.length - 1])
          if (matched > 0) details.push(`✓ ${matched} treino(s) cruzado(s) com o planejado`)
        }
      } catch { /* não crítico */ }
    }

    try {
      const { data: userData } = await sb.auth.getUser()
      if (userData.user) {
        await sb.from('import_logs').insert({
          coach_id: userData.user.id, athlete_id: selectedAthlete,
          file_name: readyFiles.map(f => f.zipSource ?? f.name).filter((v, i, a) => a.indexOf(v) === i).join(', '),
          file_type: readyFiles[0]?.ext ?? 'fit',
          status: totalFailed > 0 ? 'partial' : 'success',
          activities_imported: totalImported, activities_skipped: totalSkipped,
          activities_failed: totalFailed, finished_at: new Date().toISOString(),
        })
      }
    } catch (_) { /* non-critical */ }

    setSaving(false)
    setSaveLog({ imported: totalImported, skipped: totalSkipped, failed: totalFailed, details })
    setFiles([])
  }

  async function handleImportOneMetrics(mf: MetricsFile) {
    if (!selectedAthlete) return
    setMetricsFiles(prev => prev.map(f => f.id === mf.id ? { ...f, status: 'importing' } : f))
    try {
      let csvText: string
      if (mf.file.name.toLowerCase().endsWith('.zip')) {
        const buf = await mf.file.arrayBuffer()
        const zip = await JSZip.loadAsync(buf)
        const csvEntry = Object.values(zip.files).find(e => !e.dir && e.name.toLowerCase().endsWith('.csv'))
        if (!csvEntry) throw new Error('Nenhum CSV no ZIP')
        csvText = await csvEntry.async('string')
      } else {
        csvText = await mf.file.text()
      }
      const rows = parseMetricsCSVText(csvText)
      if (rows.length === 0) throw new Error('Nenhum dado reconhecido')
      const sb = createClient()
      let inserted = 0, failed = 0
      for (const row of rows) {
        const hasData = row.resting_hr_bpm || row.sleep_hours || row.stress_avg || row.weight_kg
        if (!hasData) continue
        const { error } = await sb.from('daily_metrics').upsert(
          { ...row, athlete_id: selectedAthlete, source: 'garmin' },
          { onConflict: 'athlete_id,date' }
        )
        if (error) { console.error('metrics upsert:', error.message, error.code); failed++ }
        else { inserted++ }
      }
      const log = `✓ ${inserted} dias${failed > 0 ? ` · ${failed} com erro` : ''}`
      setMetricsFiles(prev => prev.map(f => f.id === mf.id ? { ...f, status: 'done', log } : f))
    } catch (err) {
      setMetricsFiles(prev => prev.map(f => f.id === mf.id ? { ...f, status: 'error', log: `✗ ${String(err)}` } : f))
    }
  }

  const successCount = files.filter(f => f.status === 'success').length
  const parsingCount = files.filter(f => f.status === 'parsing').length
  const errorCount = files.filter(f => f.status === 'error').length
  const zipSources = [...new Set(files.filter(f => f.isFromZip).map(f => f.zipSource).filter(Boolean))]

  return (
    <div>
      <Topbar title="Importar Dados" subtitle="Arquivos .FIT, .CSV e .ZIP do TrainingPeaks" />

      <div className="p-6 space-y-5">
        {/* Info */}
        <div className="flex items-start gap-3 p-4 bg-[#0088ff]/10 border border-[#0088ff]/20 rounded-xl">
          <Info className="w-4 h-4 text-[#0088ff] mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-semibold text-[#0088ff] mb-1">Como exportar do TrainingPeaks</p>
            <ul className="text-xs text-muted-foreground space-y-0.5">
              <li><strong>Treinos em lote (ZIP):</strong> Settings → Export → WorkoutFileExport → Download ZIP</li>
              <li><strong>Métricas (ZIP):</strong> Settings → Export → Metrics Export → Download ZIP</li>
              <li><strong>Planilha de treinos (CSV):</strong> importa potência, FC, cadência, velocidade, torque, energia, zonas de FC/potência, RPE e sensação</li>
              <li><strong>Individual:</strong> Calendário → selecione atividade → Exportar → .FIT</li>
            </ul>
          </div>
        </div>

        {/* Athlete selector */}
        <div className="bg-card border border-border rounded-xl p-5">
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">1. Selecione o atleta</label>
          {athletes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum atleta. <a href="/athletes" className="text-primary hover:underline">Cadastre um atleta →</a></p>
          ) : (
            <div className="relative max-w-sm">
              <select value={selectedAthlete} onChange={e => setSelectedAthlete(e.target.value)}
                className="w-full px-3 py-2.5 pr-8 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary appearance-none">
                <option value="">— Selecionar atleta —</option>
                {athletes.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
              </select>
              <ChevronDown className="absolute right-2.5 top-3 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
          )}
          {athlete && (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              <p className="text-xs text-muted-foreground">FTP Bike: <span className="text-foreground font-medium">{athlete.ftp_watts ? `${athlete.ftp_watts}W` : '—'}</span></p>
              <p className="text-xs text-muted-foreground">FTP Run: <span className="text-foreground font-medium">{athlete.ftp_run_watts ? `${athlete.ftp_run_watts}W` : '—'}</span></p>
              <p className="text-xs text-muted-foreground">LTHR Bike: <span className="text-foreground font-medium">{athlete.lthr_bike_bpm ?? athlete.lthr_bpm ? `${athlete.lthr_bike_bpm ?? athlete.lthr_bpm} bpm` : '—'}</span></p>
              <p className="text-xs text-muted-foreground">LTHR Run: <span className="text-foreground font-medium">{athlete.lthr_run_bpm ? `${athlete.lthr_run_bpm} bpm` : '—'}</span></p>
              <p className="text-xs text-muted-foreground">LTHR Swim: <span className="text-foreground font-medium">{athlete.lthr_swim_bpm ? `${athlete.lthr_swim_bpm} bpm` : '—'}</span></p>
              {!athlete.ftp_watts && !athlete.lthr_bpm && !athlete.lthr_bike_bpm && !athlete.lthr_run_bpm && !athlete.lthr_swim_bpm && (
                <span className="text-[10px] text-[#ffa800]">⚠ Sem FTP nem LTHR — TSS não será calculado. Cadastre no perfil do atleta.</span>
              )}
            </div>
          )}
        </div>

        {/* Unified drop zone */}
        <div className="bg-card border border-border rounded-xl p-5">
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            2. Arraste os arquivos — treinos e/ou métricas
          </label>
          <div
            className={cn(
              'border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer',
              !selectedAthlete ? 'opacity-40 pointer-events-none border-border' :
              dragging ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50 hover:bg-secondary/30'
            )}
            onClick={() => inputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
          >
            <div className="flex flex-col items-center gap-3">
              <div className="flex gap-2">
                <div className="w-11 h-11 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Dumbbell className="w-5 h-5 text-primary" />
                </div>
                <div className="w-11 h-11 rounded-full bg-[#ffa800]/10 border border-[#ffa800]/20 flex items-center justify-center">
                  <Archive className="w-5 h-5 text-[#ffa800]" />
                </div>
                <div className="w-11 h-11 rounded-full bg-[#00d084]/10 border border-[#00d084]/20 flex items-center justify-center">
                  <Heart className="w-5 h-5 text-[#00d084]" />
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Arraste aqui ou clique para selecionar</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Tipo detectado automaticamente · <strong>.ZIP</strong> · <strong>.FIT</strong> / <strong>.FIT.gz</strong> · <strong>.CSV</strong>
                </p>
              </div>
            </div>
            <input ref={inputRef} type="file" multiple accept=".fit,.csv,.gz,.fit.gz,.zip"
              className="hidden" onChange={e => handleFiles(e.target.files)} />
          </div>
        </div>

        {/* Two columns: workouts + metrics */}
        {(files.length > 0 || metricsFiles.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* WORKOUTS */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-border bg-secondary/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Dumbbell className="w-3.5 h-3.5 text-primary" />
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Treinos
                    {parsingCount > 0 && <span className="ml-2 text-[#ffa800]">· {parsingCount} analisando</span>}
                    {successCount > 0 && <span className="ml-2 text-[#00d084]">· {successCount} prontos</span>}
                    {errorCount > 0 && <span className="ml-2 text-primary">· {errorCount} com erro</span>}
                  </p>
                </div>
                {files.length > 0 && (
                  <button onClick={() => setFiles([])} className="text-xs text-muted-foreground hover:text-foreground">limpar</button>
                )}
              </div>

              {files.length === 0 ? (
                <div className="px-5 py-8 text-center text-xs text-muted-foreground">
                  Nenhum treino detectado ainda
                </div>
              ) : (
                <>
                  {zipSources.length > 0 && (
                    <div className="px-5 pt-3 flex flex-wrap gap-2">
                      {zipSources.map(z => (
                        <div key={z} className="flex items-center gap-1.5 px-2.5 py-1 bg-[#ffa800]/10 border border-[#ffa800]/20 rounded-full text-[10px] text-[#ffa800] font-medium">
                          <Archive className="w-2.5 h-2.5" /> {z}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="divide-y divide-border/50 max-h-72 overflow-y-auto">
                    {files.map(f => (
                      <div key={f.id} className="flex items-start gap-3 px-5 py-2.5">
                        <div className={cn('w-6 h-6 rounded flex items-center justify-center flex-shrink-0 mt-0.5',
                          f.ext === 'fit' ? 'bg-[#0088ff]/10' : 'bg-[#00d084]/10')}>
                          <FileText className={cn('w-3 h-3', f.ext === 'fit' ? 'text-[#0088ff]' : 'text-[#00d084]')} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{f.name}</p>
                          {f.status === 'parsing' && <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Loader2 className="w-2.5 h-2.5 animate-spin" /> Analisando...</p>}
                          {f.status === 'success' && f.metrics && (
                            <div className="flex flex-wrap gap-2">
                              {f.metrics.count && f.metrics.count > 1 && <span className="text-[10px] text-[#00d084]">{f.metrics.count} atividades</span>}
                              {f.metrics.sport && <span className="text-[10px] text-muted-foreground">{f.metrics.sport}</span>}
                              {f.metrics.duration && <span className="text-[10px] text-muted-foreground">{f.metrics.duration}</span>}
                              {f.metrics.tss != null && <span className="text-[10px] font-bold text-[#ffa800]">TSS {f.metrics.tss}</span>}
                              {f.metrics.hr && <span className="text-[10px] text-muted-foreground">{f.metrics.hr}bpm</span>}
                            </div>
                          )}
                          {f.status === 'error' && <p className="text-[10px] text-primary line-clamp-2">{f.error}</p>}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {f.status === 'parsing' && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                          {f.status === 'success' && <CheckCircle className="w-3 h-3 text-[#00d084]" />}
                          {f.status === 'error' && <AlertCircle className="w-3 h-3 text-primary" />}
                          <button onClick={() => setFiles(p => p.filter(x => x.id !== f.id))} className="p-0.5 hover:bg-secondary rounded">
                            <X className="w-2.5 h-2.5 text-muted-foreground" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {successCount > 0 && (
                    <div className="px-5 py-3 border-t border-border bg-secondary/30 flex items-center justify-between gap-3">
                      <p className="text-xs text-muted-foreground">{successCount} pronto{successCount !== 1 ? 's' : ''}</p>
                      <button onClick={handleSaveWorkouts} disabled={saving || !selectedAthlete || parsingCount > 0}
                        className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 disabled:opacity-60 text-white text-xs font-semibold rounded-lg transition-colors">
                        {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        {saving ? 'Importando...' : `Importar ${successCount} treino${successCount !== 1 ? 's' : ''}`}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* METRICS */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-border bg-secondary/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Heart className="w-3.5 h-3.5 text-[#00d084]" />
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Recuperação (MetricsExport)
                  </p>
                </div>
                {metricsFiles.length > 0 && (
                  <button onClick={() => setMetricsFiles([])} className="text-xs text-muted-foreground hover:text-foreground">limpar</button>
                )}
              </div>

              {metricsFiles.length === 0 ? (
                <div className="px-5 py-8 text-center text-xs text-muted-foreground">
                  Nenhum MetricsExport detectado ainda
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {metricsFiles.map(mf => (
                    <div key={mf.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="w-6 h-6 rounded bg-[#00d084]/10 flex items-center justify-center flex-shrink-0">
                        <Heart className="w-3 h-3 text-[#00d084]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{mf.name}</p>
                        <p className="text-[10px] text-muted-foreground">{mf.size}</p>
                        {mf.log && (
                          <p className={`text-[10px] font-medium ${mf.log.startsWith('✓') ? 'text-[#00d084]' : 'text-primary'}`}>{mf.log}</p>
                        )}
                      </div>
                      <div className="flex-shrink-0">
                        {mf.status === 'ready' && (
                          <button onClick={() => handleImportOneMetrics(mf)} disabled={!selectedAthlete}
                            className="px-3 py-1.5 bg-[#00d084]/10 border border-[#00d084]/30 hover:bg-[#00d084]/20 disabled:opacity-50 text-[#00d084] text-xs font-semibold rounded-lg transition-colors">
                            Importar
                          </button>
                        )}
                        {mf.status === 'importing' && <Loader2 className="w-4 h-4 animate-spin text-[#00d084]" />}
                        {mf.status === 'done' && <CheckCircle className="w-4 h-4 text-[#00d084]" />}
                        {mf.status === 'error' && <AlertCircle className="w-4 h-4 text-primary" />}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Workout import results */}
        {(saveError || saveLog) && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-secondary/30 flex items-center gap-2">
              <Dumbbell className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Resultado — Treinos</span>
            </div>
            {saveError && (
              <div className="px-5 py-3">
                <p className="text-xs text-primary font-mono break-all">{saveError}</p>
              </div>
            )}
            {saveLog && (
              <>
                <div className="px-5 py-3 flex items-center gap-4 border-b border-border/50">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-[#00d084]" />
                    <span className="text-sm font-bold text-[#00d084]">{saveLog.imported} importados</span>
                  </div>
                  {saveLog.skipped > 0 && (
                    <div className="flex items-center gap-1.5">
                      <SkipForward className="w-3.5 h-3.5 text-[#ffa800]" />
                      <span className="text-sm font-medium text-[#ffa800]">{saveLog.skipped} já existiam</span>
                    </div>
                  )}
                  {saveLog.failed > 0 && (
                    <div className="flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-primary" />
                      <span className="text-sm font-medium text-primary">{saveLog.failed} falharam</span>
                    </div>
                  )}
                </div>
                <div className="max-h-52 overflow-y-auto px-5 py-3 space-y-0.5">
                  {saveLog.details.map((line, i) => (
                    <p key={i} className={cn('text-xs font-mono',
                      line.startsWith('✓') ? 'text-[#00d084]' :
                      line.startsWith('⏭') ? 'text-[#ffa800]' :
                      line.startsWith('✗') ? 'text-primary' : 'text-muted-foreground'
                    )}>{line}</p>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        <GlossaryLegend terms={['TSS', 'FTP', 'NP', 'IF', 'CTL', 'ATL', 'TSB']} />

        {/* Format reference */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-bold text-foreground mb-4">Formatos Suportados</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            {[
              { color: '#ffa800', label: 'WorkoutFileExport.zip', items: ['Treinos em lote do TrainingPeaks', 'Extração automática dos .FIT.gz', 'Duplicatas ignoradas automaticamente', 'PMC recalculado após importação'] },
              { color: '#0088ff', label: '.FIT / .FIT.gz (Garmin)', items: ['Arquivo único de atividade', 'Garmin, Wahoo, Polar, Suunto', 'TSS calculado automaticamente com FTP', 'FC, Potência, Cadência, Elevação'] },
              { color: '#00d084', label: 'MetricsExport.zip (Garmin)', items: ['Pulso de repouso diário', 'Sono: profundo, REM, leve', 'Nível de stress Garmin', 'Peso corporal'] },
            ].map(({ color, label, items }) => (
              <div key={label}>
                <p className="font-semibold mb-2" style={{ color }}>{label}</p>
                <ul className="space-y-1 text-muted-foreground">
                  {items.map(i => <li key={i} className="flex items-center gap-1.5"><span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: color }} />{i}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
