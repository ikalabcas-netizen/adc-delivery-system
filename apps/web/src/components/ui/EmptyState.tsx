import { ReactNode } from 'react'
import { PackageOpen } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  title:    string
  subtitle?: string
  action?:  ReactNode
  icon?:    ReactNode
  className?: string
}

export function EmptyState({ title, subtitle, action, icon, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 text-center', className)}>
      <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-4">
        {icon ?? <PackageOpen size={22} className="text-slate-400" />}
      </div>
      <h3 className="text-sm font-semibold text-slate-700 mb-1">{title}</h3>
      {subtitle && <p className="text-sm text-slate-400 max-w-xs mb-4">{subtitle}</p>}
      {action}
    </div>
  )
}
