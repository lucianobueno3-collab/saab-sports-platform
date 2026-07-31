'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  androidChromeIntent, detectPlatform, isInAppBrowser, isIosSafari, isStandalone,
  type InstallPromptEvent, type Platform,
} from '@/lib/pwa-install'
import { Smartphone, Share, PlusSquare, MoreVertical, Download, X, CheckCircle2, ExternalLink, ChevronDown, Copy, Check } from 'lucide-react'

const RED = '#e8001c'

type Situation =
  | 'instalado'      // já está rodando como app
  | 'um-toque'       // Chrome/Edge guardou o evento: instala com um clique
  | 'ios'            // iPhone/iPad no Safari: passo a passo manual
  | 'ios-navegador'  // iPhone em Chrome/Firefox: precisa abrir no Safari
  | 'in-app'         // navegador do Instagram/Facebook: precisa sair de lá
  | 'manual'         // Android/desktop sem o evento: menu do navegador

/** Descobre em que situação o aparelho está e guarda o evento de instalação. */
export function useInstall() {
  const [platform, setPlatform] = useState<Platform>('desktop')
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  const [inApp, setInApp] = useState(false)
  const [iosSafari, setIosSafari] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setPlatform(detectPlatform())
    setInstalled(isStandalone())
    setInApp(isInAppBrowser())
    setIosSafari(isIosSafari())
    setReady(true)

    const onPrompt = (e: Event) => {
      // Segura o banner padrão do Chrome para oferecer o convite no nosso lugar.
      e.preventDefault()
      setPrompt(e as InstallPromptEvent)
    }
    const onInstalled = () => { setInstalled(true); setPrompt(null) }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const situation: Situation = installed ? 'instalado'
    : inApp ? 'in-app'
    : prompt ? 'um-toque'
    : platform === 'ios' ? (iosSafari ? 'ios' : 'ios-navegador')
    : 'manual'

  /** Instala com um toque. Devolve true se o usuário aceitou. */
  async function install() {
    if (!prompt) return false
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    setPrompt(null)
    return outcome === 'accepted'
  }

  return { ready, platform, situation, install, installed }
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black text-white" style={{ background: RED }}>{n}</span>
      <span className="text-sm text-foreground leading-relaxed pt-0.5">{children}</span>
    </li>
  )
}

const chip = 'inline-flex items-center gap-1 align-middle rounded-md px-1.5 py-0.5 mx-0.5 bg-background border border-border font-bold text-[12px]'
const botao = 'w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-black text-white'

/** Copia o endereço da página para o usuário colar no navegador de verdade. */
function CopiarLink() {
  const [copiado, setCopiado] = useState(false)

  async function copiar() {
    const url = window.location.href
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // Navegador interno costuma bloquear a área de transferência: usa o jeito antigo.
      const el = document.createElement('textarea')
      el.value = url
      el.style.position = 'fixed'
      el.style.opacity = '0'
      document.body.appendChild(el)
      el.select()
      try { document.execCommand('copy') } catch { /* sem jeito: o texto fica visível abaixo */ }
      document.body.removeChild(el)
    }
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2500)
  }

  return (
    <div className="space-y-2">
      <button onClick={copiar} className={botao} style={{ background: RED }}>
        {copiado ? <><Check className="w-4 h-4" /> Endereço copiado!</> : <><Copy className="w-4 h-4" /> Copiar o endereço</>}
      </button>
      {copiado && (
        <p className="text-[11px] text-muted-foreground text-center">
          Agora abra o Safari e cole na barra de cima.
        </p>
      )}
    </div>
  )
}

/** No Android abre o Chrome de verdade num toque; no iPhone só resta copiar. */
function SairDoNavegadorInterno() {
  const [intent, setIntent] = useState<string | null>(null)
  useEffect(() => {
    if (detectPlatform() === 'android') setIntent(androidChromeIntent(window.location.href))
  }, [])

  if (!intent) return <CopiarLink />

  return (
    <a href={intent} className={botao} style={{ background: RED }}>
      <ExternalLink className="w-4 h-4" /> Abrir no Chrome
    </a>
  )
}

