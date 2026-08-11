// Conquistas e narrativa de evolução do aluno.
//
// Nada de medalha genérica: cada marco sai dos dados reais e é escrito na
// linguagem de quem está começando. O objetivo é o oposto do que a maioria
// dos apps faz — em vez de punir quem falhou, celebrar o que já mudou.

export type Achievement = {
  key: string
  icon: 'trophy' | 'flame' | 'clock' | 'route' | 'calendar' | 'sparkles'
  title: string
  detail: string
  date?: string | null
}

export type AchievementInput = {
  /** atividades realizadas (mais recente primeiro ou qualquer ordem) */
  activities: { started_at: string; duration_seconds: number; distance_meters: number | null }[]
  /** treinos planejados de todo o plano */
  planned: { date: string; completed: boolean; skipped?: boolean }[]
}

const fmtD = (iso: string) => new Date(iso).toLocaleDateString('pt-BR')
const km = (m: number) => m / 1000

/** Marcos já conquistados, do mais recente para o mais antigo. */
export function computeAchievements({ activities, planned }: AchievementInput): Achievement[] {
  const out: Achievement[] = []
  const acts = [...activities].sort((a, b) => (a.started_at < b.started_at ? -1 : 1))
  const todayISO = new Date().toLocaleDateString('en-CA')

  // ── Primeira vez em cada distância marcante ─────────────────────────────
  for (const alvo of [3, 5, 10, 21.1, 42.2]) {
    const first = acts.find(a => a.distance_meters != null && km(a.distance_meters) >= alvo)
    if (first) {
      const label = alvo === 21.1 ? 'meia maratona' : alvo === 42.2 ? 'maratona' : `${alvo} km`
      out.push({
        key: `dist_${alvo}`, icon: alvo >= 21 ? 'trophy' : 'route',
        title: `Primeiros ${label}`,
        detail: `Você completou ${label} pela primeira vez em ${fmtD(first.started_at)}. Isso não se desfaz.`,
        date: first.started_at,
      })
    }
  }

  // ── Primeira vez correndo X minutos ─────────────────────────────────────
  for (const min of [20, 30, 45, 60]) {
    const first = acts.find(a => a.duration_seconds >= min * 60)
    if (first) {
      out.push({
        key: `tempo_${min}`, icon: 'clock',
        title: `${min} minutos em movimento`,
        detail: `Sua primeira sessão de ${min} minutos foi em ${fmtD(first.started_at)}.`,
        date: first.started_at,
      })
    }
  }

  // ── Semana cheia (todos os treinos planejados concluídos) ───────────────
  const byWeek = new Map<string, { total: number; done: number }>()
  for (const p of planned) {
    if (p.date > todayISO) continue
    const d = new Date(p.date + 'T12:00:00')
    const monday = new Date(d); monday.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    const k = monday.toLocaleDateString('en-CA')
    const cur = byWeek.get(k) ?? { total: 0, done: 0 }
    cur.total++; if (p.completed) cur.done++
    byWeek.set(k, cur)
  }
  const fullWeeks = [...byWeek.entries()].filter(([, v]) => v.total > 0 && v.done === v.total)
  if (fullWeeks.length > 0) {
    const first = fullWeeks.sort((a, b) => (a[0] < b[0] ? -1 : 1))[0]
    out.push({
      key: 'semana_cheia', icon: 'calendar',
      title: fullWeeks.length === 1 ? 'Primeira semana 100%' : `${fullWeeks.length} semanas 100%`,
      detail: fullWeeks.length === 1
        ? `Você fez todos os treinos da semana de ${fmtD(first[0])}.`
        : `Você já fechou ${fullWeeks.length} semanas com todos os treinos feitos.`,
      date: first[0],
    })
  }

  // ── Total acumulado ─────────────────────────────────────────────────────
  const totalKm = acts.reduce((s, a) => s + (a.distance_meters ? km(a.distance_meters) : 0), 0)
  if (totalKm >= 10) {
    out.push({
      key: 'total_km', icon: 'flame',
      title: `${totalKm.toFixed(0)} km acumulados`,
      detail: `Somando tudo que você já correu desde o começo. Cada saída entrou nessa conta.`,
    })
  }

  // Mais recentes primeiro; os sem data (acumulados) vão ao final
  return out.sort((a, b) => (a.date && b.date ? (a.date < b.date ? 1 : -1) : a.date ? -1 : 1))
}

/** Narrativa "onde você estava × onde está" — o texto que segura o iniciante. */
export function evolutionStory(acts: AchievementInput['activities']): string | null {
  if (acts.length < 4) return null
  const sorted = [...acts].sort((a, b) => (a.started_at < b.started_at ? -1 : 1))
  const cut = new Date(); cut.setDate(cut.getDate() - 28)
  const cutISO = cut.toISOString()
  const older = sorted.filter(a => a.started_at < cutISO)
  const recent = sorted.filter(a => a.started_at >= cutISO)
  if (older.length === 0 || recent.length === 0) return null

  const avg = (list: typeof sorted, f: (a: (typeof sorted)[number]) => number) =>
    list.reduce((s, a) => s + f(a), 0) / list.length

  const durOld = avg(older, a => a.duration_seconds) / 60
  const durNew = avg(recent, a => a.duration_seconds) / 60
  const withDist = (l: typeof sorted) => l.filter(a => a.distance_meters != null)
  const distOld = withDist(older).length ? avg(withDist(older), a => km(a.distance_meters!)) : null
  const distNew = withDist(recent).length ? avg(withDist(recent), a => km(a.distance_meters!)) : null

  const partes: string[] = []
  if (durNew - durOld >= 3) partes.push(`suas sessões passaram de ~${durOld.toFixed(0)} para ~${durNew.toFixed(0)} minutos`)
  if (distOld != null && distNew != null && distNew - distOld >= 0.5) partes.push(`a distância média subiu de ${distOld.toFixed(1)} para ${distNew.toFixed(1)} km`)
  if (partes.length === 0) return null
  return `Comparando com um mês atrás, ${partes.join(' e ')}. Isso é adaptação acontecendo.`
}
