'use client'

import { useEffect, useState } from 'react'
import { QrCode, Copy, Check, MessageCircle, Download } from 'lucide-react'

/**
 * Kit de divulgação do treinador: link curto, QR para mostrar no treino e
 * mensagem pronta para o WhatsApp. A ideia é o treinador não precisar
 * escrever nada — só tocar e enviar.
 */
export function ShareInstallCard() {
  const [url, setUrl] = useState('')
  const [qr, setQr] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    const link = `${window.location.origin}/app`
    setUrl(link)
    // Carrega o gerador só aqui, para não pesar nas outras telas.
    import('qrcode').then(({ default: QRCode }) => {
      QRCode.toDataURL(link, { width: 512, margin: 1, errorCorrectionLevel: 'M' })
        .then(setQr)
        .catch(() => setQr(null))
    }).catch(() => setQr(null))
  }, [])

  const mensagem = `Oi! Instale o app da SAAB no seu celular para ver seus treinos:\n\n${url}\n\nÉ rapidinho e não passa por loja de aplicativos.`

  async function copiar() {
    try { await navigator.clipboard.writeText(url) } catch { return }
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2500)
  }

  function baixarQr() {
    if (!qr) return
    const a = document.createElement('a')
    a.href = qr
    a.download = 'saab-instalar-qrcode.png'
    a.click()
  }

  const btn = 'flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors'

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-5">
      <div className="flex items-center gap-3 pb-4 border-b border-border">
        <div className="w-10 h-10 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-center">
          <QrCode className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-foreground">Divulgar o app</h2>
          <p className="text-xs text-muted-foreground">Para o aluno instalar no celular dele</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-start">
        {qr && (
          <div className="shrink-0 text-center">
            {/* Fundo branco fixo: QR em fundo escuro não é lido pela câmera. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="QR code para instalar o app" className="w-36 h-36 rounded-lg bg-white p-1.5" />
            <button onClick={baixarQr} className="text-[11px] text-muted-foreground hover:text-foreground mt-1.5 inline-flex items-center gap-1">
              <Download className="w-3 h-3" /> Baixar
            </button>
          </div>
        )}

        <div className="flex-1 w-full space-y-3">
          <div>
            <p className="text-xs font-medium text-foreground mb-1.5">Link para o aluno</p>
            <code className="block text-xs bg-background border border-border rounded-lg px-3 py-2.5 text-foreground break-all">{url}</code>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <a href={`https://wa.me/?text=${encodeURIComponent(mensagem)}`} target="_blank" rel="noopener noreferrer"
              className={`${btn} bg-primary hover:bg-primary/90 text-white`}>
              <MessageCircle className="w-4 h-4" /> Enviar no WhatsApp
            </a>
            <button onClick={copiar} className={`${btn} bg-background border border-border text-foreground hover:bg-card`}>
              {copiado ? <><Check className="w-4 h-4" /> Copiado!</> : <><Copy className="w-4 h-4" /> Copiar link</>}
            </button>
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            O passo a passo se adapta sozinho ao aparelho do aluno. Mostre o QR no treino
            para quem preferir escanear em vez de receber mensagem.
          </p>
        </div>
      </div>
    </div>
  )
}
