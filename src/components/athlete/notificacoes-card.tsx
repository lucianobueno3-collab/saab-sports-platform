'use client'

import { useEffect, useState } from 'react'
import { estadoDoPush, ligarPush, desligarPush, type EstadoDoPush } from '@/lib/push'
import { Bell, BellOff, Loader2, Smartphone, Check } from 'lucide-react'

const DISPENSADO = 'saab:push-dispensado'

/**
 * Convite para ligar as notificações, no portal do aluno.
 *
 * Some quando já está ligado, quando o navegador não suporta, e quando as
 * chaves VAPID não estão configuradas — nesse caso o recurso simplesmente não
 * existe, e mostrar um botão morto seria pior do que não mostrar nada.
 *
 * O aluno pode dispensar. O convite não volta: insistir em pedir permissão é
 * o caminho mais curto para ele bloquear de vez, e aí nem o recado importante
 * chega.
 */
export function NotificacoesCard({ athleteId }: { athleteId: string }) {
  const [estado, setEstado] = useState<EstadoDoPush | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [dispensado, setDispensado] = useState(true)

  useEffect(() => {
    try { setDispensado(localStorage.getItem(DISPENSADO) === '1') } catch { setDispensado(false) }
    estadoDoPush().then(setEstado).catch(() => setEstado('indisponivel'))
  }, [])

  function dispensar() {
    setDispensado(true)
    try { localStorage.setItem(DISPENSADO, '1') } catch { /* modo privado */ }
  }

  async function ligar() {
    setOcupado(true)
    setEstado(await ligarPush(athleteId).catch(() => 'desligado' as const))
    setOcupado(false)
  }

  if (!estado || estado === 'indisponivel' || estado === 'sem-chave') return null

  // Já ligado: um lembrete discreto de que dá para desligar, sem ocupar espaço.
  if (estado === 'ligado') {
    return (
      <button
        onClick={async () => { setOcupado(true); setEstado(await desligarPush()); setOcupado(false) }}
        disabled={ocupado}
        className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground">
        {ocupado ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" style={{ color: '#00d084' }} />}
        Avisos ligados neste aparelho · desligar
      </button>
    )
  }

  if (dispensado) return null

  const conteudo = {
    'precisa-instalar': {
      icone: Smartphone,
      titulo: 'Instale o app para receber avisos',
      texto: 'No iPhone, os avisos só funcionam com o app na tela de início. Toque em Compartilhar → Adicionar à Tela de Início e volte aqui.',
      acao: null,
    },
    'negado': {
      icone: BellOff,
      titulo: 'Avisos bloqueados',
      texto: 'Você bloqueou as notificações para este site. Dá para liberar nas configurações do navegador, em Notificações.',
      acao: null,
    },
    'desligado': {
      icone: Bell,
      titulo: 'Receba um aviso quando seu treinador responder',
      texto: 'E o lembrete do treino do dia. Só isso — nada de propaganda.',
      acao: 'Ligar avisos',
    },
  }[estado]

  const Icon = conteudo.icone

  return (
    <div className="rounded-2xl p-4 flex items-start gap-3"
      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
      <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: 'var(--marca-1f)' }}>
        <Icon className="w-4 h-4" style={{ color: 'var(--marca)' }} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold text-foreground">{conteudo.titulo}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{conteudo.texto}</p>

        <div className="flex items-center gap-3 mt-2.5">
          {conteudo.acao && (
            <button onClick={ligar} disabled={ocupado}
              className="px-3 py-1.5 rounded-lg text-[12px] font-bold text-white disabled:opacity-60 inline-flex items-center gap-1.5"
              style={{ background: 'var(--marca)' }}>
              {ocupado && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {conteudo.acao}
            </button>
          )}
          <button onClick={dispensar} className="text-[11px] text-muted-foreground hover:text-foreground">
            Agora não
          </button>
        </div>
      </div>
    </div>
  )
}
