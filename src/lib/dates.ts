// Datas no fuso local — toISOString() usa UTC e vira "amanhã" à noite no Brasil (UTC-3).

/** Data de hoje no fuso local, formato YYYY-MM-DD */
export function todayLocalISO(): string {
  return toLocalISO(new Date())
}

/** Converte um Date para YYYY-MM-DD no fuso local */
export function toLocalISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Dias entre hoje (local) e uma data YYYY-MM-DD; positivo = futuro */
export function daysFromToday(dateISO: string): number {
  const today = new Date(todayLocalISO() + 'T00:00:00')
  const target = new Date(dateISO + 'T00:00:00')
  return Math.round((target.getTime() - today.getTime()) / 86400000)
}
