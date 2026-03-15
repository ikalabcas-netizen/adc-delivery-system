import { cn } from '@/lib/utils'
import { STATUS_BADGE_CLASS, STATUS_LABELS } from '@/lib/utils'

interface BadgeProps {
  status: string
  className?: string
}

/** Order status badge with predetermined styling */
export function StatusBadge({ status, className }: BadgeProps) {
  return (
    <span className={cn(STATUS_BADGE_CLASS[status] ?? 'badge', className)}>
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

interface RoleBadgeProps {
  role: string
  className?: string
}

const ROLE_LABELS: Record<string, string>   = {
  super_admin: 'Super Admin',
  coordinator: 'Điều phối',
  sales:       'Kinh doanh',
  manager:     'Quản lý',
  delivery:    'Giao nhận',
}
const ROLE_COLORS: Record<string, string> = {
  super_admin: 'bg-violet-100 text-violet-700',
  coordinator: 'bg-adc-100 text-adc-700',
  sales:       'bg-green-100 text-green-700',
  manager:     'bg-amber-100 text-amber-700',
  delivery:    'bg-slate-100 text-slate-600',
}

export function RoleBadge({ role, className }: RoleBadgeProps) {
  return (
    <span className={cn('badge', ROLE_COLORS[role] ?? 'badge', className)}>
      {ROLE_LABELS[role] ?? role}
    </span>
  )
}
