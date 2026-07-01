'use client'

import { useState, useRef, useEffect } from 'react'
import { Topbar } from '@/components/layout/topbar'
import { GlossaryLegend } from '@/components/ui/glossary-legend'
import { Upload, FileText, CheckCircle, AlertCircle, X, Info, Loader2, ChevronDown, SkipForward, Archive, Heart, Dumbbell } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { parseFitFile } from '@/lib/parsers/fit-parser'
import { parseTPCSV } from '@/lib/parsers/csv-parser'
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

type AthleteSummary = { id: string; full_name: string; ftp_watts: number | null }

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
    createClient().from('athletes').select('id, full_name, ftp_watts').eq('active', true).order('full_name')
      .then(({ data }) => setAthletes(data ?? []))
  }, [])

  const athlete = athletes.find(a => a.id === selectedAthlete) ?? null

  async function parseSingleFit(buf: ArrayBuffer, name: string, ftp?: number): Promise<ParsedFile['metrics']> {
    const act = await parseFitFile(buf, ftp)
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
                const metrics = await parseSingleFit(buf, nf.name, athlete?.ftp_watts ?? undefined)
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
          const metrics = await parseSingleFit(buf, raw.name, athlete?.ftp_watts ?? undefined)
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

    for (const uf of readyFiles) {
      if (uf.ext === 'fit') {
        try {
          const act = await parseFitFile(uf.buffer!, athlete.ftp_watts ?? undefined)
          const { error } = await sb.from('activities').insert({
            athlete_id: selectedAthlete,
            name: act.name,
            sport: sportToDb(act.sport),
            started_at: act.date,
            duration_seconds: act.duration_seconds,
            distance_meters: act.distance_meters ?? null,
            avg_power_watts: act.avg_power_watts ?? null,
            normalized_power: act.normalized_power ?? null,
            intensity_factor: act.intensity_factor ?? null,
            tss: act.tss ?? null,
            avg_hr_bpm: act.avg_hr ?? null,
            max_hr_bpm: act.max_hr ?? null,
            avg_cadence_rpm: act.avg_cadence ?? null,
            elevation_gain_m: act.elevation_gain_m ?? null,
            calories: act.calories ?? null,
            source: 'fit' as const,
            external_id: uf.name,
            ftp_used: athlete.ftp_watts ?? null,
          })
          if (error) {
            const isDuplicate = error.message?.includes('uq_activity') || error.code === '23505'
            if (isDuplicate) { totalSkipped++; details.push(`⏭ Duplicata: ${uf.name}`) }
            else { totalFailed++; details.push(`✗ Falhou: ${uf.name} — ${error.message} (${error.code})`) }
          } else { totalImported++; details.push(`✓ ${uf.name}`) }
        } catch (err) { totalFailed++; details.push(`✗ ${uf.name} — ${String(err)}`) }

      } else if (uf.ext === 'csv' && uf.rawFile) {
        try {
          const acts = await parseTPCSV(uf.rawFile)
          let csvSkipped = 0
          for (const act of acts) {
            const { error } = await sb.from('activities').insert({
              athlete_id: selectedAthlete,
              name: act.title || sportLabel(act.sport),
              sport: sportToDb(act.sport),
              started_at: act.date,
              duration_seconds: act.duration_seconds,
              distance_meters: act.distance_meters ?? null,
              tss: act.tss ?? null,
              normalized_power: act.np ?? null,
              intensity_factor: act.if_ ?? null,
              avg_hr_bpm: act.avg_hr ?? null,
              avg_power_watts: act.avg_power ?? null,
              calories: act.calories ?? null,
              source: 'csv' as const,
              external_id: `${act.date}-${act.title}`,
              ftp_used: athlete.ftp_watts ?? null,
            })
            if (error) {
              const isDuplicate = error.message?.includes('uq_activity') || error.code === '23505'
              if (isDuplicate) { totalSkipped++; csvSkipped++ }
              else { totalFailed++; details.push(`✗ CSV: ${act.title} — ${error.message}`) }
            } else { totalImported++ }
          }
          if (csvSkipped > 0) details.push(`⏭ ${csvSkipped} atividades CSV já existiam`)
        } catch (err) { totalFailed++; details.push(`✗ CSV ${uf.name} — ${String(err)}`) }
      }
    }

    if (totalImported > 0) {
      const { error: rpcErr } = await sb.rpc('recalculate_pmc', { p_athlete_id: selectedAthlete })
      if (rpcErr) details.push(`⚠ PMC: ${rpcErr.message}`)
      else details.push(`✓ PMC recalculado`)
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
              <li><strong>Métricas Garmin (ZIP):</strong> Settings → Export → Metrics Export → Download ZIP</li>
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
            <p className="text-xs text-muted-foreground mt-2">
              FTP: <span className="text-foreground font-medium">{athlete.ftp_watts ? `${athlete.ftp_watts}W` : 'não definido'}</span>
              {!athlete.ftp_watts && <span className="text-[#ffa800] ml-2">⚠ Sem FTP — TSS não será calculado para arquivos .FIT</span>}
            </p>
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
