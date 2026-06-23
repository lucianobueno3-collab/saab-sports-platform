import { cn } from '@/lib/utils'

type Status = 'peak' | 'fit' | 'fresh' | 'tired' | 'overreaching'

const statusConfig: Record<Status, { label: string; className: string }> = {
  peak:        { label: 'Em Pico',      className: 'bg-[#00d084]/15 text-[#00d084] border-[#00d084]/30' },
  fit:         { label: 'Em Forma',     className: 'bg-[#0088ff]/15 text-[#0088ff] border-[#0088ff]/30' },
  fresh:       { label: 'Descansado',   className: 'bg-[#8b5cf6]/15 text-[#8b5cf6] border-[#8b5cf6]/30' },
  tired:       { label: 'Carga Alta',   className: 'bg-[#ffa800]/15 text-[#ffa800] border-[#ffa800]/30' },
  overreaching:{ label: 'Alerta Fadiga',className: 'bg-primary/15 text-primary border-primary/30' },
}

interface StatusBadgeProps {
  status: Status
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const cfg = statusConfig[status]
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border', cfg.className, className)}>
      {cfg.label}
    </span>
  )
}