/** Passo a passo de instalação conforme o aparelho. */
export function InstallSteps({ situation }: { situation: Situation }) {
  if (situation === 'instalado') {
    return (
      <p className="text-sm text-foreground flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4" style={{ color: '#00d084' }} />
        O app já está instalado neste aparelho.
      </p>
    )
  }

  if (situation === 'in-app') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-foreground leading-relaxed">
          Você abriu por dentro de outro app (WhatsApp, Instagram ou similar) e daqui não dá para instalar.
        </p>
        <SairDoNavegadorInterno />
        <p className="text-xs text-muted-foreground font-bold pt-1">Se o botão não funcionar:</p>
        <ol className="space-y-3">
          <Step n={1}>Toque nos <span className={chip}><MoreVertical className="w-3.5 h-3.5" /> três pontinhos</span> no canto da tela.</Step>
          <Step n={2}>Escolha <b>&quot;Abrir no navegador&quot;</b> (Safari no iPhone, Chrome no Android).</Step>
          <Step n={3}>Lá, siga o passo a passo desta mesma página.</Step>
        </ol>
      </div>
    )
  }

  if (situation === 'ios-navegador') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-foreground leading-relaxed">
          No iPhone, só o <b>Safari</b> consegue instalar o app — o Chrome e o Firefox não têm essa opção.
        </p>
        <CopiarLink />
        <ol className="space-y-3">
          <Step n={1}>Copie o endereço com o botão acima.</Step>
          <Step n={2}>Abra o <b>Safari</b> e cole na barra de endereço.</Step>
          <Step n={3}>Siga o passo a passo que vai aparecer lá.</Step>
        </ol>
      </div>
    )
  }

  if (situation === 'ios') {
    return (
      <ol className="space-y-3">
        <Step n={1}>Toque no botão <span className={chip}><Share className="w-3.5 h-3.5" /> Compartilhar</span>, na barra de baixo do Safari.</Step>
        <Step n={2}>Deslize a lista para cima e toque em <span className={chip}><PlusSquare className="w-3.5 h-3.5" /> Adicionar à Tela de Início</span>.</Step>
        <Step n={3}>Toque em <b>Adicionar</b>, no canto superior direito.</Step>
        <Step n={4}>Pronto — o ícone da SAAB aparece na tela do celular, igual a qualquer outro app.</Step>
      </ol>
    )
  }

  // Android/desktop sem o evento: caminho pelo menu do navegador.
  return (
    <ol className="space-y-3">
      <Step n={1}>Toque nos <span className={chip}><MoreVertical className="w-3.5 h-3.5" /> três pontinhos</span> do Chrome, no canto da tela.</Step>
      <Step n={2}>Escolha <b>&quot;Instalar app&quot;</b> ou <b>&quot;Adicionar à tela inicial&quot;</b>.</Step>
      <Step n={3}>Confirme em <b>Instalar</b>.</Step>
      <Step n={4}>Pronto — o ícone da SAAB aparece na tela do celular, igual a qualquer outro app.</Step>
    </ol>
  )
}

/** Modal com o passo a passo, para quem não tem o botão de um toque. */
export function InstallGuideModal({ situation, onClose }: { situation: Situation; onClose: () => void }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-2xl max-h-[92vh] flex flex-col safe-bottom" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-black text-foreground flex items-center gap-2">
            <Smartphone className="w-4 h-4" style={{ color: RED }} /> Instalar o app
          </h2>
          <button onClick={onClose} aria-label="Fechar" className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="overflow-y-auto px-5 py-5">
          <InstallSteps situation={situation} />
        </div>
      </div>
    </div>,
    document.body,
  )
}

/**
 * Convite que aparece sozinho, sem o aluno procurar nada.
 *
 * No Android o Chrome deixa instalar de verdade: um toque abre a caixa do
 * próprio sistema. No iPhone isso não existe — a Apple não expõe nenhuma API
 * de instalação, então o máximo possível é mostrar o caminho na hora certa,
 * apontando para o botão Compartilhar. Aparece uma vez por aparelho.
 */
