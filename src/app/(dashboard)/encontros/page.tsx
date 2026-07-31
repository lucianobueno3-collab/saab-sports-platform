'use client'

import { Topbar } from '@/components/layout/topbar'
import { MeetupsTab } from '@/components/athlete/meetups-tab'

/** Encontros de treino da comunidade (visão do treinador). */
export default function EncontrosPage() {
  return (
    <div>
      <Topbar title="Treinar junto" subtitle="Encontros da comunidade — marque treinos coletivos e veja quem confirmou" />
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <MeetupsTab athleteId={null} />
      </div>
    </div>
  )
}
