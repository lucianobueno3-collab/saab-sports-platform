// Exportação de treino estruturado para relógio (arquivo .TCX) + visão "Passos"
// no estilo TrainingPeaks. Os alvos são por ZONA de FC (PredefinedHeartRateZone),
// que o relógio interpreta com as zonas do próprio atleta — portável e sem
// depender dos limiares cadastrados.

import { type WorkoutStructure, type Step, type Zone, ZONES, KIND_LABEL } from '@/lib/workout-structure'

// Alvos aproximados por zona (para exibição, quando há limiares do atleta).
// Multiplicadores de pace sobre o pace de limiar (sec/km): >1 = mais lento.
const PACE_MULT: Record<Zone, [number, number]> = {
  1: [1.29, 1.15], 2: [1.15, 1.06], 3: [1.06, 1.01], 4: [1.00, 0.97], 5: [0.97, 0.89],
}
// Multiplicadores de FC sobre a FC de limiar (LTHR).
const HR_MULT: Record<Zone, [number, number]> = {
  1: [0.70, 0.81], 2: [0.81, 0.89], 3: [0.90, 0.94], 4: [0.95, 1.00], 5: [1.00, 1.06],
}

export type Thresholds = { thresholdPaceSecKm?: number | null; lthr?: number | null }

function fmtPace(sec: number) { const m = Math.floor(sec / 60), s = Math.round(sec % 60); return `${m}:${s.toString().padStart(2, '0')}` }

/** Alvo legível de um passo: faixa de pace/FC quando há limiar, senão só a zona. */
export function stepTargetLabel(zone: Zone, sport: string, th?: Thresholds): string {
  const z = ZONES[zone]
  if (sport === 'running' && th?.thresholdPaceSecKm) {
    const [a, b] = PACE_MULT[zone]
    return `${fmtPace(th.thresholdPaceSecKm * a)}–${fmtPace(th.thresholdPaceSecKm * b)} /km · ${z.label}`
  }
  if (th?.lthr) {
    const [a, b] = HR_MULT[zone]
    return `${Math.round(th.lthr * a)}–${Math.round(th.lthr * b)} bpm · ${z.label}`
  }
  return `${z.label} · ${z.name}`
}

export type DisplaySegment =
  | { type: 'step'; step: Step }
  | { type: 'repeat'; times: number; steps: Step[] }

/** Estrutura pronta para a visão "Passos" (mantém as séries agrupadas). */
export function toDisplaySegments(st: WorkoutStructure): DisplaySegment[] { return st as DisplaySegment[] }

// ─── Geração do arquivo .TCX (treino estruturado) ───────────────────────────
function tcxSport(sport: string) { return sport === 'cycling' ? 'Biking' : sport === 'running' ? 'Running' : 'Other' }
function intensity(kind: Step['kind']) { return kind === 'recovery' || kind === 'cooldown' ? 'Resting' : 'Active' }
function esc(s: string) { return s.replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c] as string)) }

function stepXml(step: Step, id: number): string {
  return `    <Step xsi:type="Step_t">
      <StepId>${id}</StepId>
      <Name>${esc(KIND_LABEL[step.kind])}</Name>
      <Duration xsi:type="Time_t"><Seconds>${Math.max(1, Math.round(step.min * 60))}</Seconds></Duration>
      <Intensity>${intensity(step.kind)}</Intensity>
      <Target xsi:type="HeartRate_t">
        <HeartRateZone xsi:type="PredefinedHeartRateZone_t"><Number>${step.zone}</Number></HeartRateZone>
      </Target>
    </Step>`
}

/** Gera o conteúdo .TCX de um treino estruturado. */
export function buildWorkoutTCX(title: string, sport: string, structure: WorkoutStructure): string {
  let id = 0
  const steps: string[] = []
  for (const seg of structure) {
    if (seg.type === 'step') { steps.push(stepXml(seg.step, ++id)) }
    else {
      const rid = ++id
      const children = seg.steps.map(s => stepXml(s, ++id).replace('<Step xsi:type="Step_t">', '        <Child xsi:type="Step_t">').replace('    </Step>', '        </Child>').replace(/^    /gm, '  '))
      steps.push(`    <Step xsi:type="Repeat_t">
      <StepId>${rid}</StepId>
      <Repetitions>${Math.max(1, seg.times)}</Repetitions>
${children.join('\n')}
    </Step>`)
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Workouts>
    <Workout Sport="${tcxSport(sport)}">
      <Name>${esc(title).slice(0, 30)}</Name>
${steps.join('\n')}
    </Workout>
  </Workouts>
</TrainingCenterDatabase>`
}

/** Dispara o download de um arquivo no navegador. */
export function downloadFile(filename: string, content: string, mime = 'application/xml') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function slugify(s: string) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/(^-|-$)/g, '').toLowerCase().slice(0, 40) || 'treino' }
