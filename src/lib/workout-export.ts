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
  const pace = paceRange(zone, sport, th)
  if (pace) return `${pace} · ${z.label}`
  const hr = hrRange(zone, th)
  if (hr) return `${hr} · ${z.label}`
  return `${z.label} · ${z.name}`
}

/** Faixa de ritmo da zona, ex.: "6:10–6:40 /km". Só corrida e com limiar. */
export function paceRange(zone: Zone, sport: string, th?: Thresholds): string | null {
  if (sport !== 'running' || !th?.thresholdPaceSecKm) return null
  const [a, b] = PACE_MULT[zone]
  return `${fmtPace(th.thresholdPaceSecKm * a)}–${fmtPace(th.thresholdPaceSecKm * b)} /km`
}

/**
 * Ritmo a partir da % do ritmo limite prescrita pelo treinador.
 *
 * 100% = ritmo de limiar, e a % é de VELOCIDADE: correr a 88% do limite é
 * mais lento, a 110% é mais rápido. Por isso o ritmo em min/km é o do limiar
 * dividido pela fração — e a faixa aparece invertida (o menor % dá o ritmo
 * mais lento, que é o primeiro número).
 */
export function pacePctRange(pct: [number, number], sport: string, th?: Thresholds): string | null {
  if (sport !== 'running' || !th?.thresholdPaceSecKm) return null
  const [lo, hi] = pct
  if (lo <= 0 || hi <= 0) return null          // 0% = parado, não há ritmo
  return `${fmtPace(th.thresholdPaceSecKm / (lo / 100))}–${fmtPace(th.thresholdPaceSecKm / (hi / 100))} /km`
}

/** Velocidade média do passo em fração do limiar, para estimar distância. */
function fracaoDoLimiar(zone: Zone, pct?: [number, number]): number {
  if (pct) return (pct[0] + pct[1]) / 200
  const [a, b] = PACE_MULT[zone]
  return 2 / (a + b)                            // multiplicador de pace → fração de velocidade
}

/** Faixa de frequência cardíaca da zona, ex.: "148–162 bpm". */
export function hrRange(zone: Zone, th?: Thresholds): string | null {
  if (!th?.lthr) return null
  const [a, b] = HR_MULT[zone]
  return `${Math.round(th.lthr * a)}–${Math.round(th.lthr * b)} bpm`
}

/**
 * Distância aproximada de um trecho, pelo ritmo médio da zona.
 * Serve para o aluno saber se o treino "dá 5 km ou 12 km" antes de sair.
 */
export function estimateKm(min: number, zone: Zone, sport: string, th?: Thresholds, pct?: [number, number]): number | null {
  if (sport !== 'running' || !th?.thresholdPaceSecKm || min <= 0) return null
  const fracao = fracaoDoLimiar(zone, pct)
  if (fracao <= 0) return null                              // passo parado não percorre distância
  const paceMedio = th.thresholdPaceSecKm / fracao          // seg por km
  return (min * 60) / paceMedio
}

/** Distância aproximada do treino inteiro, em km (null quando não dá para estimar). */
export function estimateTotalKm(
  passos: { min: number; zone: Zone; pacePct?: [number, number]; km?: number }[], sport: string, th?: Thresholds,
): number | null {
  if (sport !== 'running') return null
  // Passo prescrito em distância já traz o número; os demais são estimados.
  const total = passos.reduce((soma, p) => soma + (p.km ?? estimateKm(p.min, p.zone, sport, th, p.pacePct) ?? 0), 0)
  return total > 0 ? total : null
}

/** Distância em texto curto: "8,4 km" ou "600 m". */
export function fmtKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`
  return `${km.toFixed(1).replace('.', ',')} km`
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
