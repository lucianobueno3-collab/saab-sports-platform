// Identidades visuais do portal do aluno (white-label).
// treinador/admin permanece sempre SAAB — isto vale só para /portal.

export type BrandId = 'saab' | 'caqui'

export interface Brand {
  id: BrandId
  name: string
  tagline: string
  /** cor primária (destaques, botões, "forma") */
  primary: string
  /** cor secundária/estrutural */
  secondary: string
  /** fundo da página */
  bg: string
  /** fundo dos cards */
  card: string
  /** borda dos cards */
  border: string
  /** texto principal */
  text: string
  /** texto secundário */
  muted: string
  /** família de fonte dos títulos (CSS var) */
  headingFont: string
  /** família de fonte do corpo (CSS var) */
  bodyFont: string
  /** mostra o motivo de linhas diagonais no cabeçalho */
  diagonalMotif: boolean
}

export const BRANDS: Record<BrandId, Brand> = {
  saab: {
    id: 'saab',
    name: 'SAAB Sports',
    tagline: 'Performance Platform',
    primary: '#e8001c',
    secondary: '#0088ff',
    bg: '#0a0a0f',
    card: '#111118',
    border: '#2a2a3a',
    text: '#e8e8f0',
    muted: '#888899',
    headingFont: 'var(--font-sans)',
    bodyFont: 'var(--font-sans)',
    diagonalMotif: false,
  },
  caqui: {
    id: 'caqui',
    name: 'Caqui Pro',
    tagline: 'Metodologia by SAAB Sports',
    primary: '#e8551f',   // Caqui Dinâmico — laranja-avermelhado vibrante
    secondary: '#1b2a4a', // Azul Resistência — azul-marinho profundo
    bg: '#f7f8fa',        // Branco Ágil
    card: '#ffffff',
    border: '#e2e5ea',
    text: '#1b2a4a',      // usa o azul-marinho como texto principal
    muted: '#6b7280',     // Cinza Técnico
    headingFont: 'var(--font-montserrat)',
    bodyFont: 'var(--font-open-sans)',
    diagonalMotif: true,
  },
}

export function getBrand(id: string | null | undefined): Brand {
  return BRANDS[(id as BrandId)] ?? BRANDS.saab
}
