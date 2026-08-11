// Preferência de "modo de visualização" para contas duplas (treinador que
// também é atleta). Guardada no navegador; escolhida no login pelo seletor
// "Sou treinador / Sou atleta" e usada para decidir a área inicial.
export type ViewMode = 'coach' | 'athlete'
const KEY = 'saab-view'

export function setViewMode(m: ViewMode) {
  try { localStorage.setItem(KEY, m) } catch { /* SSR / storage indisponível */ }
}
export function getViewMode(): ViewMode | null {
  try { return localStorage.getItem(KEY) as ViewMode | null } catch { return null }
}
