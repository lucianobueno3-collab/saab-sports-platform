'use client'

import { useEffect, useState } from 'react'
import { getPartners, type PartnerRow } from '@/lib/supabase/queries'
import { Loader2, ExternalLink } from 'lucide-react'

const RED = 'var(--marca)'

/** Faixa de parceiros (propaganda) para o Hoje e abaixo do Calendário.
 *  Visual limpo: só os logos em chips flutuantes, sem caixa e sem rótulo.
 *  Some se não houver parceiros. */
export function PartnersStrip() {
  const [partners, setPartners] = useState<PartnerRow[]>([])
  useEffect(() => { getPartners(true).then(setPartners).catch(() => {}) }, [])
  if (partners.length === 0) return null
  const open = (p: PartnerRow) => { if (p.url) window.open(p.url, '_blank', 'noopener') }
  return (
    <div className="flex flex-wrap justify-center items-center gap-3 sm:gap-4 py-2">
      {partners.map(p => (
        <button key={p.id} onClick={() => open(p)} disabled={!p.url} title={p.name}
          className="group flex-shrink-0 rounded-2xl bg-white flex items-center justify-center transition-all duration-200 hover:-translate-y-0.5 disabled:cursor-default"
          style={{ width: 148, height: 80, padding: 14, boxShadow: '0 4px 16px rgba(0,0,0,0.10)' }}>
          {p.logo_url
            ? <img src={p.logo_url} alt={p.name} className="max-h-full max-w-full object-contain transition-transform duration-200 group-hover:scale-105" />
            : <span className="text-lg font-black tracking-tight" style={{ color: RED }}>{p.name}</span>}
        </button>
      ))}
    </div>
  )
}

/** Vitrine de parceiros no portal do aluno (somente leitura). O cadastro é
 *  feito pelo admin. As imagens aparecem como propaganda, com link para o site. */
export function PartnersTab() {
  const [partners, setPartners] = useState<PartnerRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { getPartners(true).then(setPartners).finally(() => setLoading(false)) }, [])

  const open = (p: PartnerRow) => { if (p.url) window.open(p.url, '_blank', 'noopener') }

  if (loading) return <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin" /></div>

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {partners.length === 0 ? (
        <div className="rounded-2xl p-8 text-center text-sm text-muted-foreground" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          Em breve, condições especiais dos nossos parceiros.
        </div>
      ) : (
        <div className="space-y-4">
          {partners.map(p => (
            <button key={p.id} onClick={() => open(p)} disabled={!p.url}
              className="block w-full text-left rounded-2xl overflow-hidden transition-transform hover:scale-[1.01] disabled:cursor-default"
              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              {/* Imagem/propaganda em destaque */}
              {p.logo_url && (
                <div className="w-full flex items-center justify-center p-4" style={{ background: '#fff' }}>
                  <img src={p.logo_url} alt={p.name} className="max-h-40 w-auto object-contain" />
                </div>
              )}
              <div className="p-4 flex items-center gap-3">
                {!p.logo_url && (
                  <span className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-base font-black" style={{ background: 'var(--marca-18)', color: RED }}>{p.name.slice(0, 2).toUpperCase()}</span>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-black text-foreground flex items-center gap-1.5">{p.name} {p.url && <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />}</p>
                  {p.description && <p className="text-sm text-muted-foreground mt-0.5">{p.description}</p>}
                </div>
                {p.url && <span className="text-xs font-bold px-3 py-1.5 rounded-lg text-white flex-shrink-0" style={{ background: RED }}>Visitar</span>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