export function InstallCoach({ storageKey = 'saab:install-coach-visto' }: { storageKey?: string }) {
  const { ready, situation, install } = useInstall()
  const [show, setShow] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!ready || (situation !== 'ios' && situation !== 'um-toque')) return
    try { if (localStorage.getItem(storageKey) === '1') return } catch { /* modo privado */ }
    // Um respiro antes de aparecer, para não atropelar o carregamento da tela.
    const t = setTimeout(() => setShow(true), 2500)
    return () => clearTimeout(t)
  }, [ready, situation, storageKey])

  function close() {
    setShow(false)
    try { localStorage.setItem(storageKey, '1') } catch { /* modo privado */ }
  }

  if (!mounted || !show) return null
  const umToque = situation === 'um-toque'

  return createPortal(
    <div className="fixed inset-0 z-[95] flex flex-col justify-end bg-black/70 backdrop-blur-[2px]" onClick={close}>
      <div className="px-4 pb-2 safe-bottom" onClick={e => e.stopPropagation()}>
        <div className="bg-card border border-border rounded-2xl shadow-2xl p-5 max-w-md mx-auto">
          <div className="flex items-start justify-between gap-3">
            <p className="text-base font-black text-foreground">Deixe a SAAB na sua tela de início</p>
            <button onClick={close} aria-label="Agora não" className="shrink-0 text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
          </div>

          {umToque ? (
            <>
              <p className="text-xs text-muted-foreground mt-1 mb-4">
                Abre direto do celular, sem procurar o link toda vez.
              </p>
              <button
                onClick={async () => { await install(); close() }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-base font-black text-white"
                style={{ background: RED }}>
                <Download className="w-5 h-5" /> Instalar
              </button>
              <button onClick={close} className="w-full mt-2 py-2 text-xs font-bold text-muted-foreground hover:text-foreground">
                Agora não
              </button>
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mt-1 mb-4">
                No iPhone são três toques — a Apple não permite instalar automaticamente.
              </p>
              <InstallSteps situation="ios" />
              <button onClick={close} className="w-full mt-4 py-2.5 rounded-lg text-sm font-black text-white" style={{ background: RED }}>
                Entendi
              </button>
            </>
          )}
        </div>

        {/* No iPhone, seta apontando para a barra do Safari, onde fica o Compartilhar */}
        {!umToque && (
          <div className="flex justify-center mt-1">
            <ChevronDown className="w-7 h-7 text-white/80 animate-bounce" />
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

/**
 * Convite para instalar o app. Some sozinho quando já está instalado
 * e lembra a dispensa para não insistir a cada visita.
 */
export function InstallAppCard({ storageKey = 'saab:install-dismissed' }: { storageKey?: string }) {
  const { ready, situation, install } = useInstall()
  const [guide, setGuide] = useState(false)
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    try { setDismissed(localStorage.getItem(storageKey) === '1') } catch { setDismissed(false) }
  }, [storageKey])

  function dismiss() {
    setDismissed(true)
    try { localStorage.setItem(storageKey, '1') } catch { /* modo privado: só some nesta sessão */ }
  }

  if (!ready || situation === 'instalado' || dismissed) return null

  return (
    <>
      <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: 'var(--card)', border: `1px solid ${RED}44` }}>
        <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: RED + '1a' }}>
          <Smartphone className="w-5 h-5" style={{ color: RED }} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-foreground">Instale o app no celular</p>
          <p className="text-[11px] text-muted-foreground">Abre direto da tela de início, sem procurar o link toda vez.</p>
        </div>
        <button
          onClick={() => { if (situation === 'um-toque') install(); else setGuide(true) }}
          className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-black text-white"
          style={{ background: RED }}>
          <Download className="w-4 h-4" /> Instalar
        </button>
        <button onClick={dismiss} aria-label="Agora não" className="shrink-0 text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>
      {guide && <InstallGuideModal situation={situation} onClose={() => setGuide(false)} />}
    </>
  )
}

/** Bloco grande da página /instalar, que o treinador manda para os alunos. */
export function InstallPageBody() {
  const { ready, situation, install } = useInstall()
  const [ok, setOk] = useState(false)

  if (!ready) return null

  return (
    <div className="space-y-5">
      {situation === 'um-toque' && !ok && (
        <button
          onClick={async () => setOk(await install())}
          className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl text-base font-black text-white"
          style={{ background: RED }}>
          <Download className="w-5 h-5" /> Instalar agora
        </button>
      )}

      {(ok || situation === 'instalado') ? (
        <div className="rounded-2xl p-5 text-center" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <CheckCircle2 className="w-9 h-9 mx-auto mb-2" style={{ color: '#00d084' }} />
          <p className="text-base font-black text-foreground">App instalado!</p>
          <p className="text-sm text-muted-foreground mt-1">Procure o ícone da SAAB na tela do seu celular e entre por ele daqui pra frente.</p>
        </div>
      ) : (
        <div className="rounded-2xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          {situation === 'um-toque' && (
            <p className="text-xs text-muted-foreground mb-4">Se o botão acima não funcionar, faça assim:</p>
          )}
          <InstallSteps situation={situation === 'um-toque' ? 'manual' : situation} />
        </div>
      )}

      <a href="/atleta" className="flex items-center justify-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground">
        Entrar no portal <ExternalLink className="w-3.5 h-3.5" />
      </a>
    </div>
  )
}
