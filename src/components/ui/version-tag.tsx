'use client'

import { useEffect, useState } from 'react'
import { APP_VERSION, formatBuildTime } from '@/lib/version'

// Versão + data/hora da última atualização (deploy). A data é formatada no
// cliente (fuso do usuário) para evitar divergência de hidratação.
export function VersionTag({ className, prefix }: { className?: string; prefix?: string }) {
  const [when, setWhen] = useState('')
  useEffect(() => { setWhen(formatBuildTime()) }, [])
  return (
    <p className={className ?? 'text-[10px] text-muted-foreground/60'}>
      {prefix ?? ''}v{APP_VERSION}{when ? ` · atualizado em ${when}` : ''}
    </p>
  )
}
