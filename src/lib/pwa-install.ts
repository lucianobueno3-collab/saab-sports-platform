/**
 * Detecção de plataforma para instalar o app na tela de início.
 *
 * Cada sistema instala de um jeito: o Android/Chrome dispara um evento e a
 * instalação é um toque; o iPhone não tem esse evento e exige o passo a passo
 * pelo menu Compartilhar; e dentro do navegador do Instagram/Facebook não dá
 * para instalar de jeito nenhum — só abrindo no navegador de verdade.
 */

/** Evento do Chrome que permite instalar com um toque (não está no lib.dom). */
export type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type Platform = 'ios' | 'android' | 'desktop'

/** Navegador embutido de outro app (Instagram, Facebook, TikTok, LinkedIn). */
export function isInAppBrowser(ua = navigator.userAgent) {
  return /FBAN|FBAV|Instagram|Line\/|TikTok|LinkedInApp|GSA\//i.test(ua)
}

export function detectPlatform(ua = navigator.userAgent): Platform {
  // iPad moderno se anuncia como Mac; a pista é ser Mac com tela sensível ao toque.
  const iPadOS = /Macintosh/.test(ua) && typeof document !== 'undefined' && navigator.maxTouchPoints > 1
  if (/iPad|iPhone|iPod/.test(ua) || iPadOS) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  return 'desktop'
}

/** No iPhone só o Safari instala — Chrome e Firefox do iOS não têm a opção. */
export function isIosSafari(ua = navigator.userAgent) {
  return detectPlatform(ua) === 'ios' && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua)
}

/** Já está rodando como app instalado (fora da aba do navegador). */
export function isStandalone() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches
    || window.matchMedia('(display-mode: fullscreen)').matches
    // Safari do iOS usa uma propriedade própria, fora do padrão.
    || (navigator as Navigator & { standalone?: boolean }).standalone === true
}
