'use client'

import { useEffect } from 'react'
import { getBrand, varsDaMarca, nomesDasVars, type BrandId } from '@/lib/portal-brands'

/**
 * Aplica a marca do aluno ao portal.
 *
 * O portal da Caqui Pro era uma tela separada (`/portal`), e por isso ficou
 * parada no tempo: nada do que foi feito no `/atleta` — ritmo em min/km,
 * treino estruturado, carga em palavras, recados, offline — chegava lá. Em vez
 * de manter dois portais, o `/atleta` passa a saber de marca.
 *
 * As variáveis vão no elemento raiz, e não num container: metade dos modais do
 * portal é renderizada por portal em `document.body`, e ficaria fora do escopo.
 * Ao sair do portal elas são removidas, e o padrão do `globals.css` — o
 * vermelho SAAB — volta a valer para as telas do treinador.
 *
 * A marca define o sotaque: cor de destaque, fonte de título e logo. O fundo
 * claro ou escuro continua sendo escolha do aluno — por isso a cor de destaque
 * é observada junto com o tema, e não fixada de uma vez.
 */
export function MarcaDoAluno({ brand }: { brand: BrandId | string | null | undefined }) {
  useEffect(() => {
    const raiz = document.documentElement
    const marca = getBrand(brand)

    const aplicar = () => {
      const vars = varsDaMarca(marca, raiz.classList.contains('dark'))
      for (const [k, v] of Object.entries(vars)) raiz.style.setProperty(k, v)
    }
    aplicar()

    // O ThemeToggle alterna a classe `dark` na raiz. Observar é mais simples e
    // mais confiável do que passar o tema por prop desde o topo do portal.
    const obs = new MutationObserver(aplicar)
    obs.observe(raiz, { attributes: true, attributeFilter: ['class'] })

    return () => {
      obs.disconnect()
      for (const k of nomesDasVars()) raiz.style.removeProperty(k)
    }
  }, [brand])

  return null
}
