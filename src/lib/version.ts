// Versão da aplicação e data/hora do último build (deploy).
// Os valores são injetados no build pelo next.config.ts.
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0'
export const BUILD_TIME = process.env.NEXT_PUBLIC_BUILD_TIME ?? ''

/** Data/hora do último deploy no fuso do usuário (ex.: 22/07/2026 14:30). */
export function formatBuildTime(): string {
  if (!BUILD_TIME) return ''
  const d = new Date(BUILD_TIME)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}
