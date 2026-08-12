'use client'

import { useEffect, useRef, useState } from 'react'
import type { Brand } from '@/lib/portal-brands'

/**
 * A marca no topo do portal do aluno.
 *
 * Cai no wordmark tipográfico quando não há arquivo de logo — é o caso do SAAB,
 * que não usa imagem aqui, e também o resgate para quando o arquivo ainda não
 * foi colocado em `/public`. Sem isso, um logo faltando deixaria o ícone de
 * imagem quebrada no lugar mais visível da tela.
 */
export function MarcaLogo({ brand, altura = 34 }: { brand: Brand; altura?: number }) {
  // O logo da Caqui é um lockup vertical (o caqui em cima, "CAQUI PRO" embaixo).
  // Num slot de 38px o texto ficaria ilegível, então ele ganha mais altura.
  const alturaReal = brand.logoSrc ? Math.round(altura * 1.7) : altura
  const [falhou, setFalhou] = useState(false)
  const img = useRef<HTMLImageElement>(null)

  /*
   * O `onError` do React não basta aqui. Isto é exportação estática: o HTML já
   * chega com a <img>, o navegador tenta carregar e falha ANTES de o React
   * hidratar e pendurar o handler — o evento se perde e fica o ícone quebrado.
   * Conferir `naturalWidth` na montagem pega o caso que passou batido.
   */
  useEffect(() => {
    const el = img.current
    if (el && el.complete && el.naturalWidth === 0) setFalhou(true)
  }, [brand.logoSrc])

  if (brand.logoSrc && !falhou) {
    return (
      // Sem next/image de propósito: a marca é escolhida em tempo de execução, e
      // o otimizador do Next não roda em exportação estática.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        ref={img}
        src={brand.logoSrc}
        alt={brand.name}
        style={{ height: alturaReal }}
        className="w-auto object-contain"
        onError={() => setFalhou(true)}
      />
    )
  }

  return (
    <span className="block leading-none">
      <span className="block text-lg tracking-tight text-foreground"
        style={{ fontFamily: brand.headingFont, fontWeight: 900 }}>
        {brand.id === 'caqui'
          ? <>CAQUI<span style={{ color: 'var(--marca)' }}> PRO</span></>
          : brand.name}
      </span>
      <span className="block text-[9px] uppercase tracking-[0.18em] mt-1"
        style={{ color: 'var(--marca)', fontFamily: brand.headingFont, fontWeight: 700 }}>
        {brand.tagline}
      </span>
    </span>
  )
}
