import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

interface KpiCardProps {
  label: string
  value: string | number
  sub?: string
  delta?: string
  deltaUp?: boolean
  icon?: LucideIcon
  color?: 'red' | 'green' | 'blue' | 'yellow' | 'purple' | 'default'
  className?: string
  onClick?: () => void
}

const colorMap = {
  red:    { value: 'text-primary',          border: 'border-primary/30',   icon: 'text-primary',        bg: 'bg-primary/10' },
  green:  { value: 'text-[#00d084]',        border: 'border-[#00d084]/30', icon: 'text-[#00d084]',      bg: 'bg-[#00d084]/10' },
  blue:   { value: 'text-[#0088ff]',        border: 'border-[#0088ff]/30', icon: 'text-[#0088ff]',      bg: 'bg-[#0088ff]/10' },
  yellow: { value: 'text-[#ffa800]',        border: 'border-[#ffa800]/30', icon: 'text-[#ffa800]',      bg: 'bg-[#ffa800]/10' },
  purple: { value: 'text-[#8b5cf6]',        border: 'border-[#8b5cf6]/30', icon: 'text-[#8b5cf6]',      bg: 'bg-[#8b5cf6]/10' },
  default:{ value: 'text-foreground',        border: 'border-border',       icon: 'text-muted-foreground',bg: 'bg-secondary' },
}

export function KpiCard({ label, value, sub, delta, deltaUp, icon: Icon, color = 'default', className, onClick }: KpiCardProps) {
  const c = colorMap[color]
  return (
    <div
      className={cn('rounded-xl border bg-card p-4 transition-colors', c.border, className, onClick && 'cursor-pointer hover:bg-secondary/50')}
      onClick={onClick}
      title={onClick ? 'Clique para ver detalhes do cálculo' : undefined}
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
        <div className="flex items-center gap-1.5">
          {onClick && <span className="text-[8px] text-muted-foreground/40 font-medium">ⓘ</span>}
          {Icon && (
            <span className={cn('p-1.5 rounded-lg', c.bg)}>
              <Icon className={cn('w-3.5 h-3.5', c.icon)} />
            </span>
          )}
        </div>
      </div>
      <p className={cn('text-2xl font-extrabold leading-none', c.value)}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-1.5">{sub}</p>}
      {delta && (
        <p className={cn('text-[10px] font-semibold mt-1', deltaUp ? 'text-[#00d084]' : 'text-primary')}>
          {deltaUp ? '↑' : '↓'} {delta}
        </p>
      )}
    </div>
  )
}
