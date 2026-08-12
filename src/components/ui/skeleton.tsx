/**
 * Esqueleto de carregamento — a forma da tela antes do conteúdo chegar.
 *
 * O app inteiro trocava o conteúdo por uma rodinha centralizada. Em conexão de
 * celular, mudar de aba era ver a tela esvaziar e voltar: a sensação é de
 * lentidão mesmo quando a resposta é rápida. Mostrar a estrutura desde o
 * primeiro instante muda a percepção sem tocar no banco.
 *
 * A animação respeita `prefers-reduced-motion` — para quem tem sensibilidade a
 * movimento, o bloco fica parado em vez de pulsar.
 */

export function Skeleton({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <span aria-hidden="true"
      className={`block rounded-md motion-safe:animate-pulse ${className}`}
      style={{ background: 'var(--secondary)', ...style }} />
  )
}

/** Envolve um esqueleto com o aviso certo para leitor de tela. */
export function Carregando({ children, rotulo = 'Carregando' }: { children: React.ReactNode; rotulo?: string }) {
  return (
    <div role="status" aria-busy="true" aria-label={rotulo}>
      {children}
    </div>
  )
}

/** Linhas de uma lista: um bloco por item, com o mesmo ritmo do conteúdo real. */
export function SkeletonLista({ linhas = 4, altura = 56 }: { linhas?: number; altura?: number }) {
  return (
    <Carregando>
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        {Array.from({ length: linhas }, (_, i) => (
          <div key={i} className="flex items-center gap-3 px-4"
            style={{ height: altura, borderTop: i ? '1px solid var(--border)' : undefined }}>
            <Skeleton className="w-9 h-9 rounded-full shrink-0" />
            <div className="flex-1 min-w-0 flex flex-col gap-1.5">
              <Skeleton className="h-3" style={{ width: `${45 + ((i * 17) % 35)}%` }} />
              <Skeleton className="h-2.5 w-1/4" />
            </div>
          </div>
        ))}
      </div>
    </Carregando>
  )
}

/** Grade de cartões — biblioteca de treinos, lista de alunos. */
export function SkeletonCartoes({ cartoes = 6, altura = 132 }: { cartoes?: number; altura?: number }) {
  return (
    <Carregando>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {Array.from({ length: cartoes }, (_, i) => (
          <div key={i} className="rounded-2xl p-4 flex flex-col gap-2.5"
            style={{ height: altura, background: 'var(--card)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2.5">
              <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
              <Skeleton className="h-3 flex-1" style={{ maxWidth: `${55 + ((i * 13) % 30)}%` }} />
            </div>
            <Skeleton className="h-2.5 w-1/3" />
            <Skeleton className="h-2.5 w-2/3 mt-auto" />
          </div>
        ))}
      </div>
    </Carregando>
  )
}

/**
 * O treino do dia e os próximos, na visão do aluno.
 *
 * É a primeira tela que ele vê ao abrir o app, então é a que mais importa não
 * piscar.
 */
export function SkeletonTreinosDoAluno() {
  return (
    <Carregando rotulo="Carregando seus treinos">
      <div className="space-y-3">
        <div className="rounded-2xl p-5 flex flex-col gap-3"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <Skeleton className="h-2.5 w-20" />
          <Skeleton className="h-5 w-3/5" />
          <Skeleton className="h-2.5 w-2/5" />
          <Skeleton className="h-2 w-full mt-1" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[0, 1].map(i => (
            <div key={i} className="rounded-2xl p-4 flex flex-col gap-2"
              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <Skeleton className="h-2.5 w-1/2" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          ))}
        </div>
      </div>
    </Carregando>
  )
}

/** A semana da equipe: uma linha por aluno, com os sete quadradinhos. */
export function SkeletonSemanaDaEquipe({ linhas = 5 }: { linhas?: number }) {
  return (
    <Carregando rotulo="Carregando a semana da equipe">
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="rounded-2xl p-4 flex flex-col gap-2.5"
              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <Skeleton className="h-2.5 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-2/5" />
            </div>
          ))}
        </div>
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="px-4 py-3 border-b border-border"><Skeleton className="h-3 w-40" /></div>
          {Array.from({ length: linhas }, (_, i) => (
            <div key={i} className="flex items-center gap-1 px-4 py-2"
              style={{ borderTop: i ? '1px solid var(--border)' : undefined }}>
              {/* O nome vai dentro de um container flexível para os quadradinhos
                  ficarem alinhados entre as linhas, como no conteúdo real. */}
              <span className="flex-1 min-w-0 pr-2">
                <Skeleton className="h-3" style={{ width: `${40 + ((i * 19) % 30)}%` }} />
              </span>
              {Array.from({ length: 7 }, (_, d) => (
                <span key={d} className="w-8 flex justify-center"><Skeleton className="w-5 h-5 rounded-md" /></span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </Carregando>
  )
}
