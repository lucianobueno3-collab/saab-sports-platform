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
  /** fundo do cabeçalho da marca */
  headerBg: string
  /** caminho do logo em imagem (em /public); null = usa wordmark tipográfico */
  logoSrc: string | null
  /**
   * O arquivo do logo tem fundo sólido claro em vez de transparente.
   *
   * Nesse caso o tema escuro ganha uma placa clara arredondada atrás dele —
   * senão o logo vira um retângulo branco recortado no meio da barra escura.
   * O ideal continua sendo um PNG transparente; isto é a rede de proteção.
   */
  logoComFundoClaro?: boolean
  /**
   * Cor de destaque do portal do aluno, por tema.
   *
   * São duas porque a mesma cor não serve nos dois fundos: o laranja da Caqui
   * fica bonito no escuro, mas como texto sobre branco não alcança o contraste
   * mínimo de leitura. No claro entra uma versão mais fechada.
   */
  accent: { light: string; dark: string }
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
    headerBg: '#111118',
    logoSrc: null,
    // O vermelho SAAB já passa no contraste nos dois fundos: fica igual.
    accent: { light: '#e8001c', dark: '#e8001c' },
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
    headerBg: '#ffffff',   // Branco Ágil — combina com o fundo claro do logo
    logoSrc: '/logo-caqui.png',
    accent: { light: '#c2451a', dark: '#e8551f' },
  },
}

export function getBrand(id: string | null | undefined): Brand {
  return BRANDS[(id as BrandId)] ?? BRANDS.saab
}

/** Sufixos de transparência usados nos destaques do portal. */
const ALFAS = ['12', '14', '15', '18', '1f', '22', '33', '3d', '40', '44', '55'] as const

/**
 * As variáveis CSS de uma marca, para o portal do aluno.
 *
 * Tudo no portal aponta para `--marca` em vez do vermelho fixo, então trocar a
 * marca é trocar estas variáveis. O padrão em `globals.css` é o SAAB, o que faz
 * as telas do treinador — e qualquer componente compartilhado — continuarem
 * exatamente como estavam.
 */
export function varsDaMarca(b: Brand, escuro: boolean): Record<string, string> {
  const cor = escuro ? b.accent.dark : b.accent.light
  const vars: Record<string, string> = { '--marca': cor }
  for (const a of ALFAS) vars[`--marca-${a}`] = cor + a
  vars['--marca-fonte-titulo'] = b.headingFont
  return vars
}

/** Nomes das variáveis, para limpar ao sair do portal. */
export function nomesDasVars(): string[] {
  return ['--marca', ...ALFAS.map(a => `--marca-${a}`), '--marca-fonte-titulo']
}
